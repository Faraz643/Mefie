import AsyncStorage from "@react-native-async-storage/async-storage";
import { File } from "expo-file-system";
import * as ImageManipulator from "expo-image-manipulator";
import * as FileSystem from "expo-file-system/legacy";
import { AppState, AppStateStatus } from "react-native";
import { ensureAnonymousAuth, supabase } from "./app-context";

const QUEUE_KEY = "mefie.photoUploadQueue.v1";
const PHOTO_BUCKET = "photos";
const MAX_ATTEMPTS = 8;
const MAX_PHOTO_BYTES = 15 * 1024 * 1024;
const MAX_THUMBNAIL_DIMENSION = 600;
const THUMBNAIL_COMPRESSION = 0.75;
const CONCURRENCY = 1;
const CAPTURE_IDLE_DELAY_MS = 1200;
const RETRY_DELAYS = [1500, 3000, 7000, 15000, 30000, 60000, 120000, 300000];

export type PhotoUploadJob = {
  id: string;
  eventId: string;
  participantId: string;
  uri: string;
  width: number | null;
  height: number | null;
  createdAt: number;
  attempts: number;
  nextAttemptAt: number;
  status: "queued" | "uploading" | "failed";
  error?: string;
};

export type PhotoQueueSummary = {
  queued: number;
  uploading: number;
  failed: number;
  lastError: string | null;
};

let jobs: PhotoUploadJob[] = [];
let loaded = false;
let loadingPromise: Promise<void> | null = null;
let processing = false;
let timer: ReturnType<typeof setTimeout> | null = null;
let processingDelayTimer: ReturnType<typeof setTimeout> | null = null;
let processingNotBefore = 0;
let appStateSubscription: { remove: () => void } | null = null;
const listeners = new Set<() => void>();
let persistChain = Promise.resolve();
let notifyTimer: ReturnType<typeof setTimeout> | null = null;

function notify() {
  if (notifyTimer) return;
  notifyTimer = setTimeout(() => {
    notifyTimer = null;
    for (const listener of listeners) listener();
  }, 0);
}

async function loadQueue() {
  if (loaded) return;
  if (loadingPromise) return loadingPromise;

  loadingPromise = (async () => {
    try {
      const raw = await AsyncStorage.getItem(QUEUE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          jobs = parsed
            .filter((job) => job?.id && job?.eventId && job?.participantId && job?.uri)
            .map((job) => ({
              ...job,
              status: job.status === "failed" ? "failed" : "queued",
              nextAttemptAt: Math.min(job.nextAttemptAt || Date.now(), Date.now()),
            }));
        }
      }
    } catch {
      jobs = [];
    } finally {
      loaded = true;
      loadingPromise = null;
      notify();
    }
  })();

  return loadingPromise;
}

function persistQueue() {
  const snapshot = JSON.stringify(jobs);
  persistChain = persistChain
    .then(() => AsyncStorage.setItem(QUEUE_KEY, snapshot))
    .then(() => notify());
  return persistChain;
}

function durableUri(job: PhotoUploadJob) {
  if (!FileSystem.documentDirectory) return null;
  return `${FileSystem.documentDirectory}mefie-pending/${job.id}.jpg`;
}

async function ensureDurableFile(job: PhotoUploadJob) {
  const target = durableUri(job);
  if (!target) return job.uri;

  const targetInfo = await FileSystem.getInfoAsync(target);
  if (targetInfo.exists) return target;

  const directory = `${FileSystem.documentDirectory}mefie-pending`;
  const directoryInfo = await FileSystem.getInfoAsync(directory);
  if (!directoryInfo.exists) {
    await FileSystem.makeDirectoryAsync(directory, { intermediates: true });
  }

  await FileSystem.copyAsync({ from: job.uri, to: target });
  return target;
}

async function removeDurableFile(job: PhotoUploadJob) {
  const target = durableUri(job);
  if (target) {
    await FileSystem.deleteAsync(target, { idempotent: true }).catch(() => undefined);
  }
}

async function cleanupFailedStorageObjects(job: PhotoUploadJob) {
  if (!supabase) return;

  const originalPath = `${job.eventId}/${job.id}.jpg`;
  const thumbnailPath = `${job.eventId}/${job.id}.thumb.jpg`;

  const { data: photoRow } = await supabase
    .from("photos")
    .select("id")
    .eq("client_upload_id", job.id)
    .maybeSingle();

  // Never delete the original after the DB row exists. The photo can safely
  // fall back to its original while the thumbnail is repaired later.
  const paths = photoRow?.id
    ? [thumbnailPath]
    : [originalPath, thumbnailPath];

  await supabase.storage
    .from(PHOTO_BUCKET)
    .remove(paths)
    .catch(() => undefined);
}

async function createThumbnail(localUri: string, job: PhotoUploadJob) {
  const width = job.width ?? null;
  const height = job.height ?? null;

  let resize: { width?: number; height?: number };
  if (width && height) {
    const scale = Math.min(1, MAX_THUMBNAIL_DIMENSION / Math.max(width, height));
    resize = {
      width: Math.max(1, Math.round(width * scale)),
      height: Math.max(1, Math.round(height * scale)),
    };
  } else {
    resize = { width: MAX_THUMBNAIL_DIMENSION };
  }

  const result = await ImageManipulator.manipulateAsync(localUri, [{ resize }], {
    compress: THUMBNAIL_COMPRESSION,
    format: ImageManipulator.SaveFormat.JPEG,
  });

  const thumbnailFile = new File(result.uri);
  if (!thumbnailFile.exists || !thumbnailFile.size) {
    throw new Error("Could not create the gallery thumbnail.");
  }

  return { uri: result.uri, size: thumbnailFile.size };
}
function summaryFor(eventId?: string): PhotoQueueSummary {
  const scoped = eventId ? jobs.filter((job) => job.eventId === eventId) : jobs;
  const withErrors = scoped
    .filter((job) => job.error)
    .sort((a, b) => b.createdAt - a.createdAt);
  return {
    queued: scoped.filter((job) => job.status === "queued").length,
    uploading: scoped.filter((job) => job.status === "uploading").length,
    failed: scoped.filter((job) => job.status === "failed").length,
    lastError: withErrors[0]?.error ?? null,
  };
}

async function processJob(jobId: string) {
  const job = jobs.find((item) => item.id === jobId);
  if (!job || job.status === "failed") return;

  job.status = "uploading";
  notify();

  try {
    if (!supabase) throw new Error("Cloud connection is not configured.");

    const userId = await ensureAnonymousAuth();
    if (!userId) throw new Error("Mefie authentication is unavailable.");

    const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
    if (sessionError) throw new Error(`Authentication session error: ${sessionError.message}`);
    if (!sessionData.session?.access_token) {
      throw new Error("Mefie has no active authentication session. Please reconnect.");
    }

    const { data: membership, error: membershipError } = await supabase
      .from("participants")
      .select("id,auth_user_id,event_id")
      .eq("id", job.participantId)
      .eq("event_id", job.eventId)
      .maybeSingle();
    if (membershipError) throw new Error(`Membership check failed: ${membershipError.message}`);
    if (!membership) throw new Error("Your event membership is missing. Reconnect to this event and try again.");
    if (membership.auth_user_id !== userId) {
      throw new Error("This event membership belongs to a different Mefie session.");
    }

    const localUri = await ensureDurableFile(job);
    const info = await FileSystem.getInfoAsync(localUri);
    if (!info.exists) throw new Error("The captured photo is no longer available on this device.");

    const file = new File(localUri);
    const fileSize = file.size;
    if (!fileSize || fileSize <= 0) throw new Error("The captured photo is empty.");
    if (fileSize > MAX_PHOTO_BYTES) {
      throw new Error("Photo is too large. Please capture a smaller image.");
    }

    // Read the JPEG directly as binary. This avoids the previous base64 string
    // + decode() path and removes a large temporary JS string from memory.
    const body = await file.arrayBuffer();
    if (!body.byteLength) throw new Error("Could not read the captured photo.");

    const path = `${job.eventId}/${job.id}.jpg`;
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from(PHOTO_BUCKET)
      .upload(path, body, {
        contentType: "image/jpeg",
        upsert: false,
        cacheControl: "3600",
      });

    if (uploadError && !/already exists|duplicate/i.test(uploadError.message)) {
      const status = (uploadError as any)?.statusCode ?? (uploadError as any)?.status ?? "unknown";
      const code = (uploadError as any)?.name ?? (uploadError as any)?.code ?? "unknown";
      throw new Error(`Photo storage upload failed (status=${status}, code=${code}): ${uploadError.message}`);
    }
    if (!uploadData && uploadError) {
      throw new Error(`Photo storage upload failed: ${uploadError.message}`);
    }

    const thumbnail = await createThumbnail(localUri, job);
    const thumbnailPath = `${job.eventId}/${job.id}.thumb.jpg`;
    try {
      const thumbnailBody = await new File(thumbnail.uri).arrayBuffer();
      const { error: thumbnailUploadError } = await supabase.storage
        .from(PHOTO_BUCKET)
        .upload(thumbnailPath, thumbnailBody, {
          contentType: "image/jpeg",
          upsert: false,
          cacheControl: "86400",
        });
      if (thumbnailUploadError && !/already exists|duplicate/i.test(thumbnailUploadError.message)) {
        throw new Error(`Gallery thumbnail upload failed: ${thumbnailUploadError.message}`);
      }
    } finally {
      await FileSystem.deleteAsync(thumbnail.uri, { idempotent: true }).catch(() => undefined);
    }

    const { data: photoId, error: finalizeError } = await supabase.rpc(
      "finalize_photo_upload",
      {
        p_client_upload_id: job.id,
        p_event_id: job.eventId,
        p_participant_id: job.participantId,
        p_storage_path: path,
        p_original_filename: `mefie-${job.id}.jpg`,
        p_file_size: body.byteLength,
        p_width: job.width,
        p_height: job.height,
      },
    );

    if (finalizeError) throw new Error(finalizeError.message);
    if (!photoId) throw new Error("Photo metadata could not be finalized.");

    const { data: thumbnailLinked, error: thumbnailLinkError } = await supabase.rpc(
      "set_photo_thumbnail",
      { p_photo_id: photoId, p_thumbnail_path: thumbnailPath },
    );
    if (thumbnailLinkError) throw new Error(thumbnailLinkError.message);
    if (!thumbnailLinked) throw new Error("Gallery thumbnail could not be linked.");

    jobs = jobs.filter((item) => item.id !== job.id);
    await persistQueue();
    await removeDurableFile(job);
  } catch (error: any) {
    const message = error?.message || String(error) || "Photo upload failed.";
    const current = jobs.find((item) => item.id === job.id);
    if (!current) return;

    current.attempts += 1;
    current.status = current.attempts >= MAX_ATTEMPTS ? "failed" : "queued";
    current.error = message;
    current.nextAttemptAt =
      Date.now() + (RETRY_DELAYS[Math.min(current.attempts - 1, RETRY_DELAYS.length - 1)] || 300000);

    if (current.status === "failed") {
      // Once retries are exhausted, clean up the deterministic Storage object
      // if a previous attempt created it without a corresponding DB row.
      await cleanupFailedStorageObjects(current);
    }

    await persistQueue();
  }
}

async function processQueue() {
  await loadQueue();
  if (processing || !supabase || AppState.currentState !== "active") return;

  const waitForCaptureBurst = processingNotBefore - Date.now();
  if (waitForCaptureBurst > 0) {
    if (processingDelayTimer) clearTimeout(processingDelayTimer);
    processingDelayTimer = setTimeout(() => {
      processingDelayTimer = null;
      void processQueue();
    }, waitForCaptureBurst);
    return;
  }

  processing = true;
  try {
    const available = jobs
      .filter((job) => job.status === "queued" && job.nextAttemptAt <= Date.now())
      .slice(0, CONCURRENCY);

    if (available.length) {
      await Promise.all(available.map((job) => processJob(job.id)));
    }
  } finally {
    processing = false;
    scheduleNext();
  }
}

function scheduleNext() {
  if (timer) clearTimeout(timer);
  const next = jobs
    .filter((job) => job.status === "queued")
    .reduce<number | null>(
      (soonest, job) => (soonest === null ? job.nextAttemptAt : Math.min(soonest, job.nextAttemptAt)),
      null,
    );

  if (next === null) return;
  const delay = Math.max(250, Math.min(next - Date.now(), 30000));
  timer = setTimeout(() => {
    timer = null;
    void processQueue();
  }, delay);
}

export async function startPhotoUploadQueue() {
  await loadQueue();
  processingNotBefore = 0;

  if (!appStateSubscription) {
    appStateSubscription = AppState.addEventListener("change", (state: AppStateStatus) => {
      if (state === "active") void processQueue();
    });
  }

  void processQueue();
}

export async function enqueuePhotoUpload(
  input: Omit<PhotoUploadJob, "createdAt" | "attempts" | "nextAttemptAt" | "status">,
) {
  await loadQueue();

  const job: PhotoUploadJob = {
    ...input,
    createdAt: Date.now(),
    attempts: 0,
    nextAttemptAt: Date.now(),
    status: "queued",
  };

  job.uri = await ensureDurableFile(job);
  jobs.push(job);
  await persistQueue();

  processingNotBefore = Math.max(processingNotBefore, Date.now() + CAPTURE_IDLE_DELAY_MS);
  if (processingDelayTimer) clearTimeout(processingDelayTimer);
  processingDelayTimer = setTimeout(() => {
    processingDelayTimer = null;
    void processQueue();
  }, CAPTURE_IDLE_DELAY_MS);
}

export async function deferPhotoUploads(delayMs = CAPTURE_IDLE_DELAY_MS) {
  await loadQueue();
  processingNotBefore = Math.max(processingNotBefore, Date.now() + delayMs);
  if (processingDelayTimer) clearTimeout(processingDelayTimer);
  processingDelayTimer = setTimeout(() => {
    processingDelayTimer = null;
    void processQueue();
  }, Math.max(0, processingNotBefore - Date.now()));
}

export async function retryFailedPhotoUploads(eventId?: string) {
  await loadQueue();
  const now = Date.now();

  for (const job of jobs) {
    if (job.status === "failed" && (!eventId || job.eventId === eventId)) {
      job.status = "queued";
      job.attempts = 0;
      job.nextAttemptAt = now;
      delete job.error;
    }
  }

  await persistQueue();
  void processQueue();
}

export function getPhotoQueueSummary(eventId?: string): PhotoQueueSummary {
  return summaryFor(eventId);
}

export function subscribePhotoUploadQueue(listener: () => void) {
  listeners.add(listener);
  void loadQueue();
  return () => listeners.delete(listener);
}

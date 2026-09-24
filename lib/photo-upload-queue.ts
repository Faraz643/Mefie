import AsyncStorage from "@react-native-async-storage/async-storage";
import { File } from "expo-file-system";
import * as ImageManipulator from "expo-image-manipulator";
import * as FileSystem from "expo-file-system/legacy";
import { AppState, AppStateStatus, Image as RNImage } from "react-native";
import { ensureAnonymousAuth, supabase } from "./app-context";

const QUEUE_KEY = "mefie.photoUploadQueue.v1";
const PHOTO_BUCKET = "photos";
const MAX_ATTEMPTS = 8;
const MAX_PHOTO_BYTES = 15 * 1024 * 1024;
const MAX_SOURCE_BYTES = 40 * 1024 * 1024;
const MAX_UPLOAD_DIMENSION = 4096;
const FALLBACK_UPLOAD_DIMENSION = 3072;
const FINAL_UPLOAD_DIMENSION = 2560;
const MAX_UNCOMPRESSED_UPLOAD_BYTES = 8 * 1024 * 1024;
const MAX_THUMBNAIL_DIMENSION = 600;
const THUMBNAIL_COMPRESSION = 0.75;
const UPLOAD_JPEG_COMPRESSION = 0.9;
const FALLBACK_JPEG_COMPRESSION = 0.88;
const FINAL_JPEG_COMPRESSION = 0.85;
const CONCURRENCY = 1;
const CAPTURE_IDLE_DELAY_MS = 1200;
const RETRY_DELAYS = [1500, 3000, 7000, 15000, 30000, 60000, 120000, 300000];

type PhotoDimensions = { width: number; height: number };
type PreparedUpload = { uri: string; size: number; cleanup: () => Promise<void> };

export type PhotoUploadJob = {
  id: string;
  eventId: string;
  participantId: string;
  uri: string;
  width: number | null;
  height: number | null;
  mimeType?: string | null;
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
              attempts: Number.isFinite(job.attempts) ? Math.max(0, job.attempts) : 0,
              nextAttemptAt: Number.isFinite(job.nextAttemptAt) ? job.nextAttemptAt : Date.now(),
              width: Number.isFinite(job.width) && job.width > 0 ? job.width : null,
              height: Number.isFinite(job.height) && job.height > 0 ? job.height : null,
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
  if (!directoryInfo.exists) await FileSystem.makeDirectoryAsync(directory, { intermediates: true });
  await FileSystem.copyAsync({ from: job.uri, to: target });
  return target;
}

async function removeDurableFile(job: PhotoUploadJob) {
  const target = durableUri(job);
  if (target) await FileSystem.deleteAsync(target, { idempotent: true }).catch(() => undefined);
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

  const paths = photoRow?.id ? [thumbnailPath] : [originalPath, thumbnailPath];
  await supabase.storage.from(PHOTO_BUCKET).remove(paths).catch(() => undefined);
}

function isAlreadyExistsError(error: unknown) {
  const message = String((error as any)?.message ?? error ?? "");
  const name = String((error as any)?.name ?? "");
  const status = String((error as any)?.statusCode ?? (error as any)?.status ?? "");
  return /already exists|duplicate|resource already exists|object already exists/i.test(`${message} ${name} ${status}`);
}

function imageDimensions(uri: string): Promise<PhotoDimensions> {
  return new Promise((resolve, reject) => {
    RNImage.getSize(
      uri,
      (width, height) => {
        if (Number.isFinite(width) && width > 0 && Number.isFinite(height) && height > 0) {
          resolve({ width: Math.round(width), height: Math.round(height) });
        } else {
          reject(new Error("The captured photo has invalid dimensions."));
        }
      },
      (message) => reject(new Error(message || "Could not read photo dimensions.")),
    );
  });
}

async function resolveDimensions(localUri: string, job: PhotoUploadJob) {
  if (job.width && job.height && job.width > 0 && job.height > 0) return { width: job.width, height: job.height };
  const dimensions = await imageDimensions(localUri);
  job.width = dimensions.width;
  job.height = dimensions.height;
  await persistQueue();
  return dimensions;
}

function sourceIsJpeg(job: PhotoUploadJob, uri: string) {
  const mimeType = job.mimeType?.toLowerCase() ?? "";
  if (mimeType) return mimeType === "image/jpeg" || mimeType === "image/jpg";
  return /\.(jpe?g)(?:[?#].*)?$/i.test(uri);
}

function resizeForDimension(dimensions: PhotoDimensions, maxDimension: number) {
  const scale = Math.min(1, maxDimension / Math.max(dimensions.width, dimensions.height));
  return {
    width: Math.max(1, Math.round(dimensions.width * scale)),
    height: Math.max(1, Math.round(dimensions.height * scale)),
  };
}

async function createOptimizedJpeg(localUri: string, dimensions: PhotoDimensions, maxDimension: number, compression: number) {
  const resize = resizeForDimension(dimensions, maxDimension);
  const result = await ImageManipulator.manipulateAsync(
    localUri,
    [{ resize }],
    { compress: compression, format: ImageManipulator.SaveFormat.JPEG },
  );
  const file = new File(result.uri);
  if (!file.exists || !file.size) {
    await FileSystem.deleteAsync(result.uri, { idempotent: true }).catch(() => undefined);
    throw new Error("Could not prepare the photo for upload.");
  }
  return { uri: result.uri, size: file.size };
}

async function prepareUploadJpeg(localUri: string, job: PhotoUploadJob, dimensions: PhotoDimensions, sourceSize: number): Promise<PreparedUpload> {
  const needsOptimization =
    !sourceIsJpeg(job, localUri) ||
    sourceSize > MAX_UNCOMPRESSED_UPLOAD_BYTES ||
    Math.max(dimensions.width, dimensions.height) > MAX_UPLOAD_DIMENSION;

  if (!needsOptimization) {
    return { uri: localUri, size: sourceSize, cleanup: async () => undefined };
  }

  const generated: string[] = [];
  try {
    let candidate = await createOptimizedJpeg(localUri, dimensions, MAX_UPLOAD_DIMENSION, UPLOAD_JPEG_COMPRESSION);
    generated.push(candidate.uri);

    if (candidate.size > MAX_PHOTO_BYTES) {
      candidate = await createOptimizedJpeg(localUri, dimensions, FALLBACK_UPLOAD_DIMENSION, FALLBACK_JPEG_COMPRESSION);
      generated.push(candidate.uri);
    }

    if (candidate.size > MAX_PHOTO_BYTES) {
      candidate = await createOptimizedJpeg(localUri, dimensions, FINAL_UPLOAD_DIMENSION, FINAL_JPEG_COMPRESSION);
      generated.push(candidate.uri);
    }

    if (candidate.size > MAX_PHOTO_BYTES) {
      throw new Error("Photo is too large after optimization. Please choose a smaller photo.");
    }

    const finalUri = candidate.uri;
    return {
      uri: finalUri,
      size: candidate.size,
      cleanup: async () => {
        await Promise.all(generated.map((uri) => FileSystem.deleteAsync(uri, { idempotent: true }).catch(() => undefined)));
      },
    };
  } catch (error) {
    await Promise.all(generated.map((uri) => FileSystem.deleteAsync(uri, { idempotent: true }).catch(() => undefined)));
    throw error;
  }
}

async function createThumbnail(localUri: string, dimensions: PhotoDimensions) {
  const resize = resizeForDimension(dimensions, MAX_THUMBNAIL_DIMENSION);
  const result = await ImageManipulator.manipulateAsync(
    localUri,
    [{ resize }],
    { compress: THUMBNAIL_COMPRESSION, format: ImageManipulator.SaveFormat.JPEG },
  );
  const thumbnailFile = new File(result.uri);
  if (!thumbnailFile.exists || !thumbnailFile.size) {
    await FileSystem.deleteAsync(result.uri, { idempotent: true }).catch(() => undefined);
    throw new Error("Could not create the gallery thumbnail.");
  }
  return { uri: result.uri, size: thumbnailFile.size };
}

async function uploadLocalFile(path: string, localUri: string, contentType: string, cacheControl: string) {
  // React Native Storage uploads require an ArrayBuffer. Keep this buffer scoped
  // to this function so the original and thumbnail buffers are never retained together.
  const file = new File(localUri);
  const body = await file.arrayBuffer();
  if (!body.byteLength) throw new Error("Could not read the photo for upload.");

  const { data, error } = await supabase!.storage.from(PHOTO_BUCKET).upload(path, body, {
    contentType,
    upsert: false,
    cacheControl,
  });

  if (error && !isAlreadyExistsError(error)) {
    const status = (error as any)?.statusCode ?? (error as any)?.status ?? "unknown";
    const code = (error as any)?.name ?? (error as any)?.code ?? "unknown";
    throw new Error(`Photo storage upload failed (status=${status}, code=${code}): ${error.message}`);
  }

  return { data, size: body.byteLength };
}

function summaryFor(eventId?: string): PhotoQueueSummary {
  const scoped = eventId ? jobs.filter((job) => job.eventId === eventId) : jobs;
  const withErrors = scoped.filter((job) => job.error).sort((a, b) => b.createdAt - a.createdAt);
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

  let uploadSourceCleanup: () => Promise<void> = async () => undefined;
  try {
    if (!supabase) throw new Error("Cloud connection is not configured.");

    const userId = await ensureAnonymousAuth();
    if (!userId) throw new Error("Mefie authentication is unavailable.");

    const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
    if (sessionError) throw new Error(`Authentication session error: ${sessionError.message}`);
    if (!sessionData.session?.access_token) throw new Error("Mefie has no active authentication session. Please reconnect.");

    const { data: membership, error: membershipError } = await supabase
      .from("participants")
      .select("id,auth_user_id,event_id")
      .eq("id", job.participantId)
      .eq("event_id", job.eventId)
      .maybeSingle();
    if (membershipError) throw new Error(`Membership check failed: ${membershipError.message}`);
    if (!membership) throw new Error("Your event membership is missing. Reconnect to this event and try again.");
    if (membership.auth_user_id !== userId) throw new Error("This event membership belongs to a different Mefie session.");

    const localUri = await ensureDurableFile(job);
    const info = await FileSystem.getInfoAsync(localUri);
    if (!info.exists) throw new Error("The captured photo is no longer available on this device.");

    const originalFile = new File(localUri);
    const originalSize = originalFile.size;
    if (!originalSize || originalSize <= 0) throw new Error("The captured photo is empty.");
    if (originalSize > MAX_SOURCE_BYTES) throw new Error("This photo is too large to process on this device.");

    const dimensions = await resolveDimensions(localUri, job);
    const prepared = await prepareUploadJpeg(localUri, job, dimensions, originalSize);
    uploadSourceCleanup = prepared.cleanup;

    const path = `${job.eventId}/${job.id}.jpg`;
    const uploadResult = await uploadLocalFile(path, prepared.uri, "image/jpeg", "3600");

    const thumbnail = await createThumbnail(prepared.uri, dimensions);
    const thumbnailPath = `${job.eventId}/${job.id}.thumb.jpg`;
    try {
      await uploadLocalFile(thumbnailPath, thumbnail.uri, "image/jpeg", "86400");
    } finally {
      await FileSystem.deleteAsync(thumbnail.uri, { idempotent: true }).catch(() => undefined);
    }

    const { data: photoId, error: finalizeError } = await supabase.rpc("finalize_photo_upload", {
      p_client_upload_id: job.id,
      p_event_id: job.eventId,
      p_participant_id: job.participantId,
      p_storage_path: path,
      p_original_filename: `mefie-${job.id}.jpg`,
      p_file_size: uploadResult.size,
      p_width: dimensions.width,
      p_height: dimensions.height,
    });

    if (finalizeError) throw new Error(finalizeError.message);
    if (!photoId) throw new Error("Photo metadata could not be finalized.");

    const { data: thumbnailLinked, error: thumbnailLinkError } = await supabase.rpc("set_photo_thumbnail", {
      p_photo_id: photoId,
      p_thumbnail_path: thumbnailPath,
    });
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
    current.nextAttemptAt = Date.now() + (RETRY_DELAYS[Math.min(current.attempts - 1, RETRY_DELAYS.length - 1)] || 300000);

    if (current.status === "failed") await cleanupFailedStorageObjects(current);
    await persistQueue();
  } finally {
    await uploadSourceCleanup();
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
    if (available.length) await Promise.all(available.map((job) => processJob(job.id)));
  } finally {
    processing = false;
    scheduleNext();
  }
}

function scheduleNext() {
  if (timer) clearTimeout(timer);
  const next = jobs
    .filter((job) => job.status === "queued")
    .reduce<number | null>((soonest, job) => (soonest === null ? job.nextAttemptAt : Math.min(soonest, job.nextAttemptAt)), null);
  if (next === null) return;

  const delay = Math.max(250, Math.min(Math.max(0, next - Date.now()), 30000));
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

export async function enqueuePhotoUpload(input: Omit<PhotoUploadJob, "createdAt" | "attempts" | "nextAttemptAt" | "status">) {
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

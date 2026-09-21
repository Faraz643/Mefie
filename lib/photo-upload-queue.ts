import AsyncStorage from "@react-native-async-storage/async-storage";
import * as FileSystem from "expo-file-system/legacy";
import { AppState, AppStateStatus } from "react-native";
import { supabase } from "./app-context";

const QUEUE_KEY = "mefie.photoUploadQueue.v1";
const PHOTO_BUCKET = "photos";
const MAX_ATTEMPTS = 8;
const CONCURRENCY = 2;
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
};

let jobs: PhotoUploadJob[] = [];
let loaded = false;
let loadingPromise: Promise<void> | null = null;
let processing = false;
let timer: ReturnType<typeof setTimeout> | null = null;
let appStateSubscription: { remove: () => void } | null = null;
const listeners = new Set<() => void>();

function notify() {
  for (const listener of listeners) listener();
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
          jobs = parsed.filter((job) => job?.id && job?.eventId && job?.participantId && job?.uri);
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

async function persistQueue() {
  await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(jobs));
  notify();
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

function summaryFor(eventId?: string): PhotoQueueSummary {
  const scoped = eventId ? jobs.filter((job) => job.eventId === eventId) : jobs;
  return {
    queued: scoped.filter((job) => job.status === "queued").length,
    uploading: scoped.filter((job) => job.status === "uploading").length,
    failed: scoped.filter((job) => job.status === "failed").length,
  };
}

async function processJob(jobId: string) {
  const job = jobs.find((item) => item.id === jobId);
  if (!job || job.status === "failed") return;

  job.status = "uploading";
  await persistQueue();

  try {
    if (!supabase) throw new Error("Cloud connection is not configured.");

    const localUri = await ensureDurableFile(job);
    const info = await FileSystem.getInfoAsync(localUri);
    if (!info.exists) throw new Error("The captured photo is no longer available on this device.");

    const base64 = await FileSystem.readAsStringAsync(localUri, {
      encoding: FileSystem.EncodingType.Base64,
    });
    if (!base64) throw new Error("Could not read the captured photo.");

    const { decode } = await import("base64-arraybuffer");
    const body = decode(base64);
    const path = `${job.eventId}/${job.id}.jpg`;

    const { error: uploadError } = await supabase.storage
      .from(PHOTO_BUCKET)
      .upload(path, body, {
        contentType: "image/jpeg",
        upsert: false,
        cacheControl: "3600",
      });

    // A previous attempt may have reached storage before the network response was lost.
    // The deterministic path lets us safely continue to the idempotent DB write.
    if (uploadError && !/already exists|duplicate/i.test(uploadError.message)) {
      throw new Error(uploadError.message);
    }

    const { data: urlData } = supabase.storage.from(PHOTO_BUCKET).getPublicUrl(path);
    const { error: insertError } = await supabase.from("photos").upsert(
      {
        client_upload_id: job.id,
        event_id: job.eventId,
        participant_id: job.participantId,
        storage_path: path,
        original_filename: `mefie-${job.id}.jpg`,
        file_size: body.byteLength,
        width: job.width,
        height: job.height,
        public_url: urlData.publicUrl,
      },
      { onConflict: "client_upload_id" },
    );

    if (insertError) {
      // Do not delete storage here. The deterministic path + client_upload_id
      // makes a retry safe if the database request actually succeeded.
      throw new Error(insertError.message);
    }

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

    await persistQueue();
  }
}

async function processQueue() {
  await loadQueue();
  if (processing || !supabase || AppState.currentState !== "active") return;

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

  jobs.push({
    ...input,
    createdAt: Date.now(),
    attempts: 0,
    nextAttemptAt: Date.now(),
    status: "queued",
  });

  await persistQueue();
  void processQueue();
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

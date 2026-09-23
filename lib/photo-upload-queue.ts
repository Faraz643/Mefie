import AsyncStorage from "@react-native-async-storage/async-storage";
import * as FileSystem from "expo-file-system/legacy";
import { AppState, AppStateStatus } from "react-native";
import { ensureAnonymousAuth, supabase } from "./app-context";

const QUEUE_KEY = "mefie.photoUploadQueue.v1";
const PHOTO_BUCKET = "photos";
const MAX_ATTEMPTS = 8;
const CONCURRENCY = 1;
// Keep camera capture responsive during short bursts. The upload pipeline uses
// base64 conversion on the JS side, so starting it immediately after every
// shutter press can briefly contend with the camera UI thread.
// Each new capture extends this idle window.
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

  try {
    if (!supabase) throw new Error("Cloud connection is not configured.");

    // The queue can start before the camera screen finishes preparing membership.
    // Make sure every Storage/DB request is made with a real authenticated JWT.
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

    const base64 = await FileSystem.readAsStringAsync(localUri, {
      encoding: FileSystem.EncodingType.Base64,
    });
    if (!base64) throw new Error("Could not read the captured photo.");

    const { decode } = await import("base64-arraybuffer");
    const body = decode(base64);
    const path = `${job.eventId}/${job.id}.jpg`;

    const { data: uploadData, error: uploadError } = await supabase.storage
      .from(PHOTO_BUCKET)
      .upload(path, body, {
        contentType: "image/jpeg",
        upsert: false,
        cacheControl: "3600",
      });

    // A previous attempt may have reached storage before the network response was lost.
    // The deterministic path lets us safely continue to the idempotent DB write.
    if (uploadError && !/already exists|duplicate/i.test(uploadError.message)) {
      const status = (uploadError as any)?.statusCode ?? (uploadError as any)?.status ?? "unknown";
      const code = (uploadError as any)?.name ?? (uploadError as any)?.code ?? "unknown";
      throw new Error(`Photo storage upload failed (status=${status}, code=${code}): ${uploadError.message}`);
    }
    if (!uploadData && uploadError) {
      throw new Error(`Photo storage upload failed: ${uploadError.message}`);
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

  // Make the captured file durable before the job is persisted. This prevents a
  // temporary camera URI from becoming a lost upload if the app is backgrounded
  // or terminated immediately after the shutter is pressed.
  job.uri = await ensureDurableFile(job);
  jobs.push(job);

  // Serialize persistence so rapid consecutive captures cannot overwrite each
  // other's AsyncStorage snapshots. Uploading still runs independently.
  await persistQueue();

  // Don't start the expensive upload/base64 pipeline immediately after a
  // shutter press. This gives rapid consecutive captures the same responsive
  // feel as a native camera burst. The timer is extended by every new capture.
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

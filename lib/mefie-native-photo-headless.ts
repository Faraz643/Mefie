import { File } from "expo-file-system";
import * as FileSystem from "expo-file-system/legacy";
import * as ImageManipulator from "expo-image-manipulator";
import { supabase, ensureAnonymousAuth } from "./app-context";
import { enqueuePhotoUpload } from "./photo-upload-queue";
import { getFloatingSharingStatus } from "./mefie-floating-bubble";

type NativePhotoTask = {
  id: string;
  uri: string;
  eventId: string;
  participantId: string;
  mimeType?: string | null;
  width?: number;
  height?: number;
};

const MAX_SOURCE_BYTES = 40 * 1024 * 1024;
const MAX_UPLOAD_BYTES = 15 * 1024 * 1024;
const BUCKET = "photos";

async function upload(path: string, uri: string, contentType: string, cacheControl: string) {
  if (!supabase) throw new Error("Cloud connection is not configured.");
  const file = new File(uri);
  const body = await file.arrayBuffer();
  if (!body.byteLength || body.byteLength > MAX_UPLOAD_BYTES) throw new Error("Photo is too large for background sharing.");
  const { error } = await supabase.storage.from(BUCKET).upload(path, body, {
    contentType,
    cacheControl,
    upsert: false,
  });
  if (error && !/already exists|duplicate|resource already exists|object already exists/i.test(error.message)) {
    throw new Error(error.message);
  }
  return body.byteLength;
}

async function prepareJpeg(uri: string, width: number, height: number) {
  const maxDimension = 2560;
  const scale = Math.min(1, maxDimension / Math.max(width, height));
  const result = await ImageManipulator.manipulateAsync(
    uri,
    [{ resize: { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) } }],
    { compress: 0.86, format: ImageManipulator.SaveFormat.JPEG },
  );
  return result.uri;
}

async function makeThumbnail(uri: string, width: number, height: number) {
  const maxDimension = 600;
  const scale = Math.min(1, maxDimension / Math.max(width, height));
  const result = await ImageManipulator.manipulateAsync(
    uri,
    [{ resize: { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) } }],
    { compress: 0.75, format: ImageManipulator.SaveFormat.JPEG },
  );
  return result.uri;
}

async function fallbackToQueue(task: NativePhotoTask) {
  await enqueuePhotoUpload({
    id: task.id,
    eventId: task.eventId,
    participantId: task.participantId,
    uri: task.uri,
    width: task.width ?? null,
    height: task.height ?? null,
    mimeType: task.mimeType ?? null,
  });
}

export async function handleMefiePhotoDetected(raw: unknown) {
  const task = raw as Partial<NativePhotoTask>;
  if (!task.id || !task.uri || !task.eventId || !task.participantId) return;

  const nativePhoto: NativePhotoTask = {
    id: String(task.id),
    uri: String(task.uri),
    eventId: String(task.eventId),
    participantId: String(task.participantId),
    mimeType: task.mimeType ? String(task.mimeType) : null,
    width: Number(task.width) || 0,
    height: Number(task.height) || 0,
  };

  try {
    const sharing = await getFloatingSharingStatus();
    if (!sharing.active || sharing.paused || sharing.eventId !== nativePhoto.eventId || sharing.participantId !== nativePhoto.participantId) {
      await FileSystem.deleteAsync(nativePhoto.uri, { idempotent: true }).catch(() => undefined);
      return;
    }

    if (!supabase) throw new Error("Cloud connection is not configured.");
    const userId = await ensureAnonymousAuth();
    if (!userId) throw new Error("Mefie authentication is unavailable.");

    const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
    if (sessionError) throw sessionError;
    if (!sessionData.session?.access_token) throw new Error("Mefie has no active authentication session.");

    const { data: membership, error: membershipError } = await supabase
      .from("participants")
      .select("id,auth_user_id,event_id")
      .eq("id", nativePhoto.participantId)
      .eq("event_id", nativePhoto.eventId)
      .maybeSingle();
    if (membershipError) throw membershipError;
    if (!membership || membership.auth_user_id !== userId) throw new Error("The active event membership is no longer valid.");

    const file = new File(nativePhoto.uri);
    if (!file.exists || !file.size || file.size > MAX_SOURCE_BYTES) throw new Error("The captured photo is unavailable or too large.");

    let width = nativePhoto.width;
    let height = nativePhoto.height;
    if (!width || !height) {
      width = 1920;
      height = 1080;
    }

    const preparedUri = await prepareJpeg(nativePhoto.uri, width, height);
    const preparedFile = new File(preparedUri);
    if (!preparedFile.exists || !preparedFile.size || preparedFile.size > MAX_UPLOAD_BYTES) {
      await fallbackToQueue(nativePhoto);
      await FileSystem.deleteAsync(preparedUri, { idempotent: true }).catch(() => undefined);
      return;
    }

    const originalPath = `${nativePhoto.eventId}/${nativePhoto.id}.jpg`;
    const thumbnailPath = `${nativePhoto.eventId}/${nativePhoto.id}.thumb.jpg`;
    const uploadSize = await upload(originalPath, preparedUri, "image/jpeg", "3600");
    const thumbnailUri = await makeThumbnail(preparedUri, width, height);
    try {
      await upload(thumbnailPath, thumbnailUri, "image/jpeg", "86400");
    } finally {
      await FileSystem.deleteAsync(thumbnailUri, { idempotent: true }).catch(() => undefined);
    }

    const { data: photoId, error: finalizeError } = await supabase.rpc("finalize_photo_upload", {
      p_client_upload_id: nativePhoto.id,
      p_event_id: nativePhoto.eventId,
      p_participant_id: nativePhoto.participantId,
      p_storage_path: originalPath,
      p_original_filename: `mefie-${nativePhoto.id}.jpg`,
      p_file_size: uploadSize,
      p_width: width,
      p_height: height,
    });
    if (finalizeError) throw finalizeError;
    if (!photoId) throw new Error("Photo metadata could not be finalized.");

    const { data: linked, error: linkError } = await supabase.rpc("set_photo_thumbnail", {
      p_photo_id: photoId,
      p_thumbnail_path: thumbnailPath,
    });
    if (linkError) throw linkError;
    if (!linked) throw new Error("Photo thumbnail could not be linked.");

    await FileSystem.deleteAsync(preparedUri, { idempotent: true }).catch(() => undefined);
    await FileSystem.deleteAsync(nativePhoto.uri, { idempotent: true }).catch(() => undefined);
  } catch (error) {
    await fallbackToQueue(nativePhoto).catch(() => undefined);
  }
}

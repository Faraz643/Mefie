import { supabase } from "./app-context";

export const PHOTO_SIGNED_URL_TTL = 60 * 60;
export const PHOTO_PREVIEW_WIDTH = 600;
export const PHOTO_PREVIEW_HEIGHT = 600;
export const PHOTO_PREVIEW_QUALITY = 75;

type PhotoTransform = {
  width: number;
  height: number;
  quality: number;
  resize: "cover" | "contain" | "fill";
};

// Generated thumbnails are preferred. For legacy photos that do not have a
// thumbnail_path yet, use Supabase's private signed-image transform by default.
// Set EXPO_PUBLIC_ENABLE_STORAGE_TRANSFORMS=false to disable that fallback.
const ENABLE_REMOTE_STORAGE_TRANSFORMS = process.env.EXPO_PUBLIC_ENABLE_STORAGE_TRANSFORMS !== "false";

export const PHOTO_GALLERY_TRANSFORM: PhotoTransform = {
  width: PHOTO_PREVIEW_WIDTH,
  height: PHOTO_PREVIEW_HEIGHT,
  quality: PHOTO_PREVIEW_QUALITY,
  resize: "cover",
};

async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  worker: (item: T) => Promise<R>,
) {
  const results: R[] = new Array(items.length);
  let nextIndex = 0;

  async function runWorker() {
    while (true) {
      const index = nextIndex++;
      if (index >= items.length) return;
      results[index] = await worker(items[index]);
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, runWorker),
  );

  return results;
}

export async function signPhotoPaths(paths: string[]) {
  if (!supabase || !paths.length) return new Map<string, string>();

  const uniquePaths = [...new Set(paths.filter(Boolean))];
  const { data, error } = await supabase.storage
    .from("photos")
    .createSignedUrls(uniquePaths, PHOTO_SIGNED_URL_TTL);

  if (error) throw error;

  return new Map(
    (data || [])
      .filter((item: any) => item?.path && item?.signedUrl)
      .map((item: any) => [item.path, item.signedUrl]),
  );
}

export async function signPhotoPath(path: string | null | undefined) {
  if (!path) return null;
  const urls = await signPhotoPaths([path]);
  return urls.get(path) || null;
}

export async function signPhotoPreviewPath(
  path: string | null | undefined,
) {
  if (!supabase || !path) return null;

  const { data, error } = await supabase.storage
    .from("photos")
    .createSignedUrl(path, PHOTO_SIGNED_URL_TTL, {
      transform: PHOTO_GALLERY_TRANSFORM,
    });

  if (error) throw error;
  return data?.signedUrl || null;
}

export async function attachSignedPhotoUrls<
  T extends {
    storage_path?: string | null;
    thumbnail_path?: string | null;
  },
>(photos: T[]) {
  const originalUrls = await signPhotoPaths(
    photos.map((photo) => photo.storage_path || ""),
  );

  const previewUrls = await mapWithConcurrency(photos, 8, async (photo) => {
    // New uploads have a physical thumbnail object. It is the cheapest and
    // most predictable gallery source, so always prefer it over a transform.
    if (photo.thumbnail_path) {
      try {
        return await signPhotoPath(photo.thumbnail_path);
      } catch {
        // Fall back to a transformed origin image if the thumbnail is missing.
      }
    }

    if (ENABLE_REMOTE_STORAGE_TRANSFORMS) {
      try {
        return await signPhotoPreviewPath(photo.storage_path);
      } catch {
        // Image transformations may be unavailable; keep the gallery usable.
      }
    }

    return photo.storage_path
      ? originalUrls.get(photo.storage_path) || null
      : null;
  });

  return photos.map((photo, index) => ({
    ...photo,
    // public_url is retained as the full-resolution signed source for the
    // photo viewer/download flow. preview_url is display-only.
    public_url: photo.storage_path
      ? originalUrls.get(photo.storage_path) || null
      : null,
    preview_url: previewUrls[index] || null,
  }));
}

import AsyncStorage from "@react-native-async-storage/async-storage";
import { Image as ExpoImage } from "expo-image";
import { supabase } from "./app-context";

export const PHOTO_SIGNED_URL_TTL = 60 * 60;
export const PHOTO_PREVIEW_WIDTH = 600;
export const PHOTO_PREVIEW_HEIGHT = 600;
export const PHOTO_PREVIEW_QUALITY = 75;

const PHOTO_URL_CACHE_TTL_MS = 50 * 60 * 1000;
const PHOTO_URL_CACHE_PREFIX = "mefie.cache.photo-url.v1:";
const PREFETCH_LIMIT = 40;

type PhotoTransform = {
  width: number;
  height: number;
  quality: number;
  resize: "cover" | "contain" | "fill";
};

type CachedPhotoUrls = {
  publicUrl: string | null;
  previewUrl: string | null;
  cachedAt: number;
};

const ENABLE_REMOTE_STORAGE_TRANSFORMS = process.env.EXPO_PUBLIC_ENABLE_STORAGE_TRANSFORMS !== "false";

export const PHOTO_GALLERY_TRANSFORM: PhotoTransform = {
  width: PHOTO_PREVIEW_WIDTH,
  height: PHOTO_PREVIEW_HEIGHT,
  quality: PHOTO_PREVIEW_QUALITY,
  resize: "cover",
};

const memoryUrlCache = new Map<string, CachedPhotoUrls>();

function photoUrlCacheKey(storagePath: string, thumbnailPath: string | null | undefined) {
  return `${PHOTO_URL_CACHE_PREFIX}${storagePath}|${thumbnailPath || ""}`;
}

function isFresh(cache: CachedPhotoUrls | null | undefined) {
  return !!cache && Date.now() - cache.cachedAt < PHOTO_URL_CACHE_TTL_MS;
}

async function readCachedPhotoUrls(
  storagePath: string,
  thumbnailPath: string | null | undefined,
): Promise<CachedPhotoUrls | null> {
  if (!storagePath) return null;
  const key = photoUrlCacheKey(storagePath, thumbnailPath);
  const memory = memoryUrlCache.get(key);
  if (isFresh(memory)) return memory!;

  try {
    const raw = await AsyncStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CachedPhotoUrls;
    if (!isFresh(parsed)) {
      await AsyncStorage.removeItem(key).catch(() => undefined);
      return null;
    }
    memoryUrlCache.set(key, parsed);
    return parsed;
  } catch {
    return null;
  }
}

async function writeCachedPhotoUrls(
  storagePath: string,
  thumbnailPath: string | null | undefined,
  urls: Omit<CachedPhotoUrls, "cachedAt">,
) {
  if (!storagePath) return;
  const value: CachedPhotoUrls = { ...urls, cachedAt: Date.now() };
  const key = photoUrlCacheKey(storagePath, thumbnailPath);
  memoryUrlCache.set(key, value);
  try {
    await AsyncStorage.setItem(key, JSON.stringify(value));
  } catch {
    // The in-memory cache is still useful when AsyncStorage is unavailable.
  }
}

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

async function resolvePhotoUrls<T extends {
  storage_path?: string | null;
  thumbnail_path?: string | null;
  public_url?: string | null;
  preview_url?: string | null;
}>(
  photo: T,
  originalUrls: Map<string, string>,
  cached: CachedPhotoUrls | null,
) {
  const storagePath = photo.storage_path || "";
  if (!storagePath) {
    return { publicUrl: photo.public_url || null, previewUrl: photo.preview_url || null };
  }

  if (cached?.publicUrl || cached?.previewUrl) {
    return {
      publicUrl: cached.publicUrl || photo.public_url || null,
      previewUrl: cached.previewUrl || photo.preview_url || cached.publicUrl || null,
    };
  }

  const publicUrl = originalUrls.get(storagePath) || photo.public_url || null;
  let previewUrl: string | null = null;

  if (photo.thumbnail_path) {
    try {
      previewUrl = await signPhotoPath(photo.thumbnail_path);
    } catch {
      // Fall back to a transformed origin image if the physical thumbnail is missing.
    }
  }

  if (!previewUrl && ENABLE_REMOTE_STORAGE_TRANSFORMS) {
    try {
      previewUrl = await signPhotoPreviewPath(storagePath);
    } catch {
      // Image transformations may be unavailable; keep the gallery usable.
    }
  }

  previewUrl = previewUrl || publicUrl;

  await writeCachedPhotoUrls(storagePath, photo.thumbnail_path, {
    publicUrl,
    previewUrl,
  });

  return { publicUrl, previewUrl };
}

export async function attachSignedPhotoUrls<
  T extends {
    storage_path?: string | null;
    thumbnail_path?: string | null;
    public_url?: string | null;
    preview_url?: string | null;
  },
>(photos: T[]) {
  if (!photos.length) return [] as Array<T & { public_url: string | null; preview_url: string | null }>;

  // Load persisted signed URLs first. This is important after an app restart:
  // AsyncStorage can satisfy the gallery without making a new Storage request.
  const cachedUrls = await mapWithConcurrency(photos, 12, async (photo) =>
    readCachedPhotoUrls(photo.storage_path || "", photo.thumbnail_path),
  );

  const pathsNeedingOriginalUrls = photos
    .map((photo, index) => ({ photo, cached: cachedUrls[index] }))
    .filter(({ photo, cached }) => {
      const path = photo.storage_path || "";
      return !!path && !cached && !photo.public_url;
    })
    .map(({ photo }) => photo.storage_path || "")
    .filter(Boolean);

  const originalUrls = pathsNeedingOriginalUrls.length
    ? await signPhotoPaths(pathsNeedingOriginalUrls)
    : new Map<string, string>();

  const resolved = await mapWithConcurrency(photos, 8, async (photo, index) => {
    const urls = await resolvePhotoUrls(photo, originalUrls, cachedUrls[index]);
    return {
      ...photo,
      public_url: urls.publicUrl,
      preview_url: urls.previewUrl,
    };
  });

  // Warm expo-image's disk/memory cache after the URLs are known. This is
  // deliberately fire-and-forget so opening an event is never blocked by
  // downloading the gallery.
  const previewUrls = resolved
    .slice(0, PREFETCH_LIMIT)
    .map((photo) => photo.preview_url || photo.public_url)
    .filter((url): url is string => !!url);
  if (previewUrls.length) {
    void ExpoImage.prefetch(previewUrls, "memory-disk").catch(() => undefined);
  }

  return resolved;
}

import AsyncStorage from "@react-native-async-storage/async-storage";
import { Image as ExpoImage } from "expo-image";
import * as FileSystem from "expo-file-system/legacy";
import { supabase } from "./app-context";

export const PHOTO_SIGNED_URL_TTL = 60 * 60;
export const PHOTO_PREVIEW_WIDTH = 600;
export const PHOTO_PREVIEW_HEIGHT = 600;
export const PHOTO_PREVIEW_QUALITY = 75;

const PHOTO_URL_CACHE_TTL_MS = 50 * 60 * 1000;
const PHOTO_URL_CACHE_PREFIX = "mefie.cache.photo-url.v1:";
const LOCAL_PREVIEW_DIR_NAME = "mefie-gallery/";
const PREFETCH_LIMIT = 40;
const LOCAL_WARM_CONCURRENCY = 6;

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
const localPreviewInFlight = new Map<string, Promise<string | null>>();
let localPreviewDirectoryReady: Promise<void> | null = null;

function photoUrlCacheKey(storagePath: string, thumbnailPath: string | null | undefined) {
  return `${PHOTO_URL_CACHE_PREFIX}${storagePath}|${thumbnailPath || ""}`;
}

function isFresh(cache: CachedPhotoUrls | null | undefined) {
  return !!cache && Date.now() - cache.cachedAt < PHOTO_URL_CACHE_TTL_MS;
}

function stableHash(value: string) {
  // Small deterministic FNV-1a hash; sufficient for a local filename because
  // the storage path remains the authoritative identity.
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

function localPreviewPath(storagePath: string, thumbnailPath: string | null | undefined) {
  if (!FileSystem.cacheDirectory || !storagePath) return null;
  const identity = `${storagePath}|${thumbnailPath || ""}`;
  return `${FileSystem.cacheDirectory}${LOCAL_PREVIEW_DIR_NAME}${stableHash(identity)}.img`;
}

async function ensureLocalPreviewDirectory() {
  if (!FileSystem.cacheDirectory) return;
  if (!localPreviewDirectoryReady) {
    localPreviewDirectoryReady = FileSystem.makeDirectoryAsync(
      `${FileSystem.cacheDirectory}${LOCAL_PREVIEW_DIR_NAME}`,
      { intermediates: true },
    ).then(() => undefined).catch(() => undefined);
  }
  await localPreviewDirectoryReady;
}

async function getLocalPreviewUri(
  storagePath: string,
  thumbnailPath: string | null | undefined,
) {
  const path = localPreviewPath(storagePath, thumbnailPath);
  if (!path) return null;
  try {
    const info = await FileSystem.getInfoAsync(path);
    return info.exists ? path : null;
  } catch {
    return null;
  }
}

async function warmLocalPreview(
  storagePath: string,
  thumbnailPath: string | null | undefined,
  previewUrl: string | null,
) {
  if (!storagePath || !previewUrl) return null;
  const localPath = localPreviewPath(storagePath, thumbnailPath);
  if (!localPath) return null;

  const existing = await getLocalPreviewUri(storagePath, thumbnailPath);
  if (existing) return existing;

  const inFlightKey = `${storagePath}|${thumbnailPath || ""}`;
  const inFlight = localPreviewInFlight.get(inFlightKey);
  if (inFlight) return inFlight;

  const task = (async () => {
    try {
      await ensureLocalPreviewDirectory();
      const result = await FileSystem.downloadAsync(previewUrl, localPath);
      if (result.status < 200 || result.status >= 300) {
        await FileSystem.deleteAsync(localPath, { idempotent: true }).catch(() => undefined);
        return null;
      }
      return localPath;
    } catch {
      await FileSystem.deleteAsync(localPath, { idempotent: true }).catch(() => undefined);
      return null;
    } finally {
      localPreviewInFlight.delete(inFlightKey);
    }
  })();

  localPreviewInFlight.set(inFlightKey, task);
  return task;
}

async function warmLocalPreviews<T extends {
  storage_path?: string | null;
  thumbnail_path?: string | null;
  preview_url?: string | null;
  public_url?: string | null;
}>(photos: T[]) {
  const candidates = photos
    .slice(0, PREFETCH_LIMIT)
    .filter((photo) => photo.storage_path && (photo.preview_url || photo.public_url));

  await mapWithConcurrency(candidates, LOCAL_WARM_CONCURRENCY, async (photo) => {
    const localPath = await warmLocalPreview(
      photo.storage_path || "",
      photo.thumbnail_path,
      photo.preview_url || photo.public_url || null,
    );
    // The caller's cached photo objects are intentionally mutated once the
    // local file exists. This makes the in-memory event cache truly local-first
    // on the next A -> B -> A navigation without another network round-trip.
    if (localPath && /^https?:\/\//.test(photo.preview_url || "")) {
      photo.preview_url = localPath;
    }
    return null;
  });
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

  // A local thumbnail is the strongest cache: it is independent of signed URL
  // expiry and survives navigation between event screens.
  const localPreview = await getLocalPreviewUri(storagePath, photo.thumbnail_path);
  if (localPreview) {
    return {
      publicUrl: cached?.publicUrl || photo.public_url || null,
      previewUrl: localPreview,
    };
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

  // Cached event objects already carry their resolved gallery URL. We still
  // check the local thumbnail store so a stable local file can replace an
  // expired/rotated signed URL before the first frame is rendered.
  if (photos.every((photo) => !!(photo.preview_url || photo.public_url))) {
    const indexed = photos.map((photo, index) => ({ photo, index }));
    const localUris = await mapWithConcurrency(indexed, 12, ({ photo }) =>
      getLocalPreviewUri(photo.storage_path || "", photo.thumbnail_path),
    );
    const resolved = photos.map((photo, index) => ({
      ...photo,
      public_url: photo.public_url || photo.preview_url || null,
      preview_url: localUris[index] || photo.preview_url || photo.public_url || null,
    }));
    const previewUrls = resolved
      .slice(0, PREFETCH_LIMIT)
      .map((photo) => photo.preview_url || photo.public_url)
      .filter((url): url is string => !!url && /^https?:\/\//.test(url));
    if (previewUrls.length) {
      void ExpoImage.prefetch(previewUrls, "memory-disk").catch(() => undefined);
    }
    // If the local file did not exist yet, seed it in the background. The first
    // render stays fast; the next event open can use the local file immediately.
    void warmLocalPreviews(photos).catch(() => undefined);
    return resolved;
  }

  // Load persisted signed URLs first. This is important after an app restart:
  // AsyncStorage can satisfy the gallery without making a new Storage request.
  const indexedPhotos = photos.map((photo, index) => ({ photo, index }));
  const cachedUrls = await mapWithConcurrency(indexedPhotos, 12, ({ photo }) =>
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

  const indexedResolved = await mapWithConcurrency(indexedPhotos, 8, ({ photo, index }) =>
    resolvePhotoUrls(photo, originalUrls, cachedUrls[index]),
  );

  const resolved = photos.map((photo, index) => {
    const urls = indexedResolved[index];
    Object.assign(photo as object, {
      public_url: urls.publicUrl,
      preview_url: urls.previewUrl,
    });
    return {
      ...photo,
      public_url: urls.publicUrl,
      preview_url: urls.previewUrl,
    };
  });

  const previewUrls = resolved
    .slice(0, PREFETCH_LIMIT)
    .map((photo) => photo.preview_url || photo.public_url)
    .filter((url): url is string => !!url && /^https?:\/\//.test(url));
  if (previewUrls.length) {
    void ExpoImage.prefetch(previewUrls, "memory-disk").catch(() => undefined);
  }
  // Pass the original objects so the event cache receives the local URI when
  // the background warm completes.
  void warmLocalPreviews(photos).catch(() => undefined);

  return resolved;
}

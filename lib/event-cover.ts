import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase } from "./app-context";
import { signPhotoPaths } from "./photo-storage";

const COVER_CACHE_KEY = "mefie.cache.event-covers.v2";
const COVER_CACHE_TTL_MS = 50 * 60 * 1000;
type CoverCacheEntry = { url: string; cachedAt: number };
let memoryCoverCache = new Map<string, CoverCacheEntry>();
let coverCacheLoaded = false;
let coverCacheLoadPromise: Promise<void> | null = null;

async function loadCoverCache() {
  if (coverCacheLoaded) return;
  if (!coverCacheLoadPromise) {
    coverCacheLoadPromise = (async () => {
      try {
        const raw = await AsyncStorage.getItem(COVER_CACHE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw) as Record<string, CoverCacheEntry>;
          memoryCoverCache = new Map(Object.entries(parsed || {}));
        }
      } catch {}
      coverCacheLoaded = true;
    })();
  }
  await coverCacheLoadPromise;
}

function isFresh(entry: CoverCacheEntry | undefined) {
  return !!entry?.url && Date.now() - entry.cachedAt < COVER_CACHE_TTL_MS;
}

function remember(eventId: string, url: string) {
  memoryCoverCache.set(eventId, { url, cachedAt: Date.now() });
  void AsyncStorage.setItem(
    COVER_CACHE_KEY,
    JSON.stringify(Object.fromEntries(memoryCoverCache)),
  ).catch(() => undefined);
}

/** Resolve the newest real event photo thumbnail for list/card covers. */
export async function getEventCoverUrl(eventId: string) {
  if (!supabase || !eventId) return null;
  await loadCoverCache();

  const cached = memoryCoverCache.get(eventId);
  if (isFresh(cached)) return cached!.url;

  const { data, error } = await supabase
    .from("photos")
    .select("storage_path,thumbnail_path,created_at")
    .eq("event_id", eventId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  if (!data) return cached?.url || null;

  const signed = await signPhotoPaths(
    [data.thumbnail_path, data.storage_path].filter(Boolean) as string[],
  );
  const url =
    signed.get(data.thumbnail_path || "") ||
    signed.get(data.storage_path || "") ||
    null;

  if (url) remember(eventId, url);
  return url || cached?.url || null;
}

/**
 * Resolve covers for many events with one photos query and one signed-URL batch.
 * Previously resolved covers are returned immediately so navigating away from
 * an event and back to Home does not blank/reload every card.
 */
export async function getEventCoverMap(eventIds: string[]) {
  if (!supabase) return {} as Record<string, string>;

  const ids = [...new Set(eventIds.filter(Boolean))];
  if (!ids.length) return {} as Record<string, string>;
  await loadCoverCache();

  const result: Record<string, string> = {};
  const missing: string[] = [];

  for (const eventId of ids) {
    const cached = memoryCoverCache.get(eventId);
    if (isFresh(cached)) result[eventId] = cached!.url;
    else missing.push(eventId);
  }

  if (!missing.length) return result;

  const { data, error } = await supabase
    .from("photos")
    .select("event_id,storage_path,thumbnail_path,created_at")
    .in("event_id", missing)
    .order("created_at", { ascending: false });

  if (error) throw error;

  const latestByEvent = new Map<
    string,
    { storage_path: string; thumbnail_path: string | null }
  >();

  for (const row of data || []) {
    if (!row.event_id || latestByEvent.has(row.event_id) || !row.storage_path) continue;
    latestByEvent.set(row.event_id, {
      storage_path: row.storage_path,
      thumbnail_path: row.thumbnail_path || null,
    });
  }

  const paths = [...latestByEvent.values()].flatMap((row) =>
    [row.thumbnail_path, row.storage_path].filter(Boolean) as string[],
  );
  const signed = paths.length ? await signPhotoPaths(paths) : new Map<string, string>();

  for (const [eventId, row] of latestByEvent) {
    const url =
      signed.get(row.thumbnail_path || "") ||
      signed.get(row.storage_path) ||
      null;
    if (url) {
      result[eventId] = url;
      remember(eventId, url);
    }
  }

  return result;
}

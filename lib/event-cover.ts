import { supabase } from "./app-context";
import { signPhotoPaths } from "./photo-storage";

/** Resolve the newest real event photo thumbnail for list/card covers. */
export async function getEventCoverUrl(eventId: string) {
  if (!supabase || !eventId) return null;

  const { data, error } = await supabase
    .from("photos")
    .select("storage_path,thumbnail_path,created_at")
    .eq("event_id", eventId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  const signed = await signPhotoPaths(
    [data.thumbnail_path, data.storage_path].filter(Boolean) as string[],
  );
  return signed.get(data.thumbnail_path || "") || signed.get(data.storage_path || "") || null;
}

/**
 * Resolve covers for many events with one photos query and one signed-URL batch.
 * This avoids one database round-trip per event when the events screen grows.
 */
export async function getEventCoverMap(eventIds: string[]) {
  if (!supabase) return {} as Record<string, string>;

  const ids = [...new Set(eventIds.filter(Boolean))];
  if (!ids.length) return {} as Record<string, string>;

  const { data, error } = await supabase
    .from("photos")
    .select("event_id,storage_path,thumbnail_path,created_at")
    .in("event_id", ids)
    .order("created_at", { ascending: false });

  if (error) throw error;

  const latestByEvent = new Map<string, { storage_path: string; thumbnail_path: string | null }>();
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
  const signed = await signPhotoPaths(paths);

  const result: Record<string, string> = {};
  for (const [eventId, row] of latestByEvent) {
    const url = signed.get(row.thumbnail_path || "") || signed.get(row.storage_path);
    if (url) result[eventId] = url;
  }
  return result;
}

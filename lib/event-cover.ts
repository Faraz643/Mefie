import { supabase } from "./app-context";
import { signPhotoPath } from "./photo-storage";

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
  return (await signPhotoPath(data.thumbnail_path)) || (await signPhotoPath(data.storage_path));
}

export async function getEventCoverMap(eventIds: string[]) {
  const ids = [...new Set(eventIds.filter(Boolean))];
  const entries = await Promise.all(ids.map(async (id) => [id, await getEventCoverUrl(id)] as const));
  return Object.fromEntries(entries);
}

import AsyncStorage from "@react-native-async-storage/async-storage";

export type CachedEventSummary = {
  id: string;
  name: string;
  people: number;
  photos: number;
  cover: string;
  creatorAuthUserId: string | null;
};

export type CachedEventDetail = {
  event: any;
  photos: any[];
  people: any[];
  cachedAt: number;
};

const EVENTS_CACHE_VERSION = 1;
const EVENTS_CACHE_PREFIX = "mefie.cache.events.v1:";
const EVENT_DETAIL_PREFIX = "mefie.cache.event.v1:";
const EVENT_DETAIL_TTL_MS = 7 * 24 * 60 * 60 * 1000;

function eventsKey(sessionId: string) { return EVENTS_CACHE_PREFIX + sessionId; }
function detailKey(eventId: string) { return EVENT_DETAIL_PREFIX + eventId; }

export async function getCachedEvents(sessionId: string): Promise<CachedEventSummary[] | null> {
  if (!sessionId) return null;
  try {
    const raw = await AsyncStorage.getItem(eventsKey(sessionId));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed?.version !== EVENTS_CACHE_VERSION || !Array.isArray(parsed.events)) return null;
    return parsed.events as CachedEventSummary[];
  } catch { return null; }
}

export async function setCachedEvents(sessionId: string, events: CachedEventSummary[]) {
  if (!sessionId) return;
  try {
    await AsyncStorage.setItem(eventsKey(sessionId), JSON.stringify({ version: EVENTS_CACHE_VERSION, events, cachedAt: Date.now() }));
  } catch {}
}

export async function getCachedEventDetail(eventId: string): Promise<CachedEventDetail | null> {
  if (!eventId) return null;
  try {
    const raw = await AsyncStorage.getItem(detailKey(eventId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CachedEventDetail;
    if (!parsed?.event || !Array.isArray(parsed.photos) || !Array.isArray(parsed.people)) return null;
    if (typeof parsed.cachedAt !== "number" || Date.now() - parsed.cachedAt > EVENT_DETAIL_TTL_MS) {
      await AsyncStorage.removeItem(detailKey(eventId)).catch(() => undefined);
      return null;
    }
    return parsed;
  } catch { return null; }
}

export async function setCachedEventDetail(eventId: string, detail: Omit<CachedEventDetail, "cachedAt">) {
  if (!eventId) return;
  try { await AsyncStorage.setItem(detailKey(eventId), JSON.stringify({ ...detail, cachedAt: Date.now() })); } catch {}
}

export async function removeCachedEventDetail(eventId: string) {
  if (!eventId) return;
  await AsyncStorage.removeItem(detailKey(eventId)).catch(() => undefined);
}

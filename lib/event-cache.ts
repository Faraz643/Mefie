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

// AsyncStorage is intentionally backed by an in-memory layer as well. This
// removes the storage bridge from the hot path when a user leaves and reopens
// an event during the same app session.
const memoryEvents = new Map<string, CachedEventSummary[]>();
const memoryDetails = new Map<string, CachedEventDetail>();

function eventsKey(sessionId: string) { return EVENTS_CACHE_PREFIX + sessionId; }
function detailKey(eventId: string) { return EVENT_DETAIL_PREFIX + eventId; }

export function getCachedEventDetailSync(eventId: string): CachedEventDetail | null {
  if (!eventId) return null;
  const cached = memoryDetails.get(eventId);
  if (!cached) return null;
  if (Date.now() - cached.cachedAt > EVENT_DETAIL_TTL_MS) {
    memoryDetails.delete(eventId);
    return null;
  }
  return cached;
}

export function getCachedEventsSync(sessionId: string): CachedEventSummary[] | null {
  if (!sessionId) return null;
  return memoryEvents.get(sessionId) ?? null;
}

export async function getCachedEvents(sessionId: string): Promise<CachedEventSummary[] | null> {
  if (!sessionId) return null;
  const memory = getCachedEventsSync(sessionId);
  if (memory) return memory;
  try {
    const raw = await AsyncStorage.getItem(eventsKey(sessionId));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed?.version !== EVENTS_CACHE_VERSION || !Array.isArray(parsed.events)) return null;
    const events = parsed.events as CachedEventSummary[];
    memoryEvents.set(sessionId, events);
    return events;
  } catch { return null; }
}

export async function setCachedEvents(sessionId: string, events: CachedEventSummary[]) {
  if (!sessionId) return;
  memoryEvents.set(sessionId, events);
  try {
    await AsyncStorage.setItem(eventsKey(sessionId), JSON.stringify({ version: EVENTS_CACHE_VERSION, events, cachedAt: Date.now() }));
  } catch {}
}

export async function getCachedEventDetail(eventId: string): Promise<CachedEventDetail | null> {
  if (!eventId) return null;
  const memory = getCachedEventDetailSync(eventId);
  if (memory) return memory;
  try {
    const raw = await AsyncStorage.getItem(detailKey(eventId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CachedEventDetail;
    if (!parsed?.event || !Array.isArray(parsed.photos) || !Array.isArray(parsed.people)) return null;
    if (typeof parsed.cachedAt !== "number" || Date.now() - parsed.cachedAt > EVENT_DETAIL_TTL_MS) {
      await AsyncStorage.removeItem(detailKey(eventId)).catch(() => undefined);
      return null;
    }
    memoryDetails.set(eventId, parsed);
    return parsed;
  } catch { return null; }
}

export async function setCachedEventDetail(eventId: string, detail: Omit<CachedEventDetail, "cachedAt">) {
  if (!eventId) return;
  const value: CachedEventDetail = { ...detail, cachedAt: Date.now() };
  memoryDetails.set(eventId, value);
  try { await AsyncStorage.setItem(detailKey(eventId), JSON.stringify(value)); } catch {}
}

export async function removeCachedEventDetail(eventId: string) {
  if (!eventId) return;
  memoryDetails.delete(eventId);
  await AsyncStorage.removeItem(detailKey(eventId)).catch(() => undefined);
}

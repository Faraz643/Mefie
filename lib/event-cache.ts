import AsyncStorage from "@react-native-async-storage/async-storage";

export type CachedEventSummary = { id: string; name: string; people: number; photos: number; cover: string; creatorAuthUserId: string | null };
export type CachedEventDetail = { event: any; photos: any[]; people: any[]; cachedAt: number };

const EVENTS_CACHE_VERSION = 1;
const EVENTS_CACHE_PREFIX = "mefie.cache.events.v1:";
const EVENT_DETAIL_VERSION = 4;
const EVENT_DETAIL_PREFIX = "mefie.cache.event.v4:";
const EVENT_DETAIL_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const DETAIL_PRELOAD_LIMIT = 12;

const memoryEvents = new Map<string, CachedEventSummary[]>();
const memoryDetails = new Map<string, CachedEventDetail>();
function eventsKey(sessionId: string) { return EVENTS_CACHE_PREFIX + sessionId; }
function detailKey(eventId: string) { return EVENT_DETAIL_PREFIX + eventId; }
function normalizePeople(people: any[]) {
  return people.map((person) => {
    const name = typeof person?.display_name === "string" ? person.display_name.trim() : "";
    return name && name !== "?" ? { ...person, display_name: name } : { ...person, display_name: "" };
  });
}

export function getCachedEventDetailSync(eventId: string): CachedEventDetail | null {
  if (!eventId) return null;
  const cached = memoryDetails.get(eventId);
  if (!cached) return null;
  if (Date.now() - cached.cachedAt > EVENT_DETAIL_TTL_MS) { memoryDetails.delete(eventId); return null; }
  return cached;
}
export function getCachedEventsSync(sessionId: string): CachedEventSummary[] | null { return sessionId ? memoryEvents.get(sessionId) ?? null : null; }

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
    void Promise.all(events.slice(0, DETAIL_PRELOAD_LIMIT).map((event) => getCachedEventDetail(event.id))).catch(() => undefined);
    return events;
  } catch { return null; }
}

export async function setCachedEvents(sessionId: string, events: CachedEventSummary[]) {
  if (!sessionId) return;
  memoryEvents.set(sessionId, events);
  try { await AsyncStorage.setItem(eventsKey(sessionId), JSON.stringify({ version: EVENTS_CACHE_VERSION, events, cachedAt: Date.now() })); } catch {}
}

export async function getCachedEventDetail(eventId: string): Promise<CachedEventDetail | null> {
  if (!eventId) return null;
  const memory = getCachedEventDetailSync(eventId);
  if (memory) return memory;
  try {
    const raw = await AsyncStorage.getItem(detailKey(eventId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CachedEventDetail & { version?: number };
    if (!parsed?.event || !Array.isArray(parsed.photos) || !Array.isArray(parsed.people) || parsed.version !== EVENT_DETAIL_VERSION) return null;
    if (typeof parsed.cachedAt !== "number" || Date.now() - parsed.cachedAt > EVENT_DETAIL_TTL_MS) { await AsyncStorage.removeItem(detailKey(eventId)).catch(() => undefined); return null; }
    const normalized = { event: parsed.event, photos: parsed.photos, people: normalizePeople(parsed.people), cachedAt: parsed.cachedAt };
    memoryDetails.set(eventId, normalized);
    return normalized;
  } catch { return null; }
}

export async function setCachedEventDetail(eventId: string, detail: Omit<CachedEventDetail, "cachedAt">) {
  if (!eventId) return;
  const value: CachedEventDetail = { ...detail, people: normalizePeople(detail.people || []), cachedAt: Date.now() };
  memoryDetails.set(eventId, value);
  try { await AsyncStorage.setItem(detailKey(eventId), JSON.stringify({ version: EVENT_DETAIL_VERSION, ...value })); } catch {}

  // Do not make navigation wait for disk writes or thumbnail downloads. The
  // first render uses the remote thumbnail when necessary; this background
  // task materializes the actual image bytes and then replaces the cached URL
  // with a local file URI. The next event open is therefore genuinely local.
  void import("./photo-storage").then(async ({ materializeLocalPhotoPreviews }) => {
    try {
      const localPhotos = await materializeLocalPhotoPreviews(value.photos);
      const latest = memoryDetails.get(eventId);
      const merged = {
        event: latest?.event ?? value.event,
        photos: localPhotos,
        people: latest?.people ?? value.people,
        cachedAt: Date.now(),
      };
      memoryDetails.set(eventId, merged);
      await AsyncStorage.setItem(detailKey(eventId), JSON.stringify({ version: EVENT_DETAIL_VERSION, ...merged }));
    } catch {
      // Remote rendering remains the fallback if local materialization fails.
    }
  }).catch(() => undefined);
}

export async function removeCachedEventDetail(eventId: string) {
  if (!eventId) return;
  memoryDetails.delete(eventId);
  await AsyncStorage.removeItem(detailKey(eventId)).catch(() => undefined);
}

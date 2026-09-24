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
const EVENT_DETAIL_VERSION = 2;
const EVENT_DETAIL_PREFIX = "mefie.cache.event.v2:";
const EVENT_DETAIL_TTL_MS = 7 * 24 * 60 * 60 * 1000;

// Keep the most recently loaded event data in memory. This is the zero-I/O
// hot path used when an event is opened again during the same app session.
const memoryEvents = new Map<string, CachedEventSummary[]>();
const memoryDetails = new Map<string, CachedEventDetail>();

function eventsKey(sessionId: string) { return EVENTS_CACHE_PREFIX + sessionId; }
function detailKey(eventId: string) { return EVENT_DETAIL_PREFIX + eventId; }

function normalizePeople(people: any[]) {
  return people.map((person) => {
    const name = typeof person?.display_name === "string" ? person.display_name.trim() : "";
    return name
      ? person
      : { ...person, display_name: "Guest" };
  });
}

export function getCachedEventDetailSync(eventId: string): CachedEventDetail | null {
  if (!eventId) return null;
  const cached = memoryDetails.get(eventId);
  if (!cached) return null;
  if (Date.now() - cached.cachedAt > EVENT_DETAIL_TTL_MS) {
    memoryDetails.delete(eventId);
    return null;
  }
  if (cached.people.some((person) => !person?.display_name?.trim())) {
    const normalized = { ...cached, people: normalizePeople(cached.people) };
    memoryDetails.set(eventId, normalized);
    return normalized;
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
  } catch {
    return null;
  }
}

export async function setCachedEvents(sessionId: string, events: CachedEventSummary[]) {
  if (!sessionId) return;
  memoryEvents.set(sessionId, events);
  try {
    await AsyncStorage.setItem(
      eventsKey(sessionId),
      JSON.stringify({ version: EVENTS_CACHE_VERSION, events, cachedAt: Date.now() }),
    );
  } catch {}
}

export async function getCachedEventDetail(eventId: string): Promise<CachedEventDetail | null> {
  if (!eventId) return null;

  // Never touch AsyncStorage when the event is already in memory.
  const memory = getCachedEventDetailSync(eventId);
  if (memory) return memory;

  try {
    const raw = await AsyncStorage.getItem(detailKey(eventId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CachedEventDetail & { version?: number };
    if (
      !parsed?.event ||
      !Array.isArray(parsed.photos) ||
      !Array.isArray(parsed.people) ||
      parsed.version !== EVENT_DETAIL_VERSION
    ) return null;
    if (typeof parsed.cachedAt !== "number" || Date.now() - parsed.cachedAt > EVENT_DETAIL_TTL_MS) {
      await AsyncStorage.removeItem(detailKey(eventId)).catch(() => undefined);
      return null;
    }
    const normalized: CachedEventDetail = {
      event: parsed.event,
      photos: parsed.photos,
      people: normalizePeople(parsed.people),
      cachedAt: parsed.cachedAt,
    };
    memoryDetails.set(eventId, normalized);
    return normalized;
  } catch {
    return null;
  }
}

export async function setCachedEventDetail(
  eventId: string,
  detail: Omit<CachedEventDetail, "cachedAt">,
) {
  if (!eventId) return;
  const value: CachedEventDetail = {
    ...detail,
    people: normalizePeople(detail.people || []),
    cachedAt: Date.now(),
  };
  memoryDetails.set(eventId, value);
  try {
    await AsyncStorage.setItem(
      detailKey(eventId),
      JSON.stringify({ version: EVENT_DETAIL_VERSION, ...value }),
    );
  } catch {}
}

export async function removeCachedEventDetail(eventId: string) {
  if (!eventId) return;
  memoryDetails.delete(eventId);
  await AsyncStorage.removeItem(detailKey(eventId)).catch(() => undefined);
}

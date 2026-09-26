import AsyncStorage from "@react-native-async-storage/async-storage";

export type CachedEventSummary = { id: string; name: string; people: number; photos: number; cover: string; creatorAuthUserId: string | null };
export type CachedEventDetail = { event: any; photos: any[]; people: any[]; cachedAt: number };

const EVENTS_CACHE_VERSION = 1;
const EVENTS_CACHE_PREFIX = "mefie.cache.events.v1:";
const EVENT_DETAIL_VERSION = 5;
const EVENT_DETAIL_PREFIX = "mefie.cache.event.v5:";
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
function mergePeople(freshPeople: any[], previousPeople: any[]) {
  const previousById = new Map<string, any>();
  for (const person of previousPeople || []) {
    if (person?.id) previousById.set(String(person.id), person);
  }
  return freshPeople.map((person) => {
    const previous = person?.id ? previousById.get(String(person.id)) : null;
    const freshName = typeof person?.display_name === "string" ? person.display_name.trim() : "";
    const previousName = typeof previous?.display_name === "string" ? previous.display_name.trim() : "";
    return previousName && !freshName
      ? { ...person, display_name: previousName }
      : { ...person, display_name: freshName };
  });
}
function hasCompletePeople(people: any[]) {
  return people.length === 0 || people.every((person) => typeof person?.display_name === "string" && person.display_name.trim() && person.display_name.trim() !== "?");
}
function validDetail(detail: CachedEventDetail | null) {
  if (!detail) return null;
  if (Date.now() - detail.cachedAt > EVENT_DETAIL_TTL_MS) return null;
  return hasCompletePeople(detail.people || []) ? detail : null;
}
function mergePhotoCache(freshPhotos: any[], previousPhotos: any[]) {
  const previousByIdentity = new Map<string, any>();
  for (const photo of previousPhotos || []) {
    const key = `${photo?.storage_path || ""}|${photo?.thumbnail_path || ""}`;
    if (key !== "|") previousByIdentity.set(key, photo);
  }
  return freshPhotos.map((photo) => {
    const key = `${photo?.storage_path || ""}|${photo?.thumbnail_path || ""}`;
    const previous = previousByIdentity.get(key);
    const localPreview = typeof previous?.preview_url === "string" && previous.preview_url.startsWith("file://")
      ? previous.preview_url
      : null;
    return localPreview ? { ...photo, preview_url: localPreview } : { ...photo };
  });
}

export function getCachedEventDetailSync(eventId: string): CachedEventDetail | null {
  if (!eventId) return null;
  const cached = validDetail(memoryDetails.get(eventId) || null);
  if (!cached) {
    memoryDetails.delete(eventId);
    return null;
  }
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
    const normalized = { event: parsed.event, photos: parsed.photos, people: normalizePeople(parsed.people), cachedAt: parsed.cachedAt };
    const valid = validDetail(normalized);
    if (!valid) {
      await AsyncStorage.removeItem(detailKey(eventId)).catch(() => undefined);
      return null;
    }
    memoryDetails.set(eventId, valid);
    return valid;
  } catch { return null; }
}

export async function setCachedEventDetail(eventId: string, detail: Omit<CachedEventDetail, "cachedAt">) {
  if (!eventId) return;

  let storedPeople: any[] = [];
  const previousMemory = memoryDetails.get(eventId);
  if (previousMemory?.people?.length) {
    storedPeople = previousMemory.people;
  } else {
    try {
      const raw = await AsyncStorage.getItem(detailKey(eventId));
      const parsed = raw ? JSON.parse(raw) : null;
      if (parsed?.version === EVENT_DETAIL_VERSION && Array.isArray(parsed.people)) {
        storedPeople = normalizePeople(parsed.people);
      }
    } catch {}
  }

  const mergedPeople = mergePeople(normalizePeople(detail.people || []), storedPeople);
  const previousPhotos = previousMemory?.photos || [];
  const value: CachedEventDetail = {
    ...detail,
    photos: mergePhotoCache(detail.photos || [], previousPhotos),
    people: mergedPeople,
    cachedAt: Date.now(),
  };
  memoryDetails.set(eventId, value);
  try { await AsyncStorage.setItem(detailKey(eventId), JSON.stringify({ version: EVENT_DETAIL_VERSION, ...value })); } catch {}

  // Resolve remote storage paths and materialize the actual thumbnail bytes.
  // The caller intentionally passes raw photo rows; resolving here guarantees
  // the persistent local-media cache is populated even when the event screen
  // itself is using a different URL resolution path.
  void import("./photo-storage").then(async ({ attachSignedPhotoUrls, materializeLocalPhotoPreviews }) => {
    try {
      const resolved = await attachSignedPhotoUrls(value.photos);
      const localPhotos = await materializeLocalPhotoPreviews(resolved);
      const latest = memoryDetails.get(eventId);
      const merged = {
        event: latest?.event ?? value.event,
        photos: mergePhotoCache(localPhotos, latest?.photos ?? value.photos),
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

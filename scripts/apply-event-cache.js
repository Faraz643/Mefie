const fs = require("fs");
const path = require("path");

const root = process.cwd();
function read(file) { return fs.readFileSync(path.join(root, file), "utf8"); }
function write(file, content) { fs.writeFileSync(path.join(root, file), content, "utf8"); }
function mustReplace(source, pattern, replacement, label) {
  const next = source.replace(pattern, replacement);
  if (next === source) throw new Error(`Patch target not found: ${label}`);
  return next;
}

const cacheModule = `import AsyncStorage from "@react-native-async-storage/async-storage";

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
`;
write("lib/event-cache.ts", cacheModule);

let appContext = read("lib/app-context.tsx");
appContext = mustReplace(
  appContext,
  /import \{ AppState, View, Text \} from "react-native";\n/,
  `import { AppState, View, Text } from "react-native";\nimport { getCachedEvents, setCachedEvents, type CachedEventSummary } from "./event-cache";\n`,
  "app-context cache import",
);

const refreshPattern = /  const refreshEvents = useCallback\(async \(\) => \{[\s\S]*?\n  \}, \[\]\);/;
const refreshReplacement = `  const refreshEvents = useCallback(async () => {
    if (!supabase) return;
    await ensureAnonymousAuth();
    const sessionId = await getSessionId();
    const { data: memberships, error: membershipError } = await supabase.from("participants").select("event_id").eq("auth_user_id", sessionId);
    if (membershipError) throw membershipError;

    const eventIds = [...new Set((memberships ?? []).map((row) => row.event_id).filter(Boolean))];
    if (!eventIds.length) {
      if (mountedRef.current) setEvents([]);
      await setCachedEvents(sessionId, []);
      return;
    }

    const [{ data: eventRows, error: eventError }, { data: participantRows, error: participantError }, { data: photoRows, error: photoError }] = await Promise.all([
      supabase.from("events").select("id,name,created_at,creator_auth_user_id").eq("status", "active").in("id", eventIds).order("created_at", { ascending: false }).limit(20),
      supabase.from("participants").select("id,event_id").in("event_id", eventIds),
      supabase.from("photos").select("id,event_id,storage_path,thumbnail_path,created_at").in("event_id", eventIds).order("created_at", { ascending: false }).limit(500),
    ]);
    if (eventError) throw eventError;
    if (participantError) throw participantError;
    if (photoError) throw photoError;

    const peopleCounts = new Map<string, number>();
    for (const row of participantRows ?? []) if (row.event_id) peopleCounts.set(row.event_id, (peopleCounts.get(row.event_id) ?? 0) + 1);
    const photoCounts = new Map<string, number>();
    const latestPhoto = new Map<string, any>();
    for (const row of photoRows ?? []) {
      if (!row.event_id) continue;
      photoCounts.set(row.event_id, (photoCounts.get(row.event_id) ?? 0) + 1);
      if (!latestPhoto.has(row.event_id)) latestPhoto.set(row.event_id, row);
    }

    const paths = [...latestPhoto.values()].flatMap((photo) => [photo.thumbnail_path, photo.storage_path].filter(Boolean)) as string[];
    const { signPhotoPaths } = await import("./photo-storage");
    const signed = paths.length ? await signPhotoPaths(paths) : new Map<string, string>();
    const enriched: CachedEventSummary[] = (eventRows ?? []).map((e) => {
      const coverRow = latestPhoto.get(e.id);
      return {
        id: e.id,
        name: e.name,
        people: peopleCounts.get(e.id) ?? 0,
        photos: photoCounts.get(e.id) ?? 0,
        cover: coverRow ? signed.get(coverRow.thumbnail_path || "") || signed.get(coverRow.storage_path) || "" : "",
        creatorAuthUserId: e.creator_auth_user_id ?? null,
      };
    });
    await setCachedEvents(sessionId, enriched);
    if (mountedRef.current) setEvents(enriched);
  }, []);`;
appContext = mustReplace(appContext, refreshPattern, refreshReplacement, "refreshEvents body");

const authLoadPattern = /          await ensureAnonymousAuth\(\);\n          if \(mountedRef\.current\) setAuthReady\(true\);/;
const authLoadReplacement = `          const authenticatedId = await ensureAnonymousAuth();
          const sessionId = authenticatedId || await getSessionId();
          const cachedEvents = await getCachedEvents(sessionId);
          if (mountedRef.current && cachedEvents) setEvents(cachedEvents);
          if (mountedRef.current) setAuthReady(true);`;
appContext = mustReplace(appContext, authLoadPattern, authLoadReplacement, "initial event cache hydration");
write("lib/app-context.tsx", appContext);

let eventScreen = read("app/event/[id].tsx");
eventScreen = mustReplace(
  eventScreen,
  /import \{ attachSignedPhotoUrls \} from "\.\.\/\.\.\/lib\/photo-storage";\n/,
  `import { attachSignedPhotoUrls } from "../../lib/photo-storage";\nimport { getCachedEventDetail, setCachedEventDetail } from "../../lib/event-cache";\n`,
  "event cache import",
);

const hydrationPattern = /        if \(active\) setParticipantId\(currentParticipantId\);[\s\S]*?        const \[eventResult, photosResult, participantsResult\] = await Promise\.all\(\[/;
const hydrationReplacement = `        if (active) setParticipantId(currentParticipantId);

        const cachedDetail = await getCachedEventDetail(String(id));
        if (active && cachedDetail) {
          setEvent(cachedDetail.event);
          setIsCreator(cachedDetail.event?.creator_auth_user_id === sessionId);
          setPeople(cachedDetail.people || []);
          try { setPhotos(await attachSignedPhotoUrls(cachedDetail.photos || [])); } catch {}
        }

        const [eventResult, photosResult, participantsResult] = await Promise.all([`;
eventScreen = mustReplace(eventScreen, hydrationPattern, hydrationReplacement, "event cache hydration");

const networkSetPattern = /        if \(active\) \{\n          setEvent\(eventResult\.data\);\n          const creator = eventResult\.data\?\.creator_auth_user_id === sessionId;\n          setIsCreator\(creator\);\n          setPhotos\(await attachSignedPhotoUrls\(photosResult\.data \|\| \[\]\)\);\n          setPeople\(mergedPeople\);/;
const networkSetReplacement = `        if (active) {
          const freshPhotos = photosResult.data || [];
          setEvent(eventResult.data);
          const creator = eventResult.data?.creator_auth_user_id === sessionId;
          setIsCreator(creator);
          setPhotos(await attachSignedPhotoUrls(freshPhotos));
          setPeople(mergedPeople);
          void setCachedEventDetail(String(id), { event: eventResult.data, photos: freshPhotos, people: mergedPeople });`;
eventScreen = mustReplace(eventScreen, networkSetPattern, networkSetReplacement, "event cache write-through");
write("app/event/[id].tsx", eventScreen);

fs.rmSync(path.join(root, "scripts/apply-event-cache.js"), { force: true });
fs.rmSync(path.join(root, ".github/workflows/apply-event-cache.yml"), { force: true });
console.log("Event cache implementation applied.");

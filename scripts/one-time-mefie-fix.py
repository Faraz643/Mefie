from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

def edit(path, replacements):
    p = ROOT / path
    text = p.read_text(encoding="utf-8")
    original = text
    for old, new in replacements:
        if old not in text:
            raise SystemExit(f"Expected text not found in {path}: {old[:120]!r}")
        text = text.replace(old, new, 1)
    if text == original:
        raise SystemExit(f"No changes made to {path}")
    p.write_text(text, encoding="utf-8", newline="\n")

helper = ROOT / "lib/event-cover.ts"
helper.write_text('''import { supabase } from "./app-context";\nimport { signPhotoPath } from "./photo-storage";\n\n/** Resolve the newest real event photo thumbnail for list/card covers. */\nexport async function getEventCoverUrl(eventId: string) {\n  if (!supabase || !eventId) return null;\n  const { data, error } = await supabase\n    .from("photos")\n    .select("storage_path,thumbnail_path,created_at")\n    .eq("event_id", eventId)\n    .order("created_at", { ascending: false })\n    .limit(1)\n    .maybeSingle();\n  if (error) throw error;\n  if (!data) return null;\n  return (await signPhotoPath(data.thumbnail_path)) || (await signPhotoPath(data.storage_path));\n}\n\nexport async function getEventCoverMap(eventIds: string[]) {\n  const ids = [...new Set(eventIds.filter(Boolean))];\n  const entries = await Promise.all(ids.map(async (id) => [id, await getEventCoverUrl(id)] as const));\n  return Object.fromEntries(entries);\n}\n''', encoding="utf-8", newline="\n")

edit("app/(tabs)/index.tsx", [
    ('import { colors, radii, shadows, typography } from "../../lib/theme";\n', 'import { colors, radii, shadows, typography } from "../../lib/theme";\nimport { getEventCoverMap } from "../../lib/event-cover";\n'),
    ('  const [sessionId, setSessionId] = useState<string | null>(null);\n', '  const [sessionId, setSessionId] = useState<string | null>(null);\n  const [coverOverrides, setCoverOverrides] = useState<Record<string, string>>({});\n'),
    ('  const ownedEvents = events.filter(\n    (event) => event.creatorAuthUserId === sessionId,\n  );\n', '  const ownedEvents = events.filter(\n    (event) => event.creatorAuthUserId === sessionId,\n  );\n\n  useEffect(() => {\n    let active = true;\n    void getEventCoverMap(ownedEvents.map((event) => event.id))\n      .then((map) => { if (active) setCoverOverrides(map as Record<string, string>); })\n      .catch(() => undefined);\n    return () => { active = false; };\n  }, [ownedEvents]);\n'),
    ('                    cover={e.cover}\n', '                    cover={coverOverrides[e.id] || e.cover}\n'),
])

edit("app/(tabs)/events.tsx", [
    ('import { useApp } from "../../lib/app-context";\n', 'import { useApp } from "../../lib/app-context";\nimport { getEventCoverMap } from "../../lib/event-cover";\n'),
    ('import { Image, Pressable, StyleSheet, Text, View } from "react-native";\n', 'import { Pressable, StyleSheet, Text, View } from "react-native";\nimport { Image as ExpoImage } from "expo-image";\n'),
    ('const fallback = "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=800&q=80";\n\n', ''),
    ('  const { events, refreshEvents } = useApp();\n', '  const { events, refreshEvents } = useApp();\n  const [coverOverrides, setCoverOverrides] = React.useState<Record<string, string>>({});\n'),
    ('  useFocusEffect(useCallback(() => { refreshEvents(); }, [refreshEvents]));\n', '  useFocusEffect(useCallback(() => { refreshEvents(); }, [refreshEvents]));\n\n  React.useEffect(() => {\n    let active = true;\n    void getEventCoverMap(events.map((event) => event.id))\n      .then((map) => { if (active) setCoverOverrides(map as Record<string, string>); })\n      .catch(() => undefined);\n    return () => { active = false; };\n  }, [events]);\n'),
    ('                <Image source={{ uri: e.cover || fallback }} style={styles.image} />\n', '                <ExpoImage\n                  source={coverOverrides[e.id] || e.cover ? { uri: coverOverrides[e.id] || e.cover } : undefined}\n                  style={styles.image}\n                  contentFit="cover"\n                  cachePolicy="memory-disk"\n                  recyclingKey={e.id}\n                  transition={0}\n                />\n'),
])

edit("app/event/[id].tsx", [
    ('            .select("id,event_id,display_name,joined_at,last_seen_at,avatar_url")\n', '            .select("id,event_id,auth_user_id,display_name,joined_at,last_seen_at,avatar_url")\n'),
    ('            event: "INSERT",\n            schema: "public",\n            table: "photos",\n', '            event: "*",\n            schema: "public",\n            table: "photos",\n'),
    ('          (payload) => {\n            void attachSignedPhotoUrls([payload.new]).then(([photo]) => {\n              if (!photo?.public_url) return;\n              setPhotos((curr) =>\n                curr.some((x) => x.id === payload.new.id)\n                  ? curr\n                  : [photo, ...curr],\n              );\n            }).catch(() => undefined);\n          },\n', '''          (payload) => {\n            if (payload.eventType === "DELETE") {\n              setPhotos((curr) => curr.filter((photo) => photo.id !== payload.old.id));\n              setSelectedIds((curr) => curr.filter((photoId) => photoId !== payload.old.id));\n              return;\n            }\n            if (payload.eventType === "UPDATE") {\n              void attachSignedPhotoUrls([payload.new]).then(([photo]) => {\n                if (!photo) return;\n                setPhotos((curr) => curr.map((item) => item.id === photo.id ? { ...item, ...photo } : item));\n              }).catch(() => undefined);\n              return;\n            }\n            void attachSignedPhotoUrls([payload.new]).then(([photo]) => {\n              if (!photo?.public_url) return;\n              setPhotos((curr) => curr.some((x) => x.id === payload.new.id) ? curr : [photo, ...curr]);\n            }).catch(() => undefined);\n          },\n'''),
    ('            select: ["id", "event_id", "display_name", "joined_at", "last_seen_at", "avatar_url"],\n', '            select: ["id", "event_id", "auth_user_id", "display_name", "joined_at", "last_seen_at", "avatar_url"],\n'),
])

# Keep the generated helper and edits; the workflow removes itself after this script succeeds.

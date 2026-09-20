import AsyncStorage from "@react-native-async-storage/async-storage";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { createClient } from "@supabase/supabase-js";
import { AppState, View, Text } from "react-native";
import * as FileSystem from "expo-file-system";
import { decode } from "base64-arraybuffer";

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

export const supabase =
  SUPABASE_URL && SUPABASE_ANON_KEY
    ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        auth: {
          storage: AsyncStorage,
          autoRefreshToken: true,
          persistSession: true,
          detectSessionInUrl: false,
        },
      })
    : null;

type DemoEvent = {
  id: string;
  name: string;
  people: number;
  photos: number;
  cover: string;
};
type AppContextValue = {
  displayName: string;
  setDisplayName: (name: string) => Promise<void>;
  avatarImage: string | null;
  setAvatarImage: (uri: string | null) => Promise<void>;
  backgroundImage: string | null;
  setBackgroundImage: (uri: string | null) => Promise<void>;
  events: DemoEvent[];
  refreshEvents: () => Promise<void>;
};

const AVATAR_PENDING_KEY = "mefie.avatarSyncPending";
const AVATAR_MAX_BYTES = 2 * 1024 * 1024;

type PendingAvatarSync = {
  uri: string | null;
  lastUpdated: string;
};

async function queueAvatarSync(uri: string | null) {
  await AsyncStorage.setItem(
    AVATAR_PENDING_KEY,
    JSON.stringify({ uri, lastUpdated: new Date().toISOString() } satisfies PendingAvatarSync),
  );
}

async function clearAvatarSyncQueue() {
  await AsyncStorage.removeItem(AVATAR_PENDING_KEY);
}

async function syncAvatarToCloud(sessionId: string, uri: string | null) {
  if (!supabase) return false;

  if (!uri) {
    const { error: removeError } = await supabase.storage
      .from("avatars")
      .remove([`avatars/${sessionId}.jpg`]);
    if (removeError && removeError.message !== "Not Found") throw removeError;

    const { error: profileError } = await supabase
      .from("avatar_profiles")
      .upsert(
        {
          user_id: sessionId,
          avatar_url: null,
          storage_path: null,
          storage_location: "local_only",
          last_updated: new Date().toISOString(),
        },
        { onConflict: "user_id" },
      );
    if (profileError) throw profileError;

    await supabase
      .from("participants")
      .update({ avatar_url: null })
      .eq("session_id", sessionId);

    return true;
  }

  if (!/^(file|content):\/\//i.test(uri)) {
    const { error } = await supabase
      .from("avatar_profiles")
      .upsert(
        {
          user_id: sessionId,
          avatar_url: uri,
          storage_path: null,
          storage_location: "external_url",
          last_updated: new Date().toISOString(),
        },
        { onConflict: "user_id" },
      );
    if (error) throw error;
    await supabase
      .from("participants")
      .update({ avatar_url: uri })
      .eq("session_id", sessionId);
    return true;
  }

  const info = await FileSystem.getInfoAsync(uri);
  if (!info.exists) throw new Error("The local avatar file no longer exists.");
  if (typeof info.size === "number" && info.size > AVATAR_MAX_BYTES) {
    throw new Error("Avatar must be 2 MB or smaller.");
  }

  const base64 = await FileSystem.readAsStringAsync(uri, {
    encoding: FileSystem.EncodingType.Base64,
  });
  const path = `avatars/${sessionId}.jpg`;
  const { error: uploadError } = await supabase.storage
    .from("avatars")
    .upload(path, decode(base64), {
      contentType: "image/jpeg",
      cacheControl: "3600",
      upsert: true,
    });
  if (uploadError) throw uploadError;

  const { data } = supabase.storage.from("avatars").getPublicUrl(path);
  const versionedUrl = `${data.publicUrl}?v=${Date.now()}`;
  const now = new Date().toISOString();

  const { error: profileError } = await supabase
    .from("avatar_profiles")
    .upsert(
      {
        user_id: sessionId,
        avatar_url: versionedUrl,
        storage_path: path,
        storage_location: "supabase_storage",
        last_updated: now,
      },
      { onConflict: "user_id" },
    );
  if (profileError) throw profileError;

  await supabase
    .from("participants")
    .update({ avatar_url: versionedUrl })
    .eq("session_id", sessionId);

  return true;
}

async function syncLocalAvatarIfNeeded(uri: string) {\n  if (!supabase) return;\n  try {\n    const sessionId = await getSessionId();\n    const { data: profile } = await supabase\n      .from("avatar_profiles")\n      .select("storage_location, storage_path")\n      .eq("user_id", sessionId)\n      .maybeSingle();\n\n    if (!profile || profile.storage_location !== "supabase_storage" || !profile.storage_path?.startsWith("avatars/")) {\n      await queueAvatarSync(uri);\n      await syncAvatarToCloud(sessionId, uri);\n      await clearAvatarSyncQueue();\n    }\n  } catch {\n    // Keep local avatar; foreground retry handles temporary failures.\n  }\n}\n\nasync function syncPendingAvatar() {
  if (!supabase) return;
  const raw = await AsyncStorage.getItem(AVATAR_PENDING_KEY);
  if (!raw) return;
  try {
    const pending = JSON.parse(raw) as PendingAvatarSync;
    const sessionId = await getSessionId();
    await syncAvatarToCloud(sessionId, pending.uri);
    await clearAvatarSyncQueue();
  } catch {
    // Keep the pending item. The next app launch/foreground cycle retries it.
  }
}

const Ctx = createContext<AppContextValue | null>(null);

export async function getSessionId() {
  const key = "mefie.sessionId";
  let id = await AsyncStorage.getItem(key);
  if (!id) {
    id = `${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
    await AsyncStorage.setItem(key, id);
  }
  return id;
}

export async function ensureParticipant(eventId: string, displayName: string, avatarUrl?: string | null) {
  if (!supabase || !eventId) return null;
  const sessionId = await getSessionId();
  const resolvedAvatarUrl =
    avatarUrl && /^(file|content):\/\//i.test(avatarUrl)
      ? supabase.storage.from("photos").getPublicUrl(`avatars/${sessionId}.jpg`).data.publicUrl
      : avatarUrl;
  const { data: existing } = await supabase
    .from("participants")
    .select("*")
    .eq("event_id", eventId)
    .eq("session_id", sessionId)
    .maybeSingle();
  if (existing) {
    await supabase
      .from("participants")
      .update({
        display_name: displayName.trim() || "Guest",
        ...(avatarUrl !== undefined ? { avatar_url: resolvedAvatarUrl } : {}),
        last_seen_at: new Date().toISOString(),
      })
      .eq("id", existing.id);
    return existing.id;
  }
  const { data, error } = await supabase
    .from("participants")
    .insert({
      event_id: eventId,
      session_id: sessionId,
      display_name: displayName.trim() || "Guest",
      ...(avatarUrl !== undefined ? { avatar_url: resolvedAvatarUrl } : {}),
    })
    .select("id")
    .single();
  if (error) throw error;
  return data.id;
}

export async function getParticipantId(eventId: string) {
  if (!supabase) return null;
  const sessionId = await getSessionId();
  const { data } = await supabase
    .from("participants")
    .select("id")
    .eq("event_id", eventId)
    .eq("session_id", sessionId)
    .maybeSingle();
  return data?.id ?? null;
}

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [displayName, setName] = useState("Faraz");
  const [avatarImage, setAvatar] = useState<string | null>(null);
  const [backgroundImage, setBackground] = useState<string | null>(null);
  const [events, setEvents] = useState<DemoEvent[]>([]);
  const mountedRef = React.useRef(false);

  useEffect(() => {
    mountedRef.current = true;
    AsyncStorage.getItem("mefie.displayName").then((v) => {
      if (mountedRef.current && v) setName(v);
    });
    AsyncStorage.getItem("mefie.avatarImage").then((v) => {
      if (mountedRef.current && v) {\n        setAvatar(v);\n        void syncLocalAvatarIfNeeded(v);\n      }
    });
    AsyncStorage.getItem("mefie.backgroundImage").then((v) => {
      if (mountedRef.current && v) setBackground(v);
    });
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const setDisplayName = async (name: string) => {
    const value = name.trim() || "Faraz";
    setName(value);
    await AsyncStorage.setItem("mefie.displayName", value);
  };

  const setAvatarImage = async (uri: string | null) => {
    // Local-first: update the device cache before attempting any network work.
    setAvatar(uri);
    if (uri) await AsyncStorage.setItem("mefie.avatarImage", uri);
    else await AsyncStorage.removeItem("mefie.avatarImage");

    await queueAvatarSync(uri);

    try {
      const sessionId = await getSessionId();
      await syncAvatarToCloud(sessionId, uri);
      await clearAvatarSyncQueue();
    } catch {
      // Offline or temporarily unavailable: local avatar remains usable and
      // the pending operation is retried when the app returns to the foreground.
    }
  };

  const setBackgroundImage = async (uri: string | null) => {
    setBackground(uri);
    if (uri) await AsyncStorage.setItem("mefie.backgroundImage", uri);
    else await AsyncStorage.removeItem("mefie.backgroundImage");
  };

  const refreshEvents = useCallback(async () => {
    if (!supabase) return;
    const { data } = await supabase
      .from("events")
      .select("id,name,created_at")
      .eq("status", "active")
      .order("created_at", { ascending: false })
      .limit(20);
    if (!data || !mountedRef.current) return;
    const enriched = await Promise.all(
      data.map(async (e) => {
        const [{ count: people }, { count: photos }, { data: cover }] =
          await Promise.all([
            supabase
              .from("participants")
              .select("id", { count: "exact", head: true })
              .eq("event_id", e.id),
            supabase
              .from("photos")
              .select("id", { count: "exact", head: true })
              .eq("event_id", e.id),
            supabase
              .from("photos")
              .select("public_url")
              .eq("event_id", e.id)
              .not("public_url", "is", null)
              .order("created_at", { ascending: false })
              .limit(1)
              .maybeSingle(),
          ]);
        return {
          id: e.id,
          name: e.name,
          people: people || 0,
          photos: photos || 0,
          cover: cover?.public_url || "",
        };
      }),
    );
    if (mountedRef.current) setEvents(enriched);
  }, []);

  useEffect(() => {
    void syncPendingAvatar();
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") void syncPendingAvatar();
    });
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    refreshEvents();
  }, [refreshEvents]);

  const value = useMemo(
    () => ({
      displayName,
      setDisplayName,
      avatarImage,
      setAvatarImage,
      backgroundImage,
      setBackgroundImage,
      events,
      refreshEvents,
    }),
    [displayName, avatarImage, backgroundImage, events, refreshEvents],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useApp() {
  const value = useContext(Ctx);
  if (!value) throw new Error("useApp must be used inside AppProvider");
  return value;
}

export function BackendNotice() {
  if (supabase) return null;
  return (
    <View
      style={{
        position: "absolute",
        bottom: 100,
        left: 20,
        right: 20,
        padding: 12,
        borderRadius: 16,
        backgroundColor: "rgba(255,180,0,0.14)",
      }}
    >
      <Text style={{ color: "#fff", textAlign: "center", fontSize: 12 }}>
        Add EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY to enable
        cloud events.
      </Text>
    </View>
  );
}

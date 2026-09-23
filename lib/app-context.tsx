import "react-native-url-polyfill/auto";
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
// PROFILE PHOTO LOGIC DISABLED FOR NOW:
// import { File } from "expo-file-system";

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
  backgroundImage: string | null;
  setBackgroundImage: (uri: string | null) => Promise<void>;
  events: DemoEvent[];
  refreshEvents: () => Promise<void>;
};

/*
  PROFILE PHOTO / AVATAR SYNC LOGIC DISABLED FOR NOW.
  Kept intact for future re-enablement.
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

async function syncAvatarToCloud(sessionId: string, uri: string | null): Promise<string | null> {
  if (!supabase) return null;

  if (!uri) {
    const { error } = await supabase
      .from("profiles")
      .upsert(
        { session_id: sessionId, avatar_url: null, updated_at: new Date().toISOString() },
        { onConflict: "session_id" },
      );
    if (error) throw error;
    return null;
  }

  if (!/^(file|content):\/\//i.test(uri)) {
    const { error } = await supabase
      .from("profiles")
      .upsert(
        { session_id: sessionId, avatar_url: uri, updated_at: new Date().toISOString() },
        { onConflict: "session_id" },
      );
    if (error) throw error;
    return uri;
  }

  const file = new File(uri);
  if (!file.exists) throw new Error("The local avatar file no longer exists.");
  if (file.size > AVATAR_MAX_BYTES) {
    throw new Error("Avatar must be 2 MB or smaller.");
  }

  // Do not turn the image into a base64 JS string. Large base64 strings can
  // fail in React Native/Expo before the upload even reaches Supabase.
  const arrayBuffer = await file.arrayBuffer();
  if (arrayBuffer.byteLength > AVATAR_MAX_BYTES) {
    throw new Error("Avatar must be 2 MB or smaller.");
  }

  const path = `${sessionId}.jpg`;
  const { error: uploadError } = await supabase.storage
    .from("avatars")
    .upload(path, arrayBuffer, {
      contentType: "image/jpeg",
      cacheControl: "3600",
      upsert: true,
    });

  if (uploadError) throw uploadError;

  const { data } = supabase.storage.from("avatars").getPublicUrl(path);
  if (!data.publicUrl) throw new Error("Could not create a public avatar URL.");

  const versionedUrl = `${data.publicUrl}?v=${Date.now()}`;
  const { error: profileError } = await supabase
    .from("profiles")
    .upsert(
      {
        session_id: sessionId,
        avatar_url: versionedUrl,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "session_id" },
    );
  if (profileError) throw profileError;

  return versionedUrl;
}

async function syncLocalAvatarIfNeeded(uri: string) {
  if (!supabase) return;
  try {
    const sessionId = await getSessionId();
    await queueAvatarSync(uri);
    await syncAvatarToCloud(sessionId, uri);
    await clearAvatarSyncQueue();
  } catch {
    // Keep pending; foreground retry will try again.
  }
}

async function syncPendingAvatar() {
  if (!supabase) return;
  const raw = await AsyncStorage.getItem(AVATAR_PENDING_KEY);
  if (!raw) return;
  try {
    const pending = JSON.parse(raw) as PendingAvatarSync;
    const sessionId = await getSessionId();
    await syncAvatarToCloud(sessionId, pending.uri);
    await clearAvatarSyncQueue();
  } catch {
    // Keep pending until the next foreground/launch.
  }
}

*/

const Ctx = createContext<AppContextValue | null>(null);

let authSessionPromise: Promise<string | null> | null = null;

export async function ensureAnonymousAuth(): Promise<string | null> {
  if (!supabase) return null;
  if (authSessionPromise) return authSessionPromise;

  authSessionPromise = (async () => {
    const legacySessionId = await AsyncStorage.getItem("mefie.sessionId");
    // getSession() reads the persisted client session. Verify that identity
    // against the Auth server so a deleted/stale local session cannot bypass
    // anonymous sign-in and leave Mefie using an identity that no longer exists.
    let { data: verifiedUserData, error: verifiedUserError } = await supabase.auth.getUser();

    if (verifiedUserError || !verifiedUserData.user) {
      await supabase.auth.signOut().catch(() => undefined);
      verifiedUserData = { user: null };
      verifiedUserError = null;
    }

    let userId = verifiedUserData.user?.id ?? null;

    if (!userId) {
      const { data, error } = await supabase.auth.signInAnonymously();
      if (error) {
        const projectHost = SUPABASE_URL
          ? (() => {
              try {
                return new URL(SUPABASE_URL).host;
              } catch {
                return SUPABASE_URL;
              }
            })()
          : "missing";

        throw new Error(
          `Mefie anonymous authentication failed: ${error.message} (code=${error.code ?? "unknown"}, status=${error.status ?? "unknown"}, project=${projectHost})`,
        );
      }
      userId = data.user?.id ?? data.session?.user?.id ?? null;
    }

    if (!userId) throw new Error("Mefie could not establish a secure user identity.");

    if (legacySessionId && legacySessionId !== userId) {
      await supabase.rpc("claim_legacy_session", {
        p_legacy_session_id: legacySessionId,
      });
    }

    await AsyncStorage.setItem("mefie.sessionId", userId);
    return userId;
  })();

  try {
    return await authSessionPromise;
  } finally {
    authSessionPromise = null;
  }
}

export async function getSessionId() {
  const userId = await ensureAnonymousAuth();
  if (userId) return userId;

  const key = "mefie.sessionId";
  let id = await AsyncStorage.getItem(key);
  if (!id) {
    id = `${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
    await AsyncStorage.setItem(key, id);
  }
  return id;
}

/* PROFILE PHOTO ARGUMENT/SYNC REMOVED FROM ACTIVE PATH. The previous avatar-aware implementation remains commented above.
export async function ensureParticipant(
  eventId: string,
  displayName: string,
  allowRemovedMember = false,
) {
  if (!supabase || !eventId) return null;
  const sessionId = await getSessionId();

  const { data: eventAccess, error: eventAccessError } = await supabase
    .from("events")
    .select("id,removed_session_ids")
    .eq("id", eventId)
    .maybeSingle();
  if (eventAccessError) throw eventAccessError;
  if (!eventAccess) return null;

  const removedSessionIds = eventAccess.removed_session_ids || [];
  if (removedSessionIds.includes(sessionId) && !allowRemovedMember) {
    return null;
  }

  const { error: profileIdentityError } = await supabase
    .from("profiles")
    .upsert(
      {
        session_id: sessionId,
        display_name: displayName.trim() || "Guest",
        updated_at: new Date().toISOString(),
      },
      { onConflict: "session_id" },
    );
  if (profileIdentityError) throw profileIdentityError;

  const { data: existing, error: existingError } = await supabase
    .from("participants")
    .select("id")
    .eq("event_id", eventId)
    .eq("auth_user_id", sessionId)
    .maybeSingle();
  if (existingError) throw existingError;

  const values = {
    display_name: displayName.trim() || "Guest",
    last_seen_at: new Date().toISOString(),
  };

  if (existing) {
    const { error } = await supabase
      .from("participants")
      .update(values)
      .eq("id", existing.id);
    if (error) throw error;
    return existing.id;
  }

  const { data, error } = await supabase
    .from("participants")
    .insert({
      event_id: eventId,
      session_id: sessionId,
      ...values,
    })
    .select("id")
    .single();
  if (error) throw error;

  if (removedSessionIds.includes(sessionId) && allowRemovedMember) {
    const { error: clearRemovedError } = await supabase.rpc("clear_event_removed_member", {
      p_event_id: eventId,
      p_session_id: sessionId,
    });
    if (clearRemovedError) throw clearRemovedError;
  }

  return data.id;
}
*/
export async function ensureParticipant(
  eventId: string,
  displayName: string,
) {
  if (!supabase || !eventId) return null;

  const sessionId = await getSessionId();
  const { data: existing, error: existingError } = await supabase
    .from("participants")
    .select("id")
    .eq("event_id", eventId)
    .eq("auth_user_id", sessionId)
    .maybeSingle();
  if (existingError) throw existingError;

  const values = {
    display_name: displayName.trim() || "Guest",
    last_seen_at: new Date().toISOString(),
  };

  if (existing) {
    const { error } = await supabase
      .from("participants")
      .update(values)
      .eq("id", existing.id);
    if (error) throw error;
    return existing.id;
  }

  const { data, error } = await supabase
    .from("participants")
    .insert({
      event_id: eventId,
      session_id: sessionId,
      ...values,
    })
    .select("id")
    .single();
  if (error) throw error;

  return data.id;
}

export async function rejoinEventWithTemporaryInvite(
  token: string,
  displayName: string,
) {
  if (!supabase) return null;
  await ensureAnonymousAuth();
  const { data, error } = await supabase.rpc(
    "rejoin_event_with_temporary_invite",
    {
      p_token: token,
      p_display_name: displayName.trim() || "Guest",
    },
  );
  if (error) throw error;
  return data as string | null;
}
export async function deleteEventsAsCreator(eventIds: string[]) {
  if (!supabase || eventIds.length === 0) return;
  for (const eventId of eventIds) {
    const { data: photos, error: photoQueryError } = await supabase
      .from("photos")
      .select("storage_path,thumbnail_path")
      .eq("event_id", eventId);
    if (photoQueryError) throw photoQueryError;

    const paths = Array.from(
      new Set((photos ?? []).flatMap((photo) => [photo.storage_path, photo.thumbnail_path].filter(Boolean))),
    ) as string[];
    if (paths.length) {
      const { error: storageError } = await supabase.storage.from("photos").remove(paths);
      if (storageError) throw storageError;
    }

    const { data: deleted, error } = await supabase.rpc("delete_event_as_creator", {
      p_event_id: eventId,
    });
    if (error) throw error;
    if (!deleted) throw new Error("Only events you created can be deleted.");
  }
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
  const [authReady, setAuthReady] = useState(!supabase);
  const [authError, setAuthError] = useState("");
  const [backgroundImage, setBackground] = useState<string | null>(null);
  const [events, setEvents] = useState<DemoEvent[]>([]);
  const mountedRef = React.useRef(false);

  useEffect(() => {
    mountedRef.current = true;
    void (async () => {
      if (supabase) {
        try {
          await ensureAnonymousAuth();
          if (mountedRef.current) setAuthReady(true);
        } catch (error: any) {
          if (mountedRef.current) {
            setAuthError(error?.message || "Could not establish a secure Mefie identity.");
            setAuthReady(false);
          }
        }
      } else if (mountedRef.current) {
        setAuthReady(true);
      }
    })();

    const authAppStateSubscription = supabase
      ? AppState.addEventListener("change", (state) => {
          if (state === "active") {
            void supabase.auth.startAutoRefresh();
          } else {
            supabase.auth.stopAutoRefresh();
          }
        })
      : null;

    AsyncStorage.getItem("mefie.displayName").then((v) => {
      if (mountedRef.current && v) setName(v);
    });
    /* PROFILE PHOTO LOCAL CACHE LOGIC DISABLED.
    AsyncStorage.getItem("mefie.avatarImage").then((v) => {
      if (mountedRef.current && v) {
        setAvatar(v);
        void syncLocalAvatarIfNeeded(v);
      }
    });
    */
    AsyncStorage.getItem("mefie.backgroundImage").then((v) => {
      if (mountedRef.current && v) setBackground(v);
    });
    return () => {
      mountedRef.current = false;
      authAppStateSubscription?.remove();
      supabase?.auth.stopAutoRefresh();
    };
  }, []);

  const setDisplayName = async (name: string) => {
    const value = name.trim() || "Faraz";
    setName(value);
    await AsyncStorage.setItem("mefie.displayName", value);
  };

  /* PROFILE PHOTO SETTER / CLOUD SYNC DISABLED.
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
    } catch (error) {
      // Local-first still works, but callers can now surface a real sync error.
      throw error;
    }
  };
  */

  const setBackgroundImage = async (uri: string | null) => {
    setBackground(uri);
    if (uri) await AsyncStorage.setItem("mefie.backgroundImage", uri);
    else await AsyncStorage.removeItem("mefie.backgroundImage");
  };

  const refreshEvents = useCallback(async () => {
    if (!supabase) return;
    await ensureAnonymousAuth();
    const sessionId = await getSessionId();
    const { data: memberships, error: membershipError } = await supabase
      .from("participants")
      .select("event_id")
      .eq("auth_user_id", sessionId);
    if (membershipError) throw membershipError;

    const eventIds = [...new Set((memberships ?? []).map((row) => row.event_id))];
    if (!eventIds.length) {
      if (mountedRef.current) setEvents([]);
      return;
    }

    const { data } = await supabase
      .from("events")
      .select("id,name,created_at,creator_auth_user_id")
      .eq("status", "active")
      .in("id", eventIds)
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
          creatorAuthUserId: e.creator_auth_user_id ?? null,
        };
      }),
    );
    if (mountedRef.current) setEvents(enriched);
  }, []);

  /* PROFILE PHOTO RETRY LOGIC DISABLED.
  useEffect(() => {
    void syncPendingAvatar();
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") void syncPendingAvatar();
    });
    return () => subscription.remove();
  }, []);
  */

  useEffect(() => {
    refreshEvents();
  }, [refreshEvents]);

  const value = useMemo(
    () => ({
      displayName,
      setDisplayName,
      backgroundImage,
      setBackgroundImage,
      events,
      refreshEvents,
    }),
    [displayName, backgroundImage, events, refreshEvents],
  );

  if (!authReady) {
    return (
      <View style={{ flex: 1, backgroundColor: "#0A0F15", alignItems: "center", justifyContent: "center", padding: 28 }}>
        <Text style={{ color: "#fff", textAlign: "center", fontSize: 18, fontWeight: "600" }}>
          {authError || "Starting Mefie…"}
        </Text>
        {authError ? (
          <Text style={{ color: "rgba(255,255,255,.68)", textAlign: "center", marginTop: 10, fontSize: 13 }}>
            Enable Anonymous Sign-Ins in Supabase Authentication settings, then restart Mefie.
          </Text>
        ) : null}
      </View>
    );
  }

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

import { BlurView } from "expo-blur";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { Asset } from "expo-asset";
import * as MediaLibrary from "expo-media-library";
import { useLocalSearchParams, useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import React, { useEffect, useRef, useState } from "react";
import {
  Alert,
  Animated,
  Image,
  Pressable,
  Share,
  StyleSheet,
  Text,
  View,
  ActivityIndicator,
  ScrollView,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BackButton } from "../../components/Screen";
import { IconButton } from "../../components/Glass";
import { colors, shadows } from "../../lib/theme";
import { ensureParticipant, getSessionId, supabase, useApp } from "../../lib/app-context";

function gradientForName(name: string): [string, string] {
  const palettes: [string, string][] = [
    ["#5B5FEF", "#9B8CFF"], ["#7C3AED", "#C084FC"], ["#0284C7", "#38BDF8"],
    ["#0F766E", "#2DD4BF"], ["#EA580C", "#FB7185"], ["#DB2777", "#F472B6"],
  ];
  const hash = [...(name || "?")].reduce((sum, char) => sum + char.charCodeAt(0), 0);
  return palettes[hash % palettes.length];
}

const fallbackPhoto =
  "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=1200&q=85";
const HERO_HEIGHT = 250;
const TAB_HEIGHT = 52;
const PLACEHOLDER_PHOTOS = [
  "https://images.unsplash.com/photo-1500534623283-312aade485b7?auto=format&fit=crop&w=700&q=88",
  "https://images.unsplash.com/photo-1511497584788-876760111969?auto=format&fit=crop&w=700&q=88",
  "https://images.unsplash.com/photo-1501785888041-af3ef285b470?auto=format&fit=crop&w=700&q=88",
  "https://images.unsplash.com/photo-1519681393784-d120267933ba?auto=format&fit=crop&w=700&q=88",
  "https://images.unsplash.com/photo-1493246507139-91e8fad9978e?auto=format&fit=crop&w=700&q=88",
  "https://images.unsplash.com/photo-1470770841072-f978cf4d019e?auto=format&fit=crop&w=700&q=88",
  "https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=700&q=88",
  "https://images.unsplash.com/photo-1495567720989-cebdbdd97913?auto=format&fit=crop&w=700&q=88",
  "https://images.unsplash.com/photo-1500534314209-a25ddb2bd429?auto=format&fit=crop&w=700&q=88",
  "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=700&q=88",
  "https://images.unsplash.com/photo-1526481280695-3c687fd5432c?auto=format&fit=crop&w=700&q=88",
  "https://images.unsplash.com/photo-1521292270410-a8c4d716d518?auto=format&fit=crop&w=700&q=88",
  "https://images.unsplash.com/photo-1526772662000-3f88f10405ff?auto=format&fit=crop&w=700&q=88",
  "https://images.unsplash.com/photo-1530789253388-582c481c54b0?auto=format&fit=crop&w=700&q=88",
  "https://images.unsplash.com/photo-1500534623283-312aade485b7?auto=format&fit=crop&w=700&q=82&sat=-12",
  "https://images.unsplash.com/photo-1519681393784-d120267933ba?auto=format&fit=crop&w=700&q=82&sat=12",
  "https://images.unsplash.com/photo-1501785888041-af3ef285b470?auto=format&fit=crop&w=700&q=82&sat=-8",
  "https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=700&q=82&sat=8",
  "https://images.unsplash.com/photo-1470770841072-f978cf4d019e?auto=format&fit=crop&w=700&q=82&sat=-10",
  "https://images.unsplash.com/photo-1493246507139-91e8fad9978e?auto=format&fit=crop&w=700&q=82&sat=10",
];

export default function EventScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { displayName } = useApp();
  const scrollY = useRef(new Animated.Value(0)).current;
  const scrollRef = useRef<ScrollView>(null);
  const photoScrollOffset = useRef(0);
  const peopleScrollOffset = useRef(0);
  const [event, setEvent] = useState<any>(null);
  const [photos, setPhotos] = useState<any[]>([]);
  const [people, setPeople] = useState<any[]>([]);
  const [tab, setTab] = useState<"photos" | "people">("photos");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [selectionMode, setSelectionMode] = useState(false);
  const [actionBusy, setActionBusy] = useState(false);
  const [error, setError] = useState("");
  const [isCreator, setIsCreator] = useState(false);
  /* PROFILE PHOTO LOGIC DISABLED — session avatar loading kept here for future use.
  useEffect(() => {
    void getSessionId().then(setSessionId);
  }, []);
  */

  useEffect(() => {
    let active = true;
    (async () => {
      if (!supabase) return;
      try {
        const sessionId = await getSessionId();
        const participantId = await ensureParticipant(String(id), displayName);
        if (!participantId) {
          if (active) router.replace("/events");
          return;
        }
        const [eventResult, photosResult, participantsResult] = await Promise.all([
          supabase.from("events").select("*").eq("id", id).single(),
          supabase
            .from("photos")
            .select("*")
            .eq("event_id", id)
            .order("created_at", { ascending: false })
            .limit(200),
          supabase
            .from("participants")
            .select("*")
            .eq("event_id", id)
            .order("joined_at", { ascending: true }),
        ]);

        if (eventResult.error) throw eventResult.error;
        if (photosResult.error) throw photosResult.error;
        if (participantsResult.error) throw participantsResult.error;

        const participantRows = participantsResult.data || [];
        // PROFILE PHOTO LOGIC DISABLED — participants now use gradient initials.
        const mergedPeople = participantRows.map((person: any) => ({
          ...person,
          avatar_url: null,
        }));
        /*
        const participantRows = participantsResult.data || [];
        const sessionIds = [...new Set(
          participantRows.map((person: any) => person.session_id).filter(Boolean),
        )];

        const profilesResult = sessionIds.length
          ? await supabase
              .from("profiles")
              .select("session_id,display_name,avatar_url,updated_at")
              .in("session_id", sessionIds)
          : { data: [], error: null };

        if (profilesResult.error) throw profilesResult.error;

        const profileBySession = new Map(
          (profilesResult.data || []).map((profile: any) => [
            profile.session_id,
            profile,
          ]),
        );

        const mergedPeople = participantRows.map((person: any) => {
          const profile = profileBySession.get(person.session_id);
          return {
            ...person,
            display_name: profile?.display_name || person.display_name,
            avatar_url: profile?.avatar_url || null,
          };
        });

        */
        if (active) {
          setEvent(eventResult.data);
          setIsCreator(eventResult.data?.creator_session_id === sessionId);
          setPhotos(photosResult.data || []);
          setPeople(mergedPeople);
        }
      } catch (e: any) {
        if (active) setError(e?.message || "Could not load event.");
      }
    })();
    if (supabase) {
      const client = supabase;
      /* PROFILE PHOTO LOGIC DISABLED — profile refresh kept for future use.
      const refreshPeopleFromProfiles = async () => {
        try {
          const { data: participantRows } = await client
            .from("participants")
            .select("*")
            .eq("event_id", id)
            .order("joined_at", { ascending: true });
          const rows = participantRows || [];
          const sessionIds = [...new Set(
            rows.map((person: any) => person.session_id).filter(Boolean),
          )];
          const { data: profiles } = sessionIds.length
            ? await client
                .from("profiles")
                .select("session_id,display_name,avatar_url,updated_at")
                .in("session_id", sessionIds)
            : { data: [] as any[] };
          const bySession = new Map(
            (profiles || []).map((profile: any) => [profile.session_id, profile]),
          );
          setPeople(rows.map((person: any) => {
            const profile = bySession.get(person.session_id);
            return {
              ...person,
              display_name: profile?.display_name || person.display_name,
              avatar_url: profile?.avatar_url || null,
            };
          }));
        } catch {
          // The realtime payload already keeps participant membership live.
        }
      };
      */
      const ch = client.channel(`event-${id}`)
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "photos",
            filter: `event_id=eq.${id}`,
          },
          (payload) =>
            setPhotos((curr) =>
              curr.some((x) => x.id === payload.new.id)
                ? curr
                : [payload.new, ...curr],
            ),
        )
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "participants",
            filter: `event_id=eq.${id}`,
          },
          (payload) => {
            if (payload.eventType === "INSERT") {
              setPeople((curr) =>
                curr.some((x) => x.id === payload.new.id)
                  ? curr
                  : [...curr, payload.new],
              );
            } else if (payload.eventType === "DELETE") {
              setPeople((curr) => curr.filter((x) => x.id !== payload.old.id));
            } else {
              setPeople((curr) =>
                curr.map((x) =>
                  x.id === payload.new.id ? { ...x, ...payload.new } : x,
                ),
              );
            }
          },
        )
        /* PROFILE PHOTO REALTIME LOGIC DISABLED.
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "profiles",
          },
          (payload) => {
            if (payload.eventType === "DELETE") return;
            const profile = payload.new as any;
            if (!profile?.session_id) return;
            setPeople((curr) =>
              curr.map((person) =>
                person.session_id === profile.session_id
                  ? {
                      ...person,
                      display_name: profile.display_name || person.display_name,
                      avatar_url: profile.avatar_url || null,
                    }
                  : person,
              ),
            );
          },
        )
        */
        .subscribe();
      return () => {
        active = false;
        client.removeChannel(ch);
      };
    }
    return () => {
      active = false;
    };
  }, [id, displayName]);
  useEffect(() => {
    const target =
      tab === "photos" ? photoScrollOffset.current : peopleScrollOffset.current;
    requestAnimationFrame(() =>
      scrollRef.current?.scrollTo({ y: target, animated: false }),
    );
  }, [tab]);
  const removeMember = (participant: any) => {
    if (!isCreator || actionBusy || participant.session_id === undefined) return;
    if (participant.session_id === undefined) return;
    Alert.alert(
      "Remove member?",
      `Remove ${participant.display_name || "this person"} from this event?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: () => {
            void (async () => {
              if (!supabase) return;
              setActionBusy(true);
              try {
                const { data, error: removeError } = await supabase.rpc(
                  "remove_event_member_as_creator",
                  {
                    p_event_id: String(id),
                    p_creator_session_id: await getSessionId(),
                    p_participant_id: participant.id,
                  },
                );
                if (removeError) throw removeError;
                if (!data) throw new Error("Only the event creator can remove members.");
                setPeople((current) => current.filter((person) => person.id !== participant.id));
              } catch (e: any) {
                Alert.alert("Could not remove member", e?.message || "Please try again.");
              } finally {
                setActionBusy(false);
              }
            })();
          },
        },
      ],
    );
  };

  const deleteEvent = () => {
    if (!isCreator || actionBusy) return;
    Alert.alert(
      "Delete event?",
      "This will permanently remove the event and all of its photos for everyone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete event",
          style: "destructive",
          onPress: () => {
            void (async () => {
              if (!supabase) return;
              setActionBusy(true);
              try {
                const paths = photos.map((photo) => photo.storage_path).filter(Boolean);
                if (paths.length) {
                  const { error: storageError } = await supabase.storage
                    .from("photos")
                    .remove(paths);
                  if (storageError) throw storageError;
                }
                const { data, error: deleteError } = await supabase.rpc(
                  "delete_event_as_creator",
                  {
                    p_event_id: String(id),
                    p_creator_session_id: await getSessionId(),
                  },
                );
                if (deleteError) throw deleteError;
                if (!data) {
                  throw new Error("Only the event creator can delete this event.");
                }
                router.replace("/events");
              } catch (e: any) {
                Alert.alert(
                  "Could not delete event",
                  e?.message || "Please try again.",
                );
              } finally {
                setActionBusy(false);
              }
            })();
          },
        },
      ],
    );
  };
  const invite = async () => {
    const link = `https://mefie.app/e/${event?.invite_code || ""}`;
    await Share.share({
      message: `Join ${event?.name || "our Mefie event"} 📸
Everyone's photos go into one shared album.

${link}`,
    });
  };
  const selectTab = (nextTab: "photos" | "people") => {
    if (nextTab === tab) return;
    if (tab === "photos")
      photoScrollOffset.current = Math.max(0, photoScrollOffset.current);
    else peopleScrollOffset.current = Math.max(0, peopleScrollOffset.current);
    setTab(nextTab);
  };
  const galleryPhotos = photos.length
    ? photos
    : PLACEHOLDER_PHOTOS.map((url, index) => ({
        id: `placeholder-${index}`,
        public_url: url,
        placeholder: true,
      }));
  const realPhotos = photos;
  const toggleSelection = (photoId: string) => {
    if (photoId.startsWith("placeholder-")) return;
    setSelectedIds((current) =>
      current.includes(photoId)
        ? current.filter((v) => v !== photoId)
        : [...current, photoId],
    );
  };
  const enterSelection = (photoId?: string) => {
    if (!photoId || photoId.startsWith("placeholder-")) return;
    setSelectionMode(true);
    setSelectedIds((current) =>
      current.includes(photoId) ? current : [...current, photoId],
    );
  };
  const exitSelection = () => {
    setSelectionMode(false);
    setSelectedIds([]);
  };
  const selectAll = () => setSelectedIds(realPhotos.map((photo) => photo.id));
  const saveSelected = async () => {
    const chosen = realPhotos.filter(
      (photo) => selectedIds.includes(photo.id) && photo.public_url,
    );
    if (!chosen.length) {
      Alert.alert("Select photos", "Please select at least one photo to save.");
      return;
    }
    if (actionBusy) return;
    setActionBusy(true);
    try {
      const permission = await MediaLibrary.requestPermissionsAsync();
      if (!permission.granted)
        throw new Error("Photo permission is required to save images.");
      let saved = 0;
      for (const photo of chosen) {
        const asset = Asset.fromURI(photo.public_url);
        await asset.downloadAsync();
        if (!asset.localUri)
          throw new Error("Could not download a selected photo.");
        await MediaLibrary.saveToLibraryAsync(asset.localUri);
        saved += 1;
      }
      Alert.alert(
        "Saved",
        `${saved} photo${saved === 1 ? "" : "s"} saved to your gallery.`,
      );
      exitSelection();
    } catch (e: any) {
      Alert.alert("Could not save photos", e?.message || "Please try again.");
    } finally {
      setActionBusy(false);
    }
  };
  const deleteSelected = () => {
    const chosen = realPhotos.filter((photo) => selectedIds.includes(photo.id));
    if (!chosen.length) {
      Alert.alert(
        "Select photos",
        "Please select at least one photo to delete.",
      );
      return;
    }
    if (actionBusy) return;
    Alert.alert(
      "Delete photos?",
      `Delete ${chosen.length} selected photo${chosen.length === 1 ? "" : "s"} from this event?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => {
            void (async () => {
              if (!supabase) {
                Alert.alert(
                  "Delete unavailable",
                  "Supabase is not configured.",
                );
                return;
              }
              setActionBusy(true);
              try {
                const paths = chosen
                  .map((photo) => photo.storage_path)
                  .filter(Boolean);
                if (paths.length) {
                  const { error: storageError } = await supabase.storage
                    .from("photos")
                    .remove(paths);
                  if (storageError) throw storageError;
                }
                const { error: deleteError } = await supabase
                  .from("photos")
                  .delete()
                  .in(
                    "id",
                    chosen.map((photo) => photo.id),
                  );
                if (deleteError) throw deleteError;
                const deletedIds = new Set(chosen.map((photo) => photo.id));
                setPhotos((current) =>
                  current.filter((photo) => !deletedIds.has(photo.id)),
                );
                Alert.alert(
                  "Deleted",
                  `${chosen.length} photo${chosen.length === 1 ? "" : "s"} deleted.`,
                );
                exitSelection();
              } catch (e: any) {
                Alert.alert(
                  "Could not delete photos",
                  e?.message || "Please try again.",
                );
              } finally {
                setActionBusy(false);
              }
            })();
          },
        },
      ],
    );
  };
  const title = event?.name || "Event";
  const visiblePeople = people.slice(0, 5);
  const heroSource = photos[0]?.public_url || fallbackPhoto;
  const heroOpacity = scrollY.interpolate({
    inputRange: [0, 130, 220],
    outputRange: [1, 0.98, 0],
    extrapolate: "clamp",
  });
  const heroInfoTranslate = scrollY.interpolate({
    inputRange: [0, 170],
    outputRange: [0, -42],
    extrapolate: "clamp",
  });
  return (
    <View style={styles.root}>
      <View pointerEvents="none" style={styles.background}>
        <Image source={{ uri: heroSource }} style={styles.backgroundImage} />
        <LinearGradient
          colors={["rgba(4,9,14,.00)", "rgba(4,9,14,.03)", "rgba(8,16,23,.58)"]}
          locations={[0, 0.48, 1]}
          style={StyleSheet.absoluteFillObject}
        />
        <LinearGradient
          colors={["rgba(4,9,14,.02)", "rgba(4,9,14,.08)", "rgba(8,16,23,.72)"]}
          locations={[0, 0.48, 1]}
          style={StyleSheet.absoluteFillObject}
        />
      </View>
      <Animated.ScrollView
        ref={scrollRef}
        style={styles.scroll}
        contentContainerStyle={{ paddingBottom: insets.bottom + 112 }}
        showsVerticalScrollIndicator={false}
        stickyHeaderIndices={[1]}
        scrollEventThrottle={16}
        bounces
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          {
            useNativeDriver: true,
            listener: (event: NativeSyntheticEvent<NativeScrollEvent>) => {
              const offset = event.nativeEvent.contentOffset.y;
              if (tab === "photos")
                photoScrollOffset.current = Math.max(0, offset);
              else peopleScrollOffset.current = Math.max(0, offset);
            },
          },
        )}
      >
        <Animated.View
          style={[
            styles.heroContent,
            { paddingTop: insets.top + 15, opacity: heroOpacity },
          ]}
        >
          <View style={styles.top}>
            <BackButton />
            <View style={styles.headerActions}>
              {isCreator ? (
                <IconButton plain accessibilityLabel="Delete event" onPress={deleteEvent}>
                  <MaterialCommunityIcons
                    name="trash-can-outline"
                    size={20}
                    color="rgba(255,255,255,.92)"
                  />
                </IconButton>
              ) : null}
              <IconButton plain accessibilityLabel="Invite friends" onPress={invite}>
                <MaterialCommunityIcons
                  name="link-variant"
                  size={21}
                  color={colors.white}
                />
              </IconButton>
            </View>
          </View>
          <Animated.View
            style={{ transform: [{ translateY: heroInfoTranslate }] }}
          >
            <View style={styles.heroInfo}>
              <Text style={styles.title} numberOfLines={1}>
                {title}
              </Text>
              <Text style={styles.meta}>
                {people.length} people · {photos.length} photos
              </Text>
              <View style={styles.avatars}>
                {visiblePeople.map((person, index) => {
                  return (
                    <LinearGradient
                      key={person.id || index}
                      colors={gradientForName(person.display_name)}
                      style={[styles.avatar, index > 0 && styles.avatarOverlap]}
                    >
                      <Text style={styles.avatarText}>
                        {(person.display_name || "?")[0].toUpperCase()}
                      </Text>
                    </LinearGradient>
                  );
                })}
                {people.length > 5 ? (
                  <View
                    style={[
                      styles.avatar,
                      styles.avatarOverlap,
                      styles.moreAvatar,
                    ]}
                  >
                    <Text style={styles.moreText}>+{people.length - 5}</Text>
                  </View>
                ) : null}
              </View>
            </View>
          </Animated.View>
        </Animated.View>
        <View style={styles.tabsSticky}>
          {selectionMode ? (
            <View style={styles.selectionHeader}>
              <Pressable onPress={exitSelection}>
                <Text style={styles.selectionSide}>Cancel</Text>
              </Pressable>
              <Text style={styles.selectionCount}>
                {selectedIds.length} selected
              </Text>
              <Pressable onPress={selectAll}>
                <Text style={styles.selectionSide}>Select all</Text>
              </Pressable>
            </View>
          ) : (
            <BlurView
              intensity={58}
              tint="dark"
              style={styles.tabs}
            >
              <View style={styles.tabsContent}>
                <Pressable
                  onPress={() => selectTab("photos")}
                  style={[styles.tab, tab === "photos" && styles.activeTab]}
                >
                  <MaterialCommunityIcons
                    name="image-multiple-outline"
                    size={18}
                    color={
                      tab === "photos" ? colors.black : "rgba(255,255,255,.96)"
                    }
                  />
                  <Text
                    style={
                      tab === "photos" ? styles.activeTabText : styles.tabText
                    }
                  >
                    Photos
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() => selectTab("people")}
                  style={[styles.tab, tab === "people" && styles.activeTab]}
                >
                  <MaterialCommunityIcons
                    name="account-group-outline"
                    size={18}
                    color={
                      tab === "people" ? colors.black : "rgba(255,255,255,.94)"
                    }
                  />
                  <Text
                    style={
                      tab === "people" ? styles.activeTabText : styles.tabText
                    }
                  >
                    People
                  </Text>
                </Pressable>
              </View>
            </BlurView>
          )}
        </View>
        <View style={styles.gallery}>
          {error ? <Text style={styles.error}>{error}</Text> : null}
          {tab === "photos" ? (
            <View style={styles.grid}>
              {galleryPhotos.map((photo, index) => {
                const selected = selectedIds.includes(photo.id);
                return (
                  <Pressable
                    key={photo.id || index}
                    disabled={photo.placeholder}
                    style={[styles.photo, selected && styles.selectedPhoto]}
                    onPress={() =>
                      selectionMode
                        ? toggleSelection(photo.id)
                        : router.push({
                            pathname: "/photo/[id]",
                            params: {
                              id: photo.id,
                              eventId: id,
                              index: String(index),
                            },
                          })
                    }
                    onLongPress={() => enterSelection(photo.id)}
                    delayLongPress={280}
                  >
                    <Image
                      source={{ uri: photo.public_url }}
                      style={styles.photoImage}
                    />
                    {selectionMode && !photo.placeholder ? (
                      <View
                        style={[styles.check, selected && styles.checkSelected]}
                      >
                        <MaterialCommunityIcons
                          name={selected ? "check" : "circle-outline"}
                          size={selected ? 19 : 20}
                          color={
                            selected ? colors.white : "rgba(255,255,255,.95)"
                          }
                        />
                      </View>
                    ) : null}
                  </Pressable>
                );
              })}
            </View>
          ) : (
            <View style={styles.peopleList}>
              {people.map((person) => {
                return (
                  <View key={person.id} style={styles.person}>
                    <LinearGradient
                      colors={gradientForName(person.display_name)}
                      style={styles.personAvatar}
                    >
                      <Text style={styles.avatarText}>
                        {(person.display_name || "?")[0].toUpperCase()}
                      </Text>
                    </LinearGradient>
                    <View style={styles.personDetails}>
                      <Text style={styles.personName}>
                        {person.display_name}
                      </Text>
                      <Text style={styles.personMeta}>
                        Joined {new Date(person.joined_at).toLocaleDateString()}
                      </Text>
                    </View>
                    {isCreator && person.session_id !== (event?.creator_session_id || "") ? (
                      <Pressable
                        onPress={() => removeMember(person)}
                        disabled={actionBusy}
                        style={styles.removeMemberButton}
                        accessibilityLabel={`Remove ${person.display_name || "member"}`}
                      >
                        <MaterialCommunityIcons
                          name="account-remove-outline"
                          size={20}
                          color="rgba(255,255,255,.82)"
                        />
                      </Pressable>
                    ) : null}
                  </View>
                );
              })}
            </View>
          )}
        </View>
      </Animated.ScrollView>
      {selectionMode ? (
        <View
          style={[
            styles.selectionBar,
            { bottom: Math.max(insets.bottom + 18, 24) },
          ]}
        >
          <Pressable
            hitSlop={8}
            disabled={!selectedIds.length || actionBusy}
            onPress={saveSelected}
            style={[
              styles.selectionAction,
              (!selectedIds.length || actionBusy) && styles.disabledAction,
            ]}
          >
            {actionBusy ? (
              <ActivityIndicator color={colors.black} />
            ) : (
              <>
                <MaterialCommunityIcons
                  name="download-outline"
                  size={21}
                  color={colors.black}
                />
                <Text style={styles.selectionActionText}>
                  Save to Gallery ({selectedIds.length})
                </Text>
              </>
            )}
          </Pressable>
          <Pressable
            hitSlop={8}
            disabled={!selectedIds.length || actionBusy}
            onPress={deleteSelected}
            style={[
              styles.deleteAction,
              (!selectedIds.length || actionBusy) && styles.disabledDelete,
            ]}
          >
            <MaterialCommunityIcons
              name="trash-can-outline"
              size={21}
              color="#fff"
            />
            <Text style={styles.deleteText}>Delete</Text>
          </Pressable>
        </View>
      ) : (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Take a photo"
          onPress={() =>
            router.push({
              pathname: "/camera/[eventId]",
              params: { eventId: id },
            })
          }
          style={[styles.camera, { bottom: Math.max(insets.bottom + 18, 24) }]}
        >
          <MaterialCommunityIcons
            name="camera-outline"
            size={27}
            color={colors.black}
          />
        </Pressable>
      )}
    </View>
  );
}
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#081017" },
  scroll: { flex: 1, zIndex: 0, elevation: 0 },
  background: { ...StyleSheet.absoluteFillObject, overflow: "hidden" },
  backgroundImage: { ...StyleSheet.absoluteFillObject, resizeMode: "cover" },
  heroContent: { minHeight: HERO_HEIGHT, paddingHorizontal: 20 },
  top: { flexDirection: "row", justifyContent: "space-between" },
  headerActions: { flexDirection: "row", alignItems: "center", gap: 6 },
  heroInfo: { paddingTop: 29, paddingBottom: 2 },
  title: {
    color: colors.white,
    fontSize: 29,
    lineHeight: 35,
    fontWeight: "800",
    letterSpacing: -0.7,
  },
  meta: { color: "rgba(255,255,255,.80)", fontSize: 14, marginTop: 1 },
  avatars: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: 38,
    marginTop: 10,
    paddingLeft: 1,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,.22)",
    borderWidth: 2,
    borderColor: "rgba(8,16,23,.92)",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  avatarOverlap: { marginLeft: -7 },
  // PROFILE PHOTO STYLE DISABLED — kept for future image avatars.
  /* avatarImage: { width: "100%", height: "100%" }, */
  avatarText: { color: colors.white, fontSize: 14, fontWeight: "800" },
  moreAvatar: { backgroundColor: "rgba(25,33,42,.88)" },
  moreText: { color: colors.white, fontSize: 13, fontWeight: "800" },
  tabsSticky: {
    height: 80,
    paddingHorizontal: 20,
    paddingTop: 13,
    paddingBottom: 5,
    backgroundColor: "transparent",
    zIndex: 10,
  },
  tabs: {
    alignSelf: "center",
    width: "82%",
    height: 58,
    borderRadius: 29,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,.20)",
    backgroundColor: "rgba(30,35,42,.46)",
    ...shadows,
  },
  tabsContent: {
    flex: 1,
    padding: 5,
    flexDirection: "row",
  },
  tab: {
    flex: 1,
    borderRadius: 24,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  activeTab: {
    backgroundColor: "rgba(255,255,255,.98)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,.98)",
    shadowColor: "#fff",
    shadowOpacity: 0.4,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 1 },
    elevation: 4,
  },
  tabText: { color: "rgba(255,255,255,.94)", fontSize: 16, fontWeight: "700" },
  activeTabText: { color: colors.black, fontSize: 16, fontWeight: "800" },
  selectionHeader: {
    height: 68,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 8,
  },
  selectionSide: { color: "#fff", fontSize: 14, fontWeight: "700" },
  selectionCount: { color: "#fff", fontSize: 16, fontWeight: "800" },
  gallery: {
    position: "relative",
    paddingHorizontal: 10,
    paddingTop: 0,
    backgroundColor: "transparent",
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "flex-start",
    columnGap: "1.85%",
    rowGap: 4,
  },
  photo: {
    width: "32.1%",
    aspectRatio: 1,
    borderRadius: 10,
    overflow: "hidden",
    backgroundColor: "#26313b",
    borderWidth: 0,
  },
  selectedPhoto: { borderWidth: 3, borderColor: "#fff" },
  photoImage: { width: "100%", height: "100%" },
  check: {
    position: "absolute",
    top: 8,
    right: 8,
    width: 27,
    height: 27,
    borderRadius: 14,
    backgroundColor: "rgba(10,14,18,.45)",
    borderWidth: 1.5,
    borderColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
  },
  checkSelected: { backgroundColor: "#2787ff", borderColor: "#fff" },
  error: { color: "#FFB4B4", paddingBottom: 8 },
  peopleList: { paddingTop: 3 },
  person: { flexDirection: "row", alignItems: "center", paddingVertical: 9 },
  personAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(255,255,255,.16)",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
    overflow: "hidden",
  },
  // PROFILE PHOTO STYLE DISABLED — kept for future image avatars.
  /* personAvatarImage: { width: "100%", height: "100%" }, */
  personDetails: { flex: 1 },
  personName: { color: colors.white, fontWeight: "800", fontSize: 15 },
  personMeta: { color: colors.muted, fontSize: 12, marginTop: 3 },
  removeMemberButton: { width: 42, height: 42, borderRadius: 21, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,.08)", borderWidth: 1, borderColor: "rgba(255,255,255,.10)" },
  selectionBar: {
    position: "absolute",
    left: 18,
    right: 18,
    minHeight: 60,
    borderRadius: 30,
    backgroundColor: "rgba(245,248,250,.96)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,.85)",
    padding: 6,
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    zIndex: 1000,
    elevation: 50,
    ...shadows,
  },
  selectionAction: {
    flex: 1,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#fff",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
  },
  selectionActionText: { color: colors.black, fontSize: 14, fontWeight: "800" },
  disabledAction: { opacity: 0.45 },
  deleteAction: {
    height: 48,
    paddingHorizontal: 18,
    borderRadius: 24,
    backgroundColor: "#171d24",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  disabledDelete: { opacity: 0.35 },
  deleteText: { color: "#fff", fontSize: 14, fontWeight: "800" },
  camera: {
    position: "absolute",
    alignSelf: "center",
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 4,
    borderColor: "rgba(255,255,255,.32)",
    zIndex: 100,
    elevation: 20,
    ...shadows,
  },
});

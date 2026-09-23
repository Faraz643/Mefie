import AsyncStorage from "@react-native-async-storage/async-storage";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { Asset } from "expo-asset";
import * as Clipboard from "expo-clipboard";
import QRCode from "react-native-qrcode-svg";
import * as MediaLibrary from "expo-media-library";
import { useLocalSearchParams, useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  Modal,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { FlashList, type FlashListRef } from "@shopify/flash-list";
import { Image as ExpoImage } from "expo-image";
import { BackButton } from "../../components/Screen";
import { IconButton } from "../../components/Glass";
import { colors, shadows, typography } from "../../lib/theme";
import { getParticipantId, getSessionId, supabase, useApp } from "../../lib/app-context";
import { attachSignedPhotoUrls, signPhotoPath } from "../../lib/photo-storage";

function gradientForName(name: string): [string, string] {
  const palettes: [string, string][] = [
    ["#5B5FEF", "#9B8CFF"], ["#7C3AED", "#C084FC"], ["#0284C7", "#38BDF8"],
    ["#0F766E", "#2DD4BF"], ["#EA580C", "#FB7185"], ["#DB2777", "#F472B6"],
  ];
  const hash = [...(name || "?")].reduce((sum, char) => sum + char.charCodeAt(0), 0);
  return palettes[hash % palettes.length];
}

const HERO_HEIGHT = 250;
const TAB_HEIGHT = 52;

export default function EventScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { displayName, backgroundImage } = useApp();
  const [storedBackgroundImage, setStoredBackgroundImage] = useState<string | null>(backgroundImage);
  const scrollRef = useRef<FlashListRef<any>>(null);
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
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteSlide, setInviteSlide] = useState<0 | 1>(0);
  const [temporaryInvite, setTemporaryInvite] = useState<{ token: string; expiresAt: string } | null>(null);
  const [temporaryInviteBusy, setTemporaryInviteBusy] = useState(false);
  const [temporarySecondsLeft, setTemporarySecondsLeft] = useState(0);
  useEffect(() => {
    if (backgroundImage) {
      setStoredBackgroundImage(backgroundImage);
      return;
    }
    AsyncStorage.getItem("mefie.backgroundImage").then((uri) => {
      if (uri) setStoredBackgroundImage(uri);
    });
  }, [backgroundImage]);
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
        const participantId = await getParticipantId(String(id));
        if (!participantId) {
          if (active) router.replace("/join-event");
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
          setIsCreator(eventResult.data?.creator_auth_user_id === sessionId);
          setPhotos(await attachSignedPhotoUrls(photosResult.data || []));
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
      const ch = client.channel(`event-${id}-${Date.now()}`)
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "photos",
            filter: `event_id=eq.${id}`,
          },
          (payload) => {
            void signPhotoPath(payload.new.storage_path).then((signedUrl) => {
              if (!signedUrl) return;
              setPhotos((curr) =>
                curr.some((x) => x.id === payload.new.id)
                  ? curr
                  : [{ ...payload.new, public_url: signedUrl }, ...curr],
              );
            }).catch(() => undefined);
          },
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
  }, [id]);
  useEffect(() => {
    const target =
      tab === "photos" ? photoScrollOffset.current : peopleScrollOffset.current;
    requestAnimationFrame(() =>
      scrollRef.current?.scrollToOffset({
        offset: Math.max(0, target),
        animated: false,
      }),
    );
  }, [tab]);
  const removeMember = (participant: any) => {
    if (!isCreator || actionBusy || participant.auth_user_id === undefined) return;
    if (participant.auth_user_id === undefined) return;
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
  const permanentInviteLink = event?.invite_code
    ? `https://mefie.app/e/${event.invite_code}`
    : "";

  const temporaryInviteLink = temporaryInvite
    ? `https://mefie.app/rejoin/${temporaryInvite.token}`
    : "";

  useEffect(() => {
    if (!temporaryInvite) {
      setTemporarySecondsLeft(0);
      return;
    }
    const update = () => {
      const remaining = Math.max(
        0,
        Math.ceil((new Date(temporaryInvite.expiresAt).getTime() - Date.now()) / 1000),
      );
      setTemporarySecondsLeft(remaining);
      if (remaining === 0) setTemporaryInvite(null);
    };
    update();
    const timer = setInterval(update, 1000);
    return () => clearInterval(timer);
  }, [temporaryInvite]);

  const openInvites = () => {
    setInviteSlide(0);
    setInviteOpen(true);
  };

  const closeInvites = () => {
    setInviteOpen(false);
    setInviteSlide(0);
  };

  const shareInvite = async (link: string, temporary = false) => {
    if (!link) return;
    await Share.share({
      message: temporary
        ? `Quick access link for ${event?.name || "this Mefie event"} 📸
This invite expires in 5 minutes.

${link}`
        : `Join ${event?.name || "our Mefie event"} 📸
Everyone's photos go into one shared album.

${link}`,
    });
  };

  const copyInvite = async (link: string) => {
    if (!link) return;
    await Clipboard.setStringAsync(link);
    Alert.alert("Copied", "Invite link copied to your clipboard.");
  };

  const createTemporaryInvite = async () => {
    if (!supabase || !isCreator || temporaryInviteBusy) return;
    setTemporaryInviteBusy(true);
    try {
      const { data, error: createError } = await supabase.rpc(
        "create_event_temporary_invite",
        {
          p_event_id: String(id),
        },
      );
      if (createError) throw createError;
      const row = Array.isArray(data) ? data[0] : data;
      if (!row?.token || !row?.expires_at) {
        throw new Error("Could not create the temporary invite.");
      }
      setTemporaryInvite({
        token: row.token,
        expiresAt: row.expires_at,
      });
      setInviteSlide(1);
    } catch (e: any) {
      Alert.alert(
        "Could not create invite",
        e?.message || "Please try again.",
      );
    } finally {
      setTemporaryInviteBusy(false);
    }
  };
  const selectTab = (nextTab: "photos" | "people") => {
    if (nextTab === tab) return;
    if (tab === "photos")
      photoScrollOffset.current = Math.max(0, photoScrollOffset.current);
    else peopleScrollOffset.current = Math.max(0, peopleScrollOffset.current);
    setTab(nextTab);
  };
  const galleryPhotos = photos;
  const realPhotos = photos;
  const listData = useMemo(
    () => [
      { type: "tabs", key: "tabs" },
      ...(tab === "photos"
        ? galleryPhotos.map((photo) => ({ type: "photo", ...photo }))
        : people.map((person) => ({ type: "person", ...person }))),
    ],
    [galleryPhotos, people, tab],
  );
  const toggleSelection = (photoId: string) => {
    setSelectedIds((current) =>
      current.includes(photoId)
        ? current.filter((v) => v !== photoId)
        : [...current, photoId],
    );
  };
  const enterSelection = (photoId?: string) => {
    if (!photoId) return;
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
    const chosen = realPhotos.filter(
      (photo) =>
        selectedIds.includes(photo.id) &&
        (isCreator || photo.participant_id === participantId),
    );
    if (!chosen.length) {
      Alert.alert(
        "Delete unavailable",
        isCreator
          ? "Please select at least one photo to delete."
          : "You can only delete photos you uploaded.",
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
  const heroSource = photos[0]?.public_url || storedBackgroundImage;
  return (
    <>
      <View style={styles.root}>
      <View pointerEvents="none" style={styles.background}>
        <ExpoImage
          source={heroSource ? { uri: heroSource } : undefined}
          style={styles.backgroundImage}
          contentFit="cover"
          cachePolicy="memory-disk"
          priority="low"
          blurRadius={18}
        />
        <LinearGradient
          colors={["rgba(4,9,14,.18)", "rgba(4,9,14,.30)", "rgba(8,16,23,.64)"]}
          locations={[0, 0.48, 1]}
          style={StyleSheet.absoluteFillObject}
        />

      </View>
      <FlashList
        key={tab}
        ref={scrollRef}
        style={styles.scroll}
        contentContainerStyle={{ paddingBottom: insets.bottom + 112, paddingHorizontal: 8 }}
        showsVerticalScrollIndicator={false}
        stickyHeaderIndices={[0]}
        estimatedItemSize={112}
        drawDistance={420}
        optimizeItemArrangement
        scrollEventThrottle={16}
        bounces
        data={listData}
        numColumns={3}
        extraData={{ selectionMode, selectedIds }}
        ListHeaderComponent={
          <Animated.View
            style={[
              styles.heroContent,
              { paddingTop: insets.top + 15 },
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
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Open event QR and invites"
                  onPress={openInvites}
                  style={styles.inviteHeaderButton}
                >
                  <MaterialCommunityIcons name="qrcode" size={23} color="#FFFFFF" />
                  <Text style={styles.inviteHeaderText}>Invite</Text>
                </Pressable>
              </View>
            </View>
            <View>
              <View style={styles.heroInfo}>
                <Text style={styles.title} numberOfLines={1}>{title}</Text>
                <Text style={styles.meta}>{people.length} people · {photos.length} photos</Text>
                <View style={styles.avatars}>
                  {visiblePeople.map((person, index) => (
                    <LinearGradient
                      key={person.id || index}
                      colors={gradientForName(person.display_name)}
                      style={[styles.avatar, index > 0 && styles.avatarOverlap]}
                    >
                      <Text style={styles.avatarText}>
                        {(person.display_name || "?")[0].toUpperCase()}
                      </Text>
                    </LinearGradient>
                  ))}
                  {people.length > 5 ? (
                    <View style={[styles.avatar, styles.avatarOverlap, styles.moreAvatar]}>
                      <Text style={styles.moreText}>+{people.length - 5}</Text>
                    </View>
                  ) : null}
                </View>
              </View>
            </View>
          </Animated.View>
        }
        getItemType={(item) => item.type}
        overrideItemLayout={(layout, item) => {
          layout.span = item.type === "photo" ? 1 : 3;
        }}
        keyExtractor={(item, index) => item.key || item.id || `${item.type}-${index}`}
        renderItem={({ item, index }) => {
          if (item.type === "tabs") {
            return (
              <View style={styles.tabsSticky}>
                {selectionMode ? (
                  <View style={styles.selectionHeader}>
                    <Pressable onPress={exitSelection}>
                      <Text style={styles.selectionSide}>Cancel</Text>
                    </Pressable>
                    <Text style={styles.selectionCount}>{selectedIds.length} selected</Text>
                    <Pressable onPress={selectAll}>
                      <Text style={styles.selectionSide}>Select all</Text>
                    </Pressable>
                  </View>
                ) : (
                  <View style={styles.tabs}>
                    <View style={styles.tabsContent}>
                      <Pressable
                        onPress={() => selectTab("photos")}
                        style={[styles.tab, tab === "photos" && styles.activeTab]}
                      >
                        <MaterialCommunityIcons
                          name="image-multiple-outline"
                          size={18}
                          color={tab === "photos" ? colors.black : "rgba(255,255,255,.96)"}
                        />
                        <Text style={tab === "photos" ? styles.activeTabText : styles.tabText}>
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
                          color={tab === "people" ? colors.black : "rgba(255,255,255,.94)"}
                        />
                        <Text style={tab === "people" ? styles.activeTabText : styles.tabText}>
                          People
                        </Text>
                      </Pressable>
                    </View>
                  </View>
                )}
              </View>
            );
          }

          if (item.type === "photo") {
            const selected = selectedIds.includes(item.id);
            const photoIndex = index - 1;
            return (
              <Pressable
                disabled={item.placeholder}
                style={[styles.photoCell, selected && styles.selectedPhoto]}
                onPress={() =>
                  selectionMode
                    ? toggleSelection(item.id)
                    : router.push({
                        pathname: "/photo/[id]",
                        params: { id: item.id, eventId: id, index: String(photoIndex) },
                      })
                }
                onLongPress={() => enterSelection(item.id)}
                delayLongPress={280}
              >
                <ExpoImage
                  source={{ uri: item.public_url }}
                  style={styles.photoImage}
                  contentFit="cover"
                  cachePolicy="memory-disk"
                  recyclingKey={item.id}
                  allowDownscaling
                  priority="low"
                  transition={0}
                />
                {selectionMode && !item.placeholder ? (
                  <View style={[styles.check, selected && styles.checkSelected]}>
                    <MaterialCommunityIcons
                      name={selected ? "check" : "circle-outline"}
                      size={selected ? 19 : 20}
                      color={selected ? colors.white : "rgba(255,255,255,.95)"}
                    />
                  </View>
                ) : null}
              </Pressable>
            );
          }

          const person = item;
          return (
            <View style={styles.person}>
              <LinearGradient
                colors={gradientForName(person.display_name)}
                style={styles.personAvatar}
              >
                <Text style={styles.avatarText}>
                  {(person.display_name || "?")[0].toUpperCase()}
                </Text>
              </LinearGradient>
              <View style={styles.personDetails}>
                <Text style={styles.personName}>{person.display_name}</Text>
                <Text style={styles.personMeta}>
                  Joined {new Date(person.joined_at).toLocaleDateString()}
                </Text>
              </View>
              {isCreator && person.auth_user_id !== (event?.creator_auth_user_id || "") ? (
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
        }}
        onScroll={(event) => {
          const offset = Math.max(0, event.nativeEvent.contentOffset.y);
          if (tab === "photos") photoScrollOffset.current = offset;
          else peopleScrollOffset.current = offset;
        }}
      />
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

      <Modal
        visible={inviteOpen}
        transparent
        animationType="slide"
        onRequestClose={closeInvites}
      >
        <View style={styles.inviteModalBackdrop}>
          <Pressable style={StyleSheet.absoluteFillObject} onPress={closeInvites} />
          <View style={[styles.inviteSheet, { paddingBottom: Math.max(insets.bottom + 18, 24) }]}>
            <View style={styles.inviteHandle} />
            <View style={styles.inviteSheetHeader}>
              <View>
                <Text style={styles.inviteEyebrow}>EVENT INVITES</Text>
                <Text style={styles.inviteSheetTitle}>
                  {inviteSlide === 0 ? "Invite to this event" : "Quick access"}
                </Text>
              </View>
              <Pressable style={styles.inviteClose} onPress={closeInvites}>
                <MaterialCommunityIcons name="close" size={20} color={colors.white} />
              </Pressable>
            </View>

            {inviteSlide === 0 ? (
              <View style={styles.inviteSlide}>
                <Text style={styles.inviteDescription}>
                  This permanent invite stays active while the event is active.
                </Text>
                <View style={styles.qrFrame}>
                  {permanentInviteLink ? (
                    <QRCode
                      value={permanentInviteLink}
                      size={210}
                      backgroundColor="#fff"
                      color="#0A1118"
                    />
                  ) : null}
                </View>
                <View style={styles.inviteLinkRow}>
                  <View style={styles.inviteLinkCopy}>
                    <MaterialCommunityIcons name="link-variant" size={18} color="rgba(255,255,255,.72)" />
                    <Text style={styles.inviteLinkText} numberOfLines={1}>
                      {permanentInviteLink}
                    </Text>
                  </View>
                  <Pressable style={styles.copyButton} onPress={() => copyInvite(permanentInviteLink)}>
                    <MaterialCommunityIcons name="content-copy" size={18} color={colors.white} />
                  </Pressable>
                </View>
                <View style={styles.inviteActions}>
                  <Pressable style={styles.secondaryInviteButton} onPress={() => shareInvite(permanentInviteLink)}>
                    <MaterialCommunityIcons name="share-variant-outline" size={19} color={colors.white} />
                    <Text style={styles.secondaryInviteText}>Share</Text>
                  </Pressable>
                  {isCreator ? (
                    <Pressable
                      style={styles.primaryInviteButton}
                      onPress={createTemporaryInvite}
                      disabled={temporaryInviteBusy}
                    >
                      {temporaryInviteBusy ? (
                        <ActivityIndicator color={colors.black} />
                      ) : (
                        <>
                          <MaterialCommunityIcons name="timer-plus-outline" size={19} color={colors.black} />
                          <Text style={styles.primaryInviteText}>Quick access</Text>
                        </>
                      )}
                    </Pressable>
                  ) : null}
                </View>
              </View>
            ) : (
              <View style={styles.inviteSlide}>
                <View style={styles.temporaryBadge}>
                  <MaterialCommunityIcons name="clock-fast" size={17} color="#fff" />
                  <Text style={styles.temporaryBadgeText}>
                    {temporarySecondsLeft > 0
                      ? `Expires in ${Math.floor(temporarySecondsLeft / 60)}:${String(temporarySecondsLeft % 60).padStart(2, "0")}`
                      : "Expired"}
                  </Text>
                </View>
                {temporaryInvite && temporarySecondsLeft > 0 ? (
                  <>
                    <Text style={styles.inviteDescription}>
                      Anyone with this QR or link can join the event. The link is available for 5 minutes; joining does not expire your membership.
                    </Text>
                    <View style={styles.qrFrame}>
                      <QRCode
                        value={temporaryInviteLink}
                        size={210}
                        backgroundColor="#fff"
                        color="#0A1118"
                      />
                    </View>
                    <View style={styles.inviteLinkRow}>
                      <View style={styles.inviteLinkCopy}>
                        <MaterialCommunityIcons name="link-variant" size={18} color="rgba(255,255,255,.72)" />
                        <Text style={styles.inviteLinkText} numberOfLines={1}>
                          {temporaryInviteLink}
                        </Text>
                      </View>
                      <Pressable style={styles.copyButton} onPress={() => copyInvite(temporaryInviteLink)}>
                        <MaterialCommunityIcons name="content-copy" size={18} color={colors.white} />
                      </Pressable>
                    </View>
                    <View style={styles.inviteActions}>
                      <Pressable style={styles.secondaryInviteButton} onPress={() => shareInvite(temporaryInviteLink, true)}>
                        <MaterialCommunityIcons name="share-variant-outline" size={19} color={colors.white} />
                        <Text style={styles.secondaryInviteText}>Share</Text>
                      </Pressable>
                      <Pressable style={styles.primaryInviteButton} onPress={createTemporaryInvite} disabled={temporaryInviteBusy}>
                        {temporaryInviteBusy ? (
                          <ActivityIndicator color={colors.black} />
                        ) : (
                          <>
                            <MaterialCommunityIcons name="refresh" size={19} color={colors.black} />
                            <Text style={styles.primaryInviteText}>New 5-min link</Text>
                          </>
                        )}
                      </Pressable>
                    </View>
                  </>
                ) : (
                  <View style={styles.expiredInvite}>
                    <MaterialCommunityIcons name="timer-off-outline" size={42} color="rgba(255,255,255,.82)" />
                    <Text style={styles.expiredTitle}>Access link expired</Text>
                    <Text style={styles.expiredText}>Create a new access link to generate another 5-minute QR and link.</Text>
                    <Pressable style={styles.primaryInviteButton} onPress={createTemporaryInvite} disabled={temporaryInviteBusy}>
                      {temporaryInviteBusy ? (
                        <ActivityIndicator color={colors.black} />
                      ) : (
                        <>
                          <MaterialCommunityIcons name="timer-plus-outline" size={19} color={colors.black} />
                          <Text style={styles.primaryInviteText}>Create new access link</Text>
                        </>
                      )}
                    </Pressable>
                  </View>
                )}
                <Pressable style={styles.backInvite} onPress={() => setInviteSlide(0)}>
                  <MaterialCommunityIcons name="arrow-left" size={18} color="rgba(255,255,255,.78)" />
                  <Text style={styles.backInviteText}>Permanent invite</Text>
                </Pressable>
              </View>
            )}
          </View>
        </View>
      </Modal>
    </>
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
    fontFamily: typography.regular, lineHeight: 35,
    fontFamily: typography.extraBold,
    letterSpacing: -0.7,
  },
  meta: { color: "rgba(255,255,255,.80)", fontSize: 14, fontFamily: typography.regular, marginTop: 1 },
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
  avatarText: { color: colors.white, fontSize: 14, fontFamily: typography.extraBold, fontFamily: typography.extraBold },
  moreAvatar: { backgroundColor: "rgba(25,33,42,.88)" },
  moreText: { color: colors.white, fontSize: 13, fontFamily: typography.extraBold, fontFamily: typography.extraBold },
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
  tabText: { color: "rgba(255,255,255,.94)", fontSize: 16, fontFamily: typography.bold, fontFamily: typography.bold },
  activeTabText: { color: colors.black, fontSize: 16, fontFamily: typography.extraBold, fontFamily: typography.extraBold },
  selectionHeader: {
    height: 68,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 8,
  },
  selectionSide: { color: "#fff", fontSize: 14, fontFamily: typography.bold, fontFamily: typography.bold },
  selectionCount: { color: "#fff", fontSize: 16, fontFamily: typography.extraBold, fontFamily: typography.extraBold },
  gallery: {
    position: "relative",
    paddingHorizontal: 10,
    paddingTop: 0,
    backgroundColor: "transparent",
  },
  photoRow: {
    flexDirection: "row",
    paddingHorizontal: 10,
    marginBottom: 4,
    justifyContent: "space-between",
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "flex-start",
    columnGap: "1.85%",
    rowGap: 4,
  },
  photoCell: {
    flex: 1,
    aspectRatio: 1,
    marginHorizontal: 2,
    marginBottom: 4,
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
  personName: { color: colors.white, fontFamily: typography.extraBold, fontSize: 15 },
  personMeta: { color: colors.muted, fontSize: 12, fontFamily: typography.regular, marginTop: 3 },
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
  selectionActionText: { color: colors.black, fontSize: 14, fontFamily: typography.extraBold, fontFamily: typography.extraBold },
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
  deleteText: { color: "#fff", fontSize: 14, fontFamily: typography.extraBold, fontFamily: typography.extraBold },
  inviteHeaderButton: {
    height: 42,
    minWidth: 88,
    paddingHorizontal: 12,
    borderRadius: 21,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    backgroundColor: "rgba(15,23,31,.72)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,.28)",
    shadowColor: "#000",
    shadowOpacity: 0.22,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  inviteHeaderText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontFamily: typography.extraBold, fontFamily: typography.extraBold,
  },
  inviteModalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,.62)",
    justifyContent: "flex-end",
  },
  inviteSheet: {
    maxHeight: "91%",
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    backgroundColor: "rgba(15,23,31,.98)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,.14)",
    paddingHorizontal: 20,
    paddingTop: 10,
  },
  inviteHandle: {
    alignSelf: "center",
    width: 42,
    height: 5,
    borderRadius: 3,
    backgroundColor: "rgba(255,255,255,.22)",
    marginBottom: 18,
  },
  inviteSheetHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  inviteEyebrow: {
    color: "rgba(255,255,255,.48)",
    fontSize: 10,
    fontFamily: typography.extraBold, fontFamily: typography.extraBold,
    letterSpacing: 1.8,
  },
  inviteSheetTitle: {
    color: colors.white,
    fontSize: 25,
    fontFamily: typography.extraBold, fontFamily: typography.extraBold,
    letterSpacing: -0.5,
    marginTop: 4,
  },
  inviteClose: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,.08)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,.10)",
    alignItems: "center",
    justifyContent: "center",
  },
  inviteSlide: {
    alignItems: "center",
    paddingTop: 14,
  },
  inviteDescription: {
    color: "rgba(255,255,255,.65)",
    fontSize: 13,
    fontFamily: typography.regular, lineHeight: 19,
    textAlign: "center",
    maxWidth: 330,
    marginBottom: 14,
  },
  qrFrame: {
    width: 238,
    height: 238,
    borderRadius: 25,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
    padding: 14,
    ...shadows,
  },
  inviteLinkRow: {
    width: "100%",
    marginTop: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  inviteLinkCopy: {
    flex: 1,
    height: 50,
    borderRadius: 16,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    backgroundColor: "rgba(255,255,255,.07)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,.10)",
  },
  inviteLinkText: {
    flex: 1,
    color: "rgba(255,255,255,.86)",
    fontSize: 12,
  },
  copyButton: {
    width: 50,
    height: 50,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,.10)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,.12)",
  },
  inviteActions: {
    width: "100%",
    flexDirection: "row",
    gap: 9,
    marginTop: 12,
  },
  secondaryInviteButton: {
    flex: 1,
    minHeight: 52,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,.08)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,.12)",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
  },
  secondaryInviteText: { color: colors.white, fontSize: 14, fontFamily: typography.bold, fontFamily: typography.bold },
  primaryInviteButton: {
    flex: 1.25,
    minHeight: 52,
    borderRadius: 18,
    backgroundColor: "#fff",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
  },
  primaryInviteText: { color: colors.black, fontSize: 14, fontFamily: typography.extraBold, fontFamily: typography.extraBold },
  temporaryBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    borderRadius: 999,
    paddingHorizontal: 13,
    paddingVertical: 8,
    backgroundColor: "rgba(255,255,255,.09)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,.12)",
    marginBottom: 10,
  },
  temporaryBadgeText: { color: colors.white, fontSize: 12, fontFamily: typography.extraBold, fontFamily: typography.extraBold },
  expiredInvite: {
    minHeight: 300,
    alignItems: "center",
    justifyContent: "center",
    gap: 9,
    paddingHorizontal: 25,
  },
  expiredTitle: { color: colors.white, fontSize: 19, fontFamily: typography.extraBold, fontFamily: typography.extraBold, marginTop: 3 },
  expiredText: {
    color: "rgba(255,255,255,.60)",
    fontSize: 13,
    fontFamily: typography.regular, lineHeight: 19,
    textAlign: "center",
    marginBottom: 9,
  },
  backInvite: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 17,
  },
  backInviteText: { color: "rgba(255,255,255,.78)", fontSize: 13, fontFamily: typography.bold, fontFamily: typography.bold },

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

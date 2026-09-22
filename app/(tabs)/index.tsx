import { BlurTargetView, BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import { Image as ExpoImage } from "expo-image";
import { useFocusEffect, useRouter } from "expo-router";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import React, { memo, useCallback, useEffect, useRef, useState } from "react";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import { BottomNav, Header, Screen } from "../../components/Screen";
import {
  GlassAction,
  GlassCard,
  SectionTitle,
  IconButton,
} from "../../components/Glass";
import { deleteEventsAsCreator, getSessionId, useApp } from "../../lib/app-context";
import { colors, radii, shadows, typography } from "../../lib/theme";

function gradientForName(name: string): [string, string] {
  const palettes: [string, string][] = [
    ["#5B5FEF", "#9B8CFF"],
    ["#7C3AED", "#C084FC"],
    ["#0284C7", "#38BDF8"],
    ["#0F766E", "#2DD4BF"],
    ["#EA580C", "#FB7185"],
    ["#DB2777", "#F472B6"],
  ];
  const hash = [...name].reduce((sum, char) => sum + char.charCodeAt(0), 0);
  return palettes[hash % palettes.length];
}

const EventCover = memo(function EventCover({
  id,
  cover,
  name,
  people,
  photos,
}: {
  id: string;
  cover: string;
  name: string;
  people: number;
  photos: number;
}) {
  const blurTarget = useRef<View | null>(null);

  return (
    <View style={styles.cover}>
      <BlurTargetView ref={blurTarget} style={StyleSheet.absoluteFillObject}>
        {cover ? (
          <ExpoImage
            source={{ uri: cover }}
            style={styles.coverImage}
            contentFit="cover"
            cachePolicy="memory-disk"
            recyclingKey={id}
            allowDownscaling
            transition={0}
          />
        ) : null}
      </BlurTargetView>
      <LinearGradient
        colors={["rgba(14,20,27,0.00)", "rgba(14,20,27,0.82)"]}
        locations={[0, 1]}
        style={styles.eventInfo}
      />
      <View style={styles.eventInfoContent} pointerEvents="none">
        <Text style={styles.eventName} numberOfLines={1}>
          {name}
        </Text>
        <Text style={styles.eventMeta}>
          {people || "—"} people · {photos || "—"} photos
        </Text>
      </View>
    </View>
  );
});

export default function HomeScreen() {
  const router = useRouter();
  const { displayName, events, refreshEvents } = useApp();
  const [selecting, setSelecting] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [deleting, setDeleting] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);

  useEffect(() => {
    void getSessionId().then(setSessionId);
  }, []);
  useFocusEffect(
    useCallback(() => {
      let active = true;
      const frame = requestAnimationFrame(() => {
        if (active) void refreshEvents();
      });
      return () => {
        active = false;
        cancelAnimationFrame(frame);
      };
    }, [refreshEvents]),
  );
  const ownedEvents = events.filter(
    (event) => event.creatorSessionId === sessionId,
  );

  const toggleSelected = (id: string) => {
    setSelectedIds((current) =>
      current.includes(id)
        ? current.filter((item) => item !== id)
        : [...current, id],
    );
  };

  const enterSelection = (id: string) => {
    setSelecting(true);
    setSelectedIds([id]);
  };

  const cancelSelection = () => {
    setSelecting(false);
    setSelectedIds([]);
  };

  const confirmDelete = () => {
    if (!selectedIds.length || deleting) return;
    Alert.alert(
      selectedIds.length === 1
        ? "Delete event?"
        : `Delete ${selectedIds.length} events?`,
      "This will remove the selected events and their photos for everyone. This cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            setDeleting(true);
            try {
              await deleteEventsAsCreator(selectedIds);
              cancelSelection();
              await refreshEvents();
            } catch (error) {
              Alert.alert(
                "Couldn’t delete events",
                error instanceof Error ? error.message : "Please try again.",
              );
            } finally {
              setDeleting(false);
            }
          },
        },
      ],
    );
  };

  return (
    <View style={styles.root}>
      <Screen bottomNav={<BottomNav active="home" />}>
        <Header
          title="Mefie"
          right={
            <IconButton
              accessibilityLabel="Open profile"
              onPress={() => router.push("/you")}
            >
              <LinearGradient
                colors={gradientForName(displayName)}
                style={styles.headerAvatar}
              >
                <Text style={styles.avatarText}>
                  {displayName.slice(0, 1).toUpperCase()}
                </Text>
              </LinearGradient>
            </IconButton>
          }
        />
        <View style={styles.hero}>
          <Text style={styles.greeting}>Hey {displayName} 👋</Text>
          <Text style={styles.title}>Same moments.{`
`}Everyone's view.</Text>
        </View>
        <GlassAction
          primary
          label="Create an event"
          onPress={() => router.push("/create-event")}
          icon={
            <MaterialCommunityIcons
              name="plus"
              size={30}
              color={colors.black}
            />
          }
        />
        <GlassAction
          label="Join an event"
          onPress={() => router.push("/join-event")}
          icon={
            <MaterialCommunityIcons
              name="link-variant"
              size={26}
              color={colors.white}
            />
          }
        />
        <View style={styles.eventsSection}>
          <View style={styles.sectionRow}>
            <SectionTitle>{selecting ? `${selectedIds.length} selected` : "Your events"}</SectionTitle>
            {ownedEvents.length > 0 && !selecting ? (
              <Pressable onPress={() => router.push("/events")}>
                <Text style={styles.seeAll}>
                  See all <Text style={styles.seeArrow}>›</Text>
                </Text>
              </Pressable>
            ) : selecting ? (
              <Pressable onPress={cancelSelection}>
                <Text style={styles.seeAll}>Cancel</Text>
              </Pressable>
            ) : null}
          </View>
          {ownedEvents.length === 0 ? (
            <GlassCard>
              <Text style={styles.emptyTitle}>Your moments start here.</Text>
              <Text style={styles.emptySub}>
                Create an event and invite your people.
              </Text>
            </GlassCard>
          ) : (
            <View style={styles.grid}>
              {ownedEvents.slice(0, 4).map((e) => {
                const selected = selectedIds.includes(e.id);
                return (
                <Pressable
                  key={e.id}
                  onLongPress={() => {
                    if (!selecting) enterSelection(e.id);
                  }}
                  delayLongPress={450}
                  onPress={() => {
                    if (selecting) {
                      toggleSelected(e.id);
                      return;
                    }
                    router.push({
                      pathname: "/event/[id]",
                      params: { id: e.id },
                    });
                  }}
                  style={styles.eventCard}
                >
                  <View
                    pointerEvents="none"
                    style={[
                      styles.selectionBadge,
                      !selecting && styles.selectionBadgeHidden,
                      selected && styles.selectionBadgeSelected,
                    ]}
                  >
                    {selected ? (
                      <MaterialCommunityIcons name="check" size={15} color={colors.black} />
                    ) : null}
                  </View>
                  <EventCover
                    id={e.id}
                    cover={e.cover}
                    name={e.name}
                    people={e.people}
                    photos={e.photos}
                  />
                </Pressable>
                );
              })}
            </View>
          )}
        </View>
      </Screen>
      {selecting ? (
        <View style={styles.selectionToolbar}>
          <Pressable onPress={cancelSelection} style={styles.selectionClose} accessibilityLabel="Cancel selection">
            <MaterialCommunityIcons name="close" size={21} color={colors.white} />
          </Pressable>
          <View style={styles.selectionCount}>
            <Text style={styles.selectionCountText}>{selectedIds.length}</Text>
          </View>
          <Pressable
            onPress={confirmDelete}
            disabled={!selectedIds.length || deleting}
            style={[styles.selectionDelete, !selectedIds.length && styles.selectionDeleteDisabled]}
            accessibilityLabel="Delete selected events"
          >
            <MaterialCommunityIcons name="trash-can-outline" size={21} color={colors.white} />
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#0A0F15" },
  hero: { paddingTop: 30, paddingBottom: 8 },
  greeting: {
fontFamily: typography.semibold,
    color: colors.white,
    fontSize: 34,
    fontFamily: typography.regular, lineHeight: 40,
    fontWeight: "500",
    letterSpacing: -0.8,
  },
  title: {
fontFamily: typography.regular,
    color: "rgba(255,255,255,0.88)",
    fontSize: 21,
    fontFamily: typography.regular, lineHeight: 27,
    fontWeight: "400",
    letterSpacing: -0.2,
    marginTop: 2,
  },
  avatarText: { color: colors.white, fontSize: 17, fontFamily: typography.bold, fontWeight: "700" },
  headerAvatar: { width: "100%", height: "100%", borderRadius: 22, alignItems: "center", justifyContent: "center" },
  eventsSection: { marginTop: 10 },
  sectionActions: { flexDirection: "row", alignItems: "center", gap: 16 },
  sectionRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  seeAll: {
    color: "rgba(220,225,232,0.82)",
    fontSize: 14,
    fontFamily: typography.semibold, fontWeight: "600",
    marginBottom: 12,
  },
  seeArrow: {
    fontSize: 23,
    fontWeight: "300",
    color: "rgba(220,225,232,0.82)",
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    rowGap: 12,
    marginHorizontal: -8,
  },
  selectionBadge: { position: "absolute", top: 10, right: 10, zIndex: 3, width: 26, height: 26, borderRadius: 13, borderWidth: 1.5, borderColor: "rgba(255,255,255,0.85)", backgroundColor: "rgba(10,15,21,0.5)", alignItems: "center", justifyContent: "center" },
  selectionBadgeHidden: { opacity: 0 },
  selectionBadgeSelected: { backgroundColor: colors.white, borderColor: colors.white },
  selectionToolbar: { position: "absolute", left: 24, right: 24, bottom: 88, height: 58, borderRadius: 22, backgroundColor: "rgba(20,27,36,0.94)", borderWidth: 1, borderColor: "rgba(255,255,255,0.12)", flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 7, zIndex: 20 },
  selectionClose: { width: 44, height: 44, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  selectionCount: { minWidth: 34, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,0.1)" },
  selectionCountText: { color: colors.white, fontSize: 15, fontFamily: typography.extraBold, fontWeight: "800" },
  selectionDelete: { width: 44, height: 44, borderRadius: 16, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(185,28,28,0.95)" },
  selectionDeleteDisabled: { opacity: 0.4 },
  eventCard: {
    width: "48%",
    height: 170,
    borderRadius: radii.card,
    overflow: "hidden",
    backgroundColor: "#26313F",
    borderWidth: 0,
    ...shadows,
  },
  cover: { flex: 1, position: "relative", justifyContent: "flex-end" },
  coverImage: {
    ...StyleSheet.absoluteFillObject,
    width: "100%",
    height: "100%",
  },
  eventInfo: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: 76,
    paddingHorizontal: 13,
    paddingTop: 18,
    paddingBottom: 13,
    backgroundColor: "rgba(14,20,27,0.24)",
  },
  eventInfoContent: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 13,
    paddingTop: 18,
    paddingBottom: 13,
  },
  eventName: {
fontFamily: typography.bold,
    color: colors.white,
    fontSize: 16,
    fontFamily: typography.extraBold, fontWeight: "800",
    letterSpacing: -0.2,
  },
  eventMeta: { fontFamily: typography.regular, color: "rgba(255,255,255,0.72)", fontSize: 11, fontFamily: typography.regular, marginTop: 4 },
  emptyTitle: { color: colors.white, fontSize: 16, fontFamily: typography.bold, fontWeight: "700" },
  emptySub: { color: colors.muted, fontSize: 13, fontFamily: typography.regular, marginTop: 5 },
});

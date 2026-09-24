import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { useFocusEffect, useRouter } from "expo-router";
import React, { useCallback } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Image as ExpoImage } from "expo-image";
import { BottomNav, Screen } from "../../components/Screen";
import { GlassButton, GlassCard } from "../../components/Glass";
import { useApp } from "../../lib/app-context";
import { getEventCoverMap } from "../../lib/event-cover";
import { colors, radii, shadows, typography } from "../../lib/theme";

export default function Events() {
  const router = useRouter();
  const { events, refreshEvents } = useApp();
  const [coverOverrides, setCoverOverrides] = React.useState<Record<string, string>>({});

  useFocusEffect(useCallback(() => { refreshEvents(); }, [refreshEvents]));

  React.useEffect(() => {
    let active = true;
    void getEventCoverMap(events.map((event) => event.id))
      .then((map) => { if (active) setCoverOverrides(map as Record<string, string>); })
      .catch(() => undefined);
    return () => { active = false; };
  }, [events]);

  return (
    <View style={styles.root}>
      <Screen bottomNav={<BottomNav active="events" />}>
        <View style={styles.heading}>
          <Text style={styles.title}>Your events</Text>
          <Text style={styles.sub}>Every group memory, in one place.</Text>
        </View>
        {events.length === 0 ? (
          <GlassCard>
            <Text style={styles.h}>No events yet.</Text>
            <Text style={styles.m}>Create one or join a friend's event.</Text>
            <View style={{ marginTop: 16 }}>
              <GlassButton primary label="Create event" onPress={() => router.push("/create-event")} />
            </View>
          </GlassCard>
        ) : (
          <View style={styles.list}>
            {events.map((e) => (
              <Pressable key={e.id} onPress={() => router.push({ pathname: "/event/[id]", params: { id: e.id } })} style={styles.card}>
                <ExpoImage
                  source={coverOverrides[e.id] || e.cover ? { uri: coverOverrides[e.id] || e.cover } : undefined}
                  style={styles.image}
                  contentFit="cover"
                  cachePolicy="memory-disk"
                  recyclingKey={e.id}
                  transition={0}
                />
                <View style={styles.overlay}>
                  <View style={styles.icon}>
                    <MaterialCommunityIcons name="image-multiple-outline" size={17} color="#fff" />
                  </View>
                  <Text style={styles.h}>{e.name}</Text>
                  <Text style={styles.m}>{e.people ?? 0} people · {e.photos ?? 0} photos</Text>
                </View>
              </Pressable>
            ))}
          </View>
        )}
      </Screen>
      <BottomNav active="events" />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#0A0F15" },
  heading: { marginTop: 28, marginBottom: 2 },
  title: { color: colors.white, fontSize: 35, fontFamily: typography.extraBold, letterSpacing: -1 },
  sub: { color: colors.muted, fontSize: 14, fontFamily: typography.regular, marginTop: 5 },
  list: { gap: 14 },
  card: { height: 190, borderRadius: radii.card, overflow: "hidden", backgroundColor: "#26313F", ...shadows },
  image: { ...StyleSheet.absoluteFillObject, width: "100%", height: "100%" },
  overlay: { padding: 15, paddingTop: 48, backgroundColor: "rgba(9,14,20,.43)", position: "absolute", left: 0, right: 0, bottom: 0 },
  icon: { width: 30, height: 30, borderRadius: 15, backgroundColor: "rgba(255,255,255,.15)", borderWidth: 1, borderColor: "rgba(255,255,255,.2)", alignItems: "center", justifyContent: "center", marginBottom: 9 },
  h: { color: colors.white, fontSize: 19, fontFamily: typography.extraBold },
  m: { color: "rgba(255,255,255,.70)", fontSize: 13, fontFamily: typography.regular, marginTop: 5 },
});

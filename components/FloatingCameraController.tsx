import * as MediaLibrary from "expo-media-library";
import { usePathname } from "expo-router";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, AppState, Modal, PermissionsAndroid, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { getParticipantId, supabase, useApp } from "../lib/app-context";
import { captureException } from "../lib/sentry";
import { hasFloatingOverlayPermission, openFloatingOverlaySettings, openPhoneCamera, startFloatingCameraSharing } from "../lib/mefie-floating-bubble";
import { colors, typography } from "../lib/theme";

function eventIdFromPath(pathname: string) {
  const match = pathname.match(/^\/camera\/([^/]+)/);
  return match ? decodeURIComponent(match[1]) : null;
}

export function FloatingCameraController() {
  const pathname = usePathname();
  const { displayName } = useApp();
  const eventId = useMemo(() => Platform.OS === "android" ? eventIdFromPath(pathname) : null, [pathname]);
  const [eventName, setEventName] = useState("Mefie event");
  const [participantId, setParticipantId] = useState<string | null>(null);
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [waitingForOverlay, setWaitingForOverlay] = useState(false);
  const [error, setError] = useState("");
  const mounted = useRef(false);

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  useEffect(() => {
    if (!eventId || !supabase) {
      setVisible(false);
      return;
    }

    let cancelled = false;
    const prepare = async () => {
      try {
        const [{ data: event }, participant] = await Promise.all([
          supabase!.from("events").select("name").eq("id", eventId).maybeSingle(),
          getParticipantId(eventId),
        ]);
        if (cancelled) return;
        setEventName(event?.name || "Mefie event");
        setParticipantId(participant);
        setError("");
        setVisible(true);
      } catch (value: any) {
        if (!cancelled) {
          setError(value?.message || "Could not prepare camera sharing.");
          setVisible(true);
        }
      }
    };
    void prepare();
    return () => { cancelled = true; };
  }, [displayName, eventId]);

  useEffect(() => {
    if (!waitingForOverlay || !eventId || !participantId) return;
    const subscription = AppState.addEventListener("change", (state) => {
      if (state !== "active") return;
      void hasFloatingOverlayPermission().then((granted) => {
        if (granted && mounted.current) {
          setWaitingForOverlay(false);
          void activate(true);
        }
      });
    });
    return () => subscription.remove();
  }, [waitingForOverlay, eventId, participantId]);

  if (!eventId || Platform.OS !== "android") return null;

  async function requestNotificationPermission() {
    if (Platform.Version < 33) return true;
    const result = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS);
    return result === PermissionsAndroid.RESULTS.GRANTED || result === PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN;
  }

  async function activate(openCamera: boolean) {
    if (!eventId || !participantId || busy) return;
    setBusy(true);
    setError("");
    try {
      const mediaPermission = await MediaLibrary.requestPermissionsAsync(false, ["photo"]);
      if (!mediaPermission.granted) {
        setError("Mefie needs photo access to notice photos saved by the phone camera.");
        return;
      }

      await requestNotificationPermission();

      const overlayGranted = await hasFloatingOverlayPermission();
      if (!overlayGranted) {
        setWaitingForOverlay(true);
        await openFloatingOverlaySettings();
        return;
      }

      const started = await startFloatingCameraSharing(eventId, eventName, participantId);
      if (!started) {
        setError("Mefie could not start the camera sharing bubble.");
        return;
      }

      setVisible(false);
      if (openCamera) await openPhoneCamera();
    } catch (value: any) {
      captureException(value, { area: "floating_camera_start" });
      if (mounted.current) setError(value?.message || "Could not start camera sharing.");
    } finally {
      if (mounted.current) setBusy(false);
    }
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={() => setVisible(false)}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <View style={styles.iconWrap}><Text style={styles.icon}>M</Text><View style={styles.dot} /></View>
          <Text style={styles.eyebrow}>MEFIE CAMERA SHARING</Text>
          <Text style={styles.title}>Use your phone camera</Text>
          <Text style={styles.body}>
            Mefie can keep sharing photos while you use the native Camera. A small floating Mefie bubble lets you pause or stop anytime.
          </Text>
          <View style={styles.eventPill}><View style={styles.greenDot} /><Text style={styles.eventText} numberOfLines={1}>{eventName}</Text></View>
          {error ? <Text style={styles.error}>{error}</Text> : null}
          {waitingForOverlay ? (
            <View style={styles.waiting}><ActivityIndicator color="#76E39A" /><Text style={styles.waitingText}>Enable “Display over other apps”, then return here.</Text></View>
          ) : null}
          <Pressable disabled={busy || !participantId} onPress={() => void activate(true)} style={({ pressed }) => [styles.primary, pressed && styles.pressed, (busy || !participantId) && styles.disabled]}>
            {busy ? <ActivityIndicator color="#08100B" /> : <Text style={styles.primaryText}>{waitingForOverlay ? "Waiting for permission…" : "Open phone camera"}</Text>}
          </Pressable>
          <Pressable disabled={busy} onPress={() => setVisible(false)} style={styles.secondary}><Text style={styles.secondaryText}>Not now</Text></Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,.58)", alignItems: "center", justifyContent: "center", padding: 22 },
  card: { width: "100%", maxWidth: 390, backgroundColor: "#111713", borderRadius: 28, padding: 24, borderWidth: 1, borderColor: "rgba(255,255,255,.10)", shadowColor: "#000", shadowOpacity: 0.35, shadowRadius: 30, shadowOffset: { width: 0, height: 16 }, elevation: 18 },
  iconWrap: { width: 54, height: 54, borderRadius: 18, backgroundColor: "#1C2520", borderWidth: 1, borderColor: "#35453B", alignItems: "center", justifyContent: "center", alignSelf: "flex-start" },
  icon: { color: "#F4FFF7", fontSize: 23, fontFamily: typography.extraBold },
  dot: { position: "absolute", right: 6, top: 6, width: 9, height: 9, borderRadius: 5, backgroundColor: "#69E58A", borderWidth: 2, borderColor: "#1C2520" },
  eyebrow: { color: "#7C8A82", fontSize: 10, fontFamily: typography.extraBold, letterSpacing: 1.4, marginTop: 20 },
  title: { color: "#F8FFF9", fontSize: 25, fontFamily: typography.extraBold, marginTop: 6 },
  body: { color: "#A9B4AC", fontSize: 14, lineHeight: 21, fontFamily: typography.medium, marginTop: 9 },
  eventPill: { marginTop: 18, paddingHorizontal: 13, paddingVertical: 10, borderRadius: 14, backgroundColor: "#19211C", flexDirection: "row", alignItems: "center", alignSelf: "flex-start", maxWidth: "100%" },
  greenDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: "#69E58A", marginRight: 8 },
  eventText: { color: "#E8F4EB", fontSize: 13, fontFamily: typography.bold, maxWidth: 270 },
  error: { color: "#FFB4B4", fontSize: 12, lineHeight: 18, marginTop: 12, fontFamily: typography.medium },
  waiting: { marginTop: 12, padding: 12, borderRadius: 14, backgroundColor: "#17221B", flexDirection: "row", alignItems: "center", gap: 9 },
  waitingText: { color: "#B8C6BD", fontSize: 12, lineHeight: 17, flex: 1, fontFamily: typography.medium },
  primary: { height: 52, borderRadius: 17, backgroundColor: "#D9FBE3", alignItems: "center", justifyContent: "center", marginTop: 20 },
  primaryText: { color: "#08100B", fontSize: 14, fontFamily: typography.extraBold },
  secondary: { height: 42, alignItems: "center", justifyContent: "center", marginTop: 4 },
  secondaryText: { color: "#8F9A92", fontSize: 13, fontFamily: typography.bold },
  pressed: { opacity: 0.82 },
  disabled: { opacity: 0.55 },
});

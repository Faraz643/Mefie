import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Camera, useCameraDevice, useCameraPermission, usePhotoOutput } from "react-native-vision-camera";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Animated, AppState, AppStateStatus, Linking, Pressable, StyleSheet, Text, View } from "react-native";
import { ensureParticipant, getParticipantId, supabase, useApp } from "../../lib/app-context";
import { colors, typography } from "../../lib/theme";
import { enqueuePhotoUpload, getPhotoQueueSummary, retryFailedPhotoUploads, startPhotoUploadQueue, subscribePhotoUploadQueue } from "../../lib/photo-upload-queue";

const MAX_IN_FLIGHT_CAPTURES = 4;
function createUploadId() {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (character) => {
    const random = Math.floor(Math.random() * 16);
    const value = character === "x" ? random : (random & 0x3) | 0x8;
    return value.toString(16);
  });
}

export default function CameraScreen() {
  const router = useRouter();
  const { eventId } = useLocalSearchParams<{ eventId: string }>();
  const { displayName } = useApp();
  const { hasPermission, canRequestPermission, requestPermission } = useCameraPermission();
  const [facing, setFacing] = useState<"front" | "back">("back");
  const [flash, setFlash] = useState<"off" | "on">("off");
  const [cameraReady, setCameraReady] = useState(false);
  const [membershipReady, setMembershipReady] = useState(false);
  const [participantId, setParticipantId] = useState<string | null>(null);
  const [membershipError, setMembershipError] = useState("");
  const [pickerBusy, setPickerBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [permissionBusy, setPermissionBusy] = useState(false);
  const [appActive, setAppActive] = useState(AppState.currentState === "active");
  const [, setQueueVersion] = useState(0);

  const mountedRef = useRef(false);
  const messageTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inFlightCaptures = useRef(0);
  const shutterScale = useRef(new Animated.Value(1)).current;
  const shutterFlash = useRef(new Animated.Value(0)).current;

  const preferredDevice = useCameraDevice(facing, { physicalDevices: ["wide-angle"] });
  const fallbackDevice = useCameraDevice(facing);
  const device = preferredDevice ?? fallbackDevice;
  const photoOutput = usePhotoOutput({
    containerFormat: "jpeg",
    quality: 0.85,
    qualityPrioritization: device?.supportsSpeedQualityPrioritization ? "speed" : "balanced",
  });
  const effectiveFlash = useMemo(() => (flash === "on" && device?.hasFlash ? "on" : "off"), [device?.hasFlash, flash]);

  useEffect(() => {
    mountedRef.current = true;
    void startPhotoUploadQueue();
    const unsubscribe = subscribePhotoUploadQueue(() => {
      if (mountedRef.current) setQueueVersion((value) => value + 1);
    });
    return () => {
      mountedRef.current = false;
      unsubscribe();
      if (messageTimer.current) clearTimeout(messageTimer.current);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const prepareMembership = async () => {
      if (!supabase || !eventId) {
        if (!cancelled) setMembershipError("Cloud connection is not configured.");
        return;
      }
      if (!cancelled) {
        setMembershipReady(false);
        setMembershipError("");
      }
      try {
        const existing = await getParticipantId(String(eventId));
        if (cancelled) return;
        if (existing) {
          setParticipantId(existing);
          setMembershipReady(true);
          return;
        }
        const created = await ensureParticipant(String(eventId), displayName);
        if (cancelled) return;
        if (!created) throw new Error("Could not join this event.");
        setParticipantId(created);
        setMembershipReady(true);
      } catch (error: any) {
        if (!cancelled) setMembershipError(error?.message || "Could not connect to this event.");
      }
    };
    void prepareMembership();
    return () => { cancelled = true; };
  }, [displayName, eventId]);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state: AppStateStatus) => {
      const active = state === "active";
      if (mountedRef.current) setAppActive(active);
      if (active) void startPhotoUploadQueue();
    });
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    if (hasPermission && device) {
      void photoOutput.prepareSettings([
        { flashMode: "off" },
        ...(device.hasFlash ? [{ flashMode: "on" as const }] : []),
      ]);
    }
  }, [device, hasPermission, photoOutput]);

  useEffect(() => {
    if (facing === "front" && flash === "on" && !device?.hasFlash) setFlash("off");
  }, [device?.hasFlash, facing, flash]);

  const showMessage = (value: string) => {
    if (!mountedRef.current) return;
    setMessage(value);
    if (messageTimer.current) clearTimeout(messageTimer.current);
    messageTimer.current = setTimeout(() => {
      if (mountedRef.current) setMessage("");
    }, 1100);
  };

  const animateShutter = () => {
    shutterScale.stopAnimation();
    shutterFlash.stopAnimation();
    shutterScale.setValue(1);
    shutterFlash.setValue(0);
    Animated.parallel([
      Animated.sequence([
        Animated.timing(shutterScale, { toValue: 0.86, duration: 70, useNativeDriver: true }),
        Animated.spring(shutterScale, { toValue: 1, speed: 22, bounciness: 5, useNativeDriver: true }),
      ]),
      Animated.sequence([
        Animated.timing(shutterFlash, { toValue: 0.28, duration: 45, useNativeDriver: true }),
        Animated.timing(shutterFlash, { toValue: 0, duration: 120, useNativeDriver: true }),
      ]),
    ]).start();
  };

  const queueSummary = getPhotoQueueSummary(eventId ? String(eventId) : undefined);

  const capture = () => {
    if (!hasPermission || !device || !cameraReady || !membershipReady || !eventId || !participantId || inFlightCaptures.current >= MAX_IN_FLIGHT_CAPTURES) return;
    inFlightCaptures.current += 1;
    animateShutter();
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    let captureCountReleased = false;
    const releaseCaptureSlot = () => {
      if (captureCountReleased) return;
      captureCountReleased = true;
      inFlightCaptures.current = Math.max(0, inFlightCaptures.current - 1);
    };

    try {
      const capturePromise = photoOutput.capturePhotoToFile(
        { flashMode: effectiveFlash, enableDistortionCorrection: false, enableShutterSound: true },
        { onDidCapturePhoto: releaseCaptureSlot },
      );
      void capturePromise.then((photo) => {
        releaseCaptureSlot();
        const uri = photo.filePath.startsWith("file://") ? photo.filePath : `file://${photo.filePath}`;
        void enqueuePhotoUpload({
          id: createUploadId(), eventId: String(eventId), participantId, uri,
          width: photo.width, height: photo.height,
        }).catch((error: any) => showMessage(error?.message || "Photo could not be queued."));
      }).catch((error: any) => {
        releaseCaptureSlot();
        showMessage(error?.message || "Could not capture the photo.");
      });
    } catch (error: any) {
      releaseCaptureSlot();
      showMessage(error?.message || "Could not capture the photo.");
    }
  };

  const pick = async () => {
    if (pickerBusy || !membershipReady || !eventId) return;
    setPickerBusy(true);
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        showMessage("Photo library permission is required.");
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 0.9, allowsMultipleSelection: false });
      if (!result.canceled && result.assets?.[0] && participantId) {
        const image = result.assets[0];
        await enqueuePhotoUpload({
          id: createUploadId(), eventId: String(eventId), participantId, uri: image.uri,
          width: image.width ?? null, height: image.height ?? null,
        });
        showMessage("Photo queued");
      }
    } catch (error: any) {
      showMessage(error?.message || "Could not add the photo.");
    } finally {
      if (mountedRef.current) setPickerBusy(false);
    }
  };

  if (!hasPermission) {
    return (
      <View style={styles.center}>
        <MaterialCommunityIcons name="camera-outline" size={36} color="#fff" />
        <Text style={styles.title}>Camera access</Text>
        <Text style={styles.sub}>Mefie needs the camera to capture and share moments.</Text>
        <Pressable disabled={permissionBusy} onPress={async () => {
          if (permissionBusy) return;
          setPermissionBusy(true);
          try {
            if (!canRequestPermission) { await Linking.openSettings(); return; }
            const granted = await requestPermission();
            if (!granted && !canRequestPermission && mountedRef.current) await Linking.openSettings();
          } finally {
            if (mountedRef.current) setPermissionBusy(false);
          }
        }} style={styles.cta}>
          {permissionBusy ? <ActivityIndicator color="#111" /> : <Text style={styles.ctaText}>{canRequestPermission ? "Allow camera" : "Open Settings"}</Text>}
        </Pressable>
      </View>
    );
  }

  if (!device) {
    return <View style={styles.center}><ActivityIndicator color="#fff" /><Text style={styles.sub}>Starting camera…</Text></View>;
  }

  return (
    <View style={styles.container}>
      <Camera
        style={StyleSheet.absoluteFill}
        device={device}
        isActive={appActive && hasPermission}
        outputs={[photoOutput]}
        enableDistortionCorrection={false}
        onStarted={() => { if (mountedRef.current) setCameraReady(true); }}
        onStopped={() => { if (mountedRef.current) setCameraReady(false); }}
        onError={(error) => { if (!mountedRef.current) return; setCameraReady(false); showMessage(error.message || "Could not start the camera."); }}
      />
      <View style={styles.scrimTop} />
      <View style={styles.top}>
        <Pressable accessibilityLabel="Close camera" onPress={() => router.back()} style={styles.control}><MaterialCommunityIcons name="close" size={23} color="#fff" /></Pressable>
        <Pressable accessibilityLabel={flash === "on" ? "Turn flash off" : "Turn flash on"} disabled={!device.hasFlash} onPress={() => setFlash((value) => value === "off" ? "on" : "off")} style={[styles.control, !device.hasFlash && styles.controlDisabled]}>
          <MaterialCommunityIcons name={flash === "on" ? "flash" : "flash-off"} size={20} color="#fff" />
        </Pressable>
      </View>

      <View style={styles.bottom}>
        {membershipError ? (
          <Pressable onPress={() => {
            if (!eventId) return;
            setMembershipError(""); setMembershipReady(false);
            void ensureParticipant(String(eventId), displayName).then((id) => {
              if (!id) throw new Error("Could not join this event.");
              if (!mountedRef.current) return;
              setParticipantId(id); setMembershipReady(true);
            }).catch((error: any) => {
              if (mountedRef.current) setMembershipError(error?.message || "Could not connect to this event.");
            });
          }} style={styles.statusPill}>
            <MaterialCommunityIcons name="cloud-alert-outline" size={15} color="#fff" /><Text style={styles.statusText}>Tap to reconnect</Text>
          </Pressable>
        ) : queueSummary.queued + queueSummary.uploading > 0 ? (
          <View style={styles.statusPill}><MaterialCommunityIcons name="cloud-upload-outline" size={15} color="#fff" /><Text style={styles.statusText}>{queueSummary.queued + queueSummary.uploading} {(queueSummary.queued + queueSummary.uploading) === 1 ? "photo" : "photos"} sharing</Text></View>
        ) : queueSummary.failed > 0 ? (
          <Pressable onPress={() => void retryFailedPhotoUploads(String(eventId))} style={styles.errorPill}>
            <MaterialCommunityIcons name="alert-circle-outline" size={15} color="#fff" />
            <Text style={styles.statusText} numberOfLines={3}>
              {queueSummary.lastError || `${queueSummary.failed} photo${queueSummary.failed === 1 ? "" : "s"} failed`}
              {" · Tap to retry"}
            </Text>
          </Pressable>
        ) : queueSummary.lastError ? (
          <View style={styles.errorPill}>
            <MaterialCommunityIcons name="alert-circle-outline" size={15} color="#fff" />
            <Text style={styles.statusText} numberOfLines={3}>{queueSummary.lastError}</Text>
          </View>
        ) : message ? (
          <View style={styles.statusPill}><MaterialCommunityIcons name="check" size={15} color="#fff" /><Text style={styles.statusText}>{message}</Text></View>
        ) : null}

        <View style={styles.row}>
          <Pressable accessibilityLabel="Choose photo" onPress={pick} disabled={pickerBusy || !membershipReady} style={styles.sideControl}>
            {pickerBusy ? <ActivityIndicator color="#fff" size="small" /> : <MaterialCommunityIcons name="image-outline" size={21} color="#fff" />}
          </Pressable>

          <Pressable accessibilityLabel="Take photo" onPress={capture} disabled={!cameraReady || !membershipReady} style={[styles.shutter, (!cameraReady || !membershipReady) && styles.shutterDisabled]}>
            <Animated.View style={[styles.shutterInner, { transform: [{ scale: shutterScale }] }]}>
              <Animated.View pointerEvents="none" style={[styles.shutterFlash, { opacity: shutterFlash }]} />
              <MaterialCommunityIcons name="camera-outline" size={27} color="#111" />
            </Animated.View>
          </Pressable>

          <Pressable accessibilityLabel="Switch camera" onPress={() => { setCameraReady(false); setFlash("off"); setFacing((value) => value === "back" ? "front" : "back"); }} style={styles.sideControl}>
            <MaterialCommunityIcons name="camera-flip-outline" size={21} color="#fff" />
          </Pressable>
        </View>
        <Text style={styles.mode}>{!cameraReady ? "STARTING CAMERA…" : !membershipReady ? "CONNECTING…" : "PHOTO"}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#000" },
  scrimTop: { position: "absolute", top: 0, left: 0, right: 0, height: 150, backgroundColor: "rgba(0,0,0,.20)" },
  top: { position: "absolute", top: 55, left: 20, right: 20, flexDirection: "row", justifyContent: "space-between" },
  control: { width: 44, height: 44, borderRadius: 22, backgroundColor: "rgba(16,21,27,.42)", borderWidth: 1, borderColor: "rgba(255,255,255,.20)", alignItems: "center", justifyContent: "center" },
  controlDisabled: { opacity: 0.45 },
  bottom: { position: "absolute", bottom: 28, left: 0, right: 0, alignItems: "center" },
  row: { width: "100%", flexDirection: "row", alignItems: "center", justifyContent: "space-around", paddingHorizontal: 20 },
  sideControl: { width: 50, height: 50, borderRadius: 25, backgroundColor: "rgba(20,25,31,.45)", borderWidth: 1, borderColor: "rgba(255,255,255,.20)", alignItems: "center", justifyContent: "center" },
  shutter: { width: 82, height: 82, borderRadius: 41, backgroundColor: "#fff", alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: "rgba(255,255,255,.72)" },
  shutterDisabled: { opacity: 0.55 },
  shutterInner: { width: 70, height: 70, borderRadius: 35, borderWidth: 2, borderColor: "#111", alignItems: "center", justifyContent: "center", overflow: "hidden" },
  shutterFlash: { ...StyleSheet.absoluteFillObject, backgroundColor: "#fff", borderRadius: 35 },
  mode: { color: "#fff", fontSize: 11, fontFamily: typography.extraBold, marginTop: 10, letterSpacing: 1 },
  statusPill: { maxWidth: "88%", flexDirection: "row", alignItems: "center", gap: 7, backgroundColor: "rgba(10,14,18,.62)", paddingHorizontal: 15, paddingVertical: 9, borderRadius: 18, borderWidth: 1, borderColor: "rgba(255,255,255,.16)", marginBottom: 14 },
  errorPill: { maxWidth: "92%", flexDirection: "row", alignItems: "center", gap: 7, backgroundColor: "rgba(150,28,28,.82)", paddingHorizontal: 15, paddingVertical: 10, borderRadius: 18, borderWidth: 1, borderColor: "rgba(255,180,180,.32)", marginBottom: 14 },
  statusText: { color: "#fff", fontFamily: typography.bold, fontSize: 13 },
  center: { flex: 1, backgroundColor: "#0A0F15", alignItems: "center", justifyContent: "center", padding: 28 },
  title: { color: "#fff", fontSize: 28, fontFamily: typography.extraBold, marginTop: 14 },
  sub: { color: colors.muted, textAlign: "center", marginTop: 8, lineHeight: 20 },
  cta: { marginTop: 22, backgroundColor: "#fff", paddingHorizontal: 24, paddingVertical: 15, borderRadius: 20 },
  ctaText: { color: "#111", fontFamily: typography.extraBold },
});

import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { CameraView, useCameraPermissions } from "expo-camera";
import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  AppState,
  Linking,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { ensureParticipant, getParticipantId, supabase, useApp } from "../../lib/app-context";
import { colors } from "../../lib/theme";
import {
  enqueuePhotoUpload,
  getPhotoQueueSummary,
  retryFailedPhotoUploads,
  startPhotoUploadQueue,
  subscribePhotoUploadQueue,
} from "../../lib/photo-upload-queue";
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
  const [perm, request] = useCameraPermissions();
  const [facing, setFacing] = useState<"front" | "back">("back");
  const [flash, setFlash] = useState<"off" | "on">("off");
  const [cameraReady, setCameraReady] = useState(false);
  const [membershipReady, setMembershipReady] = useState(false);
  const [participantId, setParticipantId] = useState<string | null>(null);
  const [membershipError, setMembershipError] = useState("");
  const [capturing, setCapturing] = useState(false);
  const [pickerBusy, setPickerBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [permissionBusy, setPermissionBusy] = useState(false);
  const [, setQueueVersion] = useState(0);
  const ref = useRef<CameraView>(null);
  const captureLock = useRef(false);
  const messageTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    void startPhotoUploadQueue();
    const unsubscribe = subscribePhotoUploadQueue(() => {
      setQueueVersion((value) => value + 1);
    });
    return () => {
      unsubscribe();
      if (messageTimer.current) clearTimeout(messageTimer.current);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const prepareMembership = async () => {
      if (!supabase || !eventId) {
        setMembershipError("Cloud connection is not configured.");
        return;
      }
      setMembershipReady(false);
      setMembershipError("");
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
    return () => {
      cancelled = true;
    };
  }, [displayName, eventId]);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", async (state) => {
      if (state === "active") {
        await request();
        void startPhotoUploadQueue();
      }
    });
    return () => subscription.remove();
  }, [request]);

  const showMessage = (value: string) => {
    setMessage(value);
    if (messageTimer.current) clearTimeout(messageTimer.current);
    messageTimer.current = setTimeout(() => setMessage(""), 1100);
  };

  const queueSummary = getPhotoQueueSummary(
    eventId ? String(eventId) : undefined,
  );
  if (!perm)
    return (
      <View style={styles.center}>
        <ActivityIndicator color="#fff" />
      </View>
    );
  if (!perm.granted)
    return (
      <View style={styles.center}>
        <MaterialCommunityIcons name="camera-outline" size={36} color="#fff" />
        <Text style={styles.title}>Camera access</Text>
        <Text style={styles.sub}>
          Mefie needs the camera to capture and share moments.
        </Text>
        <Pressable
          disabled={permissionBusy}
          onPress={async () => {
            if (permissionBusy) return;
            setPermissionBusy(true);
            try {
              const result = await request();
              if (!result.granted && !result.canAskAgain) await Linking.openSettings();
            } finally {
              setPermissionBusy(false);
            }
          }}
          style={styles.cta}
        >
          {permissionBusy ? (
            <ActivityIndicator color="#111" />
          ) : (
            <Text style={styles.ctaText}>
              {perm.canAskAgain ? "Allow camera" : "Open Settings"}
            </Text>
          )}
        </Pressable>
      </View>
    );
  const capture = async () => {
    // Use an immediate ref lock as well as React state. State updates are batched,
    // so rapid taps can otherwise enter this handler several times before
    // disabled={capturing} reaches the native button.
    if (
      captureLock.current ||
      !ref.current ||
      capturing ||
      !cameraReady ||
      !membershipReady ||
      !eventId
    ) {
      return;
    }

    captureLock.current = true;
    setCapturing(true);
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      const photo = await ref.current.takePictureAsync({
        quality: 0.85,
        skipProcessing: true,
      });
      if (!photo?.uri) throw new Error("Could not capture the photo.");
      if (!participantId) throw new Error("Your event connection was lost. Please try again.");
      void enqueuePhotoUpload({
        id: createUploadId(),
        eventId: String(eventId),
        participantId,
        uri: photo.uri,
        width: photo.width ?? null,
        height: photo.height ?? null,
      }).catch((error: any) => {
        showMessage(error?.message || "Photo could not be queued.");
      });
      showMessage("Photo queued");
    } catch (error: any) {
      showMessage(error?.message || "Could not capture the photo.");
    } finally {
      captureLock.current = false;
      setCapturing(false);
    }
  };

  const pick = async () => {
    if (pickerBusy || !membershipReady || !eventId) return;
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      showMessage("Photo library permission is required.");
      return;
    }
    setPickerBusy(true);
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        quality: 0.9,
        allowsMultipleSelection: false,
      });
      if (result.canceled || !result.assets?.[0]) return;
      const image = result.assets[0];
      if (!participantId) {
        showMessage("Your event connection was lost. Please try again.");
        return;
      }
      await enqueuePhotoUpload({
        id: createUploadId(),
        eventId: String(eventId),
        participantId,
        uri: image.uri,
        width: image.width ?? null,
        height: image.height ?? null,
      });
      showMessage("Photo queued");
    } catch (error: any) {
      showMessage(error?.message || "Could not add the photo.");
    } finally {
      setPickerBusy(false);
    }
  };

  return (
    <View style={styles.container}>
      <CameraView
        ref={ref}
        style={StyleSheet.absoluteFill}
        facing={facing}
        flash={flash}
        onCameraReady={() => setCameraReady(true)}
        onMountError={(error) => {
          setCameraReady(false);
          setMessage(error.message || "Could not start the camera.");
        }}
      />
      <View style={styles.scrimTop} />
      <View style={styles.top}>
        <Pressable
          accessibilityLabel="Close camera"
          onPress={() => router.back()}
          style={styles.control}
        >
          <MaterialCommunityIcons name="close" size={23} color="#fff" />
        </Pressable>
        <Pressable
          accessibilityLabel={
            flash === "on" ? "Turn flash off" : "Turn flash on"
          }
          onPress={() => setFlash((v) => (v === "off" ? "on" : "off"))}
          style={styles.control}
        >
          <MaterialCommunityIcons
            name={flash === "on" ? "flash" : "flash-off"}
            size={20}
            color="#fff"
          />
        </Pressable>
      </View>
      <View style={styles.bottom}>
        {membershipError ? (
          <Pressable
            onPress={() => {
              setMembershipError("");
              setMembershipReady(false);
              void ensureParticipant(String(eventId), displayName)
                .then((id) => {
                  if (!id) throw new Error("Could not join this event.");
                  setParticipantId(id);
                  setMembershipReady(true);
                })
                .catch((error: any) => {
                  setMembershipError(error?.message || "Could not connect to this event.");
                });
            }}
            style={styles.statusPill}
          >
            <MaterialCommunityIcons name="cloud-alert-outline" size={15} color="#fff" />
            <Text style={styles.statusText}>Tap to reconnect</Text>
          </Pressable>
        ) : queueSummary.queued + queueSummary.uploading > 0 ? (
          <View style={styles.statusPill}>
            <MaterialCommunityIcons name="cloud-upload-outline" size={15} color="#fff" />
            <Text style={styles.statusText}>
              {String(queueSummary.queued + queueSummary.uploading)}{" "}
              {queueSummary.queued + queueSummary.uploading === 1 ? "photo" : "photos"} sharing
            </Text>
          </View>
        ) : queueSummary.failed > 0 ? (
          <Pressable
            onPress={() => void retryFailedPhotoUploads(String(eventId))}
            style={styles.statusPill}
          >
            <MaterialCommunityIcons name="alert-circle-outline" size={15} color="#fff" />
            <Text style={styles.statusText}>
              {queueSummary.failed} failed · Tap to retry
            </Text>
          </Pressable>
        ) : message ? (
          <View style={styles.statusPill}>
            <MaterialCommunityIcons name="check" size={15} color="#fff" />
            <Text style={styles.statusText}>{message}</Text>
          </View>
        ) : null}

        <View style={styles.row}>
          <Pressable
            accessibilityLabel="Choose photo"
            onPress={pick}
            disabled={pickerBusy || !membershipReady}
            style={styles.sideControl}
          >
            {pickerBusy ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <MaterialCommunityIcons name="image-outline" size={21} color="#fff" />
            )}
          </Pressable>

          <Pressable
            accessibilityLabel="Take photo"
            onPress={capture}
            disabled={!cameraReady || !membershipReady || capturing}
            style={[
              styles.shutter,
              (!cameraReady || !membershipReady) && styles.shutterDisabled,
            ]}
          >
            {capturing ? (
              <ActivityIndicator color="#111" />
            ) : (
              <View style={styles.shutterInner}>
                <MaterialCommunityIcons name="camera-outline" size={27} color="#111" />
              </View>
            )}
          </Pressable>

          <Pressable
            accessibilityLabel="Switch camera"
            onPress={() => {
              setCameraReady(false);
              setFacing((value) => (value === "back" ? "front" : "back"));
            }}
            style={styles.sideControl}
          >
            <MaterialCommunityIcons name="camera-flip-outline" size={21} color="#fff" />
          </Pressable>
        </View>

        <Text style={styles.mode}>
          {!cameraReady ? "STARTING CAMERA…" : !membershipReady ? "CONNECTING…" : "PHOTO"}
        </Text>
      </View>    </View>
  );
}
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#000" },
  scrimTop: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 150,
    backgroundColor: "rgba(0,0,0,.20)",
  },
  top: {
    position: "absolute",
    top: 55,
    left: 20,
    right: 20,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  control: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(16,21,27,.42)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,.20)",
    alignItems: "center",
    justifyContent: "center",
  },
  bottom: {
    position: "absolute",
    bottom: 28,
    left: 0,
    right: 0,
    alignItems: "center",
  },
  row: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
    paddingHorizontal: 20,
  },
  sideControl: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: "rgba(20,25,31,.45)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,.20)",
    alignItems: "center",
    justifyContent: "center",
  },
  shutter: {
    width: 82,
    height: 82,
    borderRadius: 41,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "rgba(255,255,255,.72)",
  },
  shutterDisabled: { opacity: 0.55 },
  shutterInner: {
    width: 70,
    height: 70,
    borderRadius: 35,
    borderWidth: 2,
    borderColor: "#111",
    alignItems: "center",
    justifyContent: "center",
  },
  mode: {
    color: "#fff",
    fontSize: 11,
    marginTop: 10,
    fontWeight: "800",
    letterSpacing: 1,
  },
  statusPill: {
    maxWidth: "88%",
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    backgroundColor: "rgba(10,14,18,.62)",
    paddingHorizontal: 15,
    paddingVertical: 9,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,.16)",
    marginBottom: 14,
  },
  statusText: { color: "#fff", fontWeight: "700", fontSize: 13 },
  center: {
    flex: 1,
    backgroundColor: "#0A0F15",
    alignItems: "center",
    justifyContent: "center",
    padding: 28,
  },
  title: { color: "#fff", fontSize: 28, fontWeight: "800", marginTop: 14 },
  sub: {
    color: colors.muted,
    textAlign: "center",
    marginTop: 8,
    lineHeight: 20,
  },
  cta: {
    marginTop: 22,
    backgroundColor: "#fff",
    paddingHorizontal: 24,
    paddingVertical: 15,
    borderRadius: 20,
  },
  ctaText: { color: "#111", fontWeight: "800" },
});

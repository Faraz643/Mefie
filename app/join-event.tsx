import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { useCameraPermission } from "react-native-vision-camera";
import { CodeScanner } from "react-native-vision-camera-barcode-scanner";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Screen } from "../components/Screen";
import { GlassCard, GlassInput, GlassAction } from "../components/Glass";
import { colors, shadows, typography } from "../lib/theme";
import { ensureParticipant, supabase, useApp } from "../lib/app-context";

function inviteFromValue(value: string) {
  const raw = value.trim().replace(/\/$/, "");
  const match = raw.match(/\/e\/([^/?#]+)/i);
  return (match?.[1] || raw).toUpperCase();
}

function quickAccessTokenFromValue(value: string) {
  const raw = value.trim().replace(/\/$/, "");
  const match = raw.match(/\/rejoin\/([^/?#]+)/i);
  if (match?.[1]) return match[1];
  // Quick-access tokens are 32-character lowercase hex strings. Supporting
  // the raw token also makes QR scanners that strip the URL work correctly.
  if (/^[a-f0-9]{32}$/i.test(raw)) return raw;
  return "";
}

export default function JoinEventScreen() {
  const router = useRouter();
  const { displayName } = useApp();
  const [link, setLink] = useState("");
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState("");
  const { hasPermission, canRequestPermission, requestPermission } = useCameraPermission();


  const join = async (value = link) => {
    setError("");
    const quickAccessToken = quickAccessTokenFromValue(value);
    if (quickAccessToken) {
      router.push({
        pathname: "/rejoin/[token]",
        params: { token: quickAccessToken },
      });
      return;
    }

    const invite = inviteFromValue(value);
    if (!invite) {
      setError("Paste an event link or code.");
      return;
    }
    if (!supabase) {
      setError("Cloud connection is not configured.");
      return;
    }
    const { data, error: lookupError } = await supabase
      .from("events")
      .select("id,name,invite_code")
      .eq("invite_code", invite)
      .eq("status", "active")
      .maybeSingle();
    if (lookupError) {
      setError(lookupError.message);
      return;
    }
    if (!data) {
      setError("We couldn't find that event.");
      return;
    }
    try {
      const participantId = await ensureParticipant(data.id, displayName);
      if (!participantId) {
        setError("This invite is no longer valid for your account.");
        return;
      }
      router.replace({ pathname: "/event/[id]", params: { id: data.id } });
    } catch (e: any) {
      setError(e?.message || "Could not join the event.");
    }
  };

  const startScan = async () => {
    setError("");
    try {
      const granted = hasPermission || (canRequestPermission && await requestPermission());

      if (!granted) {
        setError(
          canRequestPermission
            ? "Camera permission is required to scan a QR code."
            : "Camera access is blocked. Enable it in Android Settings for Mefie."
        );
        return;
      }

      setScanning(true);
    } catch (e: any) {
      setError(e?.message || "Could not access the camera.");
    }
  };

  if (scanning)
    return (
      <View style={styles.scanner}>
        <CodeScanner
          style={StyleSheet.absoluteFill}
          isActive={scanning}
          barcodeFormats={["qr-code"]}
          onBarcodeScanned={(barcodes) => {
            const data = barcodes[0]?.rawValue;
            if (!data) return;
            setScanning(false);
            setLink(data);
            void join(data);
          }}
          onError={(scanError) => setError(scanError.message || "Could not scan the QR code.")}
        />
        <View style={styles.scanOverlay}>
          <View style={styles.scanTop}>
            <Text style={styles.scanEyebrow}>MEFIE</Text>
            <Pressable
              style={styles.closeCircle}
              onPress={() => setScanning(false)}
            >
              <MaterialCommunityIcons name="close" size={24} color="#fff" />
            </Pressable>
          </View>
          <Text style={styles.scanTitle}>Scan to join</Text>
          <Text style={styles.scanSub}>
            Point your camera at the event QR code.
          </Text>
          <View style={styles.scanBox}>
            <View style={styles.cornerTL} />
            <View style={styles.cornerTR} />
            <View style={styles.cornerBL} />
            <View style={styles.cornerBR} />
            <MaterialCommunityIcons
              name="scan-helper"
              size={28}
              color="rgba(255,255,255,.9)"
            />
          </View>
        </View>
      </View>
    );

  return (
    <Screen blurBackground>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Go back"
        onPress={() => router.back()}
        focusable={false}
        android_ripple={{ color: "transparent" }}
        style={styles.backButton}
      >
        <MaterialCommunityIcons
          name="arrow-left"
          size={25}
          color={colors.white}
        />
      </Pressable>

      <View style={styles.heading}>
        <Text style={styles.title}>Join an event</Text>
        <Text style={styles.sub}>Link, code, or QR. That's it.</Text>
      </View>

      <GlassCard style={styles.formCard}>
        <GlassInput
          value={link}
          onChangeText={setLink}
          placeholder="Paste event link here"
        />
        <Pressable
          disabled={!link.trim()}
          onPress={() => join()}
          focusable={false}
          android_ripple={{ color: "transparent" }}
          style={({ pressed }) => [
            styles.joinButton,
            !link.trim() && styles.joinDisabled,
            pressed && styles.pressed,
          ]}
        >
          <Text style={styles.joinLabel}>Join</Text>
          <MaterialCommunityIcons
            name="arrow-right"
            size={23}
            color={colors.white}
          />
        </Pressable>
      </GlassCard>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <View style={styles.or}>
        <View style={styles.orLine} />
        <Text style={styles.orText}>or</Text>
        <View style={styles.orLine} />
      </View>

      <GlassAction
        label="Scan QR Code"
        onPress={startScan}
        icon={
          <MaterialCommunityIcons
            name="qrcode-scan"
            size={25}
            color={colors.white}
          />
        }
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  backButton: {
    width: 44,
    height: 44,
    alignItems: "flex-start",
    justifyContent: "center",
    marginBottom: 10,
  fontFamily: typography.regular, },
  heading: { marginTop: 34, paddingBottom: 5 },
  title: {
    color: colors.white,
    fontFamily: typography.regular, fontSize: 29,
    fontFamily: typography.semibold, fontFamily: typography.semibold,
    letterSpacing: -0.7,
  },
  sub: { color: "rgba(255,255,255,.70)", fontSize: 14, fontFamily: typography.regular, marginTop: 7 },
  formCard: {
    padding: 10,
    borderRadius: 22,
    backgroundColor: "rgba(220,225,232,.18)",
    borderColor: "rgba(255,255,255,.25)",
    shadowOpacity: 0.2,
  },
  joinButton: {
    height: 66,
    borderRadius: 18,
    marginTop: 10,
    backgroundColor: "rgba(8,14,20,.94)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,.08)",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    ...shadows,
  },
  joinLabel: { color: colors.white, fontSize: 16, fontFamily: typography.medium, fontFamily: typography.medium },
  joinDisabled: { opacity: 0.6 },
  pressed: { transform: [{ scale: 0.985 }], opacity: 0.88 },
  or: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginVertical: 20,
    paddingHorizontal: 8,
  },
  orLine: { height: 1, backgroundColor: "rgba(255,255,255,.30)", flex: 1 },
  orText: { color: "rgba(255,255,255,.78)", fontFamily: typography.regular, fontSize: 14 },
  error: {
    color: colors.danger,
    fontFamily: typography.regular, fontSize: 13,
    fontFamily: typography.regular, marginHorizontal: 4,
    marginTop: -5,
  },
  scanner: { flex: 1, backgroundColor: "#000" },
  scanOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,.16)",
    alignItems: "center",
  },
  scanTop: {
    position: "absolute",
    top: 58,
    left: 22,
    right: 22,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  scanEyebrow: {
    color: "#fff",
    fontFamily: typography.regular, fontSize: 12,
    fontFamily: typography.extraBold, fontFamily: typography.extraBold,
    letterSpacing: 2,
  },
  closeCircle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "rgba(20,25,32,.62)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,.22)",
    alignItems: "center",
    justifyContent: "center",
  },
  scanTitle: { color: "#fff", fontSize: 26, fontFamily: typography.extraBold, fontFamily: typography.extraBold, marginTop: 118 },
  scanSub: { color: "rgba(255,255,255,.72)", fontSize: 13, fontFamily: typography.regular, marginTop: 7 },
  scanBox: {
    width: 270,
    height: 270,
    marginTop: 42,
    borderRadius: 28,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,.25)",
    backgroundColor: "rgba(255,255,255,.04)",
    alignItems: "center",
    justifyContent: "center",
  },
  cornerTL: {
    position: "absolute",
    left: -2,
    top: -2,
    width: 42,
    height: 42,
    borderLeftWidth: 4,
    borderTopWidth: 4,
    borderColor: "#fff",
    borderTopLeftRadius: 26,
  },
  cornerTR: {
    position: "absolute",
    right: -2,
    top: -2,
    width: 42,
    height: 42,
    borderRightWidth: 4,
    borderTopWidth: 4,
    borderColor: "#fff",
    borderTopRightRadius: 26,
  },
  cornerBL: {
    position: "absolute",
    left: -2,
    bottom: -2,
    width: 42,
    height: 42,
    borderLeftWidth: 4,
    borderBottomWidth: 4,
    borderColor: "#fff",
    borderBottomLeftRadius: 26,
  },
  cornerBR: {
    position: "absolute",
    right: -2,
    bottom: -2,
    width: 42,
    height: 42,
    borderRightWidth: 4,
    borderBottomWidth: 4,
    borderColor: "#fff",
    borderBottomRightRadius: 26,
  },
});

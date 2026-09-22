import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import * as Clipboard from "expo-clipboard";
import * as Sharing from "expo-sharing";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useRef, useState } from "react";
import { Share, StyleSheet, Text, View } from "react-native";
import QRCode from "react-native-qrcode-svg";
import { captureRef } from "react-native-view-shot";
import { BackButton, Screen } from "../components/Screen";
import { GlassButton } from "../components/Glass";
import { colors, radii, shadows, typography } from "../lib/theme";
export default function EventCreatedScreen() {
  const router = useRouter();
  const {
    id = "local",
    name = "Your event",
    invite = "MEFIE1",
  } = useLocalSearchParams<{ id: string; name: string; invite: string }>();
  const [sharingQr, setSharingQr] = useState(false);
  const qrRef = useRef<View>(null);
  const link = `https://mefie.app/e/${invite}`;
  const share = () =>
    Share.share({
      message: `Join our ${name} on Mefie 📸\nEveryone's photos go into one shared album.\n\nTap to join: ${link}`,
    });
  const shareQr = async () => {
    if (!qrRef.current || sharingQr) return;
    setSharingQr(true);
    try {
      const uri = await captureRef(qrRef.current, {
        format: "png",
        quality: 1,
      });
      if (await Sharing.isAvailableAsync())
        await Sharing.shareAsync(uri, {
          mimeType: "image/png",
          dialogTitle: `Join ${name} on Mefie`,
        });
      else await share();
    } catch (e) {
      await share();
    } finally {
      setSharingQr(false);
    }
  };
  return (
    <Screen>
      <BackButton />
      <View style={styles.center}>
        <View style={styles.check}>
          <MaterialCommunityIcons name="check" size={29} color="#3975D8" />
        </View>
        <Text style={styles.ready}>Your event is ready</Text>
        <Text style={styles.title}>{name}</Text>
        <Text style={styles.sub}>
          Share this link or QR code with your friends.
        </Text>
      </View>
      <View ref={qrRef} collapsable={false} style={styles.qrCard}>
        <Text style={styles.label}>JOIN ON MEFIE</Text>
        <QRCode value={link} size={180} backgroundColor="white" color="black" />
        <Text style={styles.qrLink}>{link}</Text>
      </View>
      <GlassButton
        label="Copy link"
        icon={
          <MaterialCommunityIcons
            name="content-copy"
            size={18}
            color={colors.white}
          />
        }
        onPress={() => Clipboard.setStringAsync(link)}
      />
      <GlassButton
        label="Share invite"
        icon={
          <MaterialCommunityIcons
            name="share-variant-outline"
            size={19}
            color={colors.white}
          />
        }
        onPress={share}
      />
      <GlassButton
        label={sharingQr ? "Preparing…" : "Share QR Code"}
        icon={
          <MaterialCommunityIcons
            name="qrcode"
            size={19}
            color={colors.white}
          />
        }
        onPress={shareQr}
      />
      <GlassButton
        primary
        label="Enter event"
        onPress={() =>
          router.replace({ pathname: "/event/[id]", params: { id } })
        }
      />
    </Screen>
  );
}
const styles = StyleSheet.create({
  center: { alignItems: "center", paddingTop: 22, paddingBottom: 12 },
  check: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: "rgba(232,240,255,.96)",
    alignItems: "center",
    justifyContent: "center",
    ...shadows,
  },
  ready: {
    color: colors.white,
    fontSize: 13,
    fontFamily: typography.bold, fontWeight: "700",
    marginTop: 16,
  },
  title: {
    color: colors.white,
    fontSize: 29,
    fontFamily: typography.extraBold, fontWeight: "800",
    marginTop: 8,
    textAlign: "center",
    letterSpacing: -0.5,
  },
  sub: { color: colors.muted, fontSize: 14, fontFamily: typography.regular, marginTop: 7, textAlign: "center" },
  qrCard: {
    backgroundColor: "rgba(255,255,255,.96)",
    borderColor: "rgba(255,255,255,.72)",
    borderWidth: 1,
    borderRadius: radii.card,
    padding: 20,
    alignItems: "center",
    marginBottom: 4,
    ...shadows,
  },
  label: {
    color: "#111",
    fontSize: 11,
    fontFamily: typography.extraBold, fontWeight: "900",
    letterSpacing: 1.3,
    marginBottom: 12,
  },
  qrLink: { color: "#111", fontSize: 10, fontFamily: typography.regular, marginTop: 12 },
});

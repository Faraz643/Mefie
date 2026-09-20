import * as ImagePicker from "expo-image-picker";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import { BottomNav, Screen } from "../../components/Screen";
import { GlassButton, GlassCard, GlassInput } from "../../components/Glass";
import { useApp } from "../../lib/app-context";
import { colors, radii, shadows } from "../../lib/theme";

export default function You() {
  const router = useRouter();
  const { displayName, setDisplayName, backgroundImage, setBackgroundImage } = useApp();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(displayName);

  const chooseBackground = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], allowsEditing: true, aspect: [9, 16], quality: 0.9 });
    if (!result.canceled && result.assets[0]?.uri) await setBackgroundImage(result.assets[0].uri);
  };

  return (
    <View style={styles.root}>
      <Screen bottomNav={<BottomNav active="you" />}>
        <View style={styles.profile}>
          <View style={styles.avatar}><Text style={styles.avatarText}>{displayName[0]?.toUpperCase() || "M"}</Text></View>
          <Text style={styles.title}>{displayName}</Text>
          <Text style={styles.handle}>@{displayName.toLowerCase().replace(/\s+/g, "")}</Text>
        </View>
        <GlassCard style={styles.menu}>
          <MenuRow icon="image-multiple-outline" label="My events" onPress={() => router.push("/events")} />
          <View style={styles.div} />
          <MenuRow icon="image-outline" label="Background photo" onPress={chooseBackground} />
          <View style={styles.div} />
          <MenuRow icon="cog-outline" label="Settings" onPress={() => setEditing((v) => !v)} />
          <View style={styles.div} />
          <MenuRow icon="help-circle-outline" label="Help & feedback" />
        </GlassCard>
        <GlassCard style={styles.backgroundCard}>
          <View style={styles.backgroundContent}>
            <View style={styles.backgroundHeader}>
            <View style={styles.backgroundIcon}><MaterialCommunityIcons name="image-outline" size={20} color={colors.white} /></View>
            <View style={styles.backgroundCopy}><Text style={styles.backgroundTitle}>App background</Text><Text style={styles.backgroundSub}>Choose a photo from your phone</Text></View>
          </View>
            {backgroundImage ? <Image source={{ uri: backgroundImage }} style={styles.preview} resizeMode="cover" /> : null}
            <View style={styles.chooseButtonSpacing}>
            <Pressable onPress={chooseBackground} style={({ pressed }) => [styles.chooseButton, pressed && styles.chooseButtonPressed]}>
              <MaterialCommunityIcons name="image-plus" size={20} color={colors.black} />
              <Text style={styles.chooseButtonText}>{backgroundImage ? "Change background" : "Choose background photo"}</Text>
            </Pressable>
            </View>
            {backgroundImage ? <Pressable onPress={() => setBackgroundImage(null)} style={styles.removeButton}><Text style={styles.removeText}>Use default background</Text></Pressable> : null}
          </View>
        </GlassCard>
        {editing ? (
          <GlassCard><GlassInput label="Display name" value={name} onChangeText={setName} /><View style={{ marginTop: 14 }}><GlassButton primary label="Save" onPress={async () => { await setDisplayName(name); setEditing(false); }} /></View></GlassCard>
        ) : <GlassButton label="Edit profile" onPress={() => setEditing(true)} />}
      </Screen>
      <BottomNav active="you" />
    </View>
  );
}

function MenuRow({ icon, label, onPress }: { icon: any; label: string; onPress?: () => void }) {
  return <Pressable style={styles.menuRow} onPress={onPress} disabled={!onPress}><MaterialCommunityIcons name={icon} size={21} color="rgba(255,255,255,.82)" /><Text style={styles.rowText}>{label}</Text><MaterialCommunityIcons name="chevron-right" size={21} color="rgba(255,255,255,.55)" /></Pressable>;
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#0A0F15" },
  profile: { alignItems: "center", paddingTop: 28, paddingBottom: 22 },
  avatar: { width: 100, height: 100, borderRadius: 50, backgroundColor: "rgba(255,255,255,.16)", borderWidth: 1, borderColor: colors.lineStrong, alignItems: "center", justifyContent: "center" },
  avatarText: { fontSize: 39, color: "#fff", fontWeight: "800" },
  title: { color: "#fff", fontSize: 29, fontWeight: "800", marginTop: 14, letterSpacing: -0.5 },
  handle: { color: colors.muted, marginTop: 3, fontSize: 13 },
  menu: {},
  menuRow: { minHeight: 54, flexDirection: "row", alignItems: "center", paddingHorizontal: 16 },
  rowText: { flex: 1, color: "#fff", fontSize: 16, fontWeight: "600", marginLeft: 13 },
  div: { height: 1, backgroundColor: colors.line, marginHorizontal: 18 },
  backgroundCard: {},
  backgroundContent: { gap: 14 },
  backgroundHeader: { flexDirection: "row", alignItems: "center" },
  backgroundIcon: { width: 40, height: 40, borderRadius: 12, backgroundColor: "rgba(255,255,255,.10)", alignItems: "center", justifyContent: "center" },
  backgroundCopy: { flex: 1, marginLeft: 12 },
  backgroundTitle: { color: colors.white, fontSize: 16, fontWeight: "700" },
  backgroundSub: { color: colors.muted, fontSize: 12, marginTop: 3 },
  preview: { width: "100%", height: 170, borderRadius: radii.card, backgroundColor: "#26313F", ...shadows },
  chooseButtonSpacing: { marginTop: 4 },
  chooseButton: { minHeight: 56, borderRadius: 20, backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "rgba(255,255,255,.86)", flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 9, paddingHorizontal: 16, ...shadows },
  chooseButtonPressed: { opacity: 0.9, transform: [{ scale: 0.99 }] },
  chooseButtonText: { color: colors.black, fontSize: 15, fontWeight: "700" },
  removeButton: { alignItems: "center", paddingTop: 2 },
  removeText: { color: "rgba(255,255,255,.68)", fontSize: 13, fontWeight: "600" },
});

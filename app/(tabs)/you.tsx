// PROFILE PHOTO LOGIC DISABLED FOR NOW:
// import * as ImagePicker from "expo-image-picker";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import { Image, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { BottomNav, Screen } from "../../components/Screen";
import { GlassCard } from "../../components/Glass";
import { useApp } from "../../lib/app-context";
import { colors, radii, shadows } from "../../lib/theme";

export default function You() {
  const router = useRouter();
  const {
    displayName,
    setDisplayName,
    backgroundImage,
    setBackgroundImage,
  } = useApp();
  const [editingName, setEditingName] = useState(false);
  const [name, setName] = useState(displayName);

  useEffect(() => {
    setName(displayName);
  }, [displayName]);

  /* PROFILE PHOTO LOGIC DISABLED — kept for future use.
  const chooseAvatar = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.9,
    });
    if (!result.canceled && result.assets[0]?.uri) {
      try {
        await setAvatarImage(result.assets[0].uri);
      } catch (e: any) {
        Alert.alert(
          "Photo saved on this device",
          e?.message
            ? `Mefie couldn't sync it to your profile yet: ${e.message}`
            : "Mefie couldn't sync it to your profile yet. We'll retry automatically.",
        );
      }
    }
  };

  */

  const saveName = async () => {
    await setDisplayName(name);
    setEditingName(false);
  };

  const chooseBackground = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [9, 16],
      quality: 0.9,
    });
    if (!result.canceled && result.assets[0]?.uri) {
      await setBackgroundImage(result.assets[0].uri);
    }
  };

  return (
    <View style={styles.root}>
      <Screen bottomNav={<BottomNav active="you" />}>
        <View style={styles.profile}>
          <View style={styles.profileColumn}>
            {/* PROFILE PHOTO LOGIC DISABLED — replaced with a deterministic gradient avatar. */}
            <LinearGradient colors={gradientForName(displayName)} style={styles.avatar}>
              <Text style={styles.avatarText}>{displayName[0]?.toUpperCase() || "M"}</Text>
            </LinearGradient>

            <View style={styles.nameRow}>
              {editingName ? (
                <TextInput
                  value={name}
                  onChangeText={setName}
                  onSubmitEditing={saveName}
                  onBlur={saveName}
                  autoFocus
                  returnKeyType="done"
                  placeholder="Your name"
                  placeholderTextColor="rgba(255,255,255,.45)"
                  selectionColor="#7C83FF"
                  style={styles.nameInput}
                />
              ) : (
                <>
                  <Text style={styles.title} numberOfLines={1}>
                    {displayName}
                  </Text>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Edit name"
                    onPress={() => setEditingName(true)}
                    hitSlop={8}
                    style={styles.editNameButton}
                  >
                    <MaterialCommunityIcons
                      name="pencil-outline"
                      size={16}
                      color="rgba(255,255,255,.82)"
                    />
                  </Pressable>
                </>
              )}
            </View>
          </View>
        </View>

        <GlassCard style={styles.menu}>
          <MenuRow
            icon="image-multiple-outline"
            label="My events"
            onPress={() => router.push("/events")}
          />
          <View style={styles.div} />
          <MenuRow icon="help-circle-outline" label="Help & feedback" />
        </GlassCard>

        <GlassCard style={styles.backgroundCard}>
          <View style={styles.backgroundContent}>
            <View style={styles.backgroundHeader}>
              <View style={styles.backgroundIcon}>
                <MaterialCommunityIcons
                  name="image-outline"
                  size={20}
                  color={colors.white}
                />
              </View>
              <View style={styles.backgroundCopy}>
                <Text style={styles.backgroundTitle}>App background</Text>
                <Text style={styles.backgroundSub}>
                  Choose a photo from your phone
                </Text>
              </View>
            </View>

            {backgroundImage ? (
              <View style={styles.previewWrap}>
                <Image
                  source={{ uri: backgroundImage }}
                  style={styles.preview}
                  resizeMode="cover"
                />
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Remove background photo"
                  onPress={() => void setBackgroundImage(null)}
                  style={styles.backgroundDelete}
                  hitSlop={6}
                >
                  <MaterialCommunityIcons name="trash-can-outline" size={18} color="#fff" />
                </Pressable>
              </View>
            ) : null}

            <View style={styles.chooseButtonSpacing}>
              <Pressable
                onPress={chooseBackground}
                style={({ pressed }) => [
                  styles.chooseButton,
                  pressed && styles.chooseButtonPressed,
                ]}
              >
                <MaterialCommunityIcons
                  name="image-plus"
                  size={20}
                  color={colors.black}
                />
                <Text style={styles.chooseButtonText}>
                  {backgroundImage
                    ? "Change background"
                    : "Choose background photo"}
                </Text>
              </Pressable>
            </View>

            {backgroundImage ? (
              <Pressable
                onPress={() => setBackgroundImage(null)}
                style={styles.removeButton}
              >
                <Text style={styles.removeText}>Use default background</Text>
              </Pressable>
            ) : null}
          </View>
        </GlassCard>

        {/* Kept in code for future use; intentionally hidden from the current profile UI. */}
        {false ? (
          <GlassCard>
            <TextInput value={name} onChangeText={setName} />
          </GlassCard>
        ) : null}
      </Screen>
    </View>
  );
}

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

function MenuRow({
  icon,
  label,
  onPress,
}: {
  icon: any;
  label: string;
  onPress?: () => void;
}) {
  return (
    <Pressable
      style={styles.menuRow}
      onPress={onPress}
      disabled={!onPress}
    >
      <MaterialCommunityIcons
        name={icon}
        size={21}
        color="rgba(255,255,255,.82)"
      />
      <Text style={styles.rowText}>{label}</Text>
      {onPress ? (
        <MaterialCommunityIcons
          name="chevron-right"
          size={21}
          color="rgba(255,255,255,.55)"
        />
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#0A0F15" },
  profile: {
    alignItems: "center",
    paddingTop: 12,
    paddingBottom: 12,
    position: "relative",
  },
  avatar: {
    width: 78,
    height: 78,
    borderRadius: 39,
    backgroundColor: "#5865F2",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,.42)",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  avatarText: { fontSize: 31, color: "#fff", fontWeight: "800" },
  /* avatarCamera: {
    position: "absolute",
    right: 4,
    bottom: 4,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "rgba(8,14,20,.72)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,.28)",
    alignItems: "center",
    justifyContent: "center",
  },
  */
  /* avatarPressed: { opacity: 0.86 }, */
  /* avatarDelete: {
    position: "absolute",
    right: 3,
    bottom: 3,
    width: 25,
    height: 25,
    borderRadius: 13,
    backgroundColor: "rgba(10,15,21,.78)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,.30)",
    alignItems: "center",
    justifyContent: "center",
  },
  */
  profileColumn: {
    width: 78,
    alignItems: "flex-start",
  },
  nameRow: {
    width: 78,
    height: 34,
    marginTop: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-start",
    overflow: "visible",
  },
  editNameButton: {
    width: 22,
    height: 22,
    marginLeft: 4,
    flexShrink: 0,
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    color: "#fff",
    fontSize: 24,
    lineHeight: 30,
    fontWeight: "800",
    letterSpacing: -0.5,
    flexShrink: 1,
  },
  nameInput: {
    width: 78,
    height: 34,
    color: "#fff",
    fontSize: 24,
    lineHeight: 30,
    fontWeight: "800",
    padding: 0,
    margin: 0,
    borderWidth: 0,
    backgroundColor: "transparent",
    textAlign: "left",
    includeFontPadding: false,
  },
  menu: {},
  menuRow: {
    minHeight: 54,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
  },
  rowText: {
    flex: 1,
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
    marginLeft: 13,
  },
  div: { height: 1, backgroundColor: colors.line, marginHorizontal: 18 },
  backgroundCard: {},
  backgroundContent: { gap: 14 },
  backgroundHeader: { flexDirection: "row", alignItems: "center" },
  backgroundIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,.10)",
    alignItems: "center",
    justifyContent: "center",
  },
  backgroundCopy: { flex: 1, marginLeft: 12 },
  backgroundTitle: { color: colors.white, fontSize: 16, fontWeight: "700" },
  backgroundSub: { color: colors.muted, fontSize: 12, marginTop: 3 },
  previewWrap: {
    width: "100%",
    height: 170,
    borderRadius: radii.card,
    overflow: "hidden",
    position: "relative",
  },
  preview: {
    width: "100%",
    height: "100%",
    borderRadius: radii.card,
    backgroundColor: "#26313F",
    ...shadows,
  },
  backgroundDelete: {
    position: "absolute",
    top: 10,
    right: 10,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(10,15,21,.72)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,.28)",
    alignItems: "center",
    justifyContent: "center",
  },
  chooseButtonSpacing: { marginTop: 4 },
  chooseButton: {
    minHeight: 56,
    borderRadius: 20,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,.86)",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 9,
    paddingHorizontal: 16,
    ...shadows,
  },
  chooseButtonPressed: { opacity: 0.9, transform: [{ scale: 0.99 }] },
  chooseButtonText: { color: colors.black, fontSize: 15, fontWeight: "700" },
  removeButton: { alignItems: "center", paddingTop: 2 },
  removeText: {
    color: "rgba(255,255,255,.68)",
    fontSize: 13,
    fontWeight: "600",
  },
});

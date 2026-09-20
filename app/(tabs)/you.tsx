import * as ImagePicker from "expo-image-picker";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
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
    avatarImage,
    setAvatarImage,
    backgroundImage,
    setBackgroundImage,
  } = useApp();
  const [editingName, setEditingName] = useState(false);
  const [name, setName] = useState(displayName);

  useEffect(() => {
    setName(displayName);
  }, [displayName]);

  const chooseAvatar = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.9,
    });
    if (!result.canceled && result.assets[0]?.uri) {
      await setAvatarImage(result.assets[0].uri);
    }
  };

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
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Change profile photo"
            onPress={chooseAvatar}
            style={({ pressed }) => [styles.avatar, pressed && styles.avatarPressed]}
          >
            {avatarImage ? (
              <Image source={{ uri: avatarImage }} style={styles.avatarImage} />
            ) : (
              <>
                <Text style={styles.avatarText}>
                  {displayName[0]?.toUpperCase() || "M"}
                </Text>
                <View style={styles.avatarCamera}>
                  <MaterialCommunityIcons
                    name="camera-plus-outline"
                    size={15}
                    color={colors.white}
                  />
                </View>
              </>
            )}
          </Pressable>

          <View style={styles.nameRow}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Edit name"
              onPress={() => setEditingName(true)}
              hitSlop={8}
              style={styles.editNameButton}
            >
              <MaterialCommunityIcons
                name="pencil-outline"
                size={17}
                color="rgba(255,255,255,.82)"
              />
            </Pressable>

            {editingName ? (
              <TextInput
                value={name}
                onChangeText={setName}
                onSubmitEditing={saveName}
                onBlur={saveName}
                autoFocus
                selectTextOnFocus
                returnKeyType="done"
                placeholder="Your name"
                placeholderTextColor="rgba(255,255,255,.45)"
                selectionColor="#FFFFFF"
                style={styles.nameInput}
              />
            ) : (
              <Text style={styles.title}>{displayName}</Text>
            )}
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
              <Image
                source={{ uri: backgroundImage }}
                style={styles.preview}
                resizeMode="cover"
              />
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
    backgroundColor: "rgba(255,255,255,.16)",
    borderWidth: 1,
    borderColor: colors.lineStrong,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    ...shadows,
  },
  avatarImage: { width: "100%", height: "100%" },
  avatarText: { fontSize: 31, color: "#fff", fontWeight: "800" },
  avatarCamera: {
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
  avatarPressed: { opacity: 0.86 },
  nameRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 8,
    minHeight: 34,
  },
  editNameButton: {
    width: 28,
    height: 28,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 6,
  },
  title: {
    color: "#fff",
    fontSize: 24,
    fontWeight: "800",
    letterSpacing: -0.5,
  },
  nameInput: {
    color: "#fff",
    fontSize: 24,
    fontWeight: "800",
    minWidth: 120,
    paddingVertical: 0,
    paddingHorizontal: 0,
    borderWidth: 0,
    backgroundColor: "transparent",
    textAlign: "center",
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
  preview: {
    width: "100%",
    height: 170,
    borderRadius: radii.card,
    backgroundColor: "#26313F",
    ...shadows,
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

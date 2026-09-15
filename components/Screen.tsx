import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { useRouter } from "expo-router";
import React, { useEffect, useRef } from "react";
import {
  Animated,
  Easing,
  ImageBackground,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, shadows } from "../lib/theme";
import { useApp } from "../lib/app-context";
import { IconButton } from "./Glass";

const hero = require("../assets/hero-background.jpg");
type NavPath = "/" | "/events" | "/you";
type NavItem = {
  key: "home" | "events" | "you";
  label: string;
  icon: "home" | "image-outline" | "account-outline";
  path: NavPath;
};

export function Screen({
  children,
  backgroundImage,
  blurBackground = false,
}: {
  children: React.ReactNode;
  backgroundImage?: any;
  blurBackground?: boolean;
}) {
  const insets = useSafeAreaInsets();
  const { backgroundImage: userBackground } = useApp();
  const activeBackground = backgroundImage ?? userBackground ?? hero;
  const source =
    typeof activeBackground === "string"
      ? { uri: activeBackground }
      : activeBackground;

  return (
    <View style={styles.bg}>
      <ImageBackground
        source={source}
        style={StyleSheet.absoluteFill}
        resizeMode="cover"
      />
      {blurBackground ? (
        <BlurView intensity={22} tint="dark" style={StyleSheet.absoluteFill} />
      ) : null}
      <LinearGradient
        colors={[
          "rgba(5,9,14,0.02)",
          "rgba(5,9,14,0.00)",
          "rgba(5,9,14,0.10)",
          "rgba(5,9,14,0.78)",
        ]}
        locations={[0, 0.34, 0.62, 1]}
        style={StyleSheet.absoluteFill}
      />
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 138 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {children}
      </ScrollView>
    </View>
  );
}

export function BackButton() {
  const router = useRouter();
  return (
    <IconButton accessibilityLabel="Go back" onPress={() => router.back()}>
      <MaterialCommunityIcons
        name="chevron-left"
        size={25}
        color={colors.white}
      />
    </IconButton>
  );
}

export function BottomNav({
  active = "home",
}: {
  active?: "home" | "events" | "you";
}) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const items: NavItem[] = [
    { key: "home", label: "Home", icon: "home", path: "/" },
    { key: "events", label: "Events", icon: "image-outline", path: "/events" },
    { key: "you", label: "You", icon: "account-outline", path: "/you" },
  ];
  const activeIndex = items.findIndex((item) => item.key === active);
  const itemWidth = Math.max((width - 36 - 12) / items.length, 0);
  const indicatorX = useRef(
    new Animated.Value(Math.max(activeIndex, 0) * itemWidth),
  ).current;

  useEffect(() => {
    indicatorX.setValue(Math.max(activeIndex, 0) * itemWidth);
  }, [activeIndex, itemWidth, indicatorX]);

  const navigate = (index: number, path: NavPath) => {
    Animated.timing(indicatorX, {
      toValue: index * itemWidth,
      duration: 220,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
    router.replace(path);
  };

  return (
    <BlurView
      intensity={78}
      tint="dark"
      style={[styles.nav, { bottom: Math.max(insets.bottom + 14, 18) }]}
    >
      <View style={styles.navInner}>
        <Animated.View
          pointerEvents="none"
          style={[
            styles.navIndicator,
            { width: itemWidth, transform: [{ translateX: indicatorX }] },
          ]}
        />
        {items.map(({ key, label, icon, path }, index) => (
          <Pressable
            key={key}
            onPress={() => navigate(index, path)}
            style={styles.navItem}
            android_ripple={{
              color: "rgba(255,255,255,0.08)",
              borderless: true,
            }}
          >
            <MaterialCommunityIcons
              name={icon}
              size={25}
              color={active === key ? "#FFFFFF" : "rgba(255,255,255,0.62)"}
            />
            <Text
              style={[
                styles.navText,
                active === key ? styles.navTextSelected : null,
              ]}
            >
              {label}
            </Text>
          </Pressable>
        ))}
      </View>
    </BlurView>
  );
}

export function Header({
  title,
  right,
}: {
  title: string;
  right?: React.ReactNode;
}) {
  return (
    <View style={styles.header}>
      <View style={styles.brandRow}>
        <View style={styles.brandMark}>
          <View style={styles.markA} />
          <View style={styles.markB} />
        </View>
        <Text style={styles.brand}>{title}</Text>
      </View>
      {right}
    </View>
  );
}

const styles = StyleSheet.create({
  bg: { flex: 1, backgroundColor: "#0A0F15" },
  content: { paddingHorizontal: 20, gap: 16 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  brandRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  brandMark: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: "rgba(10,15,21,0.70)",
    alignItems: "center",
    justifyContent: "center",
    ...shadows,
  },
  markA: {
    position: "absolute",
    width: 17,
    height: 20,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: "#FFF",
    left: 7,
    top: 7,
  },
  markB: {
    position: "absolute",
    width: 17,
    height: 20,
    borderRadius: 6,
    borderColor: "#C9D7F5",
    left: 11,
    top: 7,
    borderWidth: 2,
  },
  brand: {
    color: colors.white,
    fontSize: 21,
    fontWeight: "800",
    letterSpacing: -0.6,
  },
  nav: {
    position: "absolute",
    left: 18,
    right: 18,
    minHeight: 76,
    borderRadius: 38,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.16)",
    overflow: "hidden",
    ...shadows,
  },
  navInner: {
    height: 74,
    padding: 6,
    backgroundColor: "rgba(220,225,232,0.16)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.22)",
    borderRadius: 37,
    flexDirection: "row",
    alignItems: "center",
    position: "relative",
  },
  navIndicator: {
    position: "absolute",
    left: 6,
    top: 6,
    bottom: 6,
    borderRadius: 31,
    backgroundColor: "rgba(255,255,255,0.18)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.28)",
  },
  navItem: {
    flex: 1,
    height: 62,
    alignItems: "center",
    justifyContent: "center",
    gap: 1,
    zIndex: 2,
  },
  navText: {
    color: "rgba(255,255,255,0.62)",
    fontSize: 11,
    lineHeight: 15,
    fontWeight: "500",
  },
  navTextSelected: { color: colors.white, fontWeight: "700" },
});

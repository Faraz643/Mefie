import React, { createContext, useContext, Pressable, RefObject, StyleSheet, Text, TextInput, View, ViewStyle } from "react-native";
import { BlurView } from "expo-blur";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { colors, radii, shadows } from "../lib/theme";

const glass = {
  blur: 28,
  surface: "rgba(30,35,42,0.30)",
  edge: "rgba(255,255,255,0.18)",
  highlight: "rgba(255,255,255,0.045)",
};

type GlassTarget = RefObject<View | null>;
const GlassTargetContext = createContext<GlassTarget | null>(null);

export function GlassTargetProvider({ target, children }: { target: GlassTarget; children: React.ReactNode }) {
  return <GlassTargetContext.Provider value={target}>{children}</GlassTargetContext.Provider>;
}

export function useGlassTarget() {
  return useContext(GlassTargetContext);
}

function blurProps(target: GlassTarget | null) {
  return target
    ? { blurTarget: target, blurMethod: "dimezisBlurView" as const }
    : { blurMethod: "none" as const };
}

export function GlassCard({ children, style }: { children: React.ReactNode; style?: ViewStyle }) {
  const target = useGlassTarget();
  return (
    <View style={[styles.card, style]}>
      <BlurView {...blurProps(target)} intensity={glass.blur} tint="dark" pointerEvents="none" style={styles.cardBlur} />
      <View pointerEvents="none" style={styles.cardTint} />
      <View style={styles.cardContent}>{children}</View>
    </View>
  );
}

export function GlassButton({ label, onPress, primary = false, icon, disabled = false }: {
  label: string; onPress?: () => void; primary?: boolean; icon?: React.ReactNode; disabled?: boolean;
}) {
  const target = useGlassTarget();
  const content = (
    <Pressable disabled={disabled} onPress={onPress} focusable={false} android_ripple={{ color: "transparent" }} style={({ pressed }) => [styles.button, primary ? styles.primary : styles.buttonGlass, disabled && styles.disabled, pressed && styles.pressed]}>
      {icon ? <View style={[styles.buttonIcon, primary && styles.primaryIcon]}>{icon}</View> : null}
      <Text style={[styles.buttonLabel, primary && styles.primaryLabel]}>{label}</Text>
      <MaterialCommunityIcons name="chevron-right" size={20} color={primary ? colors.black : colors.white} />
    </Pressable>
  );
  if (primary) return content;
  return (
    <View style={styles.buttonSurface}>
      <BlurView {...blurProps(target)} intensity={glass.blur} tint="dark" pointerEvents="none" style={styles.surfaceBlur} />
      <View pointerEvents="none" style={styles.buttonTint} />
      {content}
    </View>
  );
}

export function GlassAction({ label, subtitle, onPress, primary = false, icon }: {
  label: string; subtitle?: string; onPress?: () => void; primary?: boolean; icon: React.ReactNode;
}) {
  const target = useGlassTarget();
  const content = (
    <Pressable onPress={onPress} focusable={false} android_ripple={{ color: "transparent" }} style={({ pressed }) => [styles.action, primary ? styles.actionPrimary : styles.actionGlass, pressed && styles.pressed]}>
      <View style={[styles.actionIcon, primary ? styles.actionIconPrimary : styles.actionIconGlass]}>{icon}</View>
      <View style={styles.actionCopy}>
        <Text style={[styles.actionTitle, primary && styles.actionTitlePrimary]}>{label}</Text>
        {subtitle ? <Text style={[styles.actionSubtitle, primary && styles.actionSubtitlePrimary]}>{subtitle}</Text> : null}
      </View>
      <MaterialCommunityIcons name="chevron-right" size={19} color={primary ? colors.black : colors.white} />
    </Pressable>
  );
  if (primary) return content;
  return (
    <View style={styles.actionSurface}>
      <BlurView {...blurProps(target)} intensity={glass.blur} tint="dark" pointerEvents="none" style={styles.surfaceBlur} />
      <View pointerEvents="none" style={styles.actionTint} />
      {content}
    </View>
  );
}

export function IconButton({ children, onPress, accessibilityLabel }: { children: React.ReactNode; onPress?: () => void; accessibilityLabel: string }) {
  const target = useGlassTarget();
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={accessibilityLabel} onPress={onPress} focusable={false} android_ripple={{ color: "transparent" }} style={({ pressed }) => [styles.iconButtonOuter, pressed && styles.pressed]}>
      <View style={styles.iconButton}>
        <BlurView {...blurProps(target)} intensity={22} tint="dark" pointerEvents="none" style={styles.surfaceBlur} />
        <View pointerEvents="none" style={styles.iconTint} />
        {children}
      </View>
    </Pressable>
  );
}

export function GlassInput({ label, value, onChangeText, placeholder }: { label?: string; value: string; onChangeText: (v: string) => void; placeholder?: string }) {
  const target = useGlassTarget();
  return (
    <View style={styles.inputSurface}>
      <BlurView {...blurProps(target)} intensity={glass.blur} tint="dark" pointerEvents="none" style={styles.surfaceBlur} />
      <View pointerEvents="none" style={styles.inputTint} />
      <View style={styles.inputContent}>
        {label ? <Text style={styles.inputLabel}>{label}</Text> : null}
        <TextInput value={value} onChangeText={onChangeText} placeholder={placeholder} placeholderTextColor="rgba(255,255,255,0.56)" autoCapitalize="sentences" selectionColor="#FFFFFF" underlineColorAndroid="transparent" style={styles.input} />
      </View>
    </View>
  );
}

export function SectionTitle({ children }: { children: React.ReactNode }) {
  return <Text style={styles.sectionTitle}>{children}</Text>;
}

const styles = StyleSheet.create({
  card: { position: "relative", overflow: "hidden", borderRadius: radii.card, borderWidth: 1, borderColor: glass.edge, backgroundColor: glass.surface, ...shadows },
  cardBlur: { ...StyleSheet.absoluteFillObject, borderRadius: radii.card },
  cardTint: { ...StyleSheet.absoluteFillObject, backgroundColor: glass.highlight },
  cardContent: { padding: 18 },
  actionSurface: { height: 66, borderRadius: 19, overflow: "hidden", borderWidth: 1, borderColor: glass.edge, backgroundColor: glass.surface, ...shadows },
  buttonSurface: { minHeight: 58, borderRadius: radii.button, overflow: "hidden", borderWidth: 1, borderColor: glass.edge, backgroundColor: glass.surface, ...shadows },
  surfaceBlur: { ...StyleSheet.absoluteFillObject },
  actionTint: { ...StyleSheet.absoluteFillObject, backgroundColor: glass.highlight },
  action: { height: 64, borderRadius: 18, flexDirection: "row", alignItems: "center", paddingHorizontal: 11, overflow: "hidden" },
  actionPrimary: { backgroundColor: "rgba(250,252,255,0.97)", borderWidth: 1, borderColor: "rgba(255,255,255,0.82)" },
  actionGlass: { backgroundColor: "transparent" },
  actionIcon: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
  actionIconPrimary: { backgroundColor: "rgba(255,255,255,0.72)", borderWidth: 1.5, borderColor: "#111111" },
  actionIconGlass: { backgroundColor: "rgba(255,255,255,0.10)", borderWidth: 1, borderColor: "rgba(255,255,255,0.18)" },
  actionCopy: { flex: 1, paddingHorizontal: 12 },
  actionTitle: { color: "rgba(255,255,255,0.96)", fontSize: 16, fontWeight: "700", letterSpacing: -0.2 },
  actionTitlePrimary: { color: colors.black },
  actionSubtitle: { color: colors.muted, fontSize: 12, marginTop: 3 },
  actionSubtitlePrimary: { color: "rgba(16,21,28,0.58)" },
  buttonTint: { ...StyleSheet.absoluteFillObject, backgroundColor: glass.highlight },
  button: { minHeight: 56, borderRadius: 20, flexDirection: "row", alignItems: "center", paddingHorizontal: 16 },
  buttonGlass: { backgroundColor: "transparent" },
  primary: { backgroundColor: colors.white, borderColor: "rgba(255,255,255,0.82)" },
  disabled: { opacity: 0.5 },
  buttonIcon: { marginRight: 10 },
  primaryIcon: { opacity: 0.9 },
  buttonLabel: { color: colors.white, fontSize: 15, fontWeight: "750", flex: 1 },
  primaryLabel: { color: colors.black },
  inputSurface: { minHeight: 72, borderRadius: 18, overflow: "hidden", borderWidth: 1, borderColor: glass.edge, backgroundColor: glass.surface },
  inputTint: { ...StyleSheet.absoluteFillObject, backgroundColor: glass.highlight },
  inputContent: { paddingHorizontal: 14, paddingVertical: 9 },
  inputLabel: { color: "rgba(255,255,255,0.88)", fontSize: 12, marginBottom: 3, fontWeight: "600" },
  input: { color: colors.white, fontSize: 16, paddingVertical: 3, paddingHorizontal: 0, minHeight: 26, backgroundColor: "transparent", borderWidth: 0 },
  sectionTitle: { color: colors.white, fontSize: 20, fontWeight: "800", marginBottom: 3, letterSpacing: -0.3 },
  iconButtonOuter: { width: 44, height: 44, borderRadius: 22, overflow: "hidden", ...shadows },
  iconButton: { width: 44, height: 44, overflow: "hidden", borderWidth: 1, borderColor: glass.edge, backgroundColor: glass.surface, alignItems: "center", justifyContent: "center" },
  iconTint: { ...StyleSheet.absoluteFillObject, backgroundColor: glass.highlight },
  pressed: { transform: [{ scale: 0.985 }], opacity: 0.88 },
});

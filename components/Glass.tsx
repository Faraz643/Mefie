import { BlurView } from "expo-blur";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  ViewStyle,
} from "react-native";
import { colors, radii, shadows } from "../lib/theme";

/**
 * One glass recipe used everywhere in the app.
 * Keep the blur itself separate from the translucent surface so Android does
 * not turn the entire card into a dark/opaque slab.
 */
export function GlassCard({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: ViewStyle;
}) {
  return (
    <View style={[styles.card, style]}>
      <BlurView intensity={32} tint="light" style={StyleSheet.absoluteFillObject} />
      <View pointerEvents="none" style={styles.cardSheen} />
      <View style={styles.cardContent}>{children}</View>
    </View>
  );
}

export function GlassButton({
  label,
  onPress,
  primary = false,
  icon,
  disabled = false,
}: {
  label: string;
  onPress?: () => void;
  primary?: boolean;
  icon?: React.ReactNode;
  disabled?: boolean;
}) {
  return (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      focusable={false}
      android_ripple={{ color: "transparent" }}
      style={({ pressed }) => [
        styles.button,
        primary ? styles.primary : styles.buttonGlass,
        disabled && styles.disabled,
        pressed && styles.pressed,
      ]}
    >
      {icon ? (
        <View style={[styles.buttonIcon, primary && styles.primaryIcon]}>{icon}</View>
      ) : null}
      <Text style={[styles.buttonLabel, primary && styles.primaryLabel]}>
        {label}
      </Text>
      <MaterialCommunityIcons
        name="chevron-right"
        size={20}
        color={primary ? colors.black : colors.white}
      />
    </Pressable>
  );
}

export function GlassAction({
  label,
  subtitle,
  onPress,
  primary = false,
  icon,
}: {
  label: string;
  subtitle?: string;
  onPress?: () => void;
  primary?: boolean;
  icon: React.ReactNode;
}) {
  const content = (
    <Pressable
      onPress={onPress}
      focusable={false}
      android_ripple={{ color: "transparent" }}
      style={({ pressed }) => [
        styles.action,
        primary ? styles.actionPrimary : styles.actionGlass,
        pressed && styles.pressed,
      ]}
    >
      <View
        style={[
          styles.actionIcon,
          primary ? styles.actionIconPrimary : styles.actionIconGlass,
        ]}
      >
        {icon}
      </View>
      <View style={styles.actionCopy}>
        <Text style={[styles.actionTitle, primary && styles.actionTitlePrimary]}>
          {label}
        </Text>
        {subtitle ? (
          <Text
            style={[
              styles.actionSubtitle,
              primary && styles.actionSubtitlePrimary,
            ]}
          >
            {subtitle}
          </Text>
        ) : null}
      </View>
      <MaterialCommunityIcons
        name="chevron-right"
        size={19}
        color={primary ? colors.black : colors.white}
      />
    </Pressable>
  );

  if (primary) return content;

  return (
    <View style={styles.actionSurface}>
      <BlurView intensity={32} tint="light" style={StyleSheet.absoluteFillObject} />
      <View pointerEvents="none" style={styles.actionSheen} />
      {content}
    </View>
  );
}

export function IconButton({
  children,
  onPress,
  accessibilityLabel,
}: {
  children: React.ReactNode;
  onPress?: () => void;
  accessibilityLabel: string;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      focusable={false}
      android_ripple={{ color: "transparent" }}
      style={({ pressed }) => [styles.iconButtonOuter, pressed && styles.pressed]}
    >
      <View style={styles.iconButton}>
        <BlurView intensity={28} tint="light" style={StyleSheet.absoluteFillObject} />
        <View pointerEvents="none" style={styles.iconSheen} />
        {children}
      </View>
    </Pressable>
  );
}

export function GlassInput({
  label,
  value,
  onChangeText,
  placeholder,
}: {
  label?: string;
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <View style={styles.inputWrap}>
      {label ? <Text style={styles.inputLabel}>{label}</Text> : null}
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="rgba(255,255,255,0.44)"
        autoCapitalize="sentences"
        selectionColor="#FFFFFF"
        underlineColorAndroid="transparent"
        style={styles.input}
      />
    </View>
  );
}

export function SectionTitle({ children }: { children: React.ReactNode }) {
  return <Text style={styles.sectionTitle}>{children}</Text>;
}

const styles = StyleSheet.create({
  card: {
    position: "relative",
    overflow: "hidden",
    borderRadius: radii.card,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.28)",
    backgroundColor: "rgba(255,255,255,0.08)",
    ...shadows,
  },
  cardSheen: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(255,255,255,0.13)",
  },
  cardContent: {
    padding: 18,
  },
  actionSurface: {
    height: 66,
    borderRadius: 19,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.30)",
    backgroundColor: "rgba(255,255,255,0.08)",
    ...shadows,
  },
  actionSheen: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(255,255,255,0.12)",
  },
  action: {
    height: 64,
    borderRadius: 18,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 11,
    overflow: "hidden",
  },
  actionPrimary: {
    backgroundColor: "rgba(250,252,255,0.97)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.82)",
  },
  actionGlass: {
    backgroundColor: "transparent",
    borderWidth: 0,
  },
  actionIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  actionIconPrimary: {
    backgroundColor: "rgba(255,255,255,0.72)",
    borderWidth: 1.5,
    borderColor: "#111111",
  },
  actionIconGlass: {
    backgroundColor: "rgba(255,255,255,0.18)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.24)",
  },
  actionCopy: {
    flex: 1,
    paddingHorizontal: 12,
  },
  actionTitle: {
    color: "rgba(255,255,255,0.96)",
    fontSize: 16,
    fontWeight: "700",
    letterSpacing: -0.2,
  },
  actionTitlePrimary: { color: colors.black },
  actionSubtitle: {
    color: colors.muted,
    fontSize: 12,
    marginTop: 3,
  },
  actionSubtitlePrimary: { color: "rgba(16,21,28,0.58)" },
  button: {
    minHeight: 58,
    borderRadius: radii.button,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    borderWidth: 1,
  },
  buttonGlass: {
    backgroundColor: "rgba(255,255,255,0.12)",
    borderColor: "rgba(255,255,255,0.26)",
  },
  primary: {
    backgroundColor: colors.white,
    borderColor: "rgba(255,255,255,0.82)",
  },
  disabled: { opacity: 0.5 },
  buttonIcon: { marginRight: 10 },
  primaryIcon: { opacity: 0.9 },
  buttonLabel: {
    color: colors.white,
    fontSize: 15,
    fontWeight: "750",
    flex: 1,
  },
  primaryLabel: { color: colors.black },
  inputWrap: {
    paddingVertical: 4,
  },
  inputLabel: {
    color: colors.muted,
    fontSize: 12,
    marginBottom: 5,
    fontWeight: "600",
  },
  input: {
    color: colors.white,
    fontSize: 16,
    paddingVertical: 4,
    paddingHorizontal: 0,
    minHeight: 26,
    backgroundColor: "transparent",
    borderWidth: 0,
  },
  sectionTitle: {
    color: colors.white,
    fontSize: 20,
    fontWeight: "800",
    marginBottom: 12,
    letterSpacing: -0.3,
  },
  iconButtonOuter: {
    width: 44,
    height: 44,
    borderRadius: 22,
    overflow: "hidden",
    ...shadows,
  },
  iconButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.36)",
    backgroundColor: "rgba(255,255,255,0.08)",
    alignItems: "center",
    justifyContent: "center",
  },
  iconSheen: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(255,255,255,0.10)",
  },
  pressed: { transform: [{ scale: 0.985 }], opacity: 0.88 },
});

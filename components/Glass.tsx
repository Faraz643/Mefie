import { BlurView } from 'expo-blur';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Pressable, StyleSheet, Text, TextInput, View, ViewStyle } from 'react-native';
import { colors, radii, shadows } from '../lib/theme';

export function GlassCard({ children, style }: { children: React.ReactNode; style?: ViewStyle }) {
  return <BlurView intensity={42} tint="dark" style={[styles.card, style]}>{children}</BlurView>;
}

export function GlassButton({ label, onPress, primary = false, icon, disabled = false }: { label: string; onPress?: () => void; primary?: boolean; icon?: React.ReactNode; disabled?: boolean }) {
  return <Pressable disabled={disabled} onPress={onPress} focusable={false} android_ripple={{ color: 'transparent' }} style={({ pressed }) => [styles.button, disabled && styles.disabled, pressed && styles.pressed]}>
    <Text style={styles.buttonLabel}>{label}</Text>
    <MaterialCommunityIcons name="chevron-right" size={21} color={colors.black} />
  </Pressable>;
}

export function GlassAction({ label, subtitle, onPress, primary = false, icon }: { label: string; subtitle?: string; onPress?: () => void; primary?: boolean; icon: React.ReactNode }) {
  const content = (
    <Pressable
      onPress={onPress}
      focusable={false}
      android_ripple={{ color: 'transparent' }}
      style={({ pressed }) => [styles.action, primary ? styles.actionPrimary : styles.actionGlass, pressed && styles.pressed]}
    >
      <View style={[styles.actionIcon, primary ? styles.actionIconPrimary : styles.actionIconGlass]}>{icon}</View>
      <View style={styles.actionCopy}>
        <Text style={[styles.actionTitle, primary && styles.actionTitlePrimary]}>{label}</Text>
        {subtitle ? <Text style={[styles.actionSubtitle, primary && styles.actionSubtitlePrimary]}>{subtitle}</Text> : null}
      </View>
      <MaterialCommunityIcons name="chevron-right" size={22} color={primary ? colors.black : colors.white} />
    </Pressable>
  );

  if (primary) return content;

  return <BlurView intensity={78} tint="dark" style={styles.actionBlur}>{content}</BlurView>;
}

export function IconButton({ children, onPress, accessibilityLabel }: { children: React.ReactNode; onPress?: () => void; accessibilityLabel: string }) {
  return <Pressable accessibilityRole="button" accessibilityLabel={accessibilityLabel} onPress={onPress} focusable={false} android_ripple={{ color: 'transparent' }} style={({ pressed }) => [styles.iconButtonOuter, pressed && styles.pressed]}>
    <BlurView intensity={34} tint="light" style={styles.iconButton}>{children}</BlurView>
  </Pressable>;
}

export function GlassInput({ label, value, onChangeText, placeholder }: { label?: string; value: string; onChangeText: (v: string) => void; placeholder?: string }) {
  return <View style={styles.inputWrap}>{label ? <Text style={styles.inputLabel}>{label}</Text> : null}<TextInput value={value} onChangeText={onChangeText} placeholder={placeholder} placeholderTextColor="rgba(255,255,255,0.44)" autoCapitalize="sentences" selectionColor="#FFFFFF" style={styles.input} /></View>;
}

export function SectionTitle({ children }: { children: React.ReactNode }) { return <Text style={styles.sectionTitle}>{children}</Text>; }

const styles = StyleSheet.create({
  card: { overflow: 'hidden', backgroundColor: colors.glass, borderColor: 'rgba(255,255,255,0.18)', borderWidth: 1, borderRadius: radii.card, padding: 18, ...shadows },
  actionBlur: { height: 80, borderRadius: 20, overflow: 'hidden', ...shadows },
  action: { height: 80, borderRadius: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, overflow: 'hidden' },
  actionPrimary: { backgroundColor: 'rgba(250,252,255,0.97)', borderColor: 'rgba(255,255,255,0.82)' },
  actionGlass: { backgroundColor: 'rgba(220,225,232,0.20)', borderColor: 'rgba(255,255,255,0.38)' },
  actionIcon: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  actionIconPrimary: { backgroundColor: 'rgba(255,255,255,0.72)', borderWidth: 1.5, borderColor: '#111111' },
  actionIconGlass: { backgroundColor: 'rgba(255,255,255,0.22)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.16)' },
  actionCopy: { flex: 1, paddingHorizontal: 14, backgroundColor: 'transparent', borderWidth: 0 },
  actionTitle: { color: 'rgba(255,255,255,0.96)', fontSize: 17, fontWeight: '700', letterSpacing: -0.2, backgroundColor: 'transparent' },
  actionTitlePrimary: { color: colors.black },
  actionSubtitle: { color: colors.muted, fontSize: 13, marginTop: 4, backgroundColor: 'transparent' },
  actionSubtitlePrimary: { color: 'rgba(16,21,28,0.58)' },
  button: { height: 66, borderRadius: radii.pill, backgroundColor: 'rgba(250,252,255,0.98)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.86)', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 22, ...shadows },
  disabled: { opacity: 0.5 },
  buttonLabel: { color: colors.black, fontSize: 16, fontWeight: '700', letterSpacing: -0.15, flex: 1, textAlign: 'center' },
  inputWrap: { backgroundColor: 'rgba(255,255,255,0.12)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.16)', borderRadius: 20, paddingHorizontal: 15, paddingVertical: 12 },
  inputLabel: { color: colors.muted, fontSize: 12, marginBottom: 5, fontWeight: '600' },
  input: { color: colors.white, fontSize: 16, paddingVertical: 4, minHeight: 26 },
  sectionTitle: { color: colors.white, fontSize: 20, fontWeight: '800', marginBottom: 12, letterSpacing: -0.3 },
  iconButtonOuter: { width: 44, height: 44, borderRadius: 22, overflow: 'hidden', ...shadows },
  iconButton: { width: 44, height: 44, borderRadius: 22, borderWidth: 1, borderColor: 'rgba(255,255,255,0.42)', backgroundColor: 'rgba(255,255,255,0.10)', alignItems: 'center', justifyContent: 'center' },
  pressed: { transform: [{ scale: 0.985 }], opacity: 0.88 },
});
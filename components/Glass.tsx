import { BlurView } from 'expo-blur';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Pressable, StyleSheet, Text, TextInput, View, ViewStyle } from 'react-native';
import { colors, radii, shadows } from '../lib/theme';

export function GlassCard({ children, style }: { children: React.ReactNode; style?: ViewStyle }) {
  return <BlurView intensity={42} tint="dark" style={[styles.card, style]}>{children}</BlurView>;
}

export function GlassButton({ label, onPress, primary = false, icon, disabled = false }: { label: string; onPress?: () => void; primary?: boolean; icon?: React.ReactNode; disabled?: boolean }) {
  return <Pressable disabled={disabled} onPress={onPress} android_ripple={{ color: 'transparent' }} style={({ pressed }) => [styles.button, primary && styles.primary, disabled && styles.disabled, pressed && styles.pressed]}>
    {icon ? <View style={[styles.buttonIcon, primary && styles.primaryIcon]}>{icon}</View> : null}
    <Text style={[styles.buttonLabel, primary && styles.primaryLabel]}>{label}</Text>
    <MaterialCommunityIcons name="chevron-right" size={20} color={primary ? colors.black : colors.white} />
  </Pressable>;
}

export function GlassAction({ label, subtitle, onPress, primary = false, icon }: { label: string; subtitle?: string; onPress?: () => void; primary?: boolean; icon: React.ReactNode }) {
  return <Pressable
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
    <MaterialCommunityIcons name="chevron-right" size={26} color={primary ? colors.black : colors.white} />
  </Pressable>;
}

export function IconButton({ children, onPress, accessibilityLabel }: { children: React.ReactNode; onPress?: () => void; accessibilityLabel: string }) {
  return <Pressable accessibilityRole="button" accessibilityLabel={accessibilityLabel} onPress={onPress} focusable={false} android_ripple={{ color: 'transparent' }} style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}>{children}</Pressable>;
}

export function GlassInput({ label, value, onChangeText, placeholder }: { label?: string; value: string; onChangeText: (v: string) => void; placeholder?: string }) {
  return <View style={styles.inputWrap}>{label ? <Text style={styles.inputLabel}>{label}</Text> : null}<TextInput value={value} onChangeText={onChangeText} placeholder={placeholder} placeholderTextColor="rgba(255,255,255,0.44)" autoCapitalize="sentences" selectionColor="#FFFFFF" style={styles.input} /></View>;
}

export function SectionTitle({ children }: { children: React.ReactNode }) { return <Text style={styles.sectionTitle}>{children}</Text>; }

const styles = StyleSheet.create({
  card: { overflow: 'hidden', backgroundColor: colors.glass, borderRadius: radii.card, padding: 18, ...shadows },
  action: { height: 96, borderRadius: 22, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, overflow: 'hidden', ...shadows },
  actionPrimary: { backgroundColor: 'rgba(250,252,255,0.97)' },
  actionGlass: { backgroundColor: 'rgba(35,43,52,0.52)' },
  actionIcon: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center' },
  actionIconPrimary: { backgroundColor: 'rgba(255,255,255,0.72)' },
  actionIconGlass: { backgroundColor: 'rgba(255,255,255,0.13)' },
  actionCopy: { flex: 1, paddingHorizontal: 15, backgroundColor: 'transparent', borderWidth: 0 },
  actionTitle: { color: colors.white, fontSize: 19, fontWeight: '800', letterSpacing: -0.3, backgroundColor: 'transparent' },
  actionTitlePrimary: { color: colors.black },
  actionSubtitle: { color: colors.muted, fontSize: 13, marginTop: 4, backgroundColor: 'transparent' },
  actionSubtitlePrimary: { color: 'rgba(16,21,28,0.58)' },
  button: { minHeight: 58, borderRadius: radii.button, backgroundColor: colors.glassLight, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16 },
  primary: { backgroundColor: colors.white },
  disabled: { opacity: 0.5 },
  buttonIcon: { marginRight: 10 },
  primaryIcon: { opacity: 0.9 },
  buttonLabel: { color: colors.white, fontSize: 15, fontWeight: '750', flex: 1 },
  primaryLabel: { color: colors.black },
  inputWrap: { backgroundColor: 'rgba(255,255,255,0.12)', borderRadius: 20, paddingHorizontal: 15, paddingVertical: 12 },
  inputLabel: { color: colors.muted, fontSize: 12, marginBottom: 5, fontWeight: '600' },
  input: { color: colors.white, fontSize: 16, paddingVertical: 4, minHeight: 26 },
  sectionTitle: { color: colors.white, fontSize: 20, fontWeight: '800', marginBottom: 12, letterSpacing: -0.3 },
  iconButton: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.12)', alignItems: 'center', justifyContent: 'center', ...shadows },
  pressed: { transform: [{ scale: 0.985 }], opacity: 0.88 },
});

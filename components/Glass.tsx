import { BlurView } from 'expo-blur';
import { Pressable, StyleSheet, Text, TextInput, View, ViewStyle } from 'react-native';
import { colors, radii, shadows } from '../lib/theme';

export function GlassCard({ children, style }: { children: React.ReactNode; style?: ViewStyle }) {
  return <BlurView intensity={42} tint="dark" style={[styles.card, style]}>{children}</BlurView>;
}

export function GlassButton({ label, onPress, primary = false, icon }: { label: string; onPress?: () => void; primary?: boolean; icon?: string }) {
  return <Pressable onPress={onPress} style={({ pressed }) => [styles.button, primary && styles.primary, pressed && styles.pressed]}>
    {icon ? <View style={[styles.buttonIcon, primary && styles.primaryIcon]}><Text style={[styles.iconText, primary && styles.primaryIconText]}>{icon}</Text></View> : null}
    <Text style={[styles.buttonLabel, primary && styles.primaryLabel]}>{label}</Text>
    <Text style={[styles.buttonArrow, primary && styles.primaryLabel]}>›</Text>
  </Pressable>;
}

export function IconButton({ label, onPress }: { label: string; onPress?: () => void }) {
  return <Pressable onPress={onPress} style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}><Text style={styles.iconButtonText}>{label}</Text></Pressable>;
}

export function GlassInput({ label, value, onChangeText, placeholder }: { label?: string; value: string; onChangeText: (v: string) => void; placeholder?: string }) {
  return <View style={styles.inputWrap}>{label ? <Text style={styles.inputLabel}>{label}</Text> : null}<TextInput value={value} onChangeText={onChangeText} placeholder={placeholder} placeholderTextColor="rgba(255,255,255,0.44)" autoCapitalize="sentences" selectionColor="#FFFFFF" style={styles.input} /></View>;
}

export function SectionTitle({ children }: { children: React.ReactNode }) { return <Text style={styles.sectionTitle}>{children}</Text>; }

const styles = StyleSheet.create({
  card: { overflow: 'hidden', backgroundColor: colors.glass, borderColor: colors.line, borderWidth: 1, borderRadius: radii.card, padding: 18, ...shadows },
  button: { minHeight: 62, borderRadius: radii.button, backgroundColor: colors.glassLight, borderWidth: 1, borderColor: colors.line, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 14, flexDirection: 'row', ...shadows },
  primary: { backgroundColor: 'rgba(255,255,255,0.94)', borderColor: 'rgba(255,255,255,0.98)' },
  pressed: { transform: [{ scale: 0.985 }], opacity: 0.88 },
  buttonIcon: { width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(255,255,255,0.15)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  primaryIcon: { backgroundColor: 'rgba(12,17,23,0.08)', borderColor: 'rgba(12,17,23,0.12)' },
  iconText: { color: colors.white, fontSize: 20, fontWeight: '500' },
  primaryIconText: { color: colors.black },
  buttonLabel: { color: colors.white, fontSize: 16, fontWeight: '700', flex: 1 },
  primaryLabel: { color: colors.black },
  buttonArrow: { color: colors.white, fontSize: 25, fontWeight: '300', marginLeft: 8 },
  iconButton: { width: 44, height: 44, borderRadius: 22, borderWidth: 1, borderColor: colors.lineStrong, backgroundColor: 'rgba(255,255,255,0.12)', alignItems: 'center', justifyContent: 'center', ...shadows },
  iconButtonText: { color: colors.white, fontSize: 18, fontWeight: '600' },
  inputWrap: { backgroundColor: 'rgba(255,255,255,0.12)', borderWidth: 1, borderColor: colors.line, borderRadius: 20, paddingHorizontal: 15, paddingVertical: 12 },
  inputLabel: { color: colors.muted, fontSize: 12, marginBottom: 5, fontWeight: '600' },
  input: { color: colors.white, fontSize: 16, paddingVertical: 4, minHeight: 26 },
  sectionTitle: { color: colors.white, fontSize: 19, fontWeight: '800', marginBottom: 12, letterSpacing: -0.3 },
});

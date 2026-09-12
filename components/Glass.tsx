import { BlurView } from 'expo-blur';
import { Pressable, StyleSheet, Text, TextInput, View, ViewStyle } from 'react-native';
import { colors, shadows } from '../lib/theme';

export function GlassCard({ children, style }: { children: React.ReactNode; style?: ViewStyle }) {
  return <BlurView intensity={28} tint="dark" style={[styles.card, style]}>{children}</BlurView>;
}
export function GlassButton({ label, onPress, primary = false, icon }: { label: string; onPress?: () => void; primary?: boolean; icon?: string }) {
  return <Pressable onPress={onPress} style={({ pressed }) => [styles.button, primary && styles.primary, pressed && { transform: [{ scale: 0.985 }], opacity: 0.9 }]}><Text style={[styles.buttonLabel, primary && styles.primaryLabel]}>{icon ? `${icon}  ` : ''}{label}</Text></Pressable>;
}
export function IconButton({ label, onPress }: { label: string; onPress?: () => void }) { return <Pressable onPress={onPress} style={styles.iconButton}><Text style={{ color: colors.white, fontSize: 18 }}>{label}</Text></Pressable>; }
export function GlassInput({ label, value, onChangeText, placeholder }: { label?: string; value: string; onChangeText: (v: string) => void; placeholder?: string }) {
  return <View style={styles.inputWrap}>{label ? <Text style={styles.inputLabel}>{label}</Text> : null}<TextInput value={value} onChangeText={onChangeText} placeholder={placeholder} placeholderTextColor="rgba(255,255,255,0.45)" autoCapitalize="sentences" style={styles.input} /></View>;
}
export function SectionTitle({ children }: { children: React.ReactNode }) { return <Text style={styles.sectionTitle}>{children}</Text>; }
const styles = StyleSheet.create({
  card: { overflow: 'hidden', backgroundColor: colors.glass, borderColor: colors.line, borderWidth: 1, borderRadius: 24, padding: 18, ...shadows },
  button: { minHeight: 58, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.10)', borderWidth: 1, borderColor: colors.line, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 20 },
  primary: { backgroundColor: colors.white, borderColor: colors.white },
  buttonLabel: { color: colors.white, fontSize: 16, fontWeight: '700' },
  primaryLabel: { color: '#0C1117' },
  iconButton: { width: 42, height: 42, borderRadius: 21, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.glass, alignItems: 'center', justifyContent: 'center' },
  inputWrap: { backgroundColor: 'rgba(255,255,255,0.10)', borderWidth: 1, borderColor: colors.line, borderRadius: 18, padding: 14 },
  inputLabel: { color: colors.muted, fontSize: 12, marginBottom: 6, fontWeight: '600' },
  input: { color: colors.white, fontSize: 16, paddingVertical: 4 },
  sectionTitle: { color: colors.white, fontSize: 18, fontWeight: '800', marginBottom: 12 },
});

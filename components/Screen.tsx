import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import React from 'react';
import { ImageBackground, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, radii, shadows } from '../lib/theme';
import { IconButton } from './Glass';

const hero = 'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=1400&q=80';

export function Screen({ children, backgroundImage = hero }: { children: React.ReactNode; backgroundImage?: string }) {
  const insets = useSafeAreaInsets();
  return <ImageBackground source={{ uri: backgroundImage }} style={styles.bg} blurRadius={7}>
    <LinearGradient colors={['rgba(18,25,34,0.16)', 'rgba(8,12,17,0.90)']} style={StyleSheet.absoluteFill} />
    <ScrollView contentContainerStyle={[styles.content, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 118 }]} showsVerticalScrollIndicator={false}>{children}</ScrollView>
  </ImageBackground>;
}

export function BackButton() { const router = useRouter(); return <IconButton label="‹" onPress={() => router.back()} />; }

export function BottomNav({ active = 'home' }: { active?: 'home'|'events'|'you' }) {
  const router = useRouter();
  const items: Array<['home'|'events'|'you', string, string]> = [['home','⌂','Home'],['events','▧','Events'],['you','◯','You']];
  return <View style={styles.nav}>{items.map(([key, icon, label]) => <Pressable key={key} onPress={() => router.replace(key === 'home' ? '/' : key === 'you' ? '/you' : '/events')} style={styles.navItem}>
    <View style={[styles.navIconWrap, active === key && styles.navIconActive]}><Text style={[styles.navIcon, active === key && styles.navIconSelected]}>{icon}</Text></View>
    <Text style={[styles.navText, active === key && styles.navTextSelected]}>{label}</Text>
  </Pressable>)}</View>;
}

export function Header({ title, right }: { title: string; right?: React.ReactNode }) {
  return <View style={styles.header}><View style={styles.brandRow}><View style={styles.brandMark}><View style={styles.markA}/><View style={styles.markB}/></View><Text style={styles.brand}>{title}</Text></View>{right}</View>;
}

const styles = StyleSheet.create({
  bg: { flex: 1, backgroundColor: '#0A0F15' },
  content: { paddingHorizontal: 20, gap: 16 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  brandMark: { width: 34, height: 34, borderRadius: 10, backgroundColor: 'rgba(10,15,21,0.72)', borderWidth: 1, borderColor: colors.lineStrong, alignItems: 'center', justifyContent: 'center', ...shadows },
  markA: { position: 'absolute', width: 17, height: 20, borderRadius: 6, borderWidth: 2, borderColor: '#FFF', left: 7, top: 7 },
  markB: { position: 'absolute', width: 17, height: 20, borderRadius: 6, borderWidth: 2, borderColor: '#C9D7F5', left: 11, top: 7 },
  brand: { color: colors.white, fontSize: 20, fontWeight: '800', letterSpacing: -0.5 },
  nav: { position: 'absolute', left: 14, right: 14, bottom: 12, minHeight: 76, borderRadius: radii.card, backgroundColor: 'rgba(20,27,35,0.78)', borderWidth: 1, borderColor: colors.line, flexDirection: 'row', justifyContent: 'space-around', paddingTop: 8, paddingBottom: 5, ...shadows },
  navItem: { alignItems: 'center', minWidth: 76 },
  navIconWrap: { width: 38, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  navIconActive: { backgroundColor: 'rgba(255,255,255,0.12)' },
  navIcon: { color: 'rgba(255,255,255,0.48)', fontSize: 21 },
  navIconSelected: { color: colors.white },
  navText: { color: 'rgba(255,255,255,0.48)', fontSize: 11, marginTop: 2, fontWeight: '600' },
  navTextSelected: { color: colors.white },
});

import { LinearGradient } from 'expo-linear-gradient';
import { CalendarDays, ChevronLeft, Home, Images, UserRound } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import React from 'react';
import { ImageBackground, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, radii, shadows } from '../lib/theme';
import { IconButton } from './Glass';

const hero = 'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=1400&q=80';

export function Screen({ children, backgroundImage = hero }: { children: React.ReactNode; backgroundImage?: string }) {
  const insets = useSafeAreaInsets();
  return <ImageBackground source={{ uri: backgroundImage }} style={styles.bg} blurRadius={9}>
    <LinearGradient colors={['rgba(17,23,31,0.12)', 'rgba(7,11,16,0.88)']} style={StyleSheet.absoluteFill} />
    <ScrollView contentContainerStyle={[styles.content, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 118 }]} showsVerticalScrollIndicator={false}>{children}</ScrollView>
  </ImageBackground>;
}

export function BackButton() { const router = useRouter(); return <IconButton accessibilityLabel="Go back" onPress={() => router.back()}><ChevronLeft size={22} strokeWidth={2.1} color={colors.white} /></IconButton>; }

export function BottomNav({ active = 'home' }: { active?: 'home'|'events'|'you' }) {
  const router = useRouter();
  const items = [
    { key: 'home' as const, label: 'Home', Icon: Home, path: '/' },
    { key: 'events' as const, label: 'Events', Icon: Images, path: '/events' },
    { key: 'you' as const, label: 'You', Icon: UserRound, path: '/you' },
  ];
  return <View style={styles.nav}>{items.map(({ key, label, Icon, path }) => <Pressable key={key} onPress={() => router.replace(path)} style={styles.navItem}>
    <View style={[styles.navIconWrap, active === key && styles.navIconActive]}><Icon size={23} strokeWidth={active === key ? 2.3 : 1.8} color={active === key ? colors.white : 'rgba(255,255,255,0.55)'} /></View>
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
  brandMark: { width: 34, height: 34, borderRadius: 10, backgroundColor: 'rgba(10,15,21,0.70)', borderWidth: 1, borderColor: colors.lineStrong, alignItems: 'center', justifyContent: 'center', ...shadows },
  markA: { position: 'absolute', width: 17, height: 20, borderRadius: 6, borderWidth: 2, borderColor: '#FFF', left: 7, top: 7 },
  markB: { position: 'absolute', width: 17, height: 20, borderRadius: 6, borderWidth: 2, borderColor: '#C9D7F5', left: 11, top: 7 },
  brand: { color: colors.white, fontSize: 21, fontWeight: '800', letterSpacing: -0.6 },
  nav: { position: 'absolute', left: 14, right: 14, bottom: 12, minHeight: 76, borderRadius: 27, backgroundColor: 'rgba(22,29,38,0.60)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.22)', flexDirection: 'row', justifyContent: 'space-around', paddingTop: 8, paddingBottom: 5, ...shadows },
  navItem: { alignItems: 'center', minWidth: 76 },
  navIconWrap: { width: 42, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  navIconActive: { backgroundColor: 'rgba(255,255,255,0.13)' },
  navText: { color: 'rgba(255,255,255,0.50)', fontSize: 11, marginTop: 2, fontWeight: '650' },
  navTextSelected: { color: colors.white },
});

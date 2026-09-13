import { LinearGradient } from 'expo-linear-gradient';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useRouter } from 'expo-router';
import React from 'react';
import { ImageBackground, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, radii, shadows } from '../lib/theme';
import { IconButton } from './Glass';

const hero = 'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=1400&q=80';

export function Screen({ children, backgroundImage = hero }: { children: React.ReactNode; backgroundImage?: string }) {
  const insets = useSafeAreaInsets();
  return <View style={styles.bg}>
    <ImageBackground source={{ uri: backgroundImage }} style={styles.clearBackground} resizeMode="cover" />
    <ImageBackground source={{ uri: backgroundImage }} style={styles.blurBackground} blurRadius={14} resizeMode="cover" />
    <LinearGradient colors={['rgba(7,11,16,0.02)', 'rgba(7,11,16,0.10)', 'rgba(7,11,16,0.58)']} locations={[0, 0.48, 1]} style={StyleSheet.absoluteFill} />
    <LinearGradient colors={['rgba(17,23,31,0.02)', 'rgba(7,11,16,0.82)']} style={styles.lowerShade} />
    <ScrollView contentContainerStyle={[styles.content, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 128 }]} showsVerticalScrollIndicator={false}>{children}</ScrollView>
  </View>;
}

export function BackButton() { const router = useRouter(); return <IconButton accessibilityLabel="Go back" onPress={() => router.back()}><MaterialCommunityIcons name="chevron-left" size={25} color={colors.white} /></IconButton>; }

export function BottomNav({ active = 'home' }: { active?: 'home'|'events'|'you' }) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const items = [
    { key: 'home' as const, label: 'Home', icon: 'home-outline' as const, path: '/' },
    { key: 'events' as const, label: 'Events', icon: 'image-multiple-outline' as const, path: '/events' },
    { key: 'you' as const, label: 'You', icon: 'account-outline' as const, path: '/you' },
  ];
  return <View style={[styles.nav, { bottom: Math.max(insets.bottom + 10, 18) }]}>{items.map(({ key, label, icon, path }) => <Pressable key={key} onPress={() => router.replace(path)} style={styles.navItem}>
    <View style={[styles.navIconWrap, active === key && styles.navIconActive]}><MaterialCommunityIcons name={icon} size={24} color={active === key ? colors.white : 'rgba(255,255,255,0.55)'} /></View>
    <Text style={[styles.navText, active === key && styles.navTextSelected]}>{label}</Text>
  </Pressable>)}</View>;
}

export function Header({ title, right }: { title: string; right?: React.ReactNode }) {
  return <View style={styles.header}><View style={styles.brandRow}><View style={styles.brandMark}><View style={styles.markA}/><View style={styles.markB}/></View><Text style={styles.brand}>{title}</Text></View>{right}</View>;
}

const styles = StyleSheet.create({
  bg: { flex: 1, backgroundColor: '#0A0F15' },
  clearBackground: { ...StyleSheet.absoluteFillObject },
  blurBackground: { position: 'absolute', left: 0, right: 0, top: '42%', bottom: 0 },
  lowerShade: { position: 'absolute', left: 0, right: 0, top: '38%', bottom: 0 },
  content: { paddingHorizontal: 20, gap: 16 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  brandMark: { width: 34, height: 34, borderRadius: 10, backgroundColor: 'rgba(10,15,21,0.70)', alignItems: 'center', justifyContent: 'center', ...shadows },
  markA: { position: 'absolute', width: 17, height: 20, borderRadius: 6, borderWidth: 2, borderColor: '#FFF', left: 7, top: 7 },
  markB: { position: 'absolute', width: 17, height: 20, borderRadius: 6, borderWidth: 2, borderColor: '#C9D7F5', left: 11, top: 7 },
  brand: { color: colors.white, fontSize: 21, fontWeight: '800', letterSpacing: -0.6 },
  nav: { position: 'absolute', left: 14, right: 14, minHeight: 76, borderRadius: 27, backgroundColor: 'rgba(22,29,38,0.72)', flexDirection: 'row', justifyContent: 'space-around', paddingTop: 8, paddingBottom: 5, ...shadows },
  navItem: { alignItems: 'center', minWidth: 76 },
  navIconWrap: { width: 42, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  navIconActive: { backgroundColor: 'rgba(255,255,255,0.13)' },
  navText: { color: 'rgba(255,255,255,0.50)', fontSize: 11, marginTop: 2, fontWeight: '650' },
  navTextSelected: { color: colors.white },
});

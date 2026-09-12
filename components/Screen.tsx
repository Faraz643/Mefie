import { LinearGradient } from 'expo-linear-gradient';
import { Stack, useRouter } from 'expo-router';
import React from 'react';
import { ImageBackground, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '../lib/theme';
import { IconButton } from './Glass';

const hero = 'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=1400&q=80';
export function Screen({ children, backgroundImage = hero }: { children: React.ReactNode; backgroundImage?: string }) {
  const insets = useSafeAreaInsets();
  return <ImageBackground source={{ uri: backgroundImage }} style={styles.bg} blurRadius={0}>
    <LinearGradient colors={['rgba(9,12,16,0.22)', 'rgba(8,12,17,0.82)']} style={StyleSheet.absoluteFill} />
    <ScrollView contentContainerStyle={[styles.content, { paddingTop: insets.top + 18, paddingBottom: insets.bottom + 36 }]} showsVerticalScrollIndicator={false}>{children}</ScrollView>
  </ImageBackground>;
}
export function BackButton() { const router = useRouter(); return <IconButton label="‹" onPress={() => router.back()} />; }
export function BottomNav({ active = 'home' }: { active?: 'home'|'events'|'you' }) {
  const router = useRouter();
  return <View style={styles.nav}>{[['home','⌂'],['events','▧'],['you','◉']].map(([key, icon]) => <Pressable key={key} onPress={() => router.replace(key === 'home' ? '/' : key === 'you' ? '/you' : '/events')} style={styles.navItem}><Text style={[styles.navIcon, active === key && { color: colors.white }]}>{icon}</Text><Text style={[styles.navText, active === key && { color: colors.white }]}>{key[0].toUpperCase()+key.slice(1)}</Text></Pressable>)}</View>;
}
export function Header({ title, right }: { title: string; right?: React.ReactNode }) { return <View style={styles.header}><Text style={styles.brand}>{title}</Text>{right}</View>; }
const styles = StyleSheet.create({ bg: { flex: 1, backgroundColor: '#0A0F15' }, content: { paddingHorizontal: 20, gap: 18 }, header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, brand: { color: colors.white, fontSize: 20, fontWeight: '800', letterSpacing: -0.4 }, nav: { position: 'absolute', left: 20, right: 20, bottom: 14, minHeight: 68, borderRadius: 24, backgroundColor: 'rgba(16,22,29,0.78)', borderWidth: 1, borderColor: colors.line, flexDirection: 'row', justifyContent: 'space-around', paddingTop: 9 }, navItem: { alignItems: 'center', minWidth: 72 }, navIcon: { color: 'rgba(255,255,255,0.52)', fontSize: 20 }, navText: { color: 'rgba(255,255,255,0.52)', fontSize: 11, marginTop: 2, fontWeight: '600' }
});

import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useRouter } from 'expo-router';
import React from 'react';
import { ImageBackground, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, shadows } from '../lib/theme';
import { useApp } from '../lib/app-context';
import { IconButton } from './Glass';

const hero = require('../assets/hero-background.jpg');

export function Screen({ children, backgroundImage }: { children: React.ReactNode; backgroundImage?: any }) {
  const insets = useSafeAreaInsets();
  const { backgroundImage: userBackground } = useApp();
  const activeBackground = backgroundImage ?? userBackground ?? hero;
  const source = typeof activeBackground === 'string' ? { uri: activeBackground } : activeBackground;

  return (
    <View style={styles.bg}>
      <ImageBackground source={source} style={StyleSheet.absoluteFill} resizeMode="cover" />
      <LinearGradient colors={['rgba(5,9,14,0.02)', 'rgba(5,9,14,0.00)', 'rgba(5,9,14,0.10)', 'rgba(5,9,14,0.78)']} locations={[0, 0.34, 0.62, 1]} style={StyleSheet.absoluteFill} />
      <ScrollView contentContainerStyle={[styles.content, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 138 }]} showsVerticalScrollIndicator={false}>
        {children}
      </ScrollView>
    </View>
  );
}

export function BackButton() {
  const router = useRouter();
  return <IconButton accessibilityLabel="Go back" onPress={() => router.back()}><MaterialCommunityIcons name="chevron-left" size={25} color={colors.white} /></IconButton>;
}

export function BottomNav({ active = 'home' }: { active?: 'home' | 'events' | 'you' }) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const items = [
    { key: 'home' as const, label: 'Home', icon: 'home' as const, path: '/' },
    { key: 'events' as const, label: 'Events', icon: 'image-outline' as const, path: '/events' },
    { key: 'you' as const, label: 'You', icon: 'account-outline' as const, path: '/you' },
  ];
  return (
    <BlurView intensity={72} tint="dark" style={[styles.nav, { bottom: Math.max(insets.bottom + 7, 12) }]}>
      <View style={styles.navInner}>
        {items.map(({ key, label, icon, path }) => <Pressable key={key} onPress={() => router.replace(path)} style={styles.navItem}>
          <MaterialCommunityIcons name={icon} size={29} color={active === key ? colors.white : 'rgba(255,255,255,0.62)'} />
          <Text style={[styles.navText, active === key && styles.navTextSelected]}>{label}</Text>
        </Pressable>)}
      </View>
    </BlurView>
  );
}

export function Header({ title, right }: { title: string; right?: React.ReactNode }) {
  return <View style={styles.header}><View style={styles.brandRow}><View style={styles.brandMark}><View style={styles.markA}/><View style={styles.markB}/></View><Text style={styles.brand}>{title}</Text></View>{right}</View>;
}

const styles = StyleSheet.create({
  bg: { flex: 1, backgroundColor: '#0A0F15' },
  content: { paddingHorizontal: 20, gap: 16 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  brandMark: { width: 34, height: 34, borderRadius: 10, backgroundColor: 'rgba(10,15,21,0.70)', alignItems: 'center', justifyContent: 'center', ...shadows },
  markA: { position: 'absolute', width: 17, height: 20, borderRadius: 6, borderWidth: 2, borderColor: '#FFF', left: 7, top: 7 },
  markB: { position: 'absolute', width: 17, height: 20, borderRadius: 6, borderWidth: 2, borderColor: '#C9D7F5', left: 11, top: 7 },
  brand: { color: colors.white, fontSize: 21, fontWeight: '800', letterSpacing: -0.6 },
  nav: { position: 'absolute', left: 0, right: 0, minHeight: 92, borderRadius: 28, borderWidth: 1, borderColor: 'rgba(255,255,255,0.10)', overflow: 'hidden', ...shadows },
  navInner: { flex: 1, minHeight: 92, backgroundColor: 'rgba(31,39,48,0.76)', flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center', paddingTop: 5, paddingBottom: 7 },
  navItem: { alignItems: 'center', justifyContent: 'center', minWidth: 82, gap: 3 },
  navText: { color: 'rgba(255,255,255,0.52)', fontSize: 13, lineHeight: 16, fontWeight: '500' },
  navTextSelected: { color: colors.white, fontWeight: '600' },
});

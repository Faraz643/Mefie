import { useFocusEffect } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import React, { useCallback } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { BottomNav, Header, Screen } from '../components/Screen';
import { GlassButton, GlassCard, SectionTitle, IconButton } from '../components/Glass';
import { useApp } from '../lib/app-context';
import { colors } from '../lib/theme';

export default function HomeScreen() {
  const router = useRouter();
  const { displayName, events, refreshEvents } = useApp();
  useFocusEffect(useCallback(() => { refreshEvents(); }, [refreshEvents]));
  return <View style={{ flex: 1, backgroundColor: '#0A0F15' }}><Screen>
    <Header title="Mefie" right={<IconButton label="◉" onPress={() => router.push('/you')} />} />
    <View style={styles.hero}><Text style={styles.kicker}>Good morning, {displayName} 👋</Text><Text style={styles.title}>Same moments.{`\n`}Everyone's view.</Text></View>
    <GlassCard><View style={styles.actionHead}><View><Text style={styles.actionTitle}>Create an event</Text><Text style={styles.actionSub}>Get a link. Start sharing.</Text></View><Text style={styles.chev}>›</Text></View><GlassButton primary label="Create event →" onPress={() => router.push('/create-event')} /></GlassCard>
    <GlassCard><View style={styles.actionHead}><View><Text style={styles.actionTitle}>Join an event</Text><Text style={styles.actionSub}>Scan or enter a link.</Text></View><Text style={styles.chev}>›</Text></View><GlassButton label="Join event →" onPress={() => router.push('/join-event')} /></GlassCard>
    <View style={{ marginTop: 6 }}><SectionTitle>Your events</SectionTitle>{events.length === 0 ? <GlassCard><Text style={styles.emptyTitle}>Your moments start here.</Text><Text style={styles.emptySub}>Create an event and invite your people.</Text></GlassCard> : <View style={styles.grid}>{events.slice(0, 4).map(e => <GlassCard key={e.id} style={{ width: '48%', padding: 0, overflow: 'hidden' }}><View style={{ height: 118, backgroundColor: '#26313F' }}>{e.cover ? <Image source={{ uri: e.cover }} style={{ width: '100%', height: '100%' }} /> : null}</View><View style={{ padding: 12 }}><Text style={styles.eventName} numberOfLines={1}>{e.name}</Text><Text style={styles.eventMeta}>{e.people || '—'} people · {e.photos || '—'} photos</Text></View></GlassCard>)}</View>}</View>
    <View style={{ height: 70 }} />
  </Screen><BottomNav active="home" /></View>;
}
const styles=StyleSheet.create({hero:{paddingTop:38,paddingBottom:8},kicker:{color:colors.muted,fontSize:15,fontWeight:'600'},title:{color:colors.white,fontSize:38,lineHeight:42,fontWeight:'800',letterSpacing:-1.1,marginTop:7},actionHead:{flexDirection:'row',justifyContent:'space-between',alignItems:'center',marginBottom:16},actionTitle:{color:colors.white,fontSize:18,fontWeight:'800'},actionSub:{color:colors.muted,fontSize:13,marginTop:3},chev:{color:colors.white,fontSize:27},emptyTitle:{color:colors.white,fontSize:16,fontWeight:'700'},emptySub:{color:colors.muted,fontSize:13,marginTop:5},grid:{flexDirection:'row',flexWrap:'wrap',gap:12},eventName:{color:colors.white,fontSize:15,fontWeight:'800'},eventMeta:{color:colors.muted,fontSize:11,marginTop:4}});

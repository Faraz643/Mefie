import { useFocusEffect } from '@react-navigation/native';
import { Link2, Plus } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import React, { useCallback } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { BottomNav, Header, Screen } from '../components/Screen';
import { GlassAction, GlassCard, SectionTitle, IconButton } from '../components/Glass';
import { useApp } from '../lib/app-context';
import { colors, radii, shadows } from '../lib/theme';

export default function HomeScreen() {
  const router = useRouter();
  const { displayName, events, refreshEvents } = useApp();
  useFocusEffect(useCallback(() => { refreshEvents(); }, [refreshEvents]));
  return <View style={styles.root}><Screen>
    <Header title="Mefie" right={<IconButton accessibilityLabel="Open profile" onPress={() => router.push('/you')}><Text style={styles.avatarText}>{displayName.slice(0,1).toUpperCase()}</Text></IconButton>} />
    <View style={styles.hero}>
      <Text style={styles.kicker}>Good morning, {displayName} 👋</Text>
      <Text style={styles.title}>Same moments.{`\n`}Everyone's view.</Text>
    </View>
    <GlassAction primary label="Create an event" subtitle="Get a link. Start sharing." onPress={() => router.push('/create-event')} icon={<Plus size={30} strokeWidth={1.8} color={colors.black} />} />
    <GlassAction label="Join an event" subtitle="Scan or enter a link." onPress={() => router.push('/join-event')} icon={<Link2 size={28} strokeWidth={2} color={colors.white} />} />
    <View style={styles.eventsSection}><View style={styles.sectionRow}><SectionTitle>Your events</SectionTitle>{events.length > 0 ? <Pressable onPress={() => router.push('/events')}><Text style={styles.seeAll}>See all <Text style={styles.seeArrow}>›</Text></Text></Pressable> : null}</View>{events.length === 0 ? <GlassCard><Text style={styles.emptyTitle}>Your moments start here.</Text><Text style={styles.emptySub}>Create an event and invite your people.</Text></GlassCard> : <View style={styles.grid}>{events.slice(0, 4).map(e => <Pressable key={e.id} onPress={() => router.push({ pathname:'/event/[id]', params:{id:e.id} })} style={styles.eventCard}><View style={styles.cover}>{e.cover ? <Image source={{ uri: e.cover }} style={styles.coverImage} /> : null}<View style={styles.eventInfo}><Text style={styles.eventName} numberOfLines={1}>{e.name}</Text><Text style={styles.eventMeta}>{e.people || '—'} people · {e.photos || '—'} photos</Text></View></View></Pressable>)}</View>}</View>
  </Screen><BottomNav active="home" /></View>;
}

const styles=StyleSheet.create({
  root:{flex:1,backgroundColor:'#0A0F15'},
  hero:{paddingTop:46,paddingBottom:8},
  kicker:{color:colors.muted,fontSize:15,fontWeight:'600'},
  title:{color:colors.white,fontSize:39,lineHeight:42,fontWeight:'800',letterSpacing:-1.25,marginTop:8},
  avatarText:{color:colors.white,fontSize:17,fontWeight:'700'},
  eventsSection:{marginTop:10},
  sectionRow:{flexDirection:'row',alignItems:'center',justifyContent:'space-between'},
  seeAll:{color:colors.white,fontSize:14,fontWeight:'600',marginBottom:12},
  seeArrow:{fontSize:23,fontWeight:'300'},
  grid:{flexDirection:'row',flexWrap:'wrap',gap:12},
  eventCard:{width:'48%',height:170,borderRadius:radii.card,overflow:'hidden',backgroundColor:'#26313F',...shadows},
  cover:{flex:1,position:'relative',justifyContent:'flex-end'},
  coverImage:{...StyleSheet.absoluteFillObject,width:'100%',height:'100%'},
  eventInfo:{paddingHorizontal:13,paddingTop:26,paddingBottom:13,backgroundColor:'rgba(14,20,27,0.45)',borderTopWidth:1,borderColor:'rgba(255,255,255,0.10)'},
  eventName:{color:colors.white,fontSize:16,fontWeight:'800',letterSpacing:-.2},
  eventMeta:{color:'rgba(255,255,255,0.72)',fontSize:11,marginTop:4},
  emptyTitle:{color:colors.white,fontSize:16,fontWeight:'700'},
  emptySub:{color:colors.muted,fontSize:13,marginTop:5},
});

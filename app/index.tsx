import { useFocusEffect } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import React, { useCallback } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { BottomNav, Header, Screen } from '../components/Screen';
import { GlassButton, GlassCard, SectionTitle, IconButton } from '../components/Glass';
import { useApp } from '../lib/app-context';
import { colors, radii, shadows } from '../lib/theme';

export default function HomeScreen() {
  const router = useRouter();
  const { displayName, events, refreshEvents } = useApp();
  useFocusEffect(useCallback(() => { refreshEvents(); }, [refreshEvents]));
  return <View style={styles.root}><Screen>
    <Header title="Mefie" right={<View style={styles.avatar}><Text style={styles.avatarText}>{displayName.slice(0,1).toUpperCase()}</Text></View>} />
    <View style={styles.hero}>
      <Text style={styles.kicker}>Good morning, {displayName} 👋</Text>
      <Text style={styles.title}>Same moments.{`\n`}Everyone's view.</Text>
    </View>
    <GlassCard style={styles.actionCard}>
      <View style={styles.actionRow}><View style={styles.actionIcon}><Text style={styles.plus}>＋</Text></View><View style={styles.actionCopy}><Text style={styles.actionTitle}>Create an event</Text><Text style={styles.actionSub}>Get a link. Start sharing.</Text></View><Text style={styles.chev}>›</Text></View>
      <GlassButton primary label="Create event" onPress={() => router.push('/create-event')} />
    </GlassCard>
    <GlassCard style={styles.actionCard}>
      <View style={styles.actionRow}><View style={styles.actionIcon}><Text style={styles.linkIcon}>⌁</Text></View><View style={styles.actionCopy}><Text style={styles.actionTitle}>Join an event</Text><Text style={styles.actionSub}>Scan or enter a link.</Text></View><Text style={styles.chev}>›</Text></View>
      <GlassButton label="Join event" onPress={() => router.push('/join-event')} />
    </GlassCard>
    <View style={styles.eventsSection}><SectionTitle>Your events</SectionTitle>{events.length === 0 ? <GlassCard><Text style={styles.emptyTitle}>Your moments start here.</Text><Text style={styles.emptySub}>Create an event and invite your people.</Text></GlassCard> : <View style={styles.grid}>{events.slice(0, 4).map(e => <Pressable key={e.id} onPress={() => router.push({ pathname:'/event/[id]', params:{id:e.id} })} style={styles.eventCard}><GlassCard style={styles.eventGlass}><View style={styles.cover}>{e.cover ? <Image source={{ uri: e.cover }} style={styles.coverImage} /> : null}</View><View style={styles.eventInfo}><Text style={styles.eventName} numberOfLines={1}>{e.name}</Text><Text style={styles.eventMeta}>{e.people || '—'} people · {e.photos || '—'} photos</Text></View></GlassCard></Pressable>)}</View>}</View>
  </Screen><BottomNav active="home" /></View>;
}

const styles=StyleSheet.create({
  root:{flex:1,backgroundColor:'#0A0F15'},
  hero:{paddingTop:38,paddingBottom:5},
  kicker:{color:colors.muted,fontSize:15,fontWeight:'600'},
  title:{color:colors.white,fontSize:38,lineHeight:42,fontWeight:'800',letterSpacing:-1.2,marginTop:8},
  avatar:{width:42,height:42,borderRadius:21,backgroundColor:'rgba(255,255,255,0.14)',borderWidth:1,borderColor:colors.lineStrong,alignItems:'center',justifyContent:'center',...shadows},
  avatarText:{color:colors.white,fontSize:17,fontWeight:'700'},
  actionCard:{padding:14},
  actionRow:{flexDirection:'row',alignItems:'center',marginBottom:13},
  actionIcon:{width:46,height:46,borderRadius:23,backgroundColor:'rgba(255,255,255,0.13)',borderWidth:1,borderColor:colors.line,alignItems:'center',justifyContent:'center'},
  plus:{color:colors.white,fontSize:28,fontWeight:'300',lineHeight:31},
  linkIcon:{color:colors.white,fontSize:27,fontWeight:'300',transform:[{rotate:'-25deg'}]},
  actionCopy:{flex:1,marginLeft:13},
  actionTitle:{color:colors.white,fontSize:18,fontWeight:'800'},
  actionSub:{color:colors.muted,fontSize:13,marginTop:3},
  chev:{color:colors.white,fontSize:28,fontWeight:'300',marginLeft:8},
  eventsSection:{marginTop:5},
  grid:{flexDirection:'row',flexWrap:'wrap',gap:12},
  eventCard:{width:'48%',borderRadius:radii.card,...shadows},
  eventGlass:{padding:0,borderRadius:radii.card},
  cover:{height:112,backgroundColor:'#26313F'},
  coverImage:{width:'100%',height:'100%'},
  eventInfo:{padding:12},
  eventName:{color:colors.white,fontSize:15,fontWeight:'800'},
  eventMeta:{color:colors.muted,fontSize:11,marginTop:4},
  emptyTitle:{color:colors.white,fontSize:16,fontWeight:'700'},
  emptySub:{color:colors.muted,fontSize:13,marginTop:5},
});

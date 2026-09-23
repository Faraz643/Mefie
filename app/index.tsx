import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect, useRouter } from 'expo-router';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import React, { useCallback } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { BottomNav, Header, Screen } from '../components/Screen';
import { GlassAction, GlassCard, SectionTitle, IconButton } from '../components/Glass';
import { useApp } from '../lib/app-context';
import { colors, radii, shadows, typography } from '../lib/theme';

export default function HomeScreen() {
  const router = useRouter();
  const { displayName, events, refreshEvents } = useApp();
  useFocusEffect(useCallback(() => { refreshEvents(); }, [refreshEvents]));
  return <View style={styles.root}><Screen>
    <Header title="Mefie" right={<IconButton accessibilityLabel="Open profile" onPress={() => router.push('/you')}><Text style={styles.avatarText}>{displayName.slice(0,1).toUpperCase()}</Text></IconButton>} />
    <View style={styles.hero}>
      <Text style={styles.greeting}>Hey {displayName} 👋</Text>
      <Text style={styles.title}>Same moments.{`\n`}Everyone's view.</Text>
    </View>
    <GlassAction primary label="Create an event" onPress={() => router.push('/create-event')} icon={<MaterialCommunityIcons name="plus" size={30} color={colors.black} />} />
    <GlassAction label="Join an event" onPress={() => router.push('/join-event')} icon={<MaterialCommunityIcons name="link-variant" size={26} color={colors.white} />} />
    <View style={styles.eventsSection}><View style={styles.sectionRow}><SectionTitle>Your events</SectionTitle>{events.length > 0 ? <Pressable onPress={() => router.push('/events')}><Text style={styles.seeAll}>See all <Text style={styles.seeArrow}>›</Text></Text></Pressable> : null}</View>{events.length === 0 ? <GlassCard><Text style={styles.emptyTitle}>Your moments start here.</Text><Text style={styles.emptySub}>Create an event and invite your people.</Text></GlassCard> : <View style={styles.grid}>{events.slice(0, 4).map(e => <Pressable key={e.id} onPress={() => router.push({ pathname:'/event/[id]', params:{id:e.id} })} style={styles.eventCard}><View style={styles.cover}>{e.cover ? <Image source={{ uri: e.cover }} style={styles.coverImage} /> : null}<LinearGradient colors={["rgba(10,15,21,0.00)", "rgba(10,15,21,0.88)"]} locations={[0, 1]} style={styles.eventInfo}><View style={styles.eventInfoTint} /><View style={styles.eventInfoContent}><Text style={styles.eventName} numberOfLines={1}>{e.name}</Text><Text style={styles.eventMeta}>{e.people || '—'} people · {e.photos || '—'} photos</Text></View></LinearGradient></View></Pressable>)}</View>}</View>
  </Screen><BottomNav active="home" /></View>;
}

const styles=StyleSheet.create({
  root:{flex:1,backgroundColor:'#0A0F15'},
  hero:{paddingTop:30,paddingBottom:8},
  greeting:{color:colors.white,fontSize:34,lineHeight:40,fontFamily:typography.medium,letterSpacing:-0.8},
  title:{color:'rgba(255,255,255,0.88)',fontSize:21,lineHeight:27,fontFamily:typography.regular,letterSpacing:-0.2,marginTop:2},
  avatarText:{color:colors.white,fontSize:17,fontFamily:typography.bold},
  eventsSection:{marginTop:10},
  sectionRow:{flexDirection:'row',alignItems:'center',justifyContent:'space-between'},
  seeAll:{color:'rgba(220,225,232,0.82)',fontSize:14,fontFamily:typography.semibold,marginBottom:12},
  seeArrow:{fontSize:23,fontFamily:typography.regular,color:'rgba(220,225,232,0.82)'},
  grid:{flexDirection:'row',flexWrap:'wrap',justifyContent:'space-between',rowGap:12,marginHorizontal:-8},
  eventCard:{width:'48%',height:170,borderRadius:radii.card,overflow:'hidden',backgroundColor:'#26313F',...shadows},
  cover:{flex:1,position:'relative',justifyContent:'flex-end'},
  coverImage:{...StyleSheet.absoluteFillObject,width:'100%',height:'100%'},
  eventInfo:{position:'absolute',left:0,right:0,bottom:0,height:78,overflow:'hidden',borderTopWidth:1,borderTopColor:'rgba(255,255,255,0.12)'},
  eventInfoTint:{...StyleSheet.absoluteFillObject,backgroundColor:'rgba(55,76,96,0.28)'},
  eventInfoContent:{flex:1,justifyContent:'flex-end',paddingHorizontal:13,paddingBottom:13,paddingTop:10},
  eventName:{color:colors.white,fontSize:16,fontFamily:typography.extraBold,letterSpacing:-.2},
  eventMeta:{fontFamily:typography.regular,color:'rgba(255,255,255,0.72)',fontSize:11,marginTop:4},
  emptyTitle:{color:colors.white,fontSize:16,fontFamily:typography.bold},
  emptySub:{fontFamily:typography.regular,color:colors.muted,fontSize:13,marginTop:5},
});

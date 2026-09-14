import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { BottomNav, Screen } from '../components/Screen';
import { GlassButton, GlassCard } from '../components/Glass';
import { useApp } from '../lib/app-context';
import { colors, radii, shadows } from '../lib/theme';

const fallback='https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=800&q=80';
export default function Events(){
  const router=useRouter(); const {events,refreshEvents}=useApp(); useFocusEffect(useCallback(()=>{refreshEvents()},[refreshEvents]));
  return <View style={styles.root}><Screen><View style={styles.heading}><Text style={styles.title}>Your events</Text><Text style={styles.sub}>Every group memory, in one place.</Text></View>{events.length===0?<GlassCard><Text style={styles.h}>No events yet.</Text><Text style={styles.m}>Create one or join a friend's event.</Text><View style={{marginTop:16}}><GlassButton primary label="Create event" icon={<MaterialCommunityIcons name="chevron-right" size={20} color={colors.black}/>} onPress={()=>router.push('/create-event')}/></View></GlassCard>:<View style={styles.list}>{events.map(e=><Pressable key={e.id} onPress={()=>router.push({pathname:'/event/[id]',params:{id:e.id}})} style={styles.card}><Image source={{uri:e.cover||fallback}} style={styles.image}/><View style={styles.overlay}><View style={styles.icon}><MaterialCommunityIcons name="image-multiple-outline" size={17} color="#fff"/></View><Text style={styles.h}>{e.name}</Text><Text style={styles.m}>{e.people||'—'} people · {e.photos||'—'} photos</Text></View></Pressable>)}</View>}</Screen><BottomNav active="events"/></View>
}
const styles=StyleSheet.create({root:{flex:1,backgroundColor:'#0A0F15'},heading:{marginTop:28,marginBottom:2},title:{color:colors.white,fontSize:35,fontWeight:'800',letterSpacing:-1},sub:{color:colors.muted,fontSize:14,marginTop:5},list:{gap:14},card:{height:190,borderRadius:radii.card,overflow:'hidden',backgroundColor:'#26313F',...shadows},image:{...StyleSheet.absoluteFillObject,width:'100%',height:'100%'},overlay:{padding:15,paddingTop:48,backgroundColor:'rgba(9,14,20,.43)',position:'absolute',left:0,right:0,bottom:0},icon:{width:30,height:30,borderRadius:15,backgroundColor:'rgba(255,255,255,.15)',borderWidth:1,borderColor:'rgba(255,255,255,.2)',alignItems:'center',justifyContent:'center',marginBottom:9},h:{color:colors.white,fontSize:19,fontWeight:'800'},m:{color:'rgba(255,255,255,.70)',fontSize:13,marginTop:5}});

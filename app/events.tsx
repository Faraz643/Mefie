import { useFocusEffect } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import React, { useCallback } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { BottomNav, Screen } from '../components/Screen';
import { GlassCard, GlassButton } from '../components/Glass';
import { useApp } from '../lib/app-context';
import { colors } from '../lib/theme';

export default function Events(){
  const router=useRouter();
  const {events,refreshEvents}=useApp();
  useFocusEffect(useCallback(()=>{refreshEvents()},[refreshEvents]));
  return <View style={{flex:1,backgroundColor:'#0A0F15'}}><Screen><Text style={styles.title}>Your events</Text><Text style={styles.sub}>Every group memory, in one place.</Text>{events.length===0?<GlassCard><Text style={styles.h}>No events yet.</Text><Text style={styles.m}>Create one or join a friend's event.</Text><View style={{marginTop:16}}><GlassButton primary label="Create event →" onPress={()=>router.push('/create-event')}/></View></GlassCard>:events.map(e=><GlassCard key={e.id} style={{marginBottom:2}}><Text style={styles.h}>{e.name}</Text><Text style={styles.m}>{e.people} people · {e.photos} photos</Text><View style={{marginTop:15}}><GlassButton label="Open event →" onPress={()=>router.push({pathname:'/event/[id]',params:{id:e.id}})}/></View></GlassCard>)}</Screen><BottomNav active="events"/></View>
}
const styles=StyleSheet.create({title:{color:colors.white,fontSize:34,fontWeight:'800',marginTop:32},sub:{color:colors.muted,fontSize:14,marginTop:5,marginBottom:12},h:{color:colors.white,fontSize:18,fontWeight:'800'},m:{color:colors.muted,fontSize:13,marginTop:5}})

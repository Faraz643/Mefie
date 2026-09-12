import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { BackButton, Screen } from '../components/Screen';
import { GlassButton, GlassCard, GlassInput } from '../components/Glass';
import { colors } from '../lib/theme';
import { supabase } from '../lib/app-context';

export default function JoinEventScreen(){const router=useRouter();const [link,setLink]=useState('');const [name,setName]=useState('');const [resolved,setResolved]=useState(false);const [error,setError]=useState('');
const join=async()=>{setError('');const raw=link.trim();const invite=raw.split('/').pop()?.toUpperCase()||raw.toUpperCase();if(!invite){setError('Paste an event link or code.');return}let id=invite; if(supabase){const {data}=await supabase.from('events').select('id').eq('invite_code',invite).maybeSingle();if(!data){setError("We couldn't find that event.");return}id=data.id}setResolved(true); if(name.trim()) router.replace({pathname:'/event/[id]',params:{id,joinName:name.trim()}})};
return <Screen><BackButton/><View style={{marginTop:42}}><Text style={styles.title}>Join an event</Text><Text style={styles.sub}>Link or QR. That's it.</Text></View>{!resolved?<><GlassCard><GlassInput label="Event link or code" value={link} onChangeText={setLink} placeholder="Paste event link here"/></GlassCard>{error?<Text style={styles.error}>{error}</Text>:null}<GlassButton primary label="Join →" onPress={join}/><Text style={styles.or}>or</Text><GlassButton label="Scan QR Code" icon="▦"/></>:<><GlassCard><Text style={styles.q}>What's your name?</Text><GlassInput value={name} onChangeText={setName} placeholder="Aman"/></GlassCard><GlassButton primary label="Join event →" onPress={join}/></>}</Screen>}
const styles=StyleSheet.create({title:{color:colors.white,fontSize:32,fontWeight:'800'},sub:{color:colors.muted,fontSize:15,marginBottom:8},or:{color:colors.muted,textAlign:'center',marginVertical:2},q:{color:colors.white,fontSize:17,fontWeight:'800',marginBottom:14},error:{color:'#FFB4B4',fontSize:13,marginHorizontal:4}})

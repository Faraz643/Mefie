import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { BackButton, Screen } from '../components/Screen';
import { GlassButton, GlassCard, GlassInput } from '../components/Glass';
import { colors } from '../lib/theme';
import { ensureParticipant, supabase, useApp } from '../lib/app-context';

function code() { return Math.random().toString(36).slice(2, 8).toUpperCase(); }

export default function CreateEventScreen() {
  const router = useRouter();
  const { displayName } = useApp();
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const create = async () => {
    if (!name.trim()) { setError('Give your event a name.'); return; }
    if (!supabase) { setError('Cloud connection is not configured.'); return; }
    setLoading(true); setError('');
    try { let data: any = null; let insertError: any = null; for (let attempt=0; attempt<3; attempt+=1) { const result=await supabase.from('events').insert({name:name.trim(),invite_code:code()}).select('id,invite_code').single(); data=result.data; insertError=result.error; if(!insertError)break; } if(insertError||!data)throw insertError||new Error('Could not create the event.'); await ensureParticipant(data.id,displayName); router.replace({pathname:'/event-created',params:{id:data.id,name:name.trim(),invite:data.invite_code}}); }
    catch(e:any){setError(e?.message||'Could not create the event.');} finally{setLoading(false)}
  };
  return <Screen><BackButton/><View style={styles.heading}><View style={styles.step}><Text style={styles.stepText}>01</Text></View><Text style={styles.title}>Create an event</Text><Text style={styles.sub}>Just a name. That's it.</Text></View><GlassCard style={styles.formCard}><GlassInput label="Event name" value={name} onChangeText={setName} placeholder="Ladakh Trip 2025" /><Text style={styles.hint}>You can invite everyone after it's created.</Text></GlassCard>{error?<Text style={styles.error}>{error}</Text>:null}<GlassButton primary label={loading?'Creating…':'Create event'} icon={<MaterialCommunityIcons name="chevron-right" size={20} color={colors.black}/>} onPress={create}/></Screen>;
}
const styles=StyleSheet.create({heading:{marginTop:34,paddingBottom:3},step:{width:34,height:34,borderRadius:17,backgroundColor:'rgba(255,255,255,0.12)',borderWidth:1,borderColor:'rgba(255,255,255,0.22)',alignItems:'center',justifyContent:'center',marginBottom:18},stepText:{color:colors.muted,fontSize:11,fontWeight:'800'},title:{color:colors.white,fontSize:34,fontWeight:'800',letterSpacing:-1},sub:{color:colors.muted,fontSize:15,marginTop:7},formCard:{padding:14},hint:{color:colors.faint,fontSize:12,marginTop:12,marginHorizontal:2},error:{color:colors.danger,fontSize:13,marginHorizontal:4}});

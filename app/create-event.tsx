import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { BackButton, Screen } from '../components/Screen';
import { GlassButton, GlassCard, GlassInput } from '../components/Glass';
import { colors } from '../lib/theme';
import { supabase } from '../lib/app-context';

function code() { return Math.random().toString(36).slice(2, 8).toUpperCase(); }
export default function CreateEventScreen() {
  const router = useRouter(); const [name,setName]=useState(''); const [loading,setLoading]=useState(false); const [error,setError]=useState('');
  const create = async () => {
    if (!name.trim()) { setError('Give your event a name.'); return; }
    setLoading(true); setError('');
    const invite = code(); let id = `local-${Date.now()}`;
    if (supabase) { const { data, error: insertError } = await supabase.from('events').insert({ name: name.trim(), invite_code: invite }).select('id').single(); if (insertError) { setError(insertError.message); setLoading(false); return; } id = data.id; }
    router.replace({ pathname:'/event-created', params:{ id, name:name.trim(), invite } }); setLoading(false);
  };
  return <Screen><BackButton/><View style={{marginTop:42}}><Text style={styles.title}>Create an event</Text><Text style={styles.sub}>Just a name. That's it.</Text></View><GlassCard><GlassInput label="Event name" value={name} onChangeText={setName} placeholder="Ladakh Trip 2025" /></GlassCard>{error ? <Text style={styles.error}>{error}</Text>:null}<GlassButton primary label={loading?'Creating…':'Create event →'} onPress={create}/></Screen>;
}
const styles=StyleSheet.create({title:{color:colors.white,fontSize:32,fontWeight:'800',letterSpacing:-.8},sub:{color:colors.muted,fontSize:15,marginTop:6,marginBottom:6},error:{color:'#FFB4B4',fontSize:13,marginHorizontal:4}});

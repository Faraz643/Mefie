import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { StyleSheet, Text } from 'react-native';
import { GlassButton, GlassCard, GlassInput } from '../../components/Glass';
import { Screen } from '../../components/Screen';
import { colors } from '../../lib/theme';
import { ensureParticipant, supabase } from '../../lib/app-context';

export default function InviteRoute() {
  const router = useRouter();
  const { code } = useLocalSearchParams<{ code: string }>();
  const [name, setName] = useState('');
  const [event, setEvent] = useState<any>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    const load = async () => {
      if (!supabase) return;
      const { data } = await supabase.from('events').select('id,name').eq('invite_code', String(code || '').toUpperCase()).eq('status', 'active').maybeSingle();
      setEvent(data);
      if (!data) setError("This event link isn't valid or the event has ended.");
    };
    load();
  }, [code]);

  const join = async () => {
    if (!name.trim() || !event) { setError('Enter your name to join.'); return; }
    try {
      await ensureParticipant(event.id, name);
      router.replace({ pathname: '/event/[id]', params: { id: event.id } });
    } catch (e: any) { setError(e?.message || 'Could not join this event.'); }
  };

  return <Screen><Text style={styles.kicker}>YOU'RE INVITED</Text><Text style={styles.title}>{event?.name || 'Mefie event'}</Text><Text style={styles.sub}>Everyone's photos go into one shared album.</Text>{event ? <GlassCard><GlassInput label="Your name" value={name} onChangeText={setName} placeholder="Aman"/></GlassCard> : null}{error ? <Text style={styles.error}>{error}</Text> : null}{event ? <GlassButton primary label="Join event" onPress={join}/> : <GlassButton label="Back to Mefie" onPress={() => router.replace('/')}/>}</Screen>;
}
const styles=StyleSheet.create({kicker:{color:colors.muted,fontSize:12,fontWeight:'800',marginTop:50},title:{color:colors.white,fontSize:34,fontWeight:'800',marginTop:8},sub:{color:colors.muted,fontSize:15,lineHeight:22,marginTop:8},error:{color:'#FFB4B4',fontSize:13,marginBottom:12}});

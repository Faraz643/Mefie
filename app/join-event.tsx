import { CameraView, useCameraPermissions } from 'expo-camera';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { BackButton, Screen } from '../components/Screen';
import { GlassButton, GlassCard, GlassInput } from '../components/Glass';
import { colors } from '../lib/theme';
import { ensureParticipant, supabase } from '../lib/app-context';

function inviteFromValue(value: string) {
  const raw = value.trim().replace(/\/$/, '');
  const match = raw.match(/\/e\/([^/?#]+)/i);
  return (match?.[1] || raw).toUpperCase();
}

export default function JoinEventScreen() {
  const router = useRouter();
  const [link, setLink] = useState('');
  const [name, setName] = useState('');
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState('');
  const [perm, request] = useCameraPermissions();

  const join = async (value = link) => {
    setError('');
    const invite = inviteFromValue(value);
    if (!invite) { setError('Paste an event link or code.'); return; }
    if (!name.trim()) { setError('Enter your name first.'); return; }
    if (!supabase) { setError('Cloud connection is not configured.'); return; }
    const { data, error: lookupError } = await supabase.from('events').select('id,name,invite_code').eq('invite_code', invite).eq('status', 'active').maybeSingle();
    if (lookupError) { setError(lookupError.message); return; }
    if (!data) { setError("We couldn't find that event."); return; }
    try {
      await ensureParticipant(data.id, name);
      router.replace({ pathname: '/event/[id]', params: { id: data.id } });
    } catch (e: any) { setError(e?.message || 'Could not join the event.'); }
  };

  const startScan = async () => {
    if (!perm?.granted) { const result = await request(); if (!result.granted) return; }
    setScanning(true); setError('');
  };

  if (scanning) return <View style={styles.scanner}><CameraView style={StyleSheet.absoluteFill} facing="back" barcodeScannerSettings={{ barcodeTypes: ['qr'] }} onBarcodeScanned={({ data }) => { setScanning(false); setLink(data); join(data); }} /><View style={styles.scanOverlay}><Text style={styles.scanTitle}>Scan Mefie QR</Text><View style={styles.scanBox}/><Pressable style={styles.close} onPress={() => setScanning(false)}><Text style={styles.closeText}>Close</Text></Pressable></View></View>;

  return <Screen><BackButton/><View style={{marginTop:42}}><Text style={styles.title}>Join an event</Text><Text style={styles.sub}>Link, code, or QR. That's it.</Text></View><GlassCard><GlassInput label="Your name" value={name} onChangeText={setName} placeholder="Aman"/><View style={{height:14}}/><GlassInput label="Event link or code" value={link} onChangeText={setLink} placeholder="Paste event link here"/></GlassCard>{error?<Text style={styles.error}>{error}</Text>:null}<GlassButton primary label="Join event →" onPress={() => join()}/><Text style={styles.or}>or</Text><GlassButton label="Scan QR Code" icon="▦" onPress={startScan}/></Screen>;
}
const styles=StyleSheet.create({title:{color:colors.white,fontSize:32,fontWeight:'800'},sub:{color:colors.muted,fontSize:15,marginBottom:8},or:{color:colors.muted,textAlign:'center',marginVertical:2},error:{color:'#FFB4B4',fontSize:13,marginHorizontal:4},scanner:{flex:1,backgroundColor:'#000'},scanOverlay:{...StyleSheet.absoluteFillObject,alignItems:'center',paddingTop:80},scanTitle:{color:'#fff',fontSize:20,fontWeight:'800'},scanBox:{width:260,height:260,borderWidth:3,borderColor:'#fff',borderRadius:24,marginTop:60},close:{marginTop:30,backgroundColor:'#fff',paddingHorizontal:24,paddingVertical:13,borderRadius:20},closeText:{color:'#111',fontWeight:'800'}});

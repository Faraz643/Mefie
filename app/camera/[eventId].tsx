import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Haptics from 'expo-haptics';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { ensureParticipant, getParticipantId, supabase, useApp } from '../../lib/app-context';
import { colors } from '../../lib/theme';

export default function CameraScreen(){
  const router=useRouter();
  const {eventId}=useLocalSearchParams<{eventId:string}>();
  const {displayName}=useApp();
  const [perm,request]=useCameraPermissions();
  const [facing,setFacing]=useState<'front'|'back'>('back');
  const [flash,setFlash]=useState<'off'|'on'>('off');
  const [busy,setBusy]=useState(false);
  const [message,setMessage]=useState('');
  const ref=useRef<CameraView>(null);

  if(!perm)return <View style={styles.center}><ActivityIndicator color="#fff"/></View>;
  if(!perm.granted)return <View style={styles.center}><Text style={styles.title}>Camera access</Text><Text style={styles.sub}>Mefie needs the camera to capture and share moments.</Text><Pressable onPress={request} style={styles.cta}><Text style={styles.ctaText}>Allow camera</Text></Pressable></View>;

  const capture=async()=>{
    if(!ref.current||busy||!supabase)return;
    setBusy(true);setMessage('');
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try{
      const participantId=await ensureParticipant(String(eventId),displayName) || await getParticipantId(String(eventId));
      if(!participantId)throw new Error('Could not join this event.');
      const photo=await ref.current.takePictureAsync({quality:0.9,skipProcessing:false});
      if(!photo?.uri)throw new Error('Could not capture the photo.');
      const response=await fetch(photo.uri);
      const blob=await response.blob();
      const path=`${eventId}/${Date.now()}-${Math.random().toString(36).slice(2,10)}.jpg`;
      const {error:uploadError}=await supabase.storage.from('photos').upload(path,blob,{contentType:'image/jpeg',upsert:false});
      if(uploadError)throw uploadError;
      const {data:urlData}=supabase.storage.from('photos').getPublicUrl(path);
      const {error:insertError}=await supabase.from('photos').insert({event_id:eventId,participant_id:participantId,storage_path:path,original_filename:`mefie-${Date.now()}.jpg`,file_size:blob.size,width:photo.width||null,height:photo.height||null,public_url:urlData.publicUrl});
      if(insertError)throw insertError;
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setMessage('Shared ✓');
    }catch(e:any){setMessage(e?.message||'Upload failed.');}
    finally{setBusy(false);}
  };

  return <View style={styles.container}><CameraView ref={ref} style={StyleSheet.absoluteFill} facing={facing} flash={flash}/><View style={styles.scrimTop}/><View style={styles.top}><Pressable onPress={()=>router.back()}><Text style={styles.icon}>×</Text></Pressable><Pressable onPress={()=>setFlash(v=>v==='off'?'on':'off')}><Text style={styles.icon}>{flash==='on'?'⚡':'♧'}</Text></Pressable></View><View style={styles.bottom}>{message?<Text style={styles.message}>{message}</Text>:null}<View style={styles.row}><View style={styles.thumb}><Text style={{color:'#fff'}}>⌂</Text></View><Pressable onPress={capture} style={styles.shutter}>{busy?<ActivityIndicator color="#111"/>:<View style={styles.shutterInner}/>}</Pressable><Pressable onPress={()=>setFacing(v=>v==='back'?'front':'back')} style={styles.flip}><Text style={{color:'#fff',fontSize:22}}>↻</Text></Pressable></View><Text style={styles.mode}>PHOTO</Text></View></View>;
}
const styles=StyleSheet.create({container:{flex:1,backgroundColor:'#000'},scrimTop:{position:'absolute',top:0,left:0,right:0,height:140,backgroundColor:'rgba(0,0,0,.18)'},top:{position:'absolute',top:58,left:22,right:22,flexDirection:'row',justifyContent:'space-between'},icon:{color:'#fff',fontSize:30,fontWeight:'300'},bottom:{position:'absolute',bottom:30,left:0,right:0,alignItems:'center'},row:{width:'100%',flexDirection:'row',alignItems:'center',justifyContent:'space-around'},thumb:{width:48,height:48,borderRadius:12,backgroundColor:'rgba(255,255,255,.22)',alignItems:'center',justifyContent:'center'},shutter:{width:78,height:78,borderRadius:39,backgroundColor:'#fff',alignItems:'center',justifyContent:'center'},shutterInner:{width:68,height:68,borderRadius:34,borderWidth:2,borderColor:'#111'},flip:{width:48,height:48,borderRadius:24,backgroundColor:'rgba(0,0,0,.35)',alignItems:'center',justifyContent:'center'},mode:{color:'#fff',fontSize:12,marginTop:10,fontWeight:'800'},message:{color:'#fff',backgroundColor:'rgba(0,0,0,.55)',paddingHorizontal:16,paddingVertical:8,borderRadius:16,marginBottom:16},center:{flex:1,backgroundColor:'#0A0F15',alignItems:'center',justifyContent:'center',padding:28},title:{color:'#fff',fontSize:28,fontWeight:'800'},sub:{color:colors.muted,textAlign:'center',marginTop:8,lineHeight:20},cta:{marginTop:22,backgroundColor:'#fff',paddingHorizontal:24,paddingVertical:15,borderRadius:20},ctaText:{color:'#111',fontWeight:'800'}})

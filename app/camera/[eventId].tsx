import { CameraView, useCameraPermissions } from 'expo-camera';
import * as FileSystem from 'expo-file-system';
import { decode } from 'base64-arraybuffer';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { ensureParticipant, supabase, useApp } from '../../lib/app-context';
import { colors } from '../../lib/theme';

const PHOTO_BUCKET = 'photos';

export default function CameraScreen(){
  const router=useRouter();
  const {eventId}=useLocalSearchParams<{eventId:string}>();
  const {displayName}=useApp();
  const [perm,request]=useCameraPermissions();
  const [facing,setFacing]=useState<'front'|'back'>('back');
  const [flash,setFlash]=useState<'off'|'on'>('off');
  const [busy,setBusy]=useState(false);
  const [cameraReady,setCameraReady]=useState(false);
  const [message,setMessage]=useState('');
  const ref=useRef<CameraView>(null);

  if(!perm)return <View style={styles.center}><ActivityIndicator color="#fff"/></View>;
  if(!perm.granted)return <View style={styles.center}><Text style={styles.title}>Camera access</Text><Text style={styles.sub}>Mefie needs the camera to capture and share moments.</Text><Pressable onPress={request} style={styles.cta}><Text style={styles.ctaText}>Allow camera</Text></Pressable></View>;

  const upload=async(uri:string,width?:number,height?:number)=>{
    if(!supabase)throw new Error('Cloud connection is not configured.');
    if(!eventId)throw new Error('Event ID is missing.');

    setMessage('Joining event…');
    const participantId=await ensureParticipant(String(eventId),displayName);
    if(!participantId)throw new Error('Could not join this event.');

    setMessage('Reading photo…');
    let localUri=uri;
    let temporaryUri:string|undefined;
    try{
      if(uri.startsWith('content://')){
        temporaryUri=`${FileSystem.cacheDirectory}mefie-upload-${Date.now()}.jpg`;
        await FileSystem.copyAsync({from:uri,to:temporaryUri});
        localUri=temporaryUri;
      }

      const info=await FileSystem.getInfoAsync(localUri,{size:true});
      if(!info.exists)throw new Error('The photo file no longer exists on the device.');
      if(!info.size)throw new Error('The captured photo is empty.');

      const base64=await FileSystem.readAsStringAsync(localUri,{encoding:FileSystem.EncodingType.Base64});
      if(!base64)throw new Error('Could not read the captured photo.');
      const body=decode(base64);

      const path=`${eventId}/${Date.now()}-${Math.random().toString(36).slice(2,10)}.jpg`;
      setMessage('Uploading…');
      const {error:uploadError}=await supabase.storage.from(PHOTO_BUCKET).upload(path,body,{contentType:'image/jpeg',upsert:false,cacheControl:'3600'});
      if(uploadError)throw new Error(`Photo upload failed: ${uploadError.message}`);

      const {data:urlData}=supabase.storage.from(PHOTO_BUCKET).getPublicUrl(path);
      setMessage('Saving photo…');
      const {error:insertError}=await supabase.from('photos').insert({
        event_id:eventId,
        participant_id:participantId,
        storage_path:path,
        original_filename:`mefie-${Date.now()}.jpg`,
        file_size:body.byteLength,
        width:width||null,
        height:height||null,
        public_url:urlData.publicUrl,
      });

      if(insertError){
        await supabase.storage.from(PHOTO_BUCKET).remove([path]).catch(()=>undefined);
        throw new Error(`Photo record failed: ${insertError.message}`);
      }
    }catch(error:any){
      const message=error?.message||String(error)||'Photo upload failed.';
      if(message.includes('Network request failed')){
        throw new Error('Could not reach photo storage. Check the phone internet connection and try again.');
      }
      throw error;
    }finally{
      if(temporaryUri){
        await FileSystem.deleteAsync(temporaryUri,{idempotent:true}).catch(()=>undefined);
      }
    }
  };

  const capture=async()=>{
    if(!ref.current||busy||!cameraReady)return;
    setBusy(true);setMessage('');await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try{
      await new Promise(resolve=>setTimeout(resolve,250));
      if(!ref.current)throw new Error('Camera is not ready.');
      const photo=await ref.current.takePictureAsync({quality:0.8,skipProcessing:true});
      if(!photo?.uri)throw new Error('Could not capture the photo.');
      await upload(photo.uri,photo.width,photo.height);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setMessage('Shared ✓');
    }catch(e:any){
      setMessage(e?.message||'Could not capture the photo. Please try again.');
    }finally{setBusy(false)}
  };

  const pick=async()=>{
    if(busy)return;
    const permission=await ImagePicker.requestMediaLibraryPermissionsAsync();
    if(!permission.granted){setMessage('Photo library permission is required.');return;}
    const result=await ImagePicker.launchImageLibraryAsync({mediaTypes:['images'],quality:0.9,allowsMultipleSelection:false});
    if(result.canceled||!result.assets?.[0])return;
    setBusy(true);setMessage('');
    try{const image=result.assets[0];await upload(image.uri,image.width,image.height);setMessage('Shared ✓');await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)}catch(e:any){setMessage(e?.message||'Upload failed.')}finally{setBusy(false)}
  };

  return <View style={styles.container}><CameraView ref={ref} style={StyleSheet.absoluteFill} facing={facing} flash={flash} onCameraReady={()=>setCameraReady(true)} onMountError={(error)=>{setCameraReady(false);setMessage(error.message||'Could not start the camera.')}}/><View style={styles.scrimTop}/><View style={styles.top}><Pressable onPress={()=>router.back()}><Text style={styles.icon}>×</Text></Pressable><Pressable onPress={()=>setFlash(v=>v==='off'?'on':'off')}><Text style={styles.icon}>{flash==='on'?'⚡':'♧'}</Text></Pressable></View><View style={styles.bottom}>{message?<Text style={styles.message}>{message}</Text>:null}<View style={styles.row}><Pressable onPress={pick} style={styles.thumb}><Text style={{color:'#fff',fontSize:22}}>▧</Text></Pressable><Pressable onPress={capture} disabled={!cameraReady||busy} style={[styles.shutter,!cameraReady&&styles.shutterDisabled]}>{busy?<ActivityIndicator color="#111"/>:<View style={styles.shutterInner}/>}</Pressable><Pressable onPress={()=>{setCameraReady(false);setFacing(v=>v==='back'?'front':'back')}} style={styles.flip}><Text style={{color:'#fff',fontSize:22}}>↻</Text></Pressable></View><Text style={styles.mode}>{cameraReady?'PHOTO':'STARTING CAMERA…'}</Text></View></View>;
}
const styles=StyleSheet.create({container:{flex:1,backgroundColor:'#000'},scrimTop:{position:'absolute',top:0,left:0,right:0,height:140,backgroundColor:'rgba(0,0,0,.18)'},top:{position:'absolute',top:58,left:22,right:22,flexDirection:'row',justifyContent:'space-between'},icon:{color:'#fff',fontSize:30,fontWeight:'300'},bottom:{position:'absolute',bottom:30,left:0,right:0,alignItems:'center'},row:{width:'100%',flexDirection:'row',alignItems:'center',justifyContent:'space-around'},thumb:{width:48,height:48,borderRadius:12,backgroundColor:'rgba(255,255,255,.22)',alignItems:'center',justifyContent:'center'},shutter:{width:78,height:78,borderRadius:39,backgroundColor:'#fff',alignItems:'center',justifyContent:'center'},shutterDisabled:{opacity:.55},shutterInner:{width:68,height:68,borderRadius:34,borderWidth:2,borderColor:'#111'},flip:{width:48,height:48,borderRadius:24,backgroundColor:'rgba(0,0,0,.35)',alignItems:'center',justifyContent:'center'},mode:{color:'#fff',fontSize:12,marginTop:10,fontWeight:'800'},message:{color:'#fff',backgroundColor:'rgba(0,0,0,.55)',paddingHorizontal:16,paddingVertical:8,borderRadius:16,marginBottom:16},center:{flex:1,backgroundColor:'#0A0F15',alignItems:'center',justifyContent:'center',padding:28},title:{color:'#fff',fontSize:28,fontWeight:'800'},sub:{color:colors.muted,textAlign:'center',marginTop:8,lineHeight:20},cta:{marginTop:22,backgroundColor:'#fff',paddingHorizontal:24,paddingVertical:15,borderRadius:20},ctaText:{color:'#111',fontWeight:'800'}})

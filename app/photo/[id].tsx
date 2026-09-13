import { Asset } from 'expo-asset';
import * as MediaLibrary from 'expo-media-library';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Image, Pressable, Share, StyleSheet, Text, View } from 'react-native';
import { colors } from '../../lib/theme';
import { supabase } from '../../lib/app-context';

export default function PhotoView(){
  const router=useRouter();
  const {id,index='0'}=useLocalSearchParams<{id:string;index?:string}>();
  const [photo,setPhoto]=useState<any>(null);
  const [busy,setBusy]=useState(false);
  const [message,setMessage]=useState('');
  useEffect(()=>{(async()=>{if(supabase&&id){const {data}=await supabase.from('photos').select('*').eq('id',id).maybeSingle();setPhoto(data);}})()},[id]);
  const download=async()=>{if(!photo?.public_url||busy)return;setBusy(true);setMessage('');try{const permission=await MediaLibrary.requestPermissionsAsync(true);if(!permission.granted)throw new Error('Photo permission is required to save this image.');const asset=Asset.fromURI(photo.public_url);await asset.downloadAsync();if(!asset.localUri)throw new Error('Could not download the image.');await MediaLibrary.saveToLibraryAsync(asset.localUri);setMessage('Saved to your photos ✓');}catch(e:any){setMessage(e?.message||'Could not save photo.')}finally{setBusy(false)}};
  const share=()=>photo?.public_url&&Share.share({message:photo.public_url});
  const uri=photo?.public_url;
  return <View style={styles.root}>{uri?<Image source={{uri}} style={StyleSheet.absoluteFill} resizeMode="contain"/>:<View style={styles.loading}>{photo===null?<ActivityIndicator color="#fff"/>:<Text style={{color:'#fff'}}>Photo unavailable</Text>}</View>}<View style={styles.top}><Pressable onPress={()=>router.back()}><Text style={styles.icon}>‹</Text></Pressable><Text style={styles.count}>{Number(index)+1}</Text><Pressable onPress={share}><Text style={styles.icon}>↗</Text></Pressable></View>{message?<View style={styles.message}><Text style={{color:'#fff',fontWeight:'700'}}>{message}</Text></View>:null}<View style={styles.bottom}><View><Text style={styles.name}>{photo?.display_name||'Mefie member'}</Text><Text style={styles.time}>{photo?.created_at?new Date(photo.created_at).toLocaleString():''}</Text></View><Pressable onPress={download} style={styles.download}>{busy?<ActivityIndicator color="#fff"/>:<Text style={{color:'#fff',fontSize:14,fontWeight:'800'}}>Save</Text>}</Pressable></View></View>;
}
const styles=StyleSheet.create({root:{flex:1,backgroundColor:'#000'},loading:{flex:1,alignItems:'center',justifyContent:'center'},top:{position:'absolute',top:58,left:20,right:20,flexDirection:'row',alignItems:'center',justifyContent:'space-between'},icon:{color:'#fff',fontSize:30},count:{color:'#fff',fontWeight:'700'},bottom:{position:'absolute',bottom:38,left:22,right:22,flexDirection:'row',justifyContent:'space-between',alignItems:'center'},name:{color:'#fff',fontSize:15,fontWeight:'800'},time:{color:colors.muted,fontSize:12,marginTop:3},download:{minWidth:70,height:44,borderRadius:22,backgroundColor:'rgba(0,0,0,.45)',borderWidth:1,borderColor:colors.line,alignItems:'center',justifyContent:'center'},message:{position:'absolute',top:110,alignSelf:'center',backgroundColor:'rgba(0,0,0,.6)',paddingHorizontal:16,paddingVertical:9,borderRadius:18}})

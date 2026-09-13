import { useLocalSearchParams, useRouter } from 'expo-router';
import { Images, Link2, MoreHorizontal, Users } from 'lucide-react-native';
import React, { useEffect, useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { BackButton, Screen } from '../../components/Screen';
import { GlassButton, GlassCard, IconButton } from '../../components/Glass';
import { colors, radii, shadows } from '../../lib/theme';
import { ensureParticipant, supabase, useApp } from '../../lib/app-context';

const fallbackPhoto = 'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=900&q=80';

export default function EventScreen(){
  const router=useRouter();
  const {id}=useLocalSearchParams<{id:string}>();
  const {displayName}=useApp();
  const [event,setEvent]=useState<any>(null);
  const [photos,setPhotos]=useState<any[]>([]);
  const [people,setPeople]=useState<any[]>([]);
  const [tab,setTab]=useState<'photos'|'people'>('photos');
  const [error,setError]=useState('');
  useEffect(()=>{
    let active=true;
    (async()=>{if(!supabase)return;try{await ensureParticipant(String(id),displayName);const [{data:e},{data:p},{data:pt}]=await Promise.all([supabase.from('events').select('*').eq('id',id).single(),supabase.from('photos').select('*').eq('event_id',id).order('created_at',{ascending:false}).limit(200),supabase.from('participants').select('*').eq('event_id',id).order('joined_at',{ascending:true})]);if(active){setEvent(e);setPhotos(p||[]);setPeople(pt||[]);}}catch(e:any){if(active)setError(e?.message||'Could not load event.');}})();
    if(supabase){const ch=supabase.channel(`event-${id}`).on('postgres_changes',{event:'INSERT',schema:'public',table:'photos',filter:`event_id=eq.${id}`},payload=>setPhotos(curr=>curr.some(x=>x.id===payload.new.id)?curr:[payload.new,...curr])).on('postgres_changes',{event:'*',schema:'public',table:'participants',filter:`event_id=eq.${id}`},payload=>setPeople(curr=>{if(payload.eventType==='INSERT')return curr.some(x=>x.id===payload.new.id)?curr:[...curr,payload.new];if(payload.eventType==='DELETE')return curr.filter(x=>x.id!==payload.old.id);return curr.map(x=>x.id===payload.new.id?payload.new:x);})).subscribe();return()=>{active=false;supabase.removeChannel(ch)}}
    return()=>{active=false};
  },[id,displayName]);
  const invite=async()=>{const link=`https://mefie.app/e/${event?.invite_code||''}`;await require('react-native').Share.share({message:`Join ${event?.name||'our Mefie event'} 📸\nEveryone's photos go into one shared album.\n\n${link}`});};
  const title=event?.name||'Event';
  return <View style={styles.root}><Screen backgroundImage={photos[0]?.public_url||fallbackPhoto}>
    <View style={styles.top}><BackButton/><IconButton accessibilityLabel="Invite friends" onPress={invite}><MoreHorizontal size={22} color={colors.white}/></IconButton></View>
    <View style={styles.hero}><Text style={styles.title}>{title}</Text><Text style={styles.meta}>{people.length} people · {photos.length} photos</Text><View style={styles.avatars}>{people.slice(0,5).map((p,i)=><View key={p.id||i} style={styles.avatar}><Text style={styles.avatarText}>{(p.display_name||'?')[0].toUpperCase()}</Text></View>)}{people.length>5?<View style={styles.avatar}><Text style={styles.avatarText}>+{people.length-5}</Text></View>:null}</View></View>
    <GlassButton label="Invite friends" icon={<Link2 size={18} color={colors.white}/>} onPress={invite}/>
    {error?<Text style={styles.error}>{error}</Text>:null}
    <GlassCard style={styles.galleryCard}><View style={styles.tabs}><Pressable onPress={()=>setTab('photos')} style={[styles.tab,tab==='photos'&&styles.activeTab]}><Images size={16} color={tab==='photos'?colors.black:colors.muted}/><Text style={tab==='photos'?styles.activeTabText:styles.tabText}>Photos</Text></Pressable><Pressable onPress={()=>setTab('people')} style={[styles.tab,tab==='people'&&styles.activeTab]}><Users size={16} color={tab==='people'?colors.black:colors.muted}/><Text style={tab==='people'?styles.activeTabText:styles.tabText}>People</Text></Pressable></View>
      {tab==='photos'?<View style={styles.grid}>{photos.length?photos.map((p,i)=><Pressable key={p.id||i} style={styles.photo} onPress={()=>router.push({pathname:'/photo/[id]',params:{id:p.id,eventId:id,index:String(i)}})}>{p.public_url?<Image source={{uri:p.public_url}} style={styles.photoImage}/>:<View style={styles.placeholder}/>}</Pressable>):<View style={styles.empty}><Text style={styles.emptyTitle}>No photos yet.</Text><Text style={styles.emptySub}>Be the first to capture the moment.</Text></View>}</View>:<View style={styles.peopleList}>{people.map(p=><View key={p.id} style={styles.person}><View style={styles.personAvatar}><Text style={styles.avatarText}>{(p.display_name||'?')[0].toUpperCase()}</Text></View><View><Text style={styles.personName}>{p.display_name}</Text><Text style={styles.personMeta}>Joined {new Date(p.joined_at).toLocaleDateString()}</Text></View></View>)}</View>}
    </GlassCard><View style={{height:94}}/>
  </Screen><Pressable accessibilityRole="button" accessibilityLabel="Take a photo" onPress={()=>router.push({pathname:'/camera/[eventId]',params:{eventId:id}})} style={styles.camera}><Images size={26} color={colors.black} strokeWidth={2.2}/></Pressable></View>;
}
const styles=StyleSheet.create({root:{flex:1,backgroundColor:'#081017'},top:{flexDirection:'row',justifyContent:'space-between'},hero:{paddingTop:38,paddingBottom:12},title:{color:colors.white,fontSize:34,fontWeight:'800',letterSpacing:-.8},meta:{color:colors.muted,fontSize:14,marginTop:4},avatars:{flexDirection:'row',marginTop:14},avatar:{width:34,height:34,borderRadius:17,backgroundColor:'rgba(255,255,255,.18)',borderWidth:2,borderColor:'#0b1117',marginRight:-5,alignItems:'center',justifyContent:'center'},avatarText:{color:'#fff',fontWeight:'800'},galleryCard:{padding:6},tabs:{flexDirection:'row',gap:8,padding:6,marginBottom:4},tab:{flex:1,minHeight:42,borderRadius:18,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:7},activeTab:{backgroundColor:'#fff'},tabText:{color:colors.muted,fontWeight:'700'},activeTabText:{color:colors.black,fontWeight:'800'},grid:{flexDirection:'row',flexWrap:'wrap',gap:4},photo:{width:'32.9%',height:112,borderRadius:11,overflow:'hidden',backgroundColor:'#26313b'},photoImage:{width:'100%',height:'100%'},placeholder:{flex:1,backgroundColor:'#26313b'},empty:{padding:26},emptyTitle:{color:colors.white,fontWeight:'800'},emptySub:{color:colors.muted,marginTop:5},peopleList:{padding:8},person:{flexDirection:'row',alignItems:'center',paddingVertical:10},personAvatar:{width:42,height:42,borderRadius:21,backgroundColor:'rgba(255,255,255,.16)',alignItems:'center',justifyContent:'center',marginRight:12},personName:{color:'#fff',fontWeight:'800',fontSize:15},personMeta:{color:colors.muted,fontSize:12,marginTop:3},error:{color:'#FFB4B4',paddingHorizontal:4,paddingBottom:8},camera:{position:'absolute',bottom:24,alignSelf:'center',width:72,height:72,borderRadius:36,backgroundColor:'#fff',alignItems:'center',justifyContent:'center',borderWidth:5,borderColor:'rgba(255,255,255,.28)',...shadows}});

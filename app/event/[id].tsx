import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Image, Pressable, Share, StyleSheet, Text, View } from 'react-native';
import { BackButton, Screen } from '../../components/Screen';
import { GlassButton, GlassCard, IconButton } from '../../components/Glass';
import { colors, radii, shadows } from '../../lib/theme';
import { ensureParticipant, supabase, useApp } from '../../lib/app-context';

const fallbackPhoto = 'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=700&q=80';

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
    (async()=>{
      if(!supabase) return;
      try {
        await ensureParticipant(String(id), displayName);
        const [{data:e},{data:p},{data:pt}]=await Promise.all([
          supabase.from('events').select('*').eq('id',id).single(),
          supabase.from('photos').select('*').eq('event_id',id).order('created_at',{ascending:false}).limit(200),
          supabase.from('participants').select('*').eq('event_id',id).order('joined_at',{ascending:true})
        ]);
        if(active){setEvent(e);setPhotos(p||[]);setPeople(pt||[]);}
      } catch(e:any) { if(active) setError(e?.message || 'Could not load event.'); }
    })();
    if(supabase){
      const ch=supabase.channel(`event-${id}`)
        .on('postgres_changes',{event:'INSERT',schema:'public',table:'photos',filter:`event_id=eq.${id}`},payload=>setPhotos(curr=>curr.some(x=>x.id===payload.new.id)?curr:[payload.new,...curr]))
        .on('postgres_changes',{event:'*',schema:'public',table:'participants',filter:`event_id=eq.${id}`},payload=>setPeople(curr=>{
          if(payload.eventType==='INSERT') return curr.some(x=>x.id===payload.new.id)?curr:[...curr,payload.new];
          if(payload.eventType==='DELETE') return curr.filter(x=>x.id!==payload.old.id);
          return curr.map(x=>x.id===payload.new.id?payload.new:x);
        })).subscribe();
      return()=>{active=false;supabase.removeChannel(ch)};
    }
    return()=>{active=false};
  },[id,displayName]);

  const invite=async()=>{
    const link=`https://mefie.app/e/${event?.invite_code||''}`;
    await Share.share({message:`Join ${event?.name||'our Mefie event'} 📸\nEveryone's photos go into one shared album.\n\n${link}`});
  };

  const title=event?.name||'Event';
  return <View style={{flex:1,backgroundColor:'#081017'}}><Screen backgroundImage={photos[0]?.public_url||fallbackPhoto}>
    <View style={styles.top}><BackButton/><IconButton label="⋯" onPress={invite}/></View>
    <View style={styles.hero}><Text style={styles.title}>{title}</Text><Text style={styles.meta}>{people.length} people · {photos.length} photos</Text><View style={styles.avatarRow}>{people.slice(0,5).map((p,i)=><View key={p.id||i} style={styles.avatar}><Text style={styles.avatarText}>{(p.display_name||'?')[0].toUpperCase()}</Text></View>)}{people.length>5?<View style={styles.avatar}><Text style={styles.avatarText}>+{people.length-5}</Text></View>:null}</View></View>
    <GlassButton label="Invite friends" icon="↗" onPress={invite}/>
    {error?<Text style={styles.error}>{error}</Text>:null}
    <GlassCard style={styles.galleryCard}><View style={styles.tabs}><Pressable onPress={()=>setTab('photos')} style={[styles.tab,tab==='photos'&&styles.activeTab]}><Text style={[styles.tabText,tab==='photos'&&styles.activeTabText]}>Photos</Text></Pressable><Pressable onPress={()=>setTab('people')} style={[styles.tab,tab==='people'&&styles.activeTab]}><Text style={[styles.tabText,tab==='people'&&styles.activeTabText]}>People</Text></Pressable></View>
      {tab==='photos'?<View style={styles.grid}>{photos.length?photos.map((p,i)=>{const uri=p.public_url;return <Pressable key={p.id||i} style={styles.photo} onPress={()=>router.push({pathname:'/photo/[id]',params:{id:p.id,eventId:id,index:String(i)}})}>{uri?<Image source={{uri}} style={styles.photoImage}/>:<View style={styles.emptyPhoto}/>}</Pressable>}):<View style={styles.empty}><Text style={styles.emptyTitle}>No photos yet.</Text><Text style={styles.emptySub}>Be the first to capture the moment.</Text></View>}</View>:<View style={styles.peopleList}>{people.map(p=><View key={p.id} style={styles.person}><View style={styles.personAvatar}><Text style={styles.avatarText}>{(p.display_name||'?')[0].toUpperCase()}</Text></View><View><Text style={styles.personName}>{p.display_name}</Text><Text style={styles.personMeta}>Joined {new Date(p.joined_at).toLocaleDateString()}</Text></View></View>)}</View>}
    </GlassCard><View style={{height:92}}/></Screen><Pressable onPress={()=>router.push({pathname:'/camera/[eventId]',params:{eventId:id}})} style={styles.camera}><Text style={styles.cameraIcon}>⌾</Text></Pressable></View>;
}
const styles=StyleSheet.create({top:{flexDirection:'row',justifyContent:'space-between'},hero:{paddingTop:42,paddingBottom:10},title:{color:colors.white,fontSize:33,fontWeight:'800',letterSpacing:-.8},meta:{color:colors.muted,fontSize:14,marginTop:4},avatarRow:{flexDirection:'row',marginTop:14},avatar:{width:34,height:34,borderRadius:17,backgroundColor:'rgba(70,82,96,0.9)',borderWidth:2,borderColor:'#101820',marginRight:-5,alignItems:'center',justifyContent:'center'},avatarText:{color:'#fff',fontWeight:'800'},galleryCard:{padding:6,borderRadius:radii.card},tabs:{flexDirection:'row',backgroundColor:'rgba(255,255,255,0.07)',borderRadius:20,padding:3,marginBottom:5},tab:{flex:1,alignItems:'center',paddingVertical:10,borderRadius:17},activeTab:{backgroundColor:'rgba(255,255,255,0.95)',...shadows},tabText:{color:colors.muted,fontWeight:'700'},activeTabText:{color:'#111'},grid:{flexDirection:'row',flexWrap:'wrap',gap:4},photo:{width:'32.9%',height:112,borderRadius:11,overflow:'hidden',backgroundColor:'#26313b'},photoImage:{width:'100%',height:'100%'},emptyPhoto:{flex:1,backgroundColor:'#26313b'},empty:{padding:26},emptyTitle:{color:colors.white,fontWeight:'800'},emptySub:{color:colors.muted,marginTop:5},peopleList:{padding:8},person:{flexDirection:'row',alignItems:'center',paddingVertical:10},personAvatar:{width:42,height:42,borderRadius:21,backgroundColor:'rgba(70,82,96,0.9)',alignItems:'center',justifyContent:'center',marginRight:12},personName:{color:colors.white,fontWeight:'800',fontSize:15},personMeta:{color:colors.muted,fontSize:12,marginTop:3},camera:{position:'absolute',bottom:24,alignSelf:'center',width:70,height:70,borderRadius:35,backgroundColor:'rgba(255,255,255,0.96)',alignItems:'center',justifyContent:'center',borderWidth:5,borderColor:'rgba(255,255,255,.25)',...shadows},cameraIcon:{fontSize:29,color:'#10151B'},error:{color:colors.danger,paddingHorizontal:4,paddingBottom:8}});

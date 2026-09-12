import * as Clipboard from 'expo-clipboard';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Share, StyleSheet, Text, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { BackButton, Screen } from '../components/Screen';
import { GlassButton, GlassCard } from '../components/Glass';
import { colors } from '../lib/theme';

export default function EventCreatedScreen() {
  const router=useRouter(); const { id='local', name='Your event', invite='MEFIE1' }=useLocalSearchParams<{id:string;name:string;invite:string}>();
  const link=`https://mefie.app/e/${invite}`;
  const share=()=>Share.share({message:`Join our ${name} on Mefie 📸\nEveryone's photos go into one shared album.\n\nTap to join: ${link}`});
  return <Screen><BackButton/><View style={styles.center}><View style={styles.check}><Text style={{fontSize:28}}>✓</Text></View><Text style={styles.ready}>Your event is ready!</Text><Text style={styles.title}>{name}</Text><Text style={styles.sub}>Share this link with your friends.</Text></View><GlassCard><Text style={styles.label}>Event link</Text><Text style={styles.link}>{link}</Text><View style={{marginTop:18,alignItems:'center'}}><QRCode value={link} size={150} backgroundColor="transparent" color="white"/></View></GlassCard><GlassButton label="Copy link" onPress={()=>Clipboard.setStringAsync(link)}/><GlassButton label="Share" onPress={share}/><GlassButton label="Share QR Code" icon="▦" onPress={share}/><GlassButton primary label="Enter event →" onPress={()=>router.replace({pathname:'/event/[id]',params:{id}})}/></Screen>;
}
const styles=StyleSheet.create({center:{alignItems:'center',paddingTop:22,paddingBottom:4},check:{width:56,height:56,borderRadius:28,backgroundColor:'#EDF4FF',alignItems:'center',justifyContent:'center'},ready:{color:colors.white,fontSize:13,fontWeight:'600',marginTop:18},title:{color:colors.white,fontSize:27,fontWeight:'800',marginTop:8,textAlign:'center'},sub:{color:colors.muted,fontSize:14,marginTop:6},label:{color:colors.muted,fontSize:12,marginBottom:6},link:{color:colors.white,fontSize:15,fontWeight:'600'}});

import { BlurView } from 'expo-blur';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useEffect, useRef, useState } from 'react';
import { Animated, Image, Pressable, Share, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BackButton } from '../../components/Screen';
import { IconButton } from '../../components/Glass';
import { colors, shadows } from '../../lib/theme';
import { ensureParticipant, supabase, useApp } from '../../lib/app-context';

const fallbackPhoto = 'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=1200&q=85';
const HERO_HEIGHT = 250;
const TAB_HEIGHT = 52;

const PLACEHOLDER_PHOTOS = [
  'https://images.unsplash.com/photo-1500534623283-312aade485b7?auto=format&fit=crop&w=700&q=88',
  'https://images.unsplash.com/photo-1511497584788-876760111969?auto=format&fit=crop&w=700&q=88',
  'https://images.unsplash.com/photo-1501785888041-af3ef285b470?auto=format&fit=crop&w=700&q=88',
  'https://images.unsplash.com/photo-1519681393784-d120267933ba?auto=format&fit=crop&w=700&q=88',
  'https://images.unsplash.com/photo-1493246507139-91e8fad9978e?auto=format&fit=crop&w=700&q=88',
  'https://images.unsplash.com/photo-1470770841072-f978cf4d019e?auto=format&fit=crop&w=700&q=88',
  'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=700&q=88',
  'https://images.unsplash.com/photo-1495567720989-cebdbdd97913?auto=format&fit=crop&w=700&q=88',
  'https://images.unsplash.com/photo-1500534314209-a25ddb2bd429?auto=format&fit=crop&w=700&q=88',
  'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=700&q=88',
  'https://images.unsplash.com/photo-1526481280695-3c687fd5432c?auto=format&fit=crop&w=700&q=88',
  'https://images.unsplash.com/photo-1521292270410-a8c4d716d518?auto=format&fit=crop&w=700&q=88',
  'https://images.unsplash.com/photo-1526772662000-3f88f10405ff?auto=format&fit=crop&w=700&q=88',
  'https://images.unsplash.com/photo-1530789253388-582c481c54b0?auto=format&fit=crop&w=700&q=88',
  'https://images.unsplash.com/photo-1500534623283-312aade485b7?auto=format&fit=crop&w=700&q=82&sat=-12',
  'https://images.unsplash.com/photo-1519681393784-d120267933ba?auto=format&fit=crop&w=700&q=82&sat=12',
  'https://images.unsplash.com/photo-1501785888041-af3ef285b470?auto=format&fit=crop&w=700&q=82&sat=-8',
  'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=700&q=82&sat=8',
  'https://images.unsplash.com/photo-1470770841072-f978cf4d019e?auto=format&fit=crop&w=700&q=82&sat=-10',
  'https://images.unsplash.com/photo-1493246507139-91e8fad9978e?auto=format&fit=crop&w=700&q=82&sat=10',
];

export default function EventScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { displayName } = useApp();
  const scrollY = useRef(new Animated.Value(0)).current;
  const [event, setEvent] = useState<any>(null);
  const [photos, setPhotos] = useState<any[]>([]);
  const [people, setPeople] = useState<any[]>([]);
  const [tab, setTab] = useState<'photos' | 'people'>('photos');
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    (async () => {
      if (!supabase) return;
      try {
        await ensureParticipant(String(id), displayName);
        const [{ data: e }, { data: p }, { data: pt }] = await Promise.all([
          supabase.from('events').select('*').eq('id', id).single(),
          supabase.from('photos').select('*').eq('event_id', id).order('created_at', { ascending: false }).limit(200),
          supabase.from('participants').select('*, users(avatar_url)').eq('event_id', id).order('joined_at', { ascending: true }),
        ]);
        if (active) { setEvent(e); setPhotos(p || []); setPeople(pt || []); }
      } catch (e: any) {
        if (active) setError(e?.message || 'Could not load event.');
      }
    })();

    if (supabase) {
      const ch = supabase.channel(`event-${id}`)
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'photos', filter: `event_id=eq.${id}` }, payload =>
          setPhotos(curr => curr.some(x => x.id === payload.new.id) ? curr : [payload.new, ...curr])
        )
        .on('postgres_changes', { event: '*', schema: 'public', table: 'participants', filter: `event_id=eq.${id}` }, payload => {
          if (payload.eventType === 'INSERT') setPeople(curr => curr.some(x => x.id === payload.new.id) ? curr : [...curr, payload.new]);
          else if (payload.eventType === 'DELETE') setPeople(curr => curr.filter(x => x.id !== payload.old.id));
          else setPeople(curr => curr.map(x => x.id === payload.new.id ? { ...x, ...payload.new } : x));
        }).subscribe();
      return () => { active = false; supabase.removeChannel(ch); };
    }
    return () => { active = false; };
  }, [id, displayName]);

  const invite = async () => {
    const link = `https://mefie.app/e/${event?.invite_code || ''}`;
    await Share.share({ message: `Join ${event?.name || 'our Mefie event'} 📸\nEveryone's photos go into one shared album.\n\n${link}` });
  };

  const title = event?.name || 'Event';
  const visiblePeople = people.slice(0, 5);
  const heroSource = photos[0]?.public_url || fallbackPhoto;
  const galleryPhotos = photos.length
    ? photos
    : PLACEHOLDER_PHOTOS.map((url, index) => ({ id: `placeholder-${index}`, public_url: url, placeholder: true }));

  const heroOpacity = scrollY.interpolate({ inputRange: [0, 130, 220], outputRange: [1, 0.98, 0], extrapolate: 'clamp' });
  const heroInfoTranslate = scrollY.interpolate({ inputRange: [0, 170], outputRange: [0, -42], extrapolate: 'clamp' });

  return (
    <View style={styles.root}>
      <View pointerEvents="none" style={styles.background}>
        <Image source={{ uri: heroSource }} style={styles.backgroundImage} />
        <LinearGradient
          colors={['rgba(4,9,14,.02)', 'rgba(4,9,14,.08)', 'rgba(8,16,23,.72)']}
          locations={[0, 0.48, 1]}
          style={StyleSheet.absoluteFillObject}
        />
      </View>

      <Animated.ScrollView
        style={styles.scroll}
        contentContainerStyle={{ paddingBottom: insets.bottom + 112 }}
        showsVerticalScrollIndicator={false}
        stickyHeaderIndices={[1]}
        scrollEventThrottle={16}
        bounces
        onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], { useNativeDriver: true })}
      >
        <Animated.View style={[styles.heroContent, { paddingTop: insets.top + 15, opacity: heroOpacity }]}>
          <View style={styles.top}>
            <BackButton />
            <IconButton accessibilityLabel="Invite friends" onPress={invite}>
              <MaterialCommunityIcons name="link-variant" size={21} color={colors.white} />
            </IconButton>
          </View>

          <Animated.View style={{ transform: [{ translateY: heroInfoTranslate }] }}>
            <View style={styles.heroInfo}>
              <Text style={styles.title} numberOfLines={1}>{title}</Text>
              <Text style={styles.meta}>{people.length} people · {photos.length} photos</Text>
              <View style={styles.avatars}>
                {visiblePeople.map((person, index) => {
                  const avatarUrl = person.users?.avatar_url;
                  return (
                    <View key={person.id || index} style={[styles.avatar, index > 0 && styles.avatarOverlap]}>
                      {avatarUrl ? <Image source={{ uri: avatarUrl }} style={styles.avatarImage} /> : <Text style={styles.avatarText}>{(person.display_name || '?')[0].toUpperCase()}</Text>}
                    </View>
                  );
                })}
                {people.length > 5 ? (
                  <View style={[styles.avatar, styles.avatarOverlap, styles.moreAvatar]}>
                    <Text style={styles.moreText}>+{people.length - 5}</Text>
                  </View>
                ) : null}
              </View>
            </View>
          </Animated.View>
        </Animated.View>

        <Animated.View style={styles.tabsSticky}>
          <BlurView intensity={82} tint="dark" style={styles.tabs}>
            <View style={styles.tabsTint}>
              <Pressable onPress={() => setTab('photos')} style={[styles.tab, tab === 'photos' && styles.activeTab]}>
                <MaterialCommunityIcons name="image-multiple-outline" size={17} color={tab === 'photos' ? colors.black : 'rgba(255,255,255,.92)'} />
                <Text style={tab === 'photos' ? styles.activeTabText : styles.tabText}>Photos</Text>
              </Pressable>
              <Pressable onPress={() => setTab('people')} style={[styles.tab, tab === 'people' && styles.activeTab]}>
                <MaterialCommunityIcons name="account-group-outline" size={17} color={tab === 'people' ? colors.black : 'rgba(255,255,255,.88)'} />
                <Text style={tab === 'people' ? styles.activeTabText : styles.tabText}>People</Text>
              </Pressable>
            </View>
          </BlurView>
        </Animated.View>

        <View style={styles.gallery}>
          <BlurView intensity={38} tint="dark" style={StyleSheet.absoluteFillObject} pointerEvents="none" />
          <View style={styles.galleryTint} pointerEvents="none" />
          {error ? <Text style={styles.error}>{error}</Text> : null}
          {tab === 'photos' ? (
            <View style={styles.grid}>
              {galleryPhotos.map((photo, index) => (
                <Pressable
                  key={photo.id || index}
                  disabled={photo.placeholder}
                  style={styles.photo}
                  onPress={() => router.push({ pathname: '/photo/[id]', params: { id: photo.id, eventId: id, index: String(index) } })}
                >
                  <Image source={{ uri: photo.public_url }} style={styles.photoImage} />
                </Pressable>
              ))}
            </View>
          ) : (
            <View style={styles.peopleList}>
              {people.map(person => {
                const avatarUrl = person.users?.avatar_url;
                return (
                  <View key={person.id} style={styles.person}>
                    <View style={styles.personAvatar}>
                      {avatarUrl ? <Image source={{ uri: avatarUrl }} style={styles.personAvatarImage} /> : <Text style={styles.avatarText}>{(person.display_name || '?')[0].toUpperCase()}</Text>}
                    </View>
                    <View>
                      <Text style={styles.personName}>{person.display_name}</Text>
                      <Text style={styles.personMeta}>Joined {new Date(person.joined_at).toLocaleDateString()}</Text>
                    </View>
                  </View>
                );
              })}
            </View>
          )}
        </View>
      </Animated.ScrollView>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Take a photo"
        onPress={() => router.push({ pathname: '/camera/[eventId]', params: { eventId: id } })}
        style={[styles.camera, { bottom: Math.max(insets.bottom + 18, 24) }]}
      >
        <MaterialCommunityIcons name="camera-outline" size={27} color={colors.black} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#081017' },
  scroll: { flex: 1 },
  background: { ...StyleSheet.absoluteFillObject, overflow: 'hidden' },
  backgroundImage: { ...StyleSheet.absoluteFillObject, resizeMode: 'cover' },
  heroContent: { minHeight: HERO_HEIGHT, paddingHorizontal: 20 },
  top: { flexDirection: 'row', justifyContent: 'space-between' },
  heroInfo: { paddingTop: 29, paddingBottom: 2 },
  title: { color: colors.white, fontSize: 29, lineHeight: 35, fontWeight: '800', letterSpacing: -0.7 },
  meta: { color: 'rgba(255,255,255,.80)', fontSize: 14, marginTop: 1 },
  avatars: { flexDirection: 'row', alignItems: 'center', minHeight: 38, marginTop: 10, paddingLeft: 1 },
  avatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,.22)', borderWidth: 2, borderColor: 'rgba(8,16,23,.92)', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  avatarOverlap: { marginLeft: -7 },
  avatarImage: { width: '100%', height: '100%' },
  avatarText: { color: colors.white, fontSize: 14, fontWeight: '800' },
  moreAvatar: { backgroundColor: 'rgba(25,33,42,.88)' },
  moreText: { color: colors.white, fontSize: 13, fontWeight: '800' },
  tabsSticky: { height: TAB_HEIGHT + 8, paddingHorizontal: 20, paddingTop: 4, paddingBottom: 4, backgroundColor: 'rgba(8,16,23,.28)', zIndex: 10 },
  tabs: { width: '100%', height: TAB_HEIGHT, borderRadius: 27, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,.26)', ...shadows },
  tabsTint: { flex: 1, padding: 3, backgroundColor: 'rgba(150,164,176,.18)', borderRadius: 27, flexDirection: 'row' },
  tab: { flex: 1, borderRadius: 24, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7 },
  activeTab: { backgroundColor: 'rgba(255,255,255,.98)', borderWidth: 1, borderColor: 'rgba(255,255,255,.94)', shadowColor: '#fff', shadowOpacity: 0.34, shadowRadius: 7, shadowOffset: { width: 0, height: 1 }, elevation: 4 },
  tabText: { color: 'rgba(255,255,255,.90)', fontSize: 14, fontWeight: '700' },
  activeTabText: { color: colors.black, fontSize: 14, fontWeight: '800' },
  gallery: { position: 'relative', paddingHorizontal: 10, paddingTop: 0, backgroundColor: 'transparent', minHeight: 900 },
  galleryTint: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(8,16,23,.24)' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 4 },
  photo: { width: '32.1%', aspectRatio: 1, borderRadius: 10, overflow: 'hidden', backgroundColor: '#26313b' },
  photoImage: { width: '100%', height: '100%' },
  error: { color: '#FFB4B4', paddingBottom: 8 },
  peopleList: { paddingTop: 3 },
  person: { flexDirection: 'row', alignItems: 'center', paddingVertical: 9 },
  personAvatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,.16)', alignItems: 'center', justifyContent: 'center', marginRight: 12, overflow: 'hidden' },
  personAvatarImage: { width: '100%', height: '100%' },
  personName: { color: colors.white, fontWeight: '800', fontSize: 15 },
  personMeta: { color: colors.muted, fontSize: 12, marginTop: 3 },
  camera: { position: 'absolute', alignSelf: 'center', width: 64, height: 64, borderRadius: 32, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', borderWidth: 4, borderColor: 'rgba(255,255,255,.32)', ...shadows },
});

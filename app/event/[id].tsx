import { BlurView } from 'expo-blur';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Image, Pressable, Share, StyleSheet, Text, View } from 'react-native';
import { BackButton, Screen } from '../../components/Screen';
import { IconButton } from '../../components/Glass';
import { colors, shadows } from '../../lib/theme';
import { ensureParticipant, supabase, useApp } from '../../lib/app-context';

const fallbackPhoto = 'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=1200&q=85';

export default function EventScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { displayName } = useApp();
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
        if (active) {
          setEvent(e);
          setPhotos(p || []);
          setPeople(pt || []);
        }
      } catch (e: any) {
        if (active) setError(e?.message || 'Could not load event.');
      }
    })();

    if (supabase) {
      const ch = supabase
        .channel(`event-${id}`)
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'photos', filter: `event_id=eq.${id}` }, payload =>
          setPhotos(curr => curr.some(x => x.id === payload.new.id) ? curr : [payload.new, ...curr])
        )
        .on('postgres_changes', { event: '*', schema: 'public', table: 'participants', filter: `event_id=eq.${id}` }, payload => {
          if (payload.eventType === 'INSERT') {
            setPeople(curr => curr.some(x => x.id === payload.new.id) ? curr : [...curr, payload.new]);
          } else if (payload.eventType === 'DELETE') {
            setPeople(curr => curr.filter(x => x.id !== payload.old.id));
          } else {
            setPeople(curr => curr.map(x => x.id === payload.new.id ? { ...x, ...payload.new } : x));
          }
        })
        .subscribe();

      return () => {
        active = false;
        supabase.removeChannel(ch);
      };
    }

    return () => { active = false; };
  }, [id, displayName]);

  const invite = async () => {
    const link = `https://mefie.app/e/${event?.invite_code || ''}`;
    await Share.share({
      message: `Join ${event?.name || 'our Mefie event'} 📸\nEveryone's photos go into one shared album.\n\n${link}`,
    });
  };

  const title = event?.name || 'Event';
  const visiblePeople = people.slice(0, 5);

  return (
    <View style={styles.root}>
      <Screen backgroundImage={photos[0]?.public_url || fallbackPhoto}>
        <View style={styles.top}>
          <BackButton />
          <IconButton accessibilityLabel="More event options" onPress={invite}>
            <MaterialCommunityIcons name="dots-horizontal" size={22} color={colors.white} />
          </IconButton>
        </View>

        <View style={styles.hero}>
          <Text style={styles.title} numberOfLines={1}>{title}</Text>
          <Text style={styles.meta}>{people.length} people · {photos.length} photos</Text>

          <View style={styles.actionRow}>
            <View style={styles.avatars}>
              {visiblePeople.map((person, index) => {
                const avatarUrl = person.users?.avatar_url;
                return (
                  <View key={person.id || index} style={[styles.avatar, index > 0 && styles.avatarOverlap]}>
                    {avatarUrl ? (
                      <Image source={{ uri: avatarUrl }} style={styles.avatarImage} />
                    ) : (
                      <Text style={styles.avatarText}>{(person.display_name || '?')[0].toUpperCase()}</Text>
                    )}
                  </View>
                );
              })}
              {people.length > 5 ? (
                <View style={[styles.avatar, styles.avatarOverlap, styles.moreAvatar]}>
                  <Text style={styles.moreText}>+{people.length - 5}</Text>
                </View>
              ) : null}
            </View>

            <Pressable accessibilityRole="button" accessibilityLabel="Invite friends" onPress={invite} style={styles.inviteButton}>
              <MaterialCommunityIcons name="link-variant" size={18} color={colors.black} />
              <Text style={styles.inviteText}>Invite</Text>
            </Pressable>
          </View>
        </View>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <View style={styles.tabs}>
          <Pressable onPress={() => setTab('photos')} style={[styles.tab, tab === 'photos' && styles.activeTab]}>
            <MaterialCommunityIcons name="image-multiple-outline" size={16} color={tab === 'photos' ? colors.black : colors.white} />
            <Text style={tab === 'photos' ? styles.activeTabText : styles.tabText}>Photos</Text>
          </Pressable>
          <Pressable onPress={() => setTab('people')} style={[styles.tab, tab === 'people' && styles.activeTab]}>
            <MaterialCommunityIcons name="account-group-outline" size={16} color={tab === 'people' ? colors.black : 'rgba(255,255,255,.70)'} />
            <Text style={tab === 'people' ? styles.activeTabText : styles.tabText}>People</Text>
          </Pressable>
        </View>

        {tab === 'photos' ? (
          photos.length ? (
            <View style={styles.grid}>
              {photos.map((photo, index) => (
                <Pressable
                  key={photo.id || index}
                  style={styles.photo}
                  onPress={() => router.push({ pathname: '/photo/[id]', params: { id: photo.id, eventId: id, index: String(index) } })}
                >
                  {photo.public_url ? <Image source={{ uri: photo.public_url }} style={styles.photoImage} /> : <View style={styles.placeholder} />}
                </Pressable>
              ))}
            </View>
          ) : (
            <View style={styles.empty}>
              <Text style={styles.emptyTitle}>No photos yet.</Text>
              <Text style={styles.emptySub}>Be the first to capture the moment.</Text>
            </View>
          )
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

        <View style={{ height: 88 }} />
      </Screen>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Take a photo"
        onPress={() => router.push({ pathname: '/camera/[eventId]', params: { eventId: id } })}
        style={styles.camera}
      >
        <MaterialCommunityIcons name="camera-outline" size={27} color={colors.black} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#081017' },
  top: { flexDirection: 'row', justifyContent: 'space-between' },
  hero: { paddingTop: 30, paddingBottom: 8 },
  title: { color: colors.white, fontSize: 29, lineHeight: 35, fontWeight: '800', letterSpacing: -0.7 },
  meta: { color: 'rgba(255,255,255,.78)', fontSize: 14, marginTop: 1 },
  actionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 13 },
  avatars: { flexDirection: 'row', alignItems: 'center', minHeight: 38, paddingLeft: 1 },
  avatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,.24)', borderWidth: 2, borderColor: '#10171e', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  avatarOverlap: { marginLeft: -7 },
  avatarImage: { width: '100%', height: '100%' },
  avatarText: { color: colors.white, fontSize: 14, fontWeight: '800' },
  moreAvatar: { backgroundColor: 'rgba(26,34,42,.82)' },
  moreText: { color: colors.white, fontSize: 13, fontWeight: '800' },
  inviteButton: { height: 42, paddingHorizontal: 17, borderRadius: 21, backgroundColor: 'rgba(255,255,255,.94)', flexDirection: 'row', alignItems: 'center', gap: 7, ...shadows },
  inviteText: { color: colors.black, fontSize: 14, fontWeight: '800' },
  error: { color: '#FFB4B4', paddingHorizontal: 2, paddingBottom: 8 },
  tabs: { width: 244, height: 43, padding: 2, borderRadius: 23, backgroundColor: 'rgba(70,78,88,.58)', borderWidth: 1, borderColor: 'rgba(255,255,255,.12)', flexDirection: 'row', marginTop: 9, marginBottom: 8 },
  tab: { flex: 1, borderRadius: 21, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  activeTab: { backgroundColor: 'rgba(255,255,255,.96)' },
  tabText: { color: 'rgba(255,255,255,.72)', fontSize: 13, fontWeight: '700' },
  activeTabText: { color: colors.black, fontSize: 13, fontWeight: '800' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 3 },
  photo: { width: '32.95%', aspectRatio: 1, borderRadius: 10, overflow: 'hidden', backgroundColor: '#26313b' },
  photoImage: { width: '100%', height: '100%' },
  placeholder: { flex: 1, backgroundColor: '#26313b' },
  empty: { padding: 26, alignItems: 'center' },
  emptyTitle: { color: colors.white, fontWeight: '800' },
  emptySub: { color: colors.muted, marginTop: 5 },
  peopleList: { paddingTop: 3 },
  person: { flexDirection: 'row', alignItems: 'center', paddingVertical: 9 },
  personAvatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,.16)', alignItems: 'center', justifyContent: 'center', marginRight: 12, overflow: 'hidden' },
  personAvatarImage: { width: '100%', height: '100%' },
  personName: { color: colors.white, fontWeight: '800', fontSize: 15 },
  personMeta: { color: colors.muted, fontSize: 12, marginTop: 3 },
  camera: { position: 'absolute', bottom: 26, alignSelf: 'center', width: 64, height: 64, borderRadius: 32, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', borderWidth: 4, borderColor: 'rgba(255,255,255,.32)', ...shadows },
});

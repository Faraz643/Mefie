import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import { View, Text } from 'react-native';

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

export const supabase = SUPABASE_URL && SUPABASE_ANON_KEY
  ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { storage: AsyncStorage, autoRefreshToken: true, persistSession: true, detectSessionInUrl: false } })
  : null;

type DemoEvent = { id: string; name: string; people: number; photos: number; cover: string; };
type AppContextValue = { displayName: string; setDisplayName: (name: string) => Promise<void>; backgroundImage: string | null; setBackgroundImage: (uri: string | null) => Promise<void>; events: DemoEvent[]; refreshEvents: () => Promise<void>; };

const Ctx = createContext<AppContextValue | null>(null);

export async function getSessionId() {
  const key = 'mefie.sessionId';
  let id = await AsyncStorage.getItem(key);
  if (!id) {
    id = `${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
    await AsyncStorage.setItem(key, id);
  }
  return id;
}

export async function ensureParticipant(eventId: string, displayName: string) {
  if (!supabase || !eventId) return null;
  const sessionId = await getSessionId();
  const { data: existing } = await supabase.from('participants').select('*').eq('event_id', eventId).eq('session_id', sessionId).maybeSingle();
  if (existing) {
    await supabase.from('participants').update({ display_name: displayName.trim() || 'Guest', last_seen_at: new Date().toISOString() }).eq('id', existing.id);
    return existing.id;
  }
  const { data, error } = await supabase.from('participants').insert({ event_id: eventId, session_id: sessionId, display_name: displayName.trim() || 'Guest' }).select('id').single();
  if (error) throw error;
  return data.id;
}

export async function getParticipantId(eventId: string) {
  if (!supabase) return null;
  const sessionId = await getSessionId();
  const { data } = await supabase.from('participants').select('id').eq('event_id', eventId).eq('session_id', sessionId).maybeSingle();
  return data?.id ?? null;
}

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [displayName, setName] = useState('Faraz');
  const [backgroundImage, setBackground] = useState<string | null>(null);
  const [events, setEvents] = useState<DemoEvent[]>([]);

  useEffect(() => {
    AsyncStorage.getItem('mefie.displayName').then(v => v && setName(v));
    AsyncStorage.getItem('mefie.backgroundImage').then(v => v && setBackground(v));
  }, []);
  const setDisplayName = async (name: string) => { const value = name.trim() || 'Faraz'; setName(value); await AsyncStorage.setItem('mefie.displayName', value); };
  const setBackgroundImage = async (uri: string | null) => {
    setBackground(uri);
    if (uri) await AsyncStorage.setItem('mefie.backgroundImage', uri);
    else await AsyncStorage.removeItem('mefie.backgroundImage');
  };

  const refreshEvents = useCallback(async () => {
    if (!supabase) return;
    const { data } = await supabase.from('events').select('id,name,created_at').eq('status', 'active').order('created_at', { ascending: false }).limit(20);
    if (!data) return;
    const enriched = await Promise.all(data.map(async e => {
      const [{ count: people }, { count: photos }, { data: cover }] = await Promise.all([
        supabase.from('participants').select('id', { count: 'exact', head: true }).eq('event_id', e.id),
        supabase.from('photos').select('id', { count: 'exact', head: true }).eq('event_id', e.id),
        supabase.from('photos').select('public_url').eq('event_id', e.id).not('public_url', 'is', null).order('created_at', { ascending: false }).limit(1).maybeSingle()
      ]);
      return { id: e.id, name: e.name, people: people || 0, photos: photos || 0, cover: cover?.public_url || '' };
    }));
    setEvents(enriched);
  }, []);

  useEffect(() => { refreshEvents(); }, [refreshEvents]);
  const value = useMemo(() => ({ displayName, setDisplayName, backgroundImage, setBackgroundImage, events, refreshEvents }), [displayName, backgroundImage, events, refreshEvents]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
export function useApp() { const value = useContext(Ctx); if (!value) throw new Error('useApp must be used inside AppProvider'); return value; }

export function BackendNotice() {
  if (supabase) return null;
  return <View style={{ position: 'absolute', bottom: 100, left: 20, right: 20, padding: 12, borderRadius: 16, backgroundColor: 'rgba(255,180,0,0.14)' }}><Text style={{ color: '#fff', textAlign: 'center', fontSize: 12 }}>Add EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY to enable cloud events.</Text></View>;
}

import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import { View, Text } from 'react-native';

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

export const supabase = SUPABASE_URL && SUPABASE_ANON_KEY
  ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { storage: AsyncStorage, autoRefreshToken: true, persistSession: true, detectSessionInUrl: false } })
  : null;

type DemoEvent = { id: string; name: string; people: number; photos: number; cover: string; };
type AppContextValue = { displayName: string; setDisplayName: (name: string) => Promise<void>; events: DemoEvent[]; refreshEvents: () => Promise<void>; };

const fallbackEvents: DemoEvent[] = [];
const Ctx = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [displayName, setName] = useState('Faraz');
  const [events, setEvents] = useState<DemoEvent[]>(fallbackEvents);

  useEffect(() => { AsyncStorage.getItem('mefie.displayName').then(v => v && setName(v)); }, []);
  const setDisplayName = async (name: string) => { const value = name.trim() || 'Faraz'; setName(value); await AsyncStorage.setItem('mefie.displayName', value); };
  const refreshEvents = async () => {
    if (!supabase) return;
    const { data } = await supabase.from('events').select('id,name').order('created_at', { ascending: false }).limit(12);
    if (data) setEvents(data.map(e => ({ id: e.id, name: e.name, people: 0, photos: 0, cover: '' })));
  };

  useEffect(() => { refreshEvents(); }, []);
  const value = useMemo(() => ({ displayName, setDisplayName, events, refreshEvents }), [displayName, events]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
export function useApp() { const value = useContext(Ctx); if (!value) throw new Error('useApp must be used inside AppProvider'); return value; }

export function BackendNotice() {
  if (supabase) return null;
  return <View style={{ position: 'absolute', bottom: 100, left: 20, right: 20, padding: 12, borderRadius: 16, backgroundColor: 'rgba(255,180,0,0.14)' }}><Text style={{ color: '#fff', textAlign: 'center', fontSize: 12 }}>Add EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY to enable cloud events.</Text></View>;
}

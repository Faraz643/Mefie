import { supabase } from './app-context';

export function subscribeToEvent(eventId: string, onPhoto: (photo: Record<string, unknown>) => void, onParticipant?: (payload: Record<string, unknown>) => void) {
  if (!supabase) return () => {};
  const channel = supabase
    .channel(`mefie:event:${eventId}`)
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'photos', filter: `event_id=eq.${eventId}` }, payload => onPhoto(payload.new as Record<string, unknown>))
    .on('postgres_changes', { event: '*', schema: 'public', table: 'participants', filter: `event_id=eq.${eventId}` }, payload => onParticipant?.(payload as unknown as Record<string, unknown>))
    .subscribe();
  return () => { supabase.removeChannel(channel); };
}

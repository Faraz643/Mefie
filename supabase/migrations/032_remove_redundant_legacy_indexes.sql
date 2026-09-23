-- Remove indexes that duplicate unique indexes or belong to disabled legacy
-- avatar storage.
drop index if exists public.idx_events_invite;
drop index if exists public.idx_event_temporary_invites_token;
drop index if exists public.idx_avatar_profiles_updated;

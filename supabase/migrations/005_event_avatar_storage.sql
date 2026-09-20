-- Event-visible avatars use participants.avatar_url as the single source of truth.
-- This migration makes the dedicated avatar bucket available on databases where
-- the earlier avatar migration was skipped or only partially applied.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'avatars',
  'avatars',
  true,
  2097152,
  array['image/jpeg','image/png','image/webp']
)
on conflict (id) do update set
  public = true,
  file_size_limit = 2097152,
  allowed_mime_types = array['image/jpeg','image/png','image/webp'];

drop policy if exists "avatar uploads" on storage.objects;
drop policy if exists "avatar reads" on storage.objects;
drop policy if exists "avatar updates" on storage.objects;
drop policy if exists "avatar deletes" on storage.objects;

create policy "avatar uploads"
  on storage.objects for insert to public
  with check (bucket_id = 'avatars');

create policy "avatar reads"
  on storage.objects for select to public
  using (bucket_id = 'avatars');

create policy "avatar updates"
  on storage.objects for update to public
  using (bucket_id = 'avatars')
  with check (bucket_id = 'avatars');

create policy "avatar deletes"
  on storage.objects for delete to public
  using (bucket_id = 'avatars');

alter table public.participants
  add column if not exists avatar_url text;

-- Prevent two rows for the same anonymous device in one event. This also makes
-- the event participant lookup deterministic when two joins happen at once.
create unique index if not exists participants_event_session_unique
  on public.participants(event_id, session_id)
  where session_id is not null;

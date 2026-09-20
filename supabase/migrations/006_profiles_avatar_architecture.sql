-- Canonical anonymous profile identity for Mefie.
-- Avatars live once per session and are never copied into event participants.

create table if not exists public.profiles (
  id uuid primary key default gen_random_uuid(),
  session_id text not null unique,
  display_name text not null default 'Guest',
  avatar_url text,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists idx_profiles_session on public.profiles(session_id);

alter table public.profiles enable row level security;

drop policy if exists "profiles readable" on public.profiles;
create policy "profiles readable"
  on public.profiles for select to public
  using (true);

drop policy if exists "profiles insertable" on public.profiles;
create policy "profiles insertable"
  on public.profiles for insert to public
  with check (true);

drop policy if exists "profiles updateable" on public.profiles;
create policy "profiles updateable"
  on public.profiles for update to public
  using (true)
  with check (true);

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

alter publication supabase_realtime add table public.profiles;

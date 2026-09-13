create extension if not exists "pgcrypto";

create table if not exists public.users (
  id uuid primary key default gen_random_uuid(),
  display_name text not null,
  username text unique,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 120),
  creator_id uuid references public.users(id) on delete set null,
  invite_code text not null unique,
  invite_link text generated always as ('https://mefie.app/e/' || invite_code) stored,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  status text not null default 'active' check (status in ('active','ended','deleted'))
);

create table if not exists public.participants (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  user_id uuid references public.users(id) on delete set null,
  session_id text,
  display_name text not null,
  joined_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);

create table if not exists public.photos (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  participant_id uuid references public.participants(id) on delete set null,
  storage_path text not null,
  thumbnail_path text,
  original_filename text,
  file_size bigint,
  width integer,
  height integer,
  public_url text,
  created_at timestamptz not null default now()
);

create index if not exists idx_events_creator on public.events(creator_id);
create index if not exists idx_events_invite on public.events(invite_code);
create index if not exists idx_participants_event on public.participants(event_id);
create index if not exists idx_photos_event_created on public.photos(event_id, created_at desc);
create index if not exists idx_photos_participant on public.photos(participant_id);

alter table public.events enable row level security;
alter table public.participants enable row level security;
alter table public.photos enable row level security;

drop policy if exists "events readable by anyone with invite code handled client-side" on public.events;
drop policy if exists "events readable" on public.events;
drop policy if exists "events insertable" on public.events;
drop policy if exists "participants insertable" on public.participants;
drop policy if exists "participants readable" on public.participants;
drop policy if exists "participants updateable" on public.participants;
drop policy if exists "photos insertable" on public.photos;
drop policy if exists "photos readable" on public.photos;

create policy "events readable" on public.events for select using (status = 'active');
create policy "events insertable" on public.events for insert with check (true);
create policy "participants insertable" on public.participants for insert with check (true);
create policy "participants readable" on public.participants for select using (true);
create policy "participants updateable" on public.participants for update using (true) with check (true);
create policy "photos insertable" on public.photos for insert with check (true);
create policy "photos readable" on public.photos for select using (true);

insert into storage.buckets (id, name, public)
values ('photos', 'photos', true)
on conflict (id) do update set public = true;

drop policy if exists "public photo uploads" on storage.objects;
drop policy if exists "public photo reads" on storage.objects;
create policy "public photo uploads" on storage.objects for insert to public with check (bucket_id = 'photos');
create policy "public photo reads" on storage.objects for select to public using (bucket_id = 'photos');

alter publication supabase_realtime add table public.events;
alter publication supabase_realtime add table public.participants;
alter publication supabase_realtime add table public.photos;

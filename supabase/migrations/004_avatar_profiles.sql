-- Avatar persistence: local-first on device, cloud-backed for other users.
-- Current Mefie identity is the stable anonymous session_id. When Supabase Auth
-- is introduced, user_id should be migrated to auth.users.id.

alter table public.participants
  add column if not exists avatar_url text;

create table if not exists public.avatar_profiles (
  user_id text primary key,
  avatar_url text,
  storage_path text,
  storage_location text not null default 'supabase_storage',
  last_updated timestamptz not null default now()
);

create index if not exists idx_avatar_profiles_updated
  on public.avatar_profiles(last_updated desc);

alter table public.avatar_profiles enable row level security;

drop policy if exists "avatar profiles readable" on public.avatar_profiles;
create policy "avatar profiles readable"
  on public.avatar_profiles for select
  using (true);

drop policy if exists "avatar profiles insertable" on public.avatar_profiles;
create policy "avatar profiles insertable"
  on public.avatar_profiles for insert
  with check (true);

drop policy if exists "avatar profiles updateable" on public.avatar_profiles;
create policy "avatar profiles updateable"
  on public.avatar_profiles for update
  using (true)
  with check (true);

-- Backfill cloud avatar metadata from any participant rows created by older builds.
insert into public.avatar_profiles (user_id, avatar_url, storage_path, storage_location, last_updated)
select distinct on (p.session_id)
  p.session_id,
  p.avatar_url,
  case
    when p.avatar_url like '%/storage/v1/object/public/photos/avatars/%'
      then regexp_replace(p.avatar_url, '^.*/storage/v1/object/public/photos/', '')
    else null
  end,
  case
    when p.avatar_url is not null then 'supabase_storage'
    else 'local_only'
  end,
  coalesce(p.last_seen_at, now())
from public.participants p
where p.session_id is not null
order by p.session_id, p.last_seen_at desc
on conflict (user_id) do update
set avatar_url = excluded.avatar_url,
    storage_path = excluded.storage_path,
    storage_location = excluded.storage_location,
    last_updated = excluded.last_updated;

-- The current app intentionally uses a public photos bucket so event members
-- can render CDN URLs without signed-url round trips. Production hardening
-- should move avatar storage to a private bucket after Supabase Auth is added.

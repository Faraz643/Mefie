-- Production RLS hardening for Supabase Anonymous Auth.
-- All client data access is authenticated; anonymous Auth users use the
-- authenticated Postgres role and are authorized by auth.uid().

create schema if not exists private;

-- Keep policy helper functions outside the API-exposed public schema.
create or replace function private.can_access_event(p_event_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.events e
    where e.id = p_event_id
      and e.status = 'active'
      and (
        e.creator_auth_user_id = (select auth.uid())
        or exists (
          select 1
          from public.participants p
          where p.event_id = e.id
            and p.auth_user_id = (select auth.uid())
        )
      )
  );
$$;

create or replace function private.can_join_event(p_event_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.events e
    where e.id = p_event_id
      and e.status = 'active'
      and not ((select auth.uid())::text = any(e.removed_session_ids))
  );
$$;

create or replace function private.can_delete_photo(p_photo_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.photos ph
    join public.events e on e.id = ph.event_id
    left join public.participants p on p.id = ph.participant_id
    where ph.id = p_photo_id
      and e.status = 'active'
      and (
        e.creator_auth_user_id = (select auth.uid())
        or p.auth_user_id = (select auth.uid())
      )
  );
$$;

create or replace function private.can_access_photo_storage(p_storage_path text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.photos ph
    where ph.storage_path = p_storage_path
      and private.can_access_event(ph.event_id)
  );
$$;

create or replace function private.can_delete_photo_storage(p_storage_path text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.photos ph
    join public.events e on e.id = ph.event_id
    left join public.participants p on p.id = ph.participant_id
    where ph.storage_path = p_storage_path
      and (
        e.creator_auth_user_id = (select auth.uid())
        or p.auth_user_id = (select auth.uid())
      )
  );
$$;

revoke all on function private.can_access_event(uuid) from public;
revoke all on function private.can_join_event(uuid) from public;
revoke all on function private.can_delete_photo(uuid) from public;
revoke all on function private.can_access_photo_storage(text) from public;
revoke all on function private.can_delete_photo_storage(text) from public;

grant usage on schema private to authenticated;
grant execute on function private.can_access_event(uuid) to authenticated;
grant execute on function private.can_join_event(uuid) to authenticated;
grant execute on function private.can_delete_photo(uuid) to authenticated;
grant execute on function private.can_access_photo_storage(text) to authenticated;
grant execute on function private.can_delete_photo_storage(text) to authenticated;

-- Remove the legacy public-facing policies. RLS becomes default-deny unless
-- an authenticated policy below explicitly grants access.
drop policy if exists "events readable by anyone with invite code handled client-side" on public.events;
drop policy if exists "events insertable" on public.events;

drop policy if exists "participants insertable" on public.participants;
drop policy if exists "participants readable" on public.participants;
drop policy if exists "participants updateable" on public.participants;

drop policy if exists "photos insertable" on public.photos;
drop policy if exists "photos readable" on public.photos;
drop policy if exists "photos deletable" on public.photos;

drop policy if exists "temporary invites readable by token" on public.event_temporary_invites;

drop policy if exists "profiles readable" on public.profiles;
drop policy if exists "profiles insertable" on public.profiles;
drop policy if exists "profiles updateable" on public.profiles;

alter table public.events enable row level security;
alter table public.participants enable row level security;
alter table public.photos enable row level security;
alter table public.event_temporary_invites enable row level security;
alter table public.profiles enable row level security;
alter table public.users enable row level security;

-- The app uses authenticated anonymous users only. Do not expose these
-- application tables to the unauthenticated anon role.
revoke all on table public.events from anon;
revoke all on table public.participants from anon;
revoke all on table public.photos from anon;
revoke all on table public.event_temporary_invites from anon;
revoke all on table public.profiles from anon;
revoke all on table public.users from anon;

grant select, insert on table public.events to authenticated;
grant select, insert, update on table public.participants to authenticated;
grant select, insert, delete on table public.photos to authenticated;

-- No direct table access is granted for temporary invite records, profiles,
-- or the legacy users table. Their intended operations are handled by
-- narrowly scoped functions or are currently disabled in the client.
revoke all on table public.event_temporary_invites from authenticated;
revoke all on table public.profiles from authenticated;
revoke all on table public.users from authenticated;

create policy "Authenticated members can read active events"
  on public.events
  for select
  to authenticated
  using ((select private.can_access_event(id)));

create policy "Authenticated users can create their own events"
  on public.events
  for insert
  to authenticated
  with check (
    creator_auth_user_id = (select auth.uid())
    and creator_session_id = (select auth.uid())::text
    and status = 'active'
  );

create policy "Authenticated members can read event participants"
  on public.participants
  for select
  to authenticated
  using ((select private.can_access_event(event_id)));

create policy "Authenticated users can join active events"
  on public.participants
  for insert
  to authenticated
  with check (
    auth_user_id = (select auth.uid())
    and session_id = (select auth.uid())::text
    and (select private.can_join_event(event_id))
  );

create policy "Authenticated users can update their own membership"
  on public.participants
  for update
  to authenticated
  using (auth_user_id = (select auth.uid()))
  with check (
    auth_user_id = (select auth.uid())
    and session_id = (select auth.uid())::text
  );

create policy "Event members can read event photos"
  on public.photos
  for select
  to authenticated
  using ((select private.can_access_event(event_id)));

create policy "Event members can upload their own photos"
  on public.photos
  for insert
  to authenticated
  with check (
    (select private.can_access_event(event_id))
    and exists (
      select 1
      from public.participants p
      where p.id = participant_id
        and p.event_id = event_id
        and p.auth_user_id = (select auth.uid())
    )
  );

create policy "Creators or uploaders can delete photos"
  on public.photos
  for delete
  to authenticated
  using ((select private.can_delete_photo(id)));

-- The legacy profiles/users tables are intentionally locked while profile
-- photo support is disabled. This prevents old permissive policies from
-- remaining an unintended public data surface.
-- There are intentionally no policies on those tables.

-- Secure existing creator/temporary-invite functions by deriving identity
-- from auth.uid() instead of accepting a caller-supplied session owner.
drop function if exists public.delete_event_as_creator(uuid, text);
drop function if exists public.remove_event_member_as_creator(uuid, text, uuid);
drop function if exists public.create_event_temporary_invite(uuid, text);
drop function if exists public.clear_event_removed_member(uuid, text);

create or replace function public.delete_event_as_creator(p_event_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  deleted_count integer;
begin
  if (select auth.uid()) is null then
    return false;
  end if;

  delete from public.events
  where id = p_event_id
    and creator_auth_user_id = (select auth.uid());

  get diagnostics deleted_count = row_count;
  return deleted_count = 1;
end;
$$;

create or replace function public.remove_event_member_as_creator(
  p_event_id uuid,
  p_participant_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  deleted_count integer;
  removed_auth_user_id uuid;
begin
  if (select auth.uid()) is null then
    return false;
  end if;

  select p.auth_user_id
    into removed_auth_user_id
  from public.participants p
  join public.events e on e.id = p.event_id
  where p.id = p_participant_id
    and p.event_id = p_event_id
    and p.auth_user_id <> (select auth.uid())
    and e.creator_auth_user_id = (select auth.uid())
    and e.status = 'active';

  if removed_auth_user_id is null then
    return false;
  end if;

  update public.events
  set removed_session_ids = array_append(
    array_remove(removed_session_ids, removed_auth_user_id::text),
    removed_auth_user_id::text
  )
  where id = p_event_id
    and creator_auth_user_id = (select auth.uid());

  delete from public.participants
  where id = p_participant_id
    and event_id = p_event_id
    and auth_user_id <> (select auth.uid());

  get diagnostics deleted_count = row_count;
  return deleted_count = 1;
end;
$$;

create or replace function public.create_event_temporary_invite(p_event_id uuid)
returns table(token text, expires_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_token text;
  new_expires_at timestamptz;
begin
  if (select auth.uid()) is null then
    raise exception 'Authentication is required';
  end if;

  if not exists (
    select 1
    from public.events
    where id = p_event_id
      and creator_auth_user_id = (select auth.uid())
      and status = 'active'
  ) then
    raise exception 'Only the event creator can create a temporary invite';
  end if;

  new_token := md5(gen_random_uuid()::text || clock_timestamp()::text || random()::text);
  new_expires_at := now() + interval '5 minutes';

  insert into public.event_temporary_invites(event_id, token, expires_at)
  values (p_event_id, new_token, new_expires_at);

  return query select new_token, new_expires_at;
end;
$$;

create or replace function public.resolve_event_temporary_invite(p_token text)
returns table(event_id uuid, event_name text)
language sql
security definer
set search_path = ''
as $$
  select e.id, e.name
  from public.event_temporary_invites i
  join public.events e on e.id = i.event_id
  where i.token = trim(p_token)
    and i.revoked_at is null
    and i.expires_at > now()
    and e.status = 'active'
  limit 1;
$$;

create or replace function public.resolve_event_invite(p_invite_code text)
returns table(event_id uuid, event_name text)
language sql
security definer
set search_path = ''
as $$
  select e.id, e.name
  from public.events e
  where e.invite_code = upper(trim(p_invite_code))
    and e.status = 'active'
  limit 1;
$$;

create or replace function public.rejoin_event_with_temporary_invite(
  p_token text,
  p_display_name text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_event_id uuid;
  participant_id uuid;
  safe_name text;
begin
  if (select auth.uid()) is null then
    raise exception 'Authentication is required';
  end if;

  safe_name := left(trim(coalesce(p_display_name, '')), 120);
  if safe_name = '' then
    safe_name := 'Guest';
  end if;

  select i.event_id
    into target_event_id
  from public.event_temporary_invites i
  join public.events e on e.id = i.event_id
  where i.token = trim(p_token)
    and i.revoked_at is null
    and i.expires_at > now()
    and e.status = 'active'
    and (select auth.uid())::text = any(e.removed_session_ids)
  order by i.created_at desc
  limit 1;

  if target_event_id is null then
    raise exception 'This temporary invite is expired, invalid, or not valid for this member';
  end if;

  insert into public.participants(
    event_id,
    auth_user_id,
    session_id,
    display_name,
    joined_at,
    last_seen_at
  )
  values (
    target_event_id,
    (select auth.uid()),
    (select auth.uid())::text,
    safe_name,
    now(),
    now()
  )
  returning id into participant_id;

  update public.events
  set removed_session_ids = array_remove(
    removed_session_ids,
    (select auth.uid())::text
  )
  where id = target_event_id;

  return participant_id;
end;
$$;

-- One-time legacy-session migration helper. It is now also pinned to an
-- empty search_path and cannot be called by the unauthenticated role.
create or replace function public.claim_legacy_session(p_legacy_session_id text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  claimed boolean := false;
begin
  if (select auth.uid()) is null
     or p_legacy_session_id is null
     or length(trim(p_legacy_session_id)) = 0
     or p_legacy_session_id = (select auth.uid())::text then
    return false;
  end if;

  update public.events
  set
    creator_auth_user_id = (select auth.uid()),
    creator_session_id = (select auth.uid())::text
  where creator_session_id = p_legacy_session_id
    and creator_auth_user_id is null;

  if found then
    claimed := true;
  end if;

  update public.participants
  set
    auth_user_id = (select auth.uid()),
    session_id = (select auth.uid())::text
  where session_id = p_legacy_session_id
    and auth_user_id is null;

  if found then
    claimed := true;
  end if;

  return claimed;
end;
$$;

revoke all on function public.delete_event_as_creator(uuid) from public, anon;
revoke all on function public.remove_event_member_as_creator(uuid, uuid) from public, anon;
revoke all on function public.create_event_temporary_invite(uuid) from public, anon;
revoke all on function public.resolve_event_temporary_invite(text) from public, anon;
revoke all on function public.resolve_event_invite(text) from public, anon;
revoke all on function public.rejoin_event_with_temporary_invite(text, text) from public, anon;
revoke all on function public.claim_legacy_session(text) from public, anon;

grant execute on function public.delete_event_as_creator(uuid) to authenticated;
grant execute on function public.remove_event_member_as_creator(uuid, uuid) to authenticated;
grant execute on function public.create_event_temporary_invite(uuid) to authenticated;
grant execute on function public.resolve_event_temporary_invite(text) to authenticated;
grant execute on function public.resolve_event_invite(text) to authenticated;
grant execute on function public.rejoin_event_with_temporary_invite(text, text) to authenticated;
grant execute on function public.claim_legacy_session(text) to authenticated;

-- Protect identity columns on participant updates even though the app only
-- updates display_name/last_seen_at today.
create or replace function public.protect_participant_identity()
returns trigger
language plpgsql
as $$
begin
  if (select auth.uid()) is not null then
    if old.auth_user_id <> (select auth.uid())
       or new.auth_user_id <> old.auth_user_id
       or new.session_id <> old.session_id
       or new.event_id <> old.event_id
       or new.id <> old.id then
      raise exception 'Participant identity cannot be changed';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists protect_participant_identity on public.participants;
create trigger protect_participant_identity
before update on public.participants
for each row
execute function public.protect_participant_identity();

-- Storage policies. The photos bucket stays public for now because the
-- existing client consumes public_url values. Upload/delete metadata access
-- is nevertheless restricted to authenticated event members/owners.
drop policy if exists "public photo uploads" on storage.objects;
drop policy if exists "public photo reads" on storage.objects;
drop policy if exists "public photo deletes" on storage.objects;

create policy "Authenticated event members can upload photos"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'photos'
    and (storage.foldername(name))[1] is not null
    and exists (
      select 1
      from public.events e
      where e.id::text = (storage.foldername(name))[1]
        and e.status = 'active'
        and private.can_access_event(e.id)
    )
  );

create policy "Authenticated event members can read photo metadata"
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'photos'
    and private.can_access_photo_storage(name)
  );

create policy "Creators or uploaders can delete photo objects"
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'photos'
    and private.can_delete_photo_storage(name)
  );

-- The upload API returns inserted object metadata, so the matching SELECT
-- policy above is required for successful authenticated uploads.

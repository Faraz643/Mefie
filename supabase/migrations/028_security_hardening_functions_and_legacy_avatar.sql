-- Security hardening for server-owned identity fields, legacy avatar data,
-- photo deletion RPC exposure, and invite entropy.
create or replace function public.set_event_creator_auth_user()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (select auth.uid()) is not null then
    new.creator_auth_user_id := (select auth.uid());
    new.creator_session_id := ((select auth.uid())::text);
  end if;
  return new;
end;
$$;

create or replace function public.set_participant_auth_user()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (select auth.uid()) is not null then
    new.auth_user_id := (select auth.uid());
    new.session_id := ((select auth.uid())::text);
  end if;
  return new;
end;
$$;

create or replace function public.protect_participant_identity()
returns trigger
language plpgsql
set search_path = ''
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

revoke all on function public.delete_photos_as_authenticated_user(uuid[]) from public, anon;
grant execute on function public.delete_photos_as_authenticated_user(uuid[]) to authenticated;

drop policy if exists "avatar profiles insertable" on public.avatar_profiles;
drop policy if exists "avatar profiles readable" on public.avatar_profiles;
drop policy if exists "avatar profiles updateable" on public.avatar_profiles;
revoke all on public.avatar_profiles from public, anon, authenticated;

create or replace function public.create_event(p_name text, p_invite_code text)
returns table(id uuid, invite_code text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_event_id uuid;
  safe_name text;
  safe_code text;
begin
  if (select auth.uid()) is null then
    raise exception 'Authentication is required';
  end if;

  safe_name := left(trim(coalesce(p_name, '')), 120);
  if safe_name = '' then
    raise exception 'Event name is required';
  end if;

  loop
    safe_code := upper(encode(gen_random_bytes(6), 'hex'));
    exit when not exists (
      select 1 from public.events where invite_code = safe_code
    );
  end loop;

  insert into public.events(
    name,
    invite_code,
    creator_auth_user_id,
    creator_session_id,
    status
  )
  values (
    safe_name,
    safe_code,
    (select auth.uid()),
    (select auth.uid())::text,
    'active'
  )
  returning events.id, events.invite_code
  into new_event_id, safe_code;

  return query select new_event_id, safe_code;
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

  new_token := encode(gen_random_bytes(24), 'hex');
  new_expires_at := now() + interval '5 minutes';

  insert into public.event_temporary_invites(event_id, token, expires_at)
  values (p_event_id, new_token, new_expires_at);

  return query select new_token, new_expires_at;
end;
$$;

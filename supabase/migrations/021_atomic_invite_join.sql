-- Make invite joins race-safe by relying on the existing unique
-- (event_id, auth_user_id) index instead of a check-then-insert sequence.
-- The temporary invite remains a bearer link for five minutes; it is not
-- single-use because the product intentionally allows multiple guests to join.

create or replace function public.join_event_by_invite(
  p_invite_code text,
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

  select e.id
    into target_event_id
  from public.events e
  where e.invite_code = upper(trim(p_invite_code))
    and e.status = 'active'
  limit 1;

  if target_event_id is null then
    raise exception 'This invite is invalid or the event has ended';
  end if;

  if exists (
    select 1
    from public.events e
    where e.id = target_event_id
      and (select auth.uid())::text = any(e.removed_session_ids)
  ) then
    raise exception 'This member was removed; use a temporary invite to rejoin';
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
  on conflict (event_id, auth_user_id)
    where auth_user_id is not null
  do update set
    display_name = excluded.display_name,
    last_seen_at = excluded.last_seen_at
  returning id into participant_id;

  return participant_id;
end;
$$;

revoke all on function public.join_event_by_invite(text, text) from public, anon;
grant execute on function public.join_event_by_invite(text, text) to authenticated;


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
  order by i.created_at desc
  limit 1;

  if target_event_id is null then
    raise exception 'This temporary invite is expired or invalid';
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
  on conflict (event_id, auth_user_id)
    where auth_user_id is not null
  do update set
    display_name = excluded.display_name,
    last_seen_at = excluded.last_seen_at
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

revoke all on function public.rejoin_event_with_temporary_invite(text, text) from public, anon;
grant execute on function public.rejoin_event_with_temporary_invite(text, text) to authenticated;

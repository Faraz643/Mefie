-- Temporary invites are bearer links intended to let any authenticated
-- Mefie user join an active event for five minutes. If the user was removed,
-- successful rejoin also clears that removal marker atomically.

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

  select p.id
    into participant_id
  from public.participants p
  where p.event_id = target_event_id
    and p.auth_user_id = (select auth.uid())
  limit 1;

  if participant_id is null then
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
  else
    update public.participants
    set
      display_name = safe_name,
      last_seen_at = now()
    where id = participant_id;
  end if;

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

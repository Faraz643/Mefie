-- Join authorization is invite-based for non-creators. The event UUID is not
-- treated as a join credential anymore; only the creator may insert a
-- participant directly. Normal members join through this authenticated RPC
-- using the event invite code.

drop policy if exists "Authenticated users can join active events"
  on public.participants;

create policy "Event creators can create their own membership"
  on public.participants
  for insert
  to authenticated
  with check (
    auth_user_id = (select auth.uid())
    and session_id = (select auth.uid())::text
    and exists (
      select 1
      from public.events e
      where e.id = event_id
        and e.creator_auth_user_id = (select auth.uid())
        and e.status = 'active'
    )
  );

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

  return participant_id;
end;
$$;

revoke all on function public.join_event_by_invite(text, text) from public, anon;
grant execute on function public.join_event_by_invite(text, text) to authenticated;

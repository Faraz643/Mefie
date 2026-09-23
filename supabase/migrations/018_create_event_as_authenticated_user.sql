-- Create events through a server-side function so ownership is derived
-- from the authenticated Supabase identity, never from client input.
create or replace function public.create_event(
  p_name text,
  p_invite_code text
)
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
  safe_code := upper(trim(coalesce(p_invite_code, '')));

  if safe_name = '' then
    raise exception 'Event name is required';
  end if;
  if safe_code = '' then
    raise exception 'Invite code is required';
  end if;

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

revoke all on function public.create_event(text, text) from public, anon;
grant execute on function public.create_event(text, text) to authenticated;

-- Fix for databases where migration 008 was already applied.
-- Uses built-in gen_random_uuid() instead of gen_random_bytes(), which may not be available.
create or replace function public.create_event_temporary_invite(
  p_event_id uuid,
  p_creator_session_id text
)
returns table(token text, expires_at timestamptz)
language plpgsql
security definer
set search_path = public
as $$
declare
  new_token text;
  new_expires_at timestamptz;
begin
  if p_creator_session_id is null or length(trim(p_creator_session_id)) = 0 then
    raise exception 'Creator session is required';
  end if;

  if not exists (
    select 1
    from public.events
    where id = p_event_id
      and creator_session_id = p_creator_session_id
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

grant execute on function public.create_event_temporary_invite(uuid, text)
  to anon, authenticated;

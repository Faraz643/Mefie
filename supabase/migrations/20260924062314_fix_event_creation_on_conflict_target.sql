-- PL/pgSQL RETURNS TABLE creates an output variable named invite_code.
-- Use the named unique constraint in ON CONFLICT so the conflict target cannot
-- be confused with that output variable.

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
    safe_code := upper(encode(extensions.gen_random_bytes(6), 'hex'));

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
    on conflict on constraint events_invite_code_key do nothing
    returning events.id, events.invite_code
    into new_event_id, safe_code;

    exit when new_event_id is not null;
  end loop;

  return query select new_event_id, safe_code;
end;
$$;

revoke all on function public.create_event(text, text) from public, anon;
grant execute on function public.create_event(text, text) to authenticated;

-- Harden event creation against invite-code races and nullable legacy identity values.

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

  -- The client argument remains for backwards compatibility; the server
  -- always generates the invite code.
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
    on conflict (invite_code) do nothing
    returning events.id, events.invite_code
    into new_event_id, safe_code;

    exit when new_event_id is not null;
  end loop;

  return query select new_event_id, safe_code;
end;
$$;

revoke all on function public.create_event(text, text) from public, anon;
grant execute on function public.create_event(text, text) to authenticated;

create or replace function public.protect_participant_identity()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (select auth.uid()) is not null then
    if old.auth_user_id is distinct from (select auth.uid())
       or new.auth_user_id is distinct from old.auth_user_id
       or new.session_id is distinct from old.session_id
       or new.event_id is distinct from old.event_id
       or new.id is distinct from old.id
       or new.user_id is distinct from old.user_id
       or new.joined_at is distinct from old.joined_at then
      raise exception 'Participant identity cannot be changed';
    end if;
  end if;
  return new;
end;
$$;

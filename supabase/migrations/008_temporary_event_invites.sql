create table if not exists public.event_temporary_invites (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  token text not null unique,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  revoked_at timestamptz
);

create index if not exists idx_event_temporary_invites_token
  on public.event_temporary_invites(token);

create index if not exists idx_event_temporary_invites_event
  on public.event_temporary_invites(event_id, created_at desc);

alter table public.event_temporary_invites enable row level security;

create policy "temporary invites readable by token"
  on public.event_temporary_invites
  for select
  using (revoked_at is null and expires_at > now());

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

  new_token := encode(gen_random_bytes(18), 'base64');
  new_token := replace(replace(replace(replace(new_token, '+', '-'), '/', '_'), '=', ''), E'\\n', '');
  new_expires_at := now() + interval '5 minutes';

  insert into public.event_temporary_invites(event_id, token, expires_at)
  values (p_event_id, new_token, new_expires_at);

  return query select new_token, new_expires_at;
end;
$$;

grant execute on function public.create_event_temporary_invite(uuid, text)
  to anon, authenticated;

create or replace function public.clear_event_removed_member(
  p_event_id uuid,
  p_session_id text
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  changed boolean := false;
begin
  update public.events
  set removed_session_ids = array_remove(removed_session_ids, p_session_id)
  where id = p_event_id
    and p_session_id = any(removed_session_ids);

  if found then
    changed := true;
  end if;

  return changed;
end;
$$;

grant execute on function public.clear_event_removed_member(uuid, text)
  to anon, authenticated;

create or replace function public.resolve_event_temporary_invite(
  p_token text
)
returns table(event_id uuid, event_name text)
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  select e.id, e.name
  from public.event_temporary_invites i
  join public.events e on e.id = i.event_id
  where i.token = p_token
    and i.revoked_at is null
    and i.expires_at > now()
    and e.status = 'active'
  limit 1;
end;
$$;

grant execute on function public.resolve_event_temporary_invite(text)
  to anon, authenticated;

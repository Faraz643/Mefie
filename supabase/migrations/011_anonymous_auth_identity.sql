-- Supabase Anonymous Auth foundation.
-- Anonymous users are real authenticated Supabase users; the app keeps the
-- existing session_id columns for compatibility while moving them to auth.uid().
alter table public.events
  add column if not exists creator_auth_user_id uuid references auth.users(id) on delete set null;

alter table public.participants
  add column if not exists auth_user_id uuid references auth.users(id) on delete set null;

create index if not exists idx_events_creator_auth_user
  on public.events(creator_auth_user_id);

create index if not exists idx_participants_auth_user
  on public.participants(auth_user_id);

create unique index if not exists idx_participants_event_auth_user
  on public.participants(event_id, auth_user_id)
  where auth_user_id is not null;

-- One-time migration helper for devices that already have a Mefie session ID.
-- The client can prove continuity by presenting the session ID already stored
-- on that device. New identities immediately use auth.uid() going forward.
create or replace function public.claim_legacy_session(
  p_legacy_session_id text
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  claimed boolean := false;
begin
  if auth.uid() is null
     or p_legacy_session_id is null
     or length(trim(p_legacy_session_id)) = 0
     or p_legacy_session_id = auth.uid()::text then
    return false;
  end if;

  update public.events
  set
    creator_auth_user_id = auth.uid(),
    creator_session_id = auth.uid()::text
  where creator_session_id = p_legacy_session_id
    and creator_auth_user_id is null;

  if found then
    claimed := true;
  end if;

  update public.participants
  set
    auth_user_id = auth.uid(),
    session_id = auth.uid()::text
  where session_id = p_legacy_session_id
    and auth_user_id is null;

  if found then
    claimed := true;
  end if;

  return claimed;
end;
$$;

grant execute on function public.claim_legacy_session(text)
  to authenticated;

-- New rows must be tied to the authenticated Supabase identity.
create or replace function public.set_event_creator_auth_user()
returns trigger
language plpgsql
as $$
begin
  if auth.uid() is not null then
    new.creator_auth_user_id := auth.uid();
    new.creator_session_id := auth.uid()::text;
  end if;
  return new;
end;
$$;

drop trigger if exists set_event_creator_auth_user on public.events;
create trigger set_event_creator_auth_user
before insert on public.events
for each row
execute function public.set_event_creator_auth_user();

create or replace function public.set_participant_auth_user()
returns trigger
language plpgsql
as $$
begin
  if auth.uid() is not null then
    new.auth_user_id := auth.uid();
    new.session_id := auth.uid()::text;
  end if;
  return new;
end;
$$;

drop trigger if exists set_participant_auth_user on public.participants;
create trigger set_participant_auth_user
before insert on public.participants
for each row
execute function public.set_participant_auth_user();

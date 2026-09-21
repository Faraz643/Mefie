alter table public.events
  add column if not exists creator_session_id text;

create index if not exists idx_events_creator_session
  on public.events(creator_session_id);

create or replace function public.delete_event_as_creator(
  p_event_id uuid,
  p_creator_session_id text
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  deleted_count integer;
begin
  if p_creator_session_id is null or length(trim(p_creator_session_id)) = 0 then
    return false;
  end if;

  delete from public.events
  where id = p_event_id
    and creator_session_id = p_creator_session_id;

  get diagnostics deleted_count = row_count;
  return deleted_count = 1;
end;
$$;

grant execute on function public.delete_event_as_creator(uuid, text) to anon, authenticated;

create or replace function public.remove_event_member_as_creator(
  p_event_id uuid,
  p_creator_session_id text,
  p_participant_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  deleted_count integer;
begin
  if p_creator_session_id is null or length(trim(p_creator_session_id)) = 0 then
    return false;
  end if;

  delete from public.participants
  where id = p_participant_id
    and event_id = p_event_id
    and session_id <> p_creator_session_id
    and exists (
      select 1
      from public.events e
      where e.id = p_event_id
        and e.creator_session_id = p_creator_session_id
    );

  get diagnostics deleted_count = row_count;
  return deleted_count = 1;
end;
$$;

grant execute on function public.remove_event_member_as_creator(uuid, text, uuid) to anon, authenticated;

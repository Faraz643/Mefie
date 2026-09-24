-- Allow a participant to leave an event without deleting the event or photos.
-- The creator cannot use this path; creators must delete the event instead.
create or replace function public.leave_event(p_event_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  deleted_participant_id uuid;
begin
  if (select auth.uid()) is null then
    raise exception 'Authentication is required';
  end if;

  if exists (
    select 1
    from public.events
    where id = p_event_id
      and creator_auth_user_id = (select auth.uid())
      and status = 'active'
  ) then
    raise exception 'The event creator cannot leave the event. Delete the event instead.';
  end if;

  delete from public.participants
  where event_id = p_event_id
    and auth_user_id = (select auth.uid())
  returning id into deleted_participant_id;

  return deleted_participant_id is not null;
end;
$$;

revoke all on function public.leave_event(uuid) from public;
grant execute on function public.leave_event(uuid) to authenticated;

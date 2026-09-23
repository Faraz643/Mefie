-- Secure deletion hardening.
-- Deletion must remain possible after an event is marked inactive so a storage
-- cleanup that races with event state changes cannot leave an undeletable DB row.

create or replace function private.can_delete_photo(p_photo_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.photos ph
    join public.events e on e.id = ph.event_id
    left join public.participants p on p.id = ph.participant_id
    where ph.id = p_photo_id
      and (
        e.creator_auth_user_id = (select auth.uid())
        or p.auth_user_id = (select auth.uid())
      )
  );
$$;

revoke all on function private.can_delete_photo(uuid) from public;
grant execute on function private.can_delete_photo(uuid) to authenticated;


-- Tighten photo insert authorization to explicitly bind the participant
-- to the same event as the photo row.
drop policy if exists "Event members can upload their own photos" on public.photos;

create policy "Event members can upload their own photos"
  on public.photos
  for insert
  to authenticated
  with check (
    (select private.can_access_event(event_id))
    and exists (
      select 1
      from public.participants p
      where p.id = participant_id
        and p.event_id = public.photos.event_id
        and p.auth_user_id = (select auth.uid())
    )
  );

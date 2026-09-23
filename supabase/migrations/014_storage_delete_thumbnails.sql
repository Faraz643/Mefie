-- Allow creator/uploader cleanup of both original and thumbnail objects.
create or replace function private.can_delete_photo_storage(p_storage_path text)
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
    where (ph.storage_path = p_storage_path or ph.thumbnail_path = p_storage_path)
      and (
        e.creator_auth_user_id = (select auth.uid())
        or p.auth_user_id = (select auth.uid())
      )
  );
$$;

revoke all on function private.can_delete_photo_storage(text) from public;
grant execute on function private.can_delete_photo_storage(text) to authenticated;

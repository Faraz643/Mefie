-- Enforce photo deletion authorization at the database boundary.
-- The event creator may delete any event photo. A participant may delete
-- only photos whose participant row belongs to the authenticated user.
create or replace function public.delete_photos_as_authenticated_user(p_photo_ids uuid[])
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  deleted_count integer := 0;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  if p_photo_ids is null or cardinality(p_photo_ids) = 0 then
    return 0;
  end if;

  delete from public.photos ph
  where ph.id = any(p_photo_ids)
    and exists (
      select 1
      from public.events e
      left join public.participants p on p.id = ph.participant_id
      where e.id = ph.event_id
        and (
          e.creator_auth_user_id = auth.uid()
          or p.auth_user_id = auth.uid()
        )
    );

  get diagnostics deleted_count = row_count;
  return deleted_count;
end;
$$;

revoke all on function public.delete_photos_as_authenticated_user(uuid[]) from public;
grant execute on function public.delete_photos_as_authenticated_user(uuid[]) to authenticated;

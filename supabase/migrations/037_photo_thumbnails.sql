-- Store and authorize the generated gallery thumbnail for each photo.
-- The original photo remains the source of truth; thumbnails are display-only.

create or replace function public.set_photo_thumbnail(
  p_photo_id uuid,
  p_thumbnail_path text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid;
  photo_event_id uuid;
  photo_client_upload_id uuid;
begin
  current_user_id := (select auth.uid());
  if current_user_id is null then
    raise exception 'Authentication required';
  end if;

  if p_photo_id is null or p_thumbnail_path is null or p_thumbnail_path = '' then
    raise exception 'Invalid thumbnail metadata';
  end if;

  select ph.event_id, ph.client_upload_id
    into photo_event_id, photo_client_upload_id
  from public.photos ph
  left join public.participants p on p.id = ph.participant_id
  join public.events e on e.id = ph.event_id
  where ph.id = p_photo_id
    and e.status = 'active'
    and (
      e.creator_auth_user_id = current_user_id
      or p.auth_user_id = current_user_id
    );

  if photo_event_id is null or photo_client_upload_id is null then
    raise exception 'Photo is not accessible to this user';
  end if;

  if p_thumbnail_path <> photo_event_id::text || '/' || photo_client_upload_id::text || '.thumb.jpg' then
    raise exception 'Invalid thumbnail storage path';
  end if;

  if not exists (
    select 1
    from storage.objects o
    where o.bucket_id = 'photos'
      and o.name = p_thumbnail_path
      and o.owner_id = current_user_id::text
  ) then
    raise exception 'Uploaded thumbnail object was not found or is not owned by this user';
  end if;

  update public.photos
  set thumbnail_path = p_thumbnail_path
  where id = p_photo_id;

  return found;
end;
$$;

revoke all on function public.set_photo_thumbnail(uuid,text) from public, anon;
grant execute on function public.set_photo_thumbnail(uuid,text) to authenticated;

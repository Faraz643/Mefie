-- Finalize a Storage upload and its metadata atomically from the client's
-- perspective, without granting direct photo-row INSERT/UPDATE privileges.
create or replace function public.finalize_photo_upload(
  p_client_upload_id uuid,
  p_event_id uuid,
  p_participant_id uuid,
  p_storage_path text,
  p_original_filename text,
  p_file_size bigint,
  p_width integer,
  p_height integer
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid;
  photo_id uuid;
begin
  current_user_id := (select auth.uid());
  if current_user_id is null then
    raise exception 'Authentication required';
  end if;

  if p_client_upload_id is null
     or p_event_id is null
     or p_participant_id is null
     or p_storage_path is null
     or p_file_size is null
     or p_file_size <= 0
     or p_file_size > 15728640
     or p_width is null
     or p_height is null
     or p_width <= 0
     or p_height <= 0 then
    raise exception 'Invalid photo metadata';
  end if;

  if p_storage_path <> p_event_id::text || '/' || p_client_upload_id::text || '.jpg' then
    raise exception 'Invalid photo storage path';
  end if;

  if not exists (
    select 1
    from public.participants p
    join public.events e on e.id = p.event_id
    where p.id = p_participant_id
      and p.event_id = p_event_id
      and p.auth_user_id = current_user_id
      and e.status = 'active'
  ) then
    raise exception 'Event membership is invalid';
  end if;

  if not exists (
    select 1
    from storage.objects o
    where o.bucket_id = 'photos'
      and o.name = p_storage_path
      and o.owner_id = current_user_id::text
  ) then
    raise exception 'Uploaded photo object was not found or is not owned by this user';
  end if;

  insert into public.photos(
    client_upload_id,
    event_id,
    participant_id,
    storage_path,
    original_filename,
    file_size,
    width,
    height,
    public_url
  )
  values (
    p_client_upload_id,
    p_event_id,
    p_participant_id,
    p_storage_path,
    left(coalesce(p_original_filename, ''), 255),
    p_file_size,
    p_width,
    p_height,
    null
  )
  on conflict (client_upload_id) do nothing;

  select ph.id
    into photo_id
  from public.photos ph
  where ph.client_upload_id = p_client_upload_id
    and ph.event_id = p_event_id
    and ph.participant_id = p_participant_id;

  if photo_id is null then
    raise exception 'Photo upload identifier is already associated with another event or member';
  end if;

  return photo_id;
end;
$$;

revoke all on function public.finalize_photo_upload(uuid,uuid,uuid,text,text,bigint,integer,integer) from public, anon;
grant execute on function public.finalize_photo_upload(uuid,uuid,uuid,text,text,bigint,integer,integer) to authenticated;

revoke insert on table public.photos from authenticated;

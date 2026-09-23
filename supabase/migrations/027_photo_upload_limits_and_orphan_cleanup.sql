-- Keep photo uploads bounded and allow the authenticated uploader to
-- clean up a Storage object if a previous upload reached Storage but the
-- corresponding public.photos row could not be finalized.
update storage.buckets
set file_size_limit = 15728640,
    allowed_mime_types = array['image/jpeg']::text[]
where id = 'photos';

drop policy if exists "Creators or uploaders can delete photo objects" on storage.objects;

create policy "Creators or uploaders can delete photo objects"
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'photos'
    and (
      private.can_delete_photo_storage(name)
      or owner_id = (select auth.uid()::text)
    )
  );

-- Make the photo upload pipeline safe to apply even when an older
-- database was provisioned without the idempotency/storage pieces.

alter table public.photos
  add column if not exists client_upload_id uuid;

drop index if exists public.idx_photos_client_upload_id;
create unique index idx_photos_client_upload_id
  on public.photos(client_upload_id);

insert into storage.buckets (id, name, public)
values ('photos', 'photos', true)
on conflict (id) do update set public = true;

-- Re-assert the authenticated photo storage surface. These policies are
-- intentionally idempotent so a database that already has 012/013 remains
-- unchanged in behavior.
drop policy if exists "Authenticated event members can upload photos" on storage.objects;
drop policy if exists "Authenticated event members can read photo metadata" on storage.objects;
drop policy if exists "Creators or uploaders can delete photo objects" on storage.objects;

create policy "Authenticated event members can upload photos"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'photos'
    and (storage.foldername(name))[1] is not null
    and exists (
      select 1
      from public.events e
      where e.id::text = (storage.foldername(name))[1]
        and e.status = 'active'
        and private.can_access_event(e.id)
    )
  );

create policy "Authenticated event members can read photo metadata"
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'photos'
    and (
      private.can_access_photo_storage(name)
      or exists (
        select 1
        from public.events e
        where e.id::text = (storage.foldername(name))[1]
          and e.status = 'active'
          and private.can_access_event(e.id)
      )
    )
  );

create policy "Creators or uploaders can delete photo objects"
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'photos'
    and private.can_delete_photo_storage(name)
  );

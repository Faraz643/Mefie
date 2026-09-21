alter table public.photos
  add column if not exists client_upload_id uuid;

create unique index if not exists idx_photos_client_upload_id
  on public.photos(client_upload_id);

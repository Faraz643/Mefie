alter table public.participants
  add column if not exists avatar_url text;

create policy "public avatar deletes" on storage.objects
  for delete to public using (bucket_id = 'photos' and (name like 'avatars/%'));

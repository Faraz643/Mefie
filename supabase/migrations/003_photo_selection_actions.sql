create policy "photos deletable" on public.photos
  for delete to public using (true);

create policy "public photo deletes" on storage.objects
  for delete to public using (bucket_id = 'photos');

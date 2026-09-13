insert into storage.buckets (id, name, public)
values ('photos', 'photos', true)
on conflict (id) do update set public = true;

drop policy if exists "public photo uploads" on storage.objects;
drop policy if exists "public photo reads" on storage.objects;
create policy "public photo uploads" on storage.objects for insert to public with check (bucket_id = 'photos');
create policy "public photo reads" on storage.objects for select to public using (bucket_id = 'photos');

drop policy if exists "participants updateable" on public.participants;
create policy "participants updateable" on public.participants for update using (true) with check (true);

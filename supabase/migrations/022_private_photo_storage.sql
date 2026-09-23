-- Make event photos private. Access is granted only through authenticated
-- Storage RLS and time-limited signed URLs.

insert into storage.buckets (id, name, public)
values ('photos', 'photos', false)
on conflict (id) do update set public = false;

drop policy if exists "Public can view photos" on storage.objects;
drop policy if exists "public can read photos" on storage.objects;
drop policy if exists "Anyone can view photos" on storage.objects;
drop policy if exists "Public photo access" on storage.objects;

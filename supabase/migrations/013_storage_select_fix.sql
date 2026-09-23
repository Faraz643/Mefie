-- Fix storage upload response authorization.
-- Supabase Storage performs an INSERT followed by a metadata SELECT. At that
-- moment the public.photos row does not exist yet, so SELECT must authorize
-- by event membership/path rather than by the photo metadata row.

drop policy if exists "Authenticated event members can read photo metadata"
  on storage.objects;

create policy "Authenticated event members can read photo metadata"
  on storage.objects
  for select
  to authenticated
  using (
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

-- Remove a legacy public policy that targeted the photos bucket.
-- The bucket now contains event photos only; avatar objects are not used here.

drop policy if exists "avatar reads" on storage.objects;

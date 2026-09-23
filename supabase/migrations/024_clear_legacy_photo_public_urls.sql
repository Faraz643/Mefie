-- public_url is no longer a source of truth now that the photos bucket is private.
update public.photos
set public_url = null
where public_url is not null;

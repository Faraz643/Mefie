-- Least-privilege Data API grants. RLS policies are not a substitute for
-- operation privileges: TRUNCATE, REFERENCES and TRIGGER are not constrained
-- by ordinary row-level policies.
revoke all on table public.events from authenticated;
grant select on table public.events to authenticated;

revoke all on table public.participants from authenticated;
grant select, insert, update on table public.participants to authenticated;

revoke all on table public.photos from authenticated;
grant select, insert on table public.photos to authenticated;

revoke all on table storage.objects from authenticated;
grant select, insert, delete on table storage.objects to authenticated;

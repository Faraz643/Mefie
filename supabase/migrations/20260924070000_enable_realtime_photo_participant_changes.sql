-- Keep DELETE payloads complete and ensure gallery/member changes reach all clients in realtime.
alter table public.photos replica identity full;
alter table public.participants replica identity full;

do $$
begin
  alter publication supabase_realtime add table public.photos;
exception when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.participants;
exception when duplicate_object then null;
end $$;

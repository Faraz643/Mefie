create table if not exists public.photo_cleanup_runs (
  event_id uuid primary key references public.events(id) on delete cascade,
  last_run_at timestamptz not null default now(),
  last_scanned_count integer not null default 0,
  last_deleted_count integer not null default 0,
  updated_at timestamptz not null default now()
);

alter table public.photo_cleanup_runs enable row level security;

revoke all on table public.photo_cleanup_runs from public, anon, authenticated;
grant select, insert, update on table public.photo_cleanup_runs to service_role;

create or replace function public.list_photo_storage_objects(p_prefix text)
returns table (
  name text,
  created_at timestamptz,
  updated_at timestamptz,
  metadata jsonb
)
language sql
security definer
set search_path = ''
stable
as $$
  select o.name, o.created_at, o.updated_at, o.metadata
  from storage.objects o
  where o.bucket_id = 'photos'
    and o.name like p_prefix || '%'
  order by o.name asc;
$$;

revoke all on function public.list_photo_storage_objects(text) from public, anon, authenticated;
grant execute on function public.list_photo_storage_objects(text) to service_role;

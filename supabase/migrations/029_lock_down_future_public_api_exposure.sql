-- New public-schema objects should not become reachable through the
-- Supabase Data API by default. Each exposed table/function must receive
-- an explicit least-privilege grant in its migration.
alter default privileges for role postgres in schema public
  revoke select, insert, update, delete on tables from anon, authenticated, service_role;

alter default privileges for role postgres in schema public
  revoke usage, select on sequences from anon, authenticated, service_role;

alter default privileges for role postgres in schema public
  revoke execute on functions from anon, authenticated, service_role;

alter default privileges for role postgres in schema public
  revoke execute on functions from public;

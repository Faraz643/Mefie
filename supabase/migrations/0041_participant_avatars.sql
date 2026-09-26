-- Participant avatar metadata/storage fields.
-- This migration was originally numbered 004; it uses 0041 to preserve
-- its position after 004_avatar_profiles without colliding on migration version.

alter table public.participants
  add column if not exists avatar_url text;

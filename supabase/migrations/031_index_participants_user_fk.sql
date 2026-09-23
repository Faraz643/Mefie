-- Cover the legacy participants.user_id foreign key so deletes/updates on
-- the referenced user relation do not require an unindexed scan.
create index if not exists idx_participants_user_id
  on public.participants(user_id);

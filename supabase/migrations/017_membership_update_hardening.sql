-- Prevent membership heartbeats/profile edits after an event is no longer active.
drop policy if exists "Authenticated users can update their own membership"
  on public.participants;

create policy "Authenticated users can update their active membership"
  on public.participants
  for update
  to authenticated
  using (
    auth_user_id = (select auth.uid())
    and private.can_access_event(event_id)
  )
  with check (
    auth_user_id = (select auth.uid())
    and session_id = (select auth.uid())::text
  );

-- Correct the nullable legacy user_id comparison with IS DISTINCT FROM.
create or replace function public.protect_participant_identity()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (select auth.uid()) is not null then
    if old.auth_user_id <> (select auth.uid())
       or new.auth_user_id <> old.auth_user_id
       or new.session_id <> old.session_id
       or new.event_id <> old.event_id
       or new.id <> old.id
       or new.user_id is distinct from old.user_id
       or new.joined_at <> old.joined_at then
      raise exception 'Participant identity cannot be changed';
    end if;
  end if;
  return new;
end;
$$;

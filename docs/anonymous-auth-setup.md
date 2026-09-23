# Supabase Anonymous Auth setup

Mefie now establishes a Supabase Anonymous Auth user silently on app startup. No email, password, Google, Apple, or other sign-in UI is required.

## One dashboard setting

In the Supabase Dashboard:

1. Open **Authentication → Sign In / Providers**.
2. Enable **Anonymous Sign-Ins**.
3. Save.

Supabase anonymous users use the normal `authenticated` database role and receive a stable user UUID/session while the app's persisted auth session remains available.

## Database migration

Apply migrations through migration 011:

`supabase/migrations/011_anonymous_auth_identity.sql`

It adds authenticated identity columns and migrates an existing Mefie local session to the new anonymous auth identity once, so existing installs can retain their event ownership/membership.

## Local install

After pulling the change:

```powershell
npm install
npx expo start --dev-client --localhost --clear
```

A native rebuild is not normally required for Supabase Auth itself; `react-native-url-polyfill` is a JavaScript dependency.

## Abuse protection before public launch

Supabase recommends CAPTCHA/Turnstile protection for anonymous sign-ins on a public app. Configure that separately before broad public distribution.

## Production RLS hardening

Mefie now uses Supabase Auth identity (`auth.uid()`) as the authorization boundary.

Applied migrations:
- `012_rls_hardening.sql` — replaces permissive public table policies with authenticated, event-member/creator policies; locks legacy profile/user tables; hardens creator/temporary-invite functions; protects participant identity fields; restricts photo storage writes/deletes.
- `013_storage_select_fix.sql` — keeps authenticated photo uploads compatible with Storage's metadata response and removes the disabled avatar upload/update/delete surface.
- `014_storage_delete_thumbnails.sql` — keeps creator/uploader storage cleanup compatible with optional thumbnail objects.
- `015_temporary_invite_bearer_join.sql` — makes five-minute temporary invites atomic bearer links; removed members are re-admitted and their removal marker is cleared.
- `016_invite_only_event_join.sql` — makes the invite code the authorization boundary for new members; an event UUID alone can no longer be used to create membership.
- `017_membership_update_hardening.sql` — blocks membership updates once an event is no longer active.

Important behavior:
- Event invite-code lookup is handled by `resolve_event_invite`; the app no longer reads every active event.
- Only authenticated event members can read an event's participants/photos.
- A participant can only update their own membership row.
- A photo can only be deleted by its uploader or the event creator.
- Creator/member mutations derive identity from `auth.uid()`; client-supplied creator session IDs are no longer trusted.
- Temporary rejoin is an atomic database operation bound to the authenticated user and the temporary invite token.

### Verification

After applying the migrations, run:

```sql
select
  id,
  role,
  is_anonymous,
  email,
  created_at
from auth.users
order by created_at desc;
```

For the app's current anonymous user, expect `role = authenticated`, `is_anonymous = true`, and a null email.

Then verify the policy surface:

```sql
select
  schemaname,
  tablename,
  policyname,
  cmd,
  roles
from pg_policies
where schemaname = 'public'
  and tablename in ('events','participants','photos','event_temporary_invites','profiles','users')
order by tablename, policyname;
```

The three active app tables should show only authenticated policies from migration 012; temporary invites, profiles, and the legacy users table intentionally have no client policies.

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

# Mefie automated security and flow tests

Mefie has two layers of regression protection.

1. Static security tests run on every push and pull request. They inspect committed Supabase migrations for RLS, authenticated-only grants, SECURITY DEFINER search-path pinning, atomic invite joins, participant identity protection, direct photo-insert prevention, and service-role-only orphan cleanup.
2. Live Supabase integration tests exercise the real Auth/RLS/RPC boundary with anonymous users. They create isolated test events, verify event isolation, invite resolution/join behavior, idempotent joins, participant identity protection, direct photo-row rejection, creator/member authorization, removal/rejoin behavior, and invalid-invite rejection. Test data is tagged and cleaned up using the creator's authenticated test session.

## Local run

Static tests need no credentials:

    npm run test:security:static

Live tests require an explicit safety switch and the test project credentials:

    MEFIE_SECURITY_TESTS=1 SUPABASE_URL=... SUPABASE_ANON_KEY=... npm run test:security:integration

The explicit switch prevents accidentally running destructive integration tests against the wrong Supabase project.

## GitHub Actions

.github/workflows/security.yml runs automatically on pushes to main/benchmark/**, pull requests, and manual dispatch.

Static tests always run. Live tests run automatically once these GitHub Actions repository secrets exist:

- SUPABASE_URL
- SUPABASE_ANON_KEY

No privileged service-role key is needed by the test suite. Until the two secrets are configured, the live job reports a warning and skips the integration portion rather than failing every build.

For production, point these secrets at a dedicated Supabase test/staging project when one exists. Do not use a developer personal session or a long-lived service key in source code.

## What this protects

These tests focus on security boundaries rather than UI snapshots. A future change that accidentally removes RLS, exposes a privileged RPC to anon, re-enables direct photo insertion, weakens participant identity protection, or breaks invite/member isolation will fail CI before the change should be released.

The live suite creates only temporary events with a unique MEFIE_TEST_ prefix and deletes them in cleanup. It does not use existing events or photos.

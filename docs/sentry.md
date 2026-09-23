# Sentry crash reporting

Mefie uses `@sentry/react-native` for JavaScript errors and native Android/iOS crashes. The SDK is privacy-hardened: default PII is disabled and auth tokens, signed URLs, invite tokens, and similar secrets are scrubbed before events are sent.

## One-time Sentry setup

Create a Sentry React Native project and copy these values:

- DSN
- organization slug
- project slug
- organization auth token with the minimum permissions needed for source-map/release upload

Set them locally in `.env.local`:

```
EXPO_PUBLIC_SENTRY_DSN=...
EXPO_PUBLIC_APP_ENV=development
SENTRY_ORG=...
SENTRY_PROJECT=...
SENTRY_AUTH_TOKEN=...
```

Never commit `SENTRY_AUTH_TOKEN`. For EAS builds, add the same values to the EAS environment used by the build; keep the auth token secret.

## Install

After pulling this change, run:

```
npm install
```

This updates `package-lock.json` with `@sentry/react-native@8.27.0`.

## Development

Sentry stays disabled when `EXPO_PUBLIC_SENTRY_DSN` is absent, so local development does not fail just because monitoring has not been configured yet.

With a DSN configured, use a development build rather than Expo Go because Sentry native crash capture requires native code.

## Production/preview

Set:

```
EXPO_PUBLIC_SENTRY_DSN=...
EXPO_PUBLIC_APP_ENV=production
SENTRY_ORG=...
SENTRY_PROJECT=...
SENTRY_AUTH_TOKEN=...
```

Then build normally with EAS. The Expo config plugin and Sentry Metro configuration handle release/source-map integration when the auth token is present. If the auth token is absent, automatic source-map upload is disabled instead of making the build fail.

## Privacy rules

Do not add photo contents, signed photo URLs, invite links/tokens, Supabase access/refresh tokens, passwords, or unnecessary personal data to Sentry contexts. The runtime scrubber also removes common credential fields and URL query strings before events are sent.

## Verification

1. Install a fresh development/preview build.
2. Trigger a controlled JavaScript exception and verify it appears in the Sentry project.
3. Verify the event has the expected environment and readable source frames.
4. Test a handled photo-upload failure; startup queue failures are captured automatically.
5. Test an actual native crash only on a non-production test build/device.
6. Confirm no access/refresh tokens, signed URLs, invite tokens, or photo data appear in the event payload.

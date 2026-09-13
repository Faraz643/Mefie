# Mefie

Premium real-time shared-camera/photo-sharing mobile app for Android and iOS.

## Stack

- Expo + React Native + TypeScript
- Expo Router
- Supabase (Postgres, Storage, Realtime)
- EAS Build

## V1 core flow

Create event → Share link/QR → Join by link/code/QR/deep link → Capture or choose a photo → Upload to shared storage → Realtime gallery → People list → Open/share/save photos

## Supabase setup

Run `supabase/migrations/001_initial.sql` once for the base schema. Then run `supabase/migrations/002_v1_storage.sql` once to create the public `photos` storage bucket and upload/read policies.

The app expects:

- `EXPO_PUBLIC_SUPABASE_URL`
- `EXPO_PUBLIC_SUPABASE_ANON_KEY`
- `EAS_PROJECT_ID` (for EAS builds)

## Development

For JavaScript/UI changes:

```bash
git pull
npm install
npx expo start
```

A native rebuild is only required when Expo native dependencies, permissions, or config plugins change:

```bash
npx expo prebuild --clean --platform android
npx expo run:android
```

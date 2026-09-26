import "../lib/sentry";
import { SentryErrorBoundary } from "../components/SentryErrorBoundary";
import { Stack } from 'expo-router';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { AppProvider } from '../lib/app-context';
import { startPhotoUploadQueue } from '../lib/photo-upload-queue';
import { captureException } from '../lib/sentry';
import { useEffect } from 'react';
import { useFonts } from '@expo-google-fonts/plus-jakarta-sans/useFonts';
import { PlusJakartaSans_400Regular } from '@expo-google-fonts/plus-jakarta-sans/400Regular';
import { PlusJakartaSans_500Medium } from '@expo-google-fonts/plus-jakarta-sans/500Medium';
import { PlusJakartaSans_600SemiBold } from '@expo-google-fonts/plus-jakarta-sans/600SemiBold';
import { PlusJakartaSans_700Bold } from '@expo-google-fonts/plus-jakarta-sans/700Bold';
import { PlusJakartaSans_800ExtraBold } from '@expo-google-fonts/plus-jakarta-sans/800ExtraBold';

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    PlusJakartaSans_400Regular,
    PlusJakartaSans_500Medium,
    PlusJakartaSans_600SemiBold,
    PlusJakartaSans_700Bold,
    PlusJakartaSans_800ExtraBold,
  });

  useEffect(() => {
    void startPhotoUploadQueue().catch((error) => {
      captureException(error, { area: "photo_upload_queue_start" });
    });

    // TEMPORARY SENTRY VERIFICATION — remove after confirming the event appears
    // in the Sentry dashboard with environment=development.
    if (__DEV__) {
      captureException(new Error("MEFIE SENTRY TEST"), {
        area: "sentry_test",
      });
    }
  }, []);

  if (!fontsLoaded) return null;

  return (
    <SafeAreaProvider>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <SentryErrorBoundary>
          <AppProvider>
            <StatusBar style="light" />
            <Stack
              screenOptions={{
                headerShown: false,
                animation: 'fade',
                contentStyle: { backgroundColor: '#0A0F15' },
              }}
            >
              <Stack.Screen name="(tabs)" options={{ animation: 'none' }} />
              {/*
                Temporary-invite navigation must be visually atomic. The global
                fade animation combined with the invite lookup/join redirect can
                expose intermediate native frames on Android, which looks like a
                rapid multi-blink when the event screen mounts. Keep these two
                routes transition-free; the event screen already performs its
                own data loading without needing a navigation animation.
              */}
              <Stack.Screen name="rejoin/[token]" options={{ animation: 'none' }} />
              <Stack.Screen name="event/[id]" options={{ animation: 'none' }} />
            </Stack>
          </AppProvider>
        </SentryErrorBoundary>
      </GestureHandlerRootView>
    </SafeAreaProvider>
  );
}

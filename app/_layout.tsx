import "../lib/sentry";
import { SentryErrorBoundary } from "../components/SentryErrorBoundary";
import { NameGate } from "../components/NameGate";
import { FloatingCameraController } from "../components/FloatingCameraController";
import { Stack } from "expo-router";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { AppProvider } from "../lib/app-context";
import { startPhotoUploadQueue } from "../lib/photo-upload-queue";
import { handleMefiePhotoDetected } from "../lib/mefie-native-photo-headless";
import { captureException } from "../lib/sentry";
import { AppRegistry, useEffect } from "react-native";
import { useFonts } from "@expo-google-fonts/plus-jakarta-sans/useFonts";
import { PlusJakartaSans_400Regular } from "@expo-google-fonts/plus-jakarta-sans/400Regular";
import { PlusJakartaSans_500Medium } from "@expo-google-fonts/plus-jakarta-sans/500Medium";
import { PlusJakartaSans_600SemiBold } from "@expo-google-fonts/plus-jakarta-sans/600SemiBold";
import { PlusJakartaSans_700Bold } from "@expo-google-fonts/plus-jakarta-sans/700Bold";
import { PlusJakartaSans_800ExtraBold } from "@expo-google-fonts/plus-jakarta-sans/800ExtraBold";

const registerHeadlessTask = (AppRegistry as typeof AppRegistry & {
  registerHeadlessTask?: (taskName: string, taskProvider: () => () => Promise<void>) => void;
}).registerHeadlessTask;

if (registerHeadlessTask) {
  registerHeadlessTask("MefiePhotoDetected", () => handleMefiePhotoDetected);
}

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
  }, []);

  if (!fontsLoaded) return null;

  return (
    <SafeAreaProvider>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <SentryErrorBoundary>
          <AppProvider>
            <NameGate>
              <StatusBar style="light" />
              <Stack
                screenOptions={{
                  headerShown: false,
                  animation: "fade",
                  contentStyle: { backgroundColor: "#0A0F15" },
                }}
              >
                <Stack.Screen name="(tabs)" options={{ animation: "none" }} />
                <Stack.Screen name="rejoin/[token]" options={{ animation: "none" }} />
                <Stack.Screen name="event/[id]" options={{ animation: "none" }} />
              </Stack>
              <FloatingCameraController />
            </NameGate>
          </AppProvider>
        </SentryErrorBoundary>
      </GestureHandlerRootView>
    </SafeAreaProvider>
  );
}

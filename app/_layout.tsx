import '../lib/debug-text';
import { Stack } from 'expo-router';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { AppProvider } from '../lib/app-context';

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <AppProvider>
          <StatusBar style="light" />
          <Stack screenOptions={{ headerShown: false, animation: 'fade', contentStyle: { backgroundColor: '#0A0F15' } }}>
            <Stack.Screen name="index" options={{ animation: 'none' }} />
            <Stack.Screen name="events" options={{ animation: 'none' }} />
            <Stack.Screen name="you" options={{ animation: 'none' }} />
          </Stack>
        </AppProvider>
      </GestureHandlerRootView>
    </SafeAreaProvider>
  );
}

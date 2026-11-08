import { Lato_400Regular, Lato_700Bold, Lato_900Black, useFonts } from '@expo-google-fonts/lato';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { colors, fonts } from '../src/theme';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [loaded, error] = useFonts({ Lato_400Regular, Lato_700Bold, Lato_900Black });

  useEffect(() => {
    if (loaded || error) SplashScreen.hideAsync();
  }, [loaded, error]);

  // If the fonts fail to load the app still renders, with the system font.
  if (!loaded && !error) return null;

  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: colors.bg },
          headerTintColor: colors.accent,
          headerShadowVisible: false,
          headerTitleStyle: { color: colors.text, fontFamily: fonts.bold, fontSize: 17 },
          headerBackTitleStyle: { fontFamily: fonts.bold, fontSize: 17 },
          contentStyle: { backgroundColor: colors.bg },
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen
          name="practice"
          options={{ headerShown: false, gestureEnabled: false }}
        />
        <Stack.Screen
          name="result/[id]"
          options={{ title: '', headerBackTitle: 'Back' }}
        />
      </Stack>
    </SafeAreaProvider>
  );
}

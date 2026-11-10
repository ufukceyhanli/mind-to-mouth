import { Lato_400Regular, Lato_700Bold, Lato_900Black, useFonts } from '@expo-google-fonts/lato';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AuthProvider, useAuth } from '../src/auth/AuthProvider';
import { colors, fonts } from '../src/theme';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  return (
    <AuthProvider>
      <RootNavigator />
    </AuthProvider>
  );
}

function RootNavigator() {
  const [loaded, error] = useFonts({ Lato_400Regular, Lato_700Bold, Lato_900Black });
  const { ready, session } = useAuth();
  const fontsSettled = loaded || error;

  // The splash screen stays up until the fonts and the stored sign-in state are
  // both known, so a signed-in user never flashes the signed-out UI.
  useEffect(() => {
    if (fontsSettled && ready) SplashScreen.hideAsync();
  }, [fontsSettled, ready]);

  // If the fonts fail to load the app still renders, with the system font.
  if (!fontsSettled || !ready) return null;

  const signedIn = session !== null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
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
          {/* Accounts are optional: the app works signed out. The guards only
              keep a signed-in user off the sign-in form and a signed-out user
              off the new-password form, bouncing them back to the tabs. */}
          <Stack.Protected guard={!signedIn}>
            <Stack.Screen name="auth/index" options={{ title: 'Account', headerBackTitle: 'Back' }} />
          </Stack.Protected>
          <Stack.Protected guard={signedIn}>
            <Stack.Screen
              name="auth/reset"
              options={{ title: 'New password', headerBackTitle: 'Back' }}
            />
          </Stack.Protected>
          <Stack.Screen name="auth/callback" options={{ headerShown: false }} />
        </Stack>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

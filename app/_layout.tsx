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
  // both known, so a signed-in user never flashes the welcome screen.
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
          {/* An account is required. Everything the app does sits behind the
              signed-in guard; a signed-out user can only reach the welcome
              carousel and the sign-up / sign-in screens. The welcome screen is
              declared first so it is where the router lands when the tabs are
              off limits. Flipping the guard (signing in or out) clears the other
              side's history, so there is no way back into the app without a
              session. */}
          <Stack.Protected guard={!signedIn}>
            <Stack.Screen name="auth/welcome" options={{ headerShown: false }} />
            <Stack.Screen name="auth/index" options={{ headerShown: false }} />
            <Stack.Screen name="auth/sign-up" options={{ headerShown: false }} />
            <Stack.Screen name="auth/sign-in" options={{ headerShown: false }} />
          </Stack.Protected>
          <Stack.Protected guard={signedIn}>
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            <Stack.Screen
              name="practice"
              options={{ headerShown: false, gestureEnabled: false }}
            />
            <Stack.Screen
              name="result/[id]"
              options={{ title: '', headerBackTitle: 'Back' }}
            />
            <Stack.Screen name="profile" options={{ title: 'Profile', headerBackTitle: 'Back' }} />
            <Stack.Screen
              name="auth/reset"
              options={{ title: 'New password', headerBackTitle: 'Back' }}
            />
          </Stack.Protected>
          {/* Email links land here signed out or in, so it is never guarded. */}
          <Stack.Screen name="auth/callback" options={{ headerShown: false }} />
        </Stack>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

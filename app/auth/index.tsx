import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { Image, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAuth } from '../../src/auth/AuthProvider';
import {
  AuthNotice,
  AuthTitle,
  LegalFooter,
  ProviderButtons,
  StepHeader,
  SwitchRow,
  useAuthAction,
  WordTile,
} from '../../src/components/auth';
import { Button, Muted } from '../../src/components/ui';
import { colors, radius, shadow, spacing } from '../../src/theme';

const ICON = require('../../assets/icon.png');

/** Tiles orbiting the app icon: word, rotation, and position in the 300pt stage. */
const ORBIT: { word: string; rotate: string; left: number; top: number }[] = [
  { word: 'Lighthouse', rotate: '-12deg', left: 86, top: 0 },
  { word: 'Courage', rotate: '10deg', left: 214, top: 8 },
  { word: 'Umbrella', rotate: '-9deg', left: 10, top: 86 },
  { word: 'Patience', rotate: '8deg', left: 268, top: 104 },
  { word: 'Tuesday', rotate: '9deg', left: 44, top: 196 },
  { word: 'Gravity', rotate: '-10deg', left: 226, top: 206 },
];

const SPARKLES: { left: number; top: number; size: number }[] = [
  { left: 60, top: 40, size: 18 },
  { left: 300, top: 60, size: 14 },
  { left: 20, top: 250, size: 14 },
  { left: 180, top: 262, size: 16 },
  { left: 290, top: 236, size: 12 },
];

/**
 * Step 1 of creating an account: pick a method. Email goes on to the form,
 * Apple and Google finish here. Once a session exists the root layout's guard
 * moves the user into the app.
 */
export default function CreateAccountScreen() {
  const insets = useSafeAreaInsets();
  const auth = useAuth();
  const { busy, notice, run } = useAuthAction<'apple' | 'google'>();

  if (!auth.configured) {
    return (
      <View style={styles.screen}>
        <StepHeader />
        <View style={[styles.content, { flex: 1, justifyContent: 'center' }]}>
          <AuthTitle
            title="Accounts are not set up"
            subtitle="This build has no sign-in service, so nobody can sign in."
          />
          <Muted style={{ textAlign: 'center' }}>
            Add EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY to .env, clear the Metro
            cache and rebuild. See README.md.
          </Muted>
        </View>
      </View>
    );
  }

  const working = busy !== null;

  return (
    <View style={styles.screen}>
      <StepHeader step={1} total={2} />
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.md }]}
        keyboardShouldPersistTaps="handled"
        bounces={false}
      >
        <View style={styles.stage} accessible accessibilityLabel="Mind to Mouth, surrounded by prompt words">
          {SPARKLES.map((s, i) => (
            <Ionicons
              key={i}
              name="sparkles"
              size={s.size}
              color={colors.warn}
              style={{ position: 'absolute', left: s.left, top: s.top }}
            />
          ))}
          {ORBIT.map((t) => (
            <WordTile
              key={t.word}
              word={t.word}
              rotate={t.rotate}
              width={64}
              style={{ position: 'absolute', left: t.left, top: t.top }}
            />
          ))}
          <View style={[styles.iconFrame, shadow]}>
            <Image source={ICON} style={styles.icon} resizeMode="cover" />
          </View>
        </View>

        <AuthTitle title="Create your account" subtitle="Choose how you'd like to create your account" />

        <View style={styles.buttons}>
          <Button
            title="Continue with email"
            variant="outline"
            icon="mail-outline"
            onPress={() => router.push('/auth/sign-up')}
            disabled={working}
          />
          <ProviderButtons
            busy={busy}
            disabled={working}
            onApple={() =>
              void run('apple', async () => {
                await auth.signInWithApple();
              })
            }
            onGoogle={() =>
              void run('google', async () => {
                await auth.signInWithGoogle();
              })
            }
          />
          <AuthNotice notice={notice} />
        </View>

        <LegalFooter />
        <SwitchRow prompt="Already have an account?" action="Sign in" onPress={() => router.push('/auth/sign-in')} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { paddingHorizontal: spacing.md, gap: spacing.lg, flexGrow: 1 },
  stage: { width: 340, height: 300, alignSelf: 'center', alignItems: 'center', justifyContent: 'center' },
  iconFrame: {
    width: 116,
    height: 116,
    borderRadius: radius.xl,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: { width: 92, height: 92, borderRadius: radius.lg },
  buttons: { gap: spacing.md },
});

import { router } from 'expo-router';
import { useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAuth } from '../../src/auth/AuthProvider';
import {
  AuthField,
  AuthNotice,
  AuthTitle,
  Divider,
  EMAIL_RE,
  MIN_PASSWORD,
  ProviderButtons,
  StepHeader,
  SwitchRow,
  useAppleAvailable,
  useAuthAction,
} from '../../src/components/auth';
import { Button, Link, Muted } from '../../src/components/ui';
import { colors, spacing } from '../../src/theme';

type Kind = 'password' | 'apple' | 'google' | 'magic' | 'reset';

/**
 * "I have an account": Apple, Google, or email and password, plus the two
 * email-link fallbacks. Signing in flips the root guard, which drops the user
 * into the tabs.
 */
export default function SignInScreen() {
  const insets = useSafeAreaInsets();
  const auth = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const { busy, notice, setNotice, run } = useAuthAction<Kind>();
  const appleAvailable = useAppleAvailable();
  const passwordRef = useRef<TextInput>(null);

  const cleanEmail = email.trim().toLowerCase();
  const working = busy !== null;

  const checkEmail = (): boolean => {
    if (EMAIL_RE.test(cleanEmail)) return true;
    setNotice({ tone: 'error', text: 'Enter a valid email address.' });
    return false;
  };

  const submitPassword = () => {
    if (!checkEmail()) return;
    if (password.length < MIN_PASSWORD) {
      setNotice({ tone: 'error', text: `Use a password of at least ${MIN_PASSWORD} characters.` });
      return;
    }
    void run('password', () => auth.signInWithPassword(cleanEmail, password));
  };

  const sendMagicLink = () => {
    if (!checkEmail()) return;
    void run('magic', async () => {
      await auth.sendMagicLink(cleanEmail);
      setNotice({ tone: 'info', text: `A sign-in link is on its way to ${cleanEmail}. Open it on this phone.` });
    });
  };

  const sendReset = () => {
    if (!checkEmail()) return;
    void run('reset', async () => {
      await auth.sendPasswordReset(cleanEmail);
      setNotice({
        tone: 'info',
        text: `If ${cleanEmail} has an account, a reset link is on its way. Open it on this phone.`,
      });
    });
  };

  if (!auth.configured) {
    return (
      <View style={styles.screen}>
        <StepHeader />
        <View style={[styles.content, { justifyContent: 'center' }]}>
          <AuthTitle title="Accounts are not set up" subtitle="This build has no sign-in service, so nobody can sign in." />
          <Muted style={{ textAlign: 'center' }}>
            Add EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY to .env, clear the Metro
            cache and rebuild. See README.md.
          </Muted>
        </View>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <StepHeader />
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.md }]}
        keyboardShouldPersistTaps="handled"
      >
        <AuthTitle title="Welcome back" subtitle="Sign in to pick up where you left off." />

        <ProviderButtons
          busy={busy === 'apple' || busy === 'google' ? busy : null}
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

        {(appleAvailable || auth.googleEnabled) && <Divider label="or with email" />}

        <View style={styles.form}>
          <AuthField
            label="Email"
            value={email}
            onChangeText={(v) => {
              setEmail(v);
              setNotice(null);
            }}
            placeholder="you@example.com"
            keyboardType="email-address"
            textContentType="emailAddress"
            autoComplete="email"
            returnKeyType="next"
            onSubmitEditing={() => passwordRef.current?.focus()}
          />
          <AuthField
            ref={passwordRef}
            label="Password"
            trailing={
              <Link onPress={sendReset} style={{ marginBottom: spacing.sm }}>
                {busy === 'reset' ? 'Sending…' : 'Forgot password?'}
              </Link>
            }
            value={password}
            onChangeText={(v) => {
              setPassword(v);
              setNotice(null);
            }}
            placeholder="Your password"
            secureTextEntry
            textContentType="password"
            autoComplete="current-password"
            returnKeyType="go"
            onSubmitEditing={submitPassword}
          />
          <AuthNotice notice={notice} />
        </View>

        <Button
          title="Sign in"
          icon="log-in-outline"
          onPress={submitPassword}
          loading={busy === 'password'}
          disabled={working && busy !== 'password'}
        />
        <Button
          title={busy === 'magic' ? 'Sending link…' : 'Email me a sign-in link instead'}
          variant="ghost"
          icon="mail-outline"
          onPress={sendMagicLink}
          loading={busy === 'magic'}
          disabled={working && busy !== 'magic'}
        />

        <View style={{ flex: 1 }} />
        <SwitchRow prompt="New here?" action="Create an account" onPress={() => router.replace('/auth')} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { paddingHorizontal: spacing.md, paddingTop: spacing.md, gap: spacing.lg, flexGrow: 1 },
  form: { gap: spacing.md },
});

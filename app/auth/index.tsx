import * as AppleAuthentication from 'expo-apple-authentication';
import { useEffect, useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { useAuth } from '../../src/auth/AuthProvider';
import { describeAuthError } from '../../src/auth/supabase';
import { Button, Card, Link, Muted } from '../../src/components/ui';
import { colors, radius, spacing, type } from '../../src/theme';

type Mode = 'signin' | 'signup';
type Notice = { tone: 'info' | 'error'; text: string } | null;

const MIN_PASSWORD = 6;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Sign in or create an account. Optional: the tabs work without one. Once a
 * session exists the root layout's guard sends the user back to the tabs.
 */
export default function AuthScreen() {
  const auth = useAuth();
  const [mode, setMode] = useState<Mode>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState<null | 'password' | 'apple' | 'magic' | 'reset'>(null);
  const [notice, setNotice] = useState<Notice>(null);
  const [appleAvailable, setAppleAvailable] = useState(false);
  const passwordRef = useRef<TextInput>(null);

  useEffect(() => {
    if (Platform.OS !== 'ios') return;
    AppleAuthentication.isAvailableAsync().then(setAppleAvailable, () => setAppleAvailable(false));
  }, []);

  if (!auth.configured) {
    return (
      <View style={[styles.screen, styles.content]}>
        <Card>
          <Text style={styles.heading}>Accounts are not available in this build</Text>
          <Muted style={{ marginTop: spacing.sm }}>
            The app still works: your talks stay on this phone.
          </Muted>
        </Card>
      </View>
    );
  }

  const cleanEmail = email.trim().toLowerCase();

  const checkEmail = (): boolean => {
    if (EMAIL_RE.test(cleanEmail)) return true;
    setNotice({ tone: 'error', text: 'Enter a valid email address.' });
    return false;
  };

  const run = async (kind: NonNullable<typeof busy>, task: () => Promise<void>) => {
    setNotice(null);
    setBusy(kind);
    try {
      await task();
    } catch (e) {
      setNotice({ tone: 'error', text: describeAuthError(e) });
    } finally {
      setBusy(null);
    }
  };

  const submitPassword = () => {
    if (!checkEmail()) return;
    if (password.length < MIN_PASSWORD) {
      setNotice({ tone: 'error', text: `Use a password of at least ${MIN_PASSWORD} characters.` });
      return;
    }
    void run('password', async () => {
      if (mode === 'signin') {
        await auth.signInWithPassword(cleanEmail, password);
      } else {
        const needsConfirmation = await auth.signUpWithPassword(cleanEmail, password);
        if (needsConfirmation) {
          setNotice({
            tone: 'info',
            text: `Check ${cleanEmail} for a confirmation link. Opening it on this phone signs you in.`,
          });
        }
      }
    });
  };

  const sendMagicLink = () => {
    if (!checkEmail()) return;
    void run('magic', async () => {
      await auth.sendMagicLink(cleanEmail);
      setNotice({
        tone: 'info',
        text: `A sign-in link is on its way to ${cleanEmail}. Open it on this phone.`,
      });
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

  const signInWithApple = () => {
    void run('apple', async () => {
      await auth.signInWithApple();
    });
  };

  const working = busy !== null;

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={100}
    >
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={{ gap: spacing.sm }}>
          <Text style={styles.heading}>
            {mode === 'signin' ? 'Welcome back' : 'Create your account'}
          </Text>
          <Muted>
            An account is optional. Your talks, recordings and scores stay on this phone either way.
          </Muted>
        </View>

        {appleAvailable && (
          <View style={{ gap: spacing.md }}>
            <AppleAuthentication.AppleAuthenticationButton
              buttonType={
                mode === 'signin'
                  ? AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN
                  : AppleAuthentication.AppleAuthenticationButtonType.SIGN_UP
              }
              buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
              cornerRadius={radius.pill}
              style={[styles.apple, working && { opacity: 0.5 }]}
              onPress={working ? () => {} : signInWithApple}
            />
            <View style={styles.divider}>
              <View style={styles.rule} />
              <Muted style={type.captionBold}>or with email</Muted>
              <View style={styles.rule} />
            </View>
          </View>
        )}

        <Card style={{ gap: spacing.md }}>
          <View>
            <Text style={styles.label}>Email</Text>
            <TextInput
              value={email}
              onChangeText={(v) => {
                setEmail(v);
                setNotice(null);
              }}
              placeholder="you@example.com"
              placeholderTextColor={colors.muted}
              keyboardType="email-address"
              textContentType="emailAddress"
              autoComplete="email"
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="next"
              onSubmitEditing={() => passwordRef.current?.focus()}
              style={styles.input}
              accessibilityLabel="Email"
            />
          </View>
          <View>
            <View style={styles.labelRow}>
              <Text style={styles.label}>Password</Text>
              {mode === 'signin' && (
                <Link onPress={sendReset} style={{ marginBottom: spacing.sm }}>
                  {busy === 'reset' ? 'Sending…' : 'Forgot password?'}
                </Link>
              )}
            </View>
            <TextInput
              ref={passwordRef}
              value={password}
              onChangeText={(v) => {
                setPassword(v);
                setNotice(null);
              }}
              placeholder={mode === 'signup' ? `At least ${MIN_PASSWORD} characters` : 'Your password'}
              placeholderTextColor={colors.muted}
              secureTextEntry
              textContentType={mode === 'signup' ? 'newPassword' : 'password'}
              autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="go"
              onSubmitEditing={submitPassword}
              style={styles.input}
              accessibilityLabel="Password"
            />
          </View>
          {notice && (
            <Text style={[styles.notice, notice.tone === 'error' ? styles.noticeError : styles.noticeInfo]}>
              {notice.text}
            </Text>
          )}
        </Card>

        <Button
          title={mode === 'signin' ? 'Sign in' : 'Create account'}
          icon={mode === 'signin' ? 'log-in-outline' : 'person-add-outline'}
          onPress={submitPassword}
          loading={busy === 'password'}
          disabled={working && busy !== 'password'}
        />
        <Button
          title={busy === 'magic' ? 'Sending link…' : 'Email me a sign-in link instead'}
          variant="secondary"
          icon="mail-outline"
          onPress={sendMagicLink}
          loading={busy === 'magic'}
          disabled={working && busy !== 'magic'}
        />

        <View style={styles.switchRow}>
          <Muted>{mode === 'signin' ? 'New here?' : 'Already have an account?'}</Muted>
          <Link
            onPress={() => {
              setMode((m) => (m === 'signin' ? 'signup' : 'signin'));
              setNotice(null);
            }}
          >
            {mode === 'signin' ? 'Create an account' : 'Sign in'}
          </Link>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.md, gap: spacing.lg },
  heading: { ...type.h2, color: colors.text },
  apple: { width: '100%', height: 56 },
  divider: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  rule: { flex: 1, height: 1, backgroundColor: colors.border },
  label: { ...type.label, color: colors.text, marginBottom: spacing.sm },
  labelRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  input: {
    ...type.body,
    backgroundColor: colors.bg,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    color: colors.text,
    paddingHorizontal: spacing.md,
    paddingVertical: 14,
  },
  notice: { ...type.caption, lineHeight: 19 },
  noticeError: { color: colors.danger },
  noticeInfo: { color: colors.success },
  switchRow: { flexDirection: 'row', justifyContent: 'center', gap: spacing.xs },
});

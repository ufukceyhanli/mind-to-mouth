import { useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAuth } from '../../src/auth/AuthProvider';
import {
  AuthField,
  AuthNotice,
  AuthTitle,
  EMAIL_RE,
  LegalFooter,
  MIN_PASSWORD,
  StepHeader,
  useAuthAction,
} from '../../src/components/auth';
import { Button } from '../../src/components/ui';
import { colors, spacing } from '../../src/theme';

/**
 * Step 2 of creating an account: email and password. With "Confirm email" on
 * in Supabase the account exists after this but there is no session until the
 * link in the email is opened on this phone; the callback route signs in then.
 */
export default function SignUpScreen() {
  const insets = useSafeAreaInsets();
  const auth = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [sent, setSent] = useState(false);
  const { busy, notice, setNotice, run } = useAuthAction<'signup'>();
  const passwordRef = useRef<TextInput>(null);

  const cleanEmail = email.trim().toLowerCase();

  const submit = () => {
    if (!EMAIL_RE.test(cleanEmail)) {
      setNotice({ tone: 'error', text: 'Enter a valid email address.' });
      return;
    }
    if (password.length < MIN_PASSWORD) {
      setNotice({ tone: 'error', text: `Use a password of at least ${MIN_PASSWORD} characters.` });
      return;
    }
    void run('signup', async () => {
      const needsConfirmation = await auth.signUpWithPassword(cleanEmail, password);
      if (needsConfirmation) {
        setSent(true);
        setNotice({
          tone: 'info',
          text: `Check ${cleanEmail} for a confirmation link. Opening it on this phone signs you in.`,
        });
      }
    });
  };

  return (
    <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <StepHeader step={2} total={2} />
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.md }]}
        keyboardShouldPersistTaps="handled"
      >
        <AuthTitle title="Sign up with email" subtitle="You'll use these to sign in on any phone." />

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
            editable={!sent}
          />
          <AuthField
            ref={passwordRef}
            label="Password"
            value={password}
            onChangeText={(v) => {
              setPassword(v);
              setNotice(null);
            }}
            placeholder={`At least ${MIN_PASSWORD} characters`}
            secureTextEntry
            textContentType="newPassword"
            autoComplete="new-password"
            returnKeyType="go"
            onSubmitEditing={submit}
            editable={!sent}
          />
          <AuthNotice notice={notice} />
        </View>

        <View style={{ flex: 1 }} />

        <Button
          title={sent ? 'Check your email' : 'Create account'}
          icon={sent ? 'mail-open-outline' : 'person-add-outline'}
          onPress={submit}
          loading={busy === 'signup'}
          disabled={sent}
        />
        <LegalFooter />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { paddingHorizontal: spacing.md, paddingTop: spacing.lg, gap: spacing.lg, flexGrow: 1 },
  form: { gap: spacing.md },
});

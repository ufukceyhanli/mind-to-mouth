import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { useAuth } from '../../src/auth/AuthProvider';
import { describeAuthError } from '../../src/auth/supabase';
import { Button, Card, Muted } from '../../src/components/ui';
import { colors, radius, spacing, type } from '../../src/theme';

const MIN_PASSWORD = 6;

/** Shown after a password-reset link signed the user in: pick the new password. */
export default function ResetPasswordScreen() {
  const { updatePassword, clearRecovery, session } = useAuth();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    setError(null);
    if (password.length < MIN_PASSWORD) {
      setError(`Use at least ${MIN_PASSWORD} characters.`);
      return;
    }
    if (password !== confirm) {
      setError('The two passwords do not match.');
      return;
    }
    setBusy(true);
    try {
      await updatePassword(password);
      Alert.alert('Password updated', 'You are signed in.', [
        { text: 'OK', onPress: () => router.replace('/') },
      ]);
    } catch (e) {
      setError(describeAuthError(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={100}
    >
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Muted>
          {session?.user.email ? `Choose a new password for ${session.user.email}.` : 'Choose a new password.'}
        </Muted>
        <Card style={{ gap: spacing.md }}>
          <View>
            <Text style={styles.label}>New password</Text>
            <TextInput
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              textContentType="newPassword"
              autoCapitalize="none"
              autoCorrect={false}
              placeholder={`At least ${MIN_PASSWORD} characters`}
              placeholderTextColor={colors.muted}
              style={styles.input}
              accessibilityLabel="New password"
            />
          </View>
          <View>
            <Text style={styles.label}>Repeat it</Text>
            <TextInput
              value={confirm}
              onChangeText={setConfirm}
              secureTextEntry
              textContentType="newPassword"
              autoCapitalize="none"
              autoCorrect={false}
              placeholder="Same password again"
              placeholderTextColor={colors.muted}
              style={styles.input}
              accessibilityLabel="Repeat new password"
              onSubmitEditing={() => void save()}
            />
          </View>
          {error && <Text style={styles.error}>{error}</Text>}
        </Card>
        <Button title="Save new password" icon="checkmark" onPress={() => void save()} loading={busy} />
        <Button
          title="Skip for now"
          variant="ghost"
          onPress={() => {
            clearRecovery();
            router.replace('/');
          }}
        />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.md, gap: spacing.lg },
  label: { ...type.label, color: colors.text, marginBottom: spacing.sm },
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
  error: { ...type.caption, color: colors.danger },
});

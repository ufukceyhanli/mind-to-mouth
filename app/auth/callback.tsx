import { router } from 'expo-router';
import { useEffect } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAuth } from '../../src/auth/AuthProvider';
import { Button, Muted } from '../../src/components/ui';
import { colors, spacing, type } from '../../src/theme';

/**
 * Where email links land (mindtomouth://auth/callback). AuthProvider reads the
 * tokens from the URL; this screen just waits for the outcome and moves on.
 */
export default function AuthCallbackScreen() {
  const insets = useSafeAreaInsets();
  const { session, recovery, linkStatus } = useAuth();

  useEffect(() => {
    if (linkStatus.state !== 'idle') return;
    if (recovery) router.replace('/auth/reset');
    else if (session) router.replace('/');
  }, [session, recovery, linkStatus]);

  const failed = linkStatus.state === 'error';
  // A callback with no tokens at all (the link was opened twice, say) would
  // otherwise spin forever once the provider has nothing to do.
  const stuck = linkStatus.state === 'idle' && !session && !recovery;

  return (
    <View style={[styles.screen, { paddingTop: insets.top + spacing.xl, paddingBottom: insets.bottom + spacing.lg }]}>
      {failed || stuck ? (
        <>
          <Text style={styles.title}>{failed ? 'That link did not work' : 'Nothing to sign in with'}</Text>
          <Muted style={styles.body}>
            {failed ? linkStatus.message : 'Open the newest email from Mind to Mouth, or ask for a new link.'}
          </Muted>
          <Button title="Back to sign in" onPress={() => router.replace('/auth')} />
          <Button title="Home" variant="ghost" onPress={() => router.replace('/')} />
        </>
      ) : (
        <>
          <ActivityIndicator color={colors.accent} size="large" />
          <Muted style={styles.body}>Signing you in…</Muted>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.bg,
    paddingHorizontal: spacing.lg,
    justifyContent: 'center',
    gap: spacing.md,
  },
  title: { ...type.h2, color: colors.text, textAlign: 'center' },
  body: { textAlign: 'center', marginBottom: spacing.md },
});

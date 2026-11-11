import Constants from 'expo-constants';
import * as Linking from 'expo-linking';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { providerLabel, useAuth } from '../src/auth/AuthProvider';
import { describeAuthError } from '../src/auth/supabase';
import { Avatar, Button, Card, Link, Muted, SectionTitle } from '../src/components/ui';
import { PRIVACY_POLICY_URL, SPEECH_SERVICE_NAME, SUPPORT_URL } from '../src/links';
import { usePlan } from '../src/plan/PlanProvider';
import { PLUS_NAME } from '../src/plan/limits';
import { useAllowance } from '../src/plan/useAllowance';
import {
  deleteAllSessions,
  getDataSharingConsent,
  loadSessions,
  setDataSharingConsent,
} from '../src/storage';
import { colors, spacing, type } from '../src/theme';

const appVersion = Constants.expoConfig?.version ?? '1.0.0';

/**
 * Who you are and what the app holds about you: the account, then an About
 * card with the policy and contact links, the recording consent (and its
 * withdrawal) and the delete-everything button. The full plain-language
 * disclosure is shown once, before the first recording. Opened from the
 * avatar on the Today tab. Everything that tunes practice stays in Settings.
 */
export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const auth = useAuth();
  const plan = usePlan();
  const allowance = useAllowance();
  const [accountBusy, setAccountBusy] = useState<null | 'signout' | 'delete'>(null);
  const [consentDate, setConsentDate] = useState<string | null>(null);
  const [talkCount, setTalkCount] = useState(0);

  // Consent and the talk count can change elsewhere (first practice, deleting
  // from Talks), so they reload every time the screen is shown.
  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      Promise.all([getDataSharingConsent(), loadSessions()]).then(([consent, sessions]) => {
        if (cancelled) return;
        setConsentDate(consent);
        setTalkCount(sessions.length);
      });
      return () => {
        cancelled = true;
      };
    }, []),
  );

  const email = auth.session?.user.email ?? null;

  const signOut = async () => {
    setAccountBusy('signout');
    try {
      await auth.signOut();
    } catch (e) {
      Alert.alert('Could not sign out', describeAuthError(e));
    } finally {
      setAccountBusy(null);
    }
  };

  // App Store guideline 5.1.1(v): an account that can be created in the app
  // must be deletable in the app, server data included.
  const deleteAccount = () => {
    Alert.alert(
      'Delete your account?',
      `${email ? `${email} and` : 'Your account and'} everything the server holds about it will be removed. This cannot be undone. Talks on this phone are not affected.${
        plan.isPlus && plan.canPurchase
          ? ` Your ${PLUS_NAME} subscription is billed by Apple and is not cancelled by this; cancel it in your App Store account settings.`
          : ''
      }`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete account',
          style: 'destructive',
          onPress: async () => {
            setAccountBusy('delete');
            try {
              await auth.deleteAccount();
              Alert.alert('Account deleted', 'Your talks are still on this phone. Create an account to use the app again.');
            } catch (e) {
              Alert.alert('Could not delete the account', describeAuthError(e));
            } finally {
              setAccountBusy(null);
            }
          },
        },
      ],
    );
  };

  const withdrawConsent = () => {
    Alert.alert(
      'Stop sending recordings?',
      'You will be asked again before your next talk. Talks cannot be scored without it.',
      [
        { text: 'Keep sharing', style: 'cancel' },
        {
          text: 'Withdraw',
          style: 'destructive',
          onPress: async () => {
            await setDataSharingConsent(false);
            setConsentDate(null);
          },
        },
      ],
    );
  };

  const deleteEverything = () => {
    Alert.alert(
      'Delete all talks?',
      `${talkCount} talk${talkCount === 1 ? '' : 's'}, with every recording, transcript and score, will be removed from this phone. This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete all',
          style: 'destructive',
          onPress: async () => {
            await deleteAllSessions();
            setTalkCount(0);
          },
        },
      ],
    );
  };

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.xl }]}
    >
      <View style={styles.identity}>
        <Avatar email={email} size={88} />
        <Text style={styles.email} selectable numberOfLines={2}>
          {email ?? 'No email on file'}
        </Text>
        {auth.session && (
          <Muted style={{ textAlign: 'center' }}>
            Signed in with {providerLabel(auth.session)}. Your talks and recordings stay on this phone.
          </Muted>
        )}
      </View>

      {plan.canPurchase && (
        <View>
          <SectionTitle>Plan</SectionTitle>
          <Card style={{ gap: spacing.md }}>
            <View style={styles.row}>
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>{plan.isPlus ? PLUS_NAME : 'Free plan'}</Text>
                <Muted style={styles.hint}>
                  {plan.isPlus
                    ? 'Unlimited talks, pronunciation check and longer talks. Billed monthly by Apple.'
                    : allowance.loaded
                      ? `${allowance.left} of ${allowance.total} free talks left this week. New ones ${allowance.resets}.`
                      : `${allowance.total} talks a week.`}
                </Muted>
              </View>
              {plan.isPlus && <Link onPress={plan.manage}>Manage</Link>}
            </View>
            {!plan.isPlus && (
              <Button title="See Plus" icon="sparkles" onPress={() => router.push('/plus')} />
            )}
          </Card>
        </View>
      )}

      <View>
        <SectionTitle>Account</SectionTitle>
        <Card style={{ gap: spacing.md }}>
          <Button
            title="Sign out"
            variant="secondary"
            icon="log-out-outline"
            onPress={() => void signOut()}
            loading={accountBusy === 'signout'}
            disabled={accountBusy === 'delete'}
          />
          <Button
            title="Delete account"
            variant="danger"
            icon="person-remove-outline"
            onPress={deleteAccount}
            loading={accountBusy === 'delete'}
            disabled={accountBusy === 'signout'}
          />
        </Card>
      </View>

      <View>
        <SectionTitle>About</SectionTitle>
        <Card style={{ gap: spacing.md }}>
          <Link onPress={() => void Linking.openURL(PRIVACY_POLICY_URL)}>Privacy policy</Link>
          <Link onPress={() => void Linking.openURL(SUPPORT_URL)}>Contact and report a problem</Link>
          <View style={styles.divider} />
          {/* App Store guideline 5.1.1(ii): consent must be as easy to withdraw
              as it was to give, so the withdrawal stays one tap from here. */}
          <View style={styles.row}>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>Sending recordings</Text>
              <Muted style={styles.hint}>
                {consentDate
                  ? `Agreed on ${new Date(consentDate).toLocaleDateString()}. Recordings go to ${SPEECH_SERVICE_NAME} for transcription and coaching.`
                  : 'Not agreed yet. You will be asked before your next talk.'}
              </Muted>
            </View>
            {consentDate && <Link onPress={withdrawConsent}>Withdraw</Link>}
          </View>
          <Button
            title={talkCount === 0 ? 'No talks to delete' : 'Delete all talks and recordings'}
            variant="danger"
            icon="trash-outline"
            disabled={talkCount === 0}
            onPress={deleteEverything}
          />
          <Muted style={styles.hint}>
            Version {appVersion}. Feedback from the coach is AI-generated and can be wrong.
          </Muted>
        </Card>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { paddingHorizontal: spacing.md, paddingTop: spacing.md, gap: spacing.lg },
  identity: { alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.md },
  email: { ...type.h3, color: colors.text, textAlign: 'center' },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: spacing.md },
  divider: { height: 1, backgroundColor: colors.border },
  label: { ...type.label, color: colors.text },
  hint: { ...type.caption, marginTop: 8 },
});

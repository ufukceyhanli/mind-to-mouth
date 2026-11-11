import Ionicons from '@expo/vector-icons/Ionicons';
import * as Linking from 'expo-linking';
import { router, Stack } from 'expo-router';
import { useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Badge, Button, Card, Link, Muted, type IconName } from '../src/components/ui';
import { PRIVACY_POLICY_URL, TERMS_URL } from '../src/links';
import { usePlan } from '../src/plan/PlanProvider';
import {
  FREE_MAX_SECONDS,
  FREE_TALKS_PER_WEEK,
  PLUS_FALLBACK_PRICE,
  PLUS_NAME,
} from '../src/plan/limits';
import { useAllowance } from '../src/plan/useAllowance';
import { colors, radius, spacing, type } from '../src/theme';

const BENEFITS: { icon: IconName; title: string; body: string }[] = [
  {
    icon: 'infinite-outline',
    title: 'Unlimited talks',
    body: `Practise every day and keep your streak. The free plan stops at ${FREE_TALKS_PER_WEEK} a week.`,
  },
  {
    icon: 'ear-outline',
    title: 'Pronunciation check',
    body: 'After each talk, hear the words worth a second try, next to your own attempt.',
  },
  {
    icon: 'timer-outline',
    title: 'Longer talks',
    body: `Keep going for up to ten minutes. Free talks stop at ${FREE_MAX_SECONDS / 60} minutes.`,
  },
];

/**
 * The paywall. App Store guideline 3.1.2 wants, on this screen: the name of
 * the subscription, its length, its price, what it gives, a way to restore,
 * and working links to the terms of use and the privacy policy.
 */
export default function PlusScreen() {
  const insets = useSafeAreaInsets();
  const plan = usePlan();
  const allowance = useAllowance();
  const [busy, setBusy] = useState<null | 'buy' | 'restore'>(null);

  const price = plan.price ?? PLUS_FALLBACK_PRICE;

  const subscribe = async () => {
    setBusy('buy');
    try {
      const result = await plan.buy();
      if (result.kind === 'purchased') {
        router.back();
      } else if (result.kind === 'pending') {
        Alert.alert('Almost there', 'The App Store is still confirming the purchase. Plus unlocks by itself as soon as it goes through.');
      } else if (result.kind === 'error') {
        Alert.alert('Could not subscribe', result.message);
      }
    } finally {
      setBusy(null);
    }
  };

  const restore = async () => {
    setBusy('restore');
    try {
      const active = await plan.restore();
      Alert.alert(
        active ? 'Plus restored' : 'Nothing to restore',
        active
          ? 'Your subscription is active on this device.'
          : 'No active subscription was found for the Apple Account signed in on this device.',
        active ? [{ text: 'OK', onPress: () => router.back() }] : undefined,
      );
    } catch {
      Alert.alert('Could not reach the App Store', 'Check the connection and try again.');
    } finally {
      setBusy(null);
    }
  };

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.xl }]}
    >
      <Stack.Screen
        options={{ headerLeft: () => <Link onPress={() => router.back()}>Close</Link> }}
      />
      <View style={styles.header}>
        <View style={styles.crown}>
          <Ionicons name="sparkles" size={30} color={colors.accent} />
        </View>
        <Text style={styles.title}>{PLUS_NAME}</Text>
        <Muted style={styles.centered}>
          {plan.isPlus
            ? 'You have Plus. Thank you for supporting the app.'
            : 'Practise as often as you like, with everything the coach can do.'}
        </Muted>
      </View>

      {!plan.isPlus && allowance.loaded && (
        <View style={styles.usage}>
          <Badge tone="light" style={{ alignSelf: 'center' }}>
            {allowance.left === 0
              ? `Free talks used. More ${allowance.resets}`
              : `${allowance.left} of ${allowance.total} free talks left this week`}
          </Badge>
        </View>
      )}

      <Card style={{ gap: spacing.md }}>
        {BENEFITS.map((b) => (
          <View key={b.title} style={styles.benefit}>
            <View style={styles.iconWrap}>
              <Ionicons name={b.icon} size={20} color={colors.accent} />
            </View>
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={styles.benefitTitle}>{b.title}</Text>
              <Muted style={styles.benefitBody}>{b.body}</Muted>
            </View>
          </View>
        ))}
      </Card>

      {plan.isPlus ? (
        <View style={{ gap: spacing.sm }}>
          <Button title="Manage subscription" variant="secondary" icon="card-outline" onPress={plan.manage} />
          <Muted style={styles.centered}>
            Billed by Apple. Cancel any time in your App Store account settings.
          </Muted>
        </View>
      ) : (
        <View style={{ gap: spacing.md }}>
          <View style={styles.priceCard}>
            <Text style={styles.priceLabel}>Monthly</Text>
            <View style={styles.priceRow}>
              <Text style={styles.price}>{price}</Text>
              <Text style={styles.per}> / month</Text>
            </View>
            <Text style={styles.priceNote}>
              {plan.trial ? `${plan.trial}, then ${price} a month. ` : ''}
              Renews automatically. Cancel any time.
            </Text>
          </View>

          {plan.canPurchase && plan.price === null && !plan.loadingProduct && (
            <View style={styles.storeError}>
              <Muted style={{ flex: 1 }}>The App Store did not answer, so the price above may differ in your country.</Muted>
              <Link onPress={plan.reloadProduct}>Try again</Link>
            </View>
          )}

          <Button
            title={plan.trial ? 'Start free trial' : `Subscribe for ${price} a month`}
            onPress={() => void subscribe()}
            loading={busy === 'buy' || (plan.canPurchase && plan.loadingProduct && plan.price === null)}
            disabled={busy !== null || !plan.canPurchase || plan.price === null}
          />
          <Button
            title="Restore purchases"
            variant="ghost"
            onPress={() => void restore()}
            loading={busy === 'restore'}
            disabled={busy !== null || !plan.canPurchase}
          />

          <Muted style={styles.legal}>
            {PLUS_NAME} is a monthly subscription at {price}
            {plan.trial ? ` after a free trial of ${plan.trial.replace(' free', '')}` : ''}. Payment is
            charged to your Apple Account at confirmation of purchase. The subscription renews
            automatically every month unless it is cancelled at least 24 hours before the end of the
            current period. Manage or cancel it in your App Store account settings. The free plan
            keeps working if you do not subscribe.
          </Muted>
          <View style={styles.links}>
            <Link onPress={() => void Linking.openURL(TERMS_URL)}>Terms of use</Link>
            <Link onPress={() => void Linking.openURL(PRIVACY_POLICY_URL)}>Privacy policy</Link>
          </View>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { paddingHorizontal: spacing.md, paddingTop: spacing.sm, gap: spacing.lg },
  header: { alignItems: 'center', gap: spacing.sm },
  crown: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: colors.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { ...type.title, fontSize: 30, lineHeight: 36, color: colors.text, textAlign: 'center' },
  centered: { textAlign: 'center' },
  usage: { alignItems: 'center' },
  benefit: { flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start' },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  benefitTitle: { ...type.label, color: colors.text },
  benefitBody: { ...type.caption, lineHeight: 19 },
  priceCard: {
    backgroundColor: colors.hero,
    borderRadius: radius.xl,
    padding: spacing.lg,
    gap: 4,
  },
  priceLabel: { ...type.captionBold, color: colors.heroMuted, textTransform: 'uppercase', letterSpacing: 0.6 },
  priceRow: { flexDirection: 'row', alignItems: 'baseline' },
  price: { ...type.title, color: colors.white },
  per: { ...type.bodyBold, color: colors.heroMuted },
  priceNote: { ...type.caption, color: colors.heroMuted },
  storeError: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  legal: { ...type.caption, textAlign: 'center' },
  links: { flexDirection: 'row', justifyContent: 'center', gap: spacing.lg },
});

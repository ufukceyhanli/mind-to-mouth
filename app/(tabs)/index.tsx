import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { SessionCard } from '../../src/components/SessionRow';
import {
  Badge,
  Button,
  Card,
  HeroCard,
  IconButton,
  MicDisc,
  Muted,
  PageHeader,
  PillRow,
  SectionHeader,
  SectionTitle,
} from '../../src/components/ui';
import {
  computeStreak,
  getNvidiaKey,
  loadSessions,
  practisedToday,
} from '../../src/storage';
import { colors, radius, spacing, type } from '../../src/theme';
import type { Session } from '../../src/types';

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [hasKey, setHasOpenAIKey] = useState<boolean | null>(null);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      (async () => {
        const [list, key] = await Promise.all([loadSessions(), getNvidiaKey()]);
        if (cancelled) return;
        setSessions(list);
        setHasOpenAIKey(Boolean(key));
      })();
      return () => {
        cancelled = true;
      };
    }, []),
  );

  const streak = computeStreak(sessions);
  const doneToday = practisedToday(sessions);
  const recent = sessions.slice(0, 3);
  const lastSeven = sessions.slice(0, 7);
  const avgRecent =
    lastSeven.length > 0
      ? Math.round(lastSeven.reduce((sum, s) => sum + s.finalScore, 0) / lastSeven.length)
      : null;
  const best = sessions.length > 0 ? Math.max(...sessions.map((s) => s.finalScore)) : null;

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[
        styles.content,
        { paddingTop: insets.top + spacing.lg, paddingBottom: spacing.xl },
      ]}
    >
      <PageHeader
        title="Today"
        style={styles.pad}
        right={
          <>
            <View style={styles.streakPill}>
              <Ionicons name="flame" size={18} color={colors.accent} />
              <Text style={styles.streakText}>{streak}</Text>
            </View>
            <IconButton
              icon="settings-outline"
              accessibilityLabel="Settings"
              onPress={() => router.push('/settings')}
            />
          </>
        }
      />

      <HeroCard
        style={styles.pad}
        disabled={hasKey === null}
        onPress={() => router.push(hasKey === false ? '/settings' : '/practice')}
      >
        <View style={styles.heroRow}>
          <View style={styles.heroText}>
            <Text style={styles.heroTitle}>
              {doneToday ? 'Practise again' : 'Today’s talk'}
            </Text>
            <Text style={styles.heroSubtitle}>One word. Two minutes. No script.</Text>
            <View style={styles.heroFooter}>
              <Badge>{doneToday ? 'Practised today' : 'Not yet today'}</Badge>
              <Text style={styles.heroLink}>
                {hasKey === false ? 'Add your API key' : 'Start now'}{' '}
                <Ionicons name="arrow-forward" size={18} color={colors.white} />
              </Text>
            </View>
          </View>
          <MicDisc size={116} style={styles.heroDisc} />
        </View>
      </HeroCard>

      {hasKey === false && (
        <Card style={[styles.pad, styles.setupCard]}>
          <SectionTitle style={{ fontSize: 20, lineHeight: 26 }}>
            One thing before you start
          </SectionTitle>
          <Muted style={{ marginBottom: spacing.md }}>
            Your talks are transcribed and coached by an AI service, so the app needs an access
            key. It stays in your phone’s keychain.
          </Muted>
          <Button title="Add access key" icon="key-outline" onPress={() => router.push('/settings')} />
        </Card>
      )}

      {sessions.length > 0 && (
        <PillRow
          style={styles.pad}
          items={[
            { icon: 'albums-outline', label: `${sessions.length} talk${sessions.length === 1 ? '' : 's'}` },
            { icon: 'trending-up-outline', label: `avg ${avgRecent === null ? '–' : avgRecent}` },
            { icon: 'trophy-outline', label: `best ${best === null ? '–' : best}` },
          ]}
        />
      )}

      {recent.length > 0 && (
        <View>
          <SectionHeader
            title="Recent talks"
            actionLabel="See all"
            onAction={() => router.push('/history')}
            style={styles.pad}
          />
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.carousel}
          >
            {recent.map((s) => (
              <SessionCard key={s.id} session={s} />
            ))}
          </ScrollView>
        </View>
      )}

      {sessions.length === 0 && hasKey && (
        <View style={styles.pad}>
          <SectionTitle>How it works</SectionTitle>
          <Card style={{ gap: spacing.sm }}>
            <Step n={1} text="You get a random word." />
            <Step n={2} text="A short countdown to gather your thoughts." />
            <Step n={3} text="Talk for at least two minutes. No script, no stopping." />
            <Step n={4} text="Your talk is transcribed and scored, with coaching notes." />
          </Card>
        </View>
      )}
    </ScrollView>
  );
}

function Step({ n, text }: { n: number; text: string }) {
  return (
    <View style={styles.step}>
      <View style={styles.stepNumber}>
        <Text style={styles.stepNumberText}>{n}</Text>
      </View>
      <Text style={styles.stepText}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { gap: spacing.lg },
  pad: { marginHorizontal: spacing.md },
  streakPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.accentSoft,
    borderRadius: radius.pill,
    paddingHorizontal: 12,
    height: 44,
  },
  streakText: { ...type.h3, color: colors.accent, fontVariant: ['tabular-nums'] },
  heroRow: { flexDirection: 'row', gap: spacing.md, minHeight: 170, alignItems: 'center' },
  heroText: { flex: 1, justifyContent: 'space-between' },
  heroTitle: { ...type.h2, fontSize: 28, lineHeight: 34, color: colors.white },
  heroSubtitle: { ...type.body, color: colors.heroMuted, marginTop: spacing.xs },
  heroFooter: { alignItems: 'flex-start', gap: spacing.md, marginTop: spacing.lg },
  heroLink: { ...type.h3, fontSize: 18, color: colors.white },
  heroDisc: { alignSelf: 'center' },
  setupCard: { borderWidth: 1.5, borderColor: colors.accentLight },
  carousel: { paddingHorizontal: spacing.md, gap: spacing.md },
  step: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  stepNumber: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepNumberText: { ...type.captionBold, color: colors.accent },
  stepText: { ...type.body, color: colors.text, flex: 1 },
});

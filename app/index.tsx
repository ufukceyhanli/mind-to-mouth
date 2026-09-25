import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { SessionRow } from '../src/components/SessionRow';
import { Button, Card, Muted, SectionTitle, Stat } from '../src/components/ui';
import {
  computeStreak,
  getNvidiaKey,
  loadSessions,
  practisedToday,
} from '../src/storage';
import { colors, radius, spacing } from '../src/theme';
import type { Session } from '../src/types';

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
        { paddingTop: insets.top + spacing.lg, paddingBottom: insets.bottom + spacing.xl },
      ]}
    >
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Mind to Mouth</Text>
          <Muted>One word. Two minutes. Every day.</Muted>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Settings"
          onPress={() => router.push('/settings')}
          style={styles.iconButton}
        >
          <Text style={styles.iconText}>⚙︎</Text>
        </Pressable>
      </View>

      <Card style={styles.streakCard}>
        <View style={styles.streakRow}>
          <Text style={styles.streakNumber}>{streak}</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.streakLabel}>day streak</Text>
            <Text style={[styles.todayLabel, doneToday ? styles.todayDone : styles.todayPending]}>
              {doneToday ? 'Practised today' : 'Not yet today'}
            </Text>
          </View>
        </View>
      </Card>

      {hasKey === false ? (
        <Card style={styles.setupCard}>
          <Text style={styles.setupTitle}>One thing before you start</Text>
          <Muted style={{ marginBottom: spacing.md }}>
            Your talks are transcribed and coached by models on build.nvidia.com, so the app
            needs a free NVIDIA API key. It stays in your phone’s keychain.
          </Muted>
          <Button title="Add API key" onPress={() => router.push('/settings')} />
        </Card>
      ) : (
        <Button
          title={doneToday ? 'Practise again' : 'Start today’s talk'}
          onPress={() => router.push('/practice')}
          disabled={hasKey === null}
          style={styles.startButton}
        />
      )}

      {sessions.length > 0 && (
        <Card>
          <View style={styles.statsRow}>
            <Stat label="talks" value={String(sessions.length)} />
            <Stat label="avg (last 7)" value={avgRecent === null ? '–' : String(avgRecent)} />
            <Stat label="best" value={best === null ? '–' : String(best)} />
          </View>
        </Card>
      )}

      {recent.length > 0 && (
        <View>
          <View style={styles.sectionHeader}>
            <SectionTitle>Recent</SectionTitle>
            <Pressable onPress={() => router.push('/history')}>
              <Text style={styles.link}>See all</Text>
            </Pressable>
          </View>
          {recent.map((s) => (
            <SessionRow key={s.id} session={s} />
          ))}
        </View>
      )}

      {sessions.length === 0 && hasKey && (
        <Card>
          <Text style={styles.howTitle}>How it works</Text>
          <Muted>1. You get a random word.</Muted>
          <Muted>2. A short countdown to gather your thoughts.</Muted>
          <Muted>3. Talk for at least two minutes. No script, no stopping.</Muted>
          <Muted>4. Your talk is transcribed and scored, with coaching notes.</Muted>
        </Card>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { paddingHorizontal: spacing.md, gap: spacing.md },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  title: { color: colors.text, fontSize: 30, fontWeight: '800', letterSpacing: -0.5 },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: radius.pill,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconText: { color: colors.text, fontSize: 20 },
  streakCard: { backgroundColor: colors.accentSoft, borderColor: colors.accentSoft },
  streakRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  streakNumber: { color: colors.accent, fontSize: 56, fontWeight: '800', lineHeight: 60 },
  streakLabel: { color: colors.text, fontSize: 18, fontWeight: '600' },
  todayLabel: { fontSize: 14, marginTop: 2 },
  todayDone: { color: colors.success },
  todayPending: { color: colors.muted },
  setupCard: { borderColor: colors.accent },
  setupTitle: { color: colors.text, fontSize: 18, fontWeight: '700', marginBottom: spacing.xs },
  startButton: { minHeight: 60 },
  statsRow: { flexDirection: 'row' },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  link: { color: colors.accent, fontWeight: '600', marginBottom: spacing.sm },
  howTitle: { color: colors.text, fontSize: 16, fontWeight: '700', marginBottom: spacing.sm },
});

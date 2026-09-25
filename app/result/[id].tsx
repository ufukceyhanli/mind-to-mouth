import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  Button,
  Card,
  Muted,
  ProgressBar,
  ScoreBadge,
  SectionTitle,
  Stat,
} from '../../src/components/ui';
import { getSession } from '../../src/storage';
import { colors, formatClock, scoreColor, spacing } from '../../src/theme';
import type { Session } from '../../src/types';

export default function ResultScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  // undefined = loading, null = not found
  const [session, setSession] = useState<Session | null | undefined>(() =>
    id ? undefined : null,
  );
  const [showTranscript, setShowTranscript] = useState(false);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    getSession(id).then((s) => {
      if (!cancelled) setSession(s);
    });
    return () => {
      cancelled = true;
    };
  }, [id]);

  if (session === undefined) {
    return (
      <View style={[styles.screen, styles.center]}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  if (session === null) {
    return (
      <View style={[styles.screen, styles.center]}>
        <Text style={styles.heading}>Talk not found</Text>
        <Button title="Home" variant="secondary" onPress={() => router.replace('/')} />
      </View>
    );
  }

  const { score, coach } = session;
  const coachTotal = coach ? coach.coherence + coach.structure + coach.relevance : null;

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.xl }]}
    >
      <View style={styles.hero}>
        <Muted>You talked about</Muted>
        <Text style={styles.word}>{session.word}</Text>
        <ScoreBadge score={session.finalScore} />
        {coach && (
          <Text style={styles.summary}>“{coach.summary}”</Text>
        )}
      </View>

      <Card>
        <View style={styles.statsRow}>
          <Stat label="length" value={formatClock(session.durationSec)} />
          <Stat label="words" value={String(score.stats.wordCount)} />
          <Stat label="wpm" value={String(score.stats.wordsPerMinute)} />
          <Stat label="fillers" value={String(score.stats.fillerCount)} />
        </View>
      </Card>

      <View>
        <SectionTitle>
          Delivery rubric · {score.total}/100{coach ? ' · 60% of final' : ''}
        </SectionTitle>
        <Card style={{ gap: spacing.md }}>
          {score.components.map((c) => (
            <View key={c.key}>
              <View style={styles.componentHeader}>
                <Text style={styles.componentLabel}>{c.label}</Text>
                <Text style={styles.componentPoints}>
                  {c.points}/{c.max}
                </Text>
              </View>
              <ProgressBar value={c.points} max={c.max} color={scoreColor((c.points / c.max) * 100)} />
              <Muted style={{ marginTop: 4, fontSize: 13 }}>{c.detail}</Muted>
            </View>
          ))}
        </Card>
      </View>

      <View>
        <SectionTitle>
          Coach{coachTotal !== null ? ` · ${coachTotal}/30 · 40% of final` : ''}
        </SectionTitle>
        {coach ? (
          <Card style={{ gap: spacing.md }}>
            <View style={styles.coachScores}>
              <CoachScore label="Coherence" value={coach.coherence} />
              <CoachScore label="Structure" value={coach.structure} />
              <CoachScore label="On topic" value={coach.relevance} />
            </View>
            <FeedbackList title="What worked" items={coach.strengths} color={colors.success} />
            <FeedbackList title="Try next time" items={coach.improvements} color={colors.warn} />
            <View>
              <Text style={styles.feedbackTitle}>Tomorrow’s drill</Text>
              <Text style={styles.body}>{coach.nextDrill}</Text>
            </View>
          </Card>
        ) : (
          <Card>
            <Muted>
              {session.coachError
                ? `Coaching unavailable: ${session.coachError}`
                : 'No coaching was recorded for this talk.'}
            </Muted>
          </Card>
        )}
      </View>

      <View>
        <Pressable onPress={() => setShowTranscript((v) => !v)} style={styles.transcriptToggle}>
          <SectionTitle>Transcript</SectionTitle>
          <Text style={styles.link}>{showTranscript ? 'Hide' : 'Show'}</Text>
        </Pressable>
        {showTranscript && (
          <Card>
            <Text style={styles.transcript}>{session.transcript}</Text>
          </Card>
        )}
      </View>

      <View style={styles.actions}>
        <Button title="Practise again" onPress={() => router.replace('/practice')} />
        <Button title="Home" variant="secondary" onPress={() => router.replace('/')} />
      </View>
    </ScrollView>
  );
}

function CoachScore({ label, value }: { label: string; value: number }) {
  return (
    <View style={styles.coachScore}>
      <Text style={[styles.coachScoreValue, { color: scoreColor(value * 10) }]}>{value}</Text>
      <Muted style={{ fontSize: 12 }}>{label}</Muted>
    </View>
  );
}

function FeedbackList({
  title,
  items,
  color,
}: {
  title: string;
  items: string[];
  color: string;
}) {
  if (items.length === 0) return null;
  return (
    <View>
      <Text style={styles.feedbackTitle}>{title}</Text>
      {items.map((item, i) => (
        <View key={i} style={styles.bulletRow}>
          <View style={[styles.bullet, { backgroundColor: color }]} />
          <Text style={[styles.body, { flex: 1 }]}>{item}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  center: { alignItems: 'center', justifyContent: 'center', gap: spacing.md },
  content: { padding: spacing.md, gap: spacing.md },
  hero: { alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.md },
  heading: { color: colors.text, fontSize: 22, fontWeight: '700' },
  word: {
    color: colors.text,
    fontSize: 34,
    fontWeight: '800',
    textTransform: 'capitalize',
    marginBottom: spacing.sm,
  },
  summary: {
    color: colors.text,
    fontSize: 16,
    lineHeight: 23,
    fontStyle: 'italic',
    textAlign: 'center',
    marginTop: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  statsRow: { flexDirection: 'row' },
  componentHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  componentLabel: { color: colors.text, fontSize: 15, fontWeight: '600' },
  componentPoints: { color: colors.muted, fontSize: 14, fontVariant: ['tabular-nums'] },
  coachScores: { flexDirection: 'row', justifyContent: 'space-around' },
  coachScore: { alignItems: 'center' },
  coachScoreValue: { fontSize: 28, fontWeight: '800' },
  feedbackTitle: { color: colors.text, fontSize: 15, fontWeight: '700', marginBottom: 6 },
  body: { color: colors.text, fontSize: 15, lineHeight: 22 },
  bulletRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: 6 },
  bullet: { width: 6, height: 6, borderRadius: 3, marginTop: 8 },
  transcriptToggle: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  link: { color: colors.accent, fontWeight: '600', marginBottom: spacing.sm },
  transcript: { color: colors.text, fontSize: 15, lineHeight: 23 },
  actions: { gap: spacing.sm, marginTop: spacing.sm },
});

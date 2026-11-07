import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PronunciationCard } from '../../src/components/PronunciationCard';
import { RecordingPlayer } from '../../src/components/RecordingPlayer';
import { TalkTile } from '../../src/components/SessionRow';
import {
  Body,
  BottomActions,
  Button,
  Card,
  Muted,
  PillRow,
  ProgressBar,
  ScoreBadge,
  SectionHeader,
  SectionTitle,
} from '../../src/components/ui';
import { getSession } from '../../src/storage';
import { colors, formatClock, scoreColor, spacing, type } from '../../src/theme';
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
        <Button title="Home" variant="secondary" icon="home-outline" onPress={() => router.replace('/')} />
      </View>
    );
  }

  const { score, coach } = session;
  const coachTotal = coach ? coach.coherence + coach.structure + coach.relevance : null;
  const date = new Date(session.createdAt).toLocaleDateString(undefined, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.hero}>
          <View style={styles.tileWrap}>
            <TalkTile
              seed={session.word}
              height={168}
              durationSec={session.durationSec}
              showPlay={false}
            />
            <View style={styles.scoreWrap}>
              <ScoreBadge score={session.finalScore} size={96} />
            </View>
          </View>
          <Text style={styles.word}>{session.word}</Text>
          <Text style={styles.date}>
            {date} · {score.stats.wordCount} words
          </Text>
          <Muted style={styles.kind}>Impromptu talk</Muted>
        </View>

        <PillRow
          items={[
            { icon: 'time-outline', label: formatClock(session.durationSec) },
            { icon: 'speedometer-outline', label: `${score.stats.wordsPerMinute} wpm` },
            { icon: 'chatbubble-ellipses-outline', label: `${score.stats.fillerCount} fillers` },
          ]}
        />

        {coach && (
          <View>
            <SectionTitle>How it went</SectionTitle>
            <Text style={styles.summary}>{coach.summary}</Text>
          </View>
        )}

        {session.audioFile && (
          <View>
            <SectionTitle>Listen back</SectionTitle>
            <RecordingPlayer fileName={session.audioFile} durationSec={session.durationSec} />
          </View>
        )}

        {session.pronunciation && session.pronunciation.status !== 'off' && (
          <View>
            <SectionTitle>Worth a listen</SectionTitle>
            <PronunciationCard
              session={session}
              onReport={(pronunciation) => setSession((s) => (s ? { ...s, pronunciation } : s))}
            />
          </View>
        )}

        <View>
          <SectionTitle style={{ marginBottom: 0 }}>Delivery</SectionTitle>
          <Muted style={styles.sectionMeta}>
            {score.total}/100{coach ? ' · 60% of final' : ''}
          </Muted>
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
                <Muted style={styles.detail}>{c.detail}</Muted>
              </View>
            ))}
          </Card>
        </View>

        <View>
          <SectionTitle style={{ marginBottom: 0 }}>Coach</SectionTitle>
          <Muted style={styles.sectionMeta}>
            {coachTotal !== null ? `${coachTotal}/30 · 40% of final` : 'Content scores'}
          </Muted>
          {coach ? (
            <Card style={{ gap: spacing.lg }}>
              <View style={styles.coachScores}>
                <CoachScore label="Coherence" value={coach.coherence} />
                <CoachScore label="Structure" value={coach.structure} />
                <CoachScore label="On topic" value={coach.relevance} />
              </View>
              <FeedbackList
                title="What worked"
                icon="checkmark-circle"
                items={coach.strengths}
                color={colors.success}
              />
              <FeedbackList
                title="Try next time"
                icon="arrow-up-circle"
                items={coach.improvements}
                color={colors.accent}
              />
              <View>
                <Text style={styles.feedbackTitle}>Tomorrow’s drill</Text>
                <Body>{coach.nextDrill}</Body>
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
          <SectionHeader
            title="Transcript"
            actionLabel={showTranscript ? 'Hide' : 'Show'}
            onAction={() => setShowTranscript((v) => !v)}
          />
          {showTranscript && (
            <Card>
              <Text style={styles.transcript}>{session.transcript}</Text>
            </Card>
          )}
        </View>
      </ScrollView>

      <BottomActions style={[styles.footer, { paddingBottom: insets.bottom + spacing.sm }]}>
        <Button
          title="Practise again"
          icon="mic"
          onPress={() => router.replace('/practice')}
          style={styles.half}
        />
        <Button
          title="Home"
          variant="secondary"
          icon="home-outline"
          onPress={() => router.replace('/')}
          style={styles.half}
        />
      </BottomActions>
    </View>
  );
}

function CoachScore({ label, value }: { label: string; value: number }) {
  return (
    <View style={styles.coachScore}>
      <Text style={[styles.coachScoreValue, { color: scoreColor(value * 10) }]}>{value}</Text>
      <Muted style={styles.coachScoreLabel}>{label}</Muted>
    </View>
  );
}

function FeedbackList({
  title,
  icon,
  items,
  color,
}: {
  title: string;
  icon: 'checkmark-circle' | 'arrow-up-circle';
  items: string[];
  color: string;
}) {
  if (items.length === 0) return null;
  return (
    <View>
      <Text style={styles.feedbackTitle}>{title}</Text>
      {items.map((item, i) => (
        <View key={i} style={styles.bulletRow}>
          <Ionicons name={icon} size={20} color={color} style={{ marginTop: 2 }} />
          <Body style={{ flex: 1 }}>{item}</Body>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  center: { alignItems: 'center', justifyContent: 'center', gap: spacing.md },
  content: { padding: spacing.md, paddingBottom: spacing.lg, gap: spacing.lg },
  hero: { alignItems: 'center', gap: spacing.xs, paddingTop: spacing.sm },
  tileWrap: { alignSelf: 'stretch', marginBottom: spacing.xl },
  scoreWrap: { position: 'absolute', alignSelf: 'center', bottom: -spacing.xl + 4 },
  heading: { ...type.h2, color: colors.text },
  word: { ...type.title, color: colors.text, textTransform: 'capitalize', textAlign: 'center' },
  date: { ...type.body, fontSize: 18, color: colors.text, textAlign: 'center' },
  kind: { ...type.captionBold, fontSize: 15, color: colors.muted },
  summary: { ...type.bodyLarge, color: colors.text },
  sectionMeta: { ...type.caption, fontSize: 14, marginBottom: spacing.sm },
  componentHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  componentLabel: { ...type.label, color: colors.text },
  componentPoints: { ...type.label, color: colors.muted, fontVariant: ['tabular-nums'] },
  detail: { ...type.caption, marginTop: 6 },
  coachScores: { flexDirection: 'row', justifyContent: 'space-around' },
  coachScore: { alignItems: 'center' },
  coachScoreValue: { fontFamily: type.title.fontFamily, fontSize: 30, lineHeight: 36 },
  coachScoreLabel: { ...type.caption },
  feedbackTitle: { ...type.h3, color: colors.text, marginBottom: spacing.sm },
  bulletRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.sm },
  transcript: { ...type.body, fontSize: 17, lineHeight: 27, color: colors.text },
  footer: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    backgroundColor: colors.bg,
  },
  half: { flex: 1 },
});

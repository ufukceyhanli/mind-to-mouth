import { setAudioModeAsync, useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import * as Speech from 'expo-speech';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { runPronunciationCheck } from '../pronunciation';
import { recordingUri } from '../recordings';
import { colors, radius, spacing } from '../theme';
import type { PronunciationIssue, PronunciationReport, Session } from '../types';
import { Button, Card, Muted } from './ui';

/** How much of the saved talk to play around a flagged word, in seconds. */
const SNIPPET_BEFORE = 1.2;
const SNIPPET_AFTER = 1.5;

/**
 * "Worth a listen" words for a talk. Kicks off the check itself when the
 * session still says pending, reports progress while it runs, and offers
 * two ways to hear each word: the system voice, and the speaker's own
 * attempt from the saved recording.
 */
export function PronunciationCard({
  session,
  onReport,
}: {
  session: Session;
  onReport: (report: PronunciationReport) => void;
}) {
  const report = session.pronunciation;
  const status = report?.status;
  const [progress, setProgress] = useState<[number, number] | null>(null);

  useEffect(() => {
    if (status !== 'pending') return;
    let cancelled = false;
    runPronunciationCheck(session, (done, total) => {
      if (!cancelled) setProgress([done, total]);
    }).then((result) => {
      if (!cancelled) onReport(result);
    });
    return () => {
      cancelled = true;
    };
    // The check reads the session once; re-running on every field change
    // would restart it needlessly.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, session.id]);

  if (!report || status === 'off') return null;

  if (status === 'pending') {
    return (
      <Card style={styles.pendingRow}>
        <ActivityIndicator color={colors.accent} />
        <Muted>
          Listening for tricky words…{progress ? ` ${progress[0]}/${progress[1]}` : ''}
        </Muted>
      </Card>
    );
  }

  if (status === 'error') {
    return (
      <Card style={{ gap: spacing.md }}>
        <Muted>Pronunciation check failed: {report.error ?? 'unknown error'}</Muted>
        <Button
          title="Try again"
          variant="secondary"
          onPress={() => {
            setProgress(null);
            onReport({ status: 'pending', issues: [], error: null });
          }}
        />
      </Card>
    );
  }

  if (report.issues.length === 0) {
    return (
      <Card>
        <Muted>Nothing stood out. Every word came through clearly.</Muted>
      </Card>
    );
  }

  return <IssueList issues={report.issues} audioFile={session.audioFile ?? null} />;
}

function IssueList({
  issues,
  audioFile,
}: {
  issues: PronunciationIssue[];
  audioFile: string | null;
}) {
  const uri = useMemo(() => (audioFile ? recordingUri(audioFile) : null), [audioFile]);
  const player = useAudioPlayer(uri ? { uri } : null);
  const playerStatus = useAudioPlayerStatus(player);
  const stopAtRef = useRef<number | null>(null);
  const [playingIndex, setPlayingIndex] = useState<number | null>(null);
  const [speakingIndex, setSpeakingIndex] = useState<number | null>(null);

  useEffect(() => {
    void setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true });
    return () => {
      void Speech.stop();
    };
  }, []);

  // Stop the snippet once it has run past the flagged word.
  useEffect(() => {
    const stopAt = stopAtRef.current;
    if (stopAt === null) return;
    if (!playerStatus.playing || playerStatus.currentTime >= stopAt || playerStatus.didJustFinish) {
      player.pause();
      stopAtRef.current = null;
      setPlayingIndex(null);
    }
  }, [player, playerStatus.playing, playerStatus.currentTime, playerStatus.didJustFinish]);

  const hearYours = async (index: number, atSec: number) => {
    await Speech.stop();
    setSpeakingIndex(null);
    if (playingIndex === index) {
      player.pause();
      stopAtRef.current = null;
      setPlayingIndex(null);
      return;
    }
    stopAtRef.current = atSec + SNIPPET_AFTER;
    setPlayingIndex(index);
    await player.seekTo(Math.max(0, atSec - SNIPPET_BEFORE));
    player.play();
  };

  const hearCorrect = async (index: number, word: string) => {
    if (playingIndex !== null) {
      player.pause();
      stopAtRef.current = null;
      setPlayingIndex(null);
    }
    await Speech.stop();
    setSpeakingIndex(index);
    Speech.speak(word, {
      language: 'en-US',
      rate: 0.85,
      onDone: () => setSpeakingIndex((v) => (v === index ? null : v)),
      onStopped: () => setSpeakingIndex((v) => (v === index ? null : v)),
      onError: () => setSpeakingIndex((v) => (v === index ? null : v)),
    });
  };

  return (
    <Card style={{ gap: spacing.md }}>
      <Muted style={{ fontSize: 13 }}>
        These are suggestions from the model, not a measurement. Tap to compare.
      </Muted>
      {issues.map((issue, index) => {
        const canHearYours = uri !== null && issue.atSec !== null && playerStatus.isLoaded;
        return (
          <View key={`${issue.word}-${index}`} style={styles.issue}>
            <Text style={styles.word}>{issue.word}</Text>
            {issue.heard.length > 0 && issue.heard.toLowerCase() !== issue.word && (
              <Muted style={{ fontSize: 13 }}>Sounded like “{issue.heard}”</Muted>
            )}
            {issue.tip.length > 0 && <Text style={styles.tip}>{issue.tip}</Text>}
            <View style={styles.buttons}>
              <PlayChip
                label={speakingIndex === index ? 'Speaking…' : 'Hear it'}
                active={speakingIndex === index}
                onPress={() => void hearCorrect(index, issue.word)}
              />
              {canHearYours && (
                <PlayChip
                  label={playingIndex === index ? 'Stop' : 'Hear yours'}
                  active={playingIndex === index}
                  onPress={() => void hearYours(index, issue.atSec as number)}
                />
              )}
            </View>
          </View>
        );
      })}
    </Card>
  );
}

function PlayChip({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.chip, active && styles.chipActive, pressed && { opacity: 0.8 }]}
    >
      <Text style={[styles.chipText, active && styles.chipTextActive]}>
        {active ? '■ ' : '▶ '}
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pendingRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  issue: {
    gap: spacing.xs,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  word: { color: colors.text, fontSize: 18, fontWeight: '700', textTransform: 'capitalize' },
  tip: { color: colors.text, fontSize: 15, lineHeight: 21 },
  buttons: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.xs },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    borderRadius: radius.pill,
    backgroundColor: colors.cardAlt,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipActive: { backgroundColor: colors.accentSoft, borderColor: colors.accent },
  chipText: { color: colors.text, fontSize: 14, fontWeight: '600' },
  chipTextActive: { color: colors.accent },
});

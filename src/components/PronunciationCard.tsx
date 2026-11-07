import { setAudioModeAsync, useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import * as Speech from 'expo-speech';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { runPronunciationCheck } from '../pronunciation';
import { recordingUri } from '../recordings';
import { colors, spacing, type } from '../theme';
import type { PronunciationIssue, PronunciationReport, Session } from '../types';
import { Button, Card, Chip, Muted } from './ui';

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
      <Muted style={type.caption}>
        These are suggestions from the model, not a measurement. Tap to compare.
      </Muted>
      {issues.map((issue, index) => {
        const canHearYours = uri !== null && issue.atSec !== null && playerStatus.isLoaded;
        return (
          <View key={`${issue.word}-${index}`} style={styles.issue}>
            <Text style={styles.word}>{issue.word}</Text>
            {issue.heard.length > 0 && issue.heard.toLowerCase() !== issue.word && (
              <Muted style={type.caption}>Sounded like “{issue.heard}”</Muted>
            )}
            {issue.tip.length > 0 && <Text style={styles.tip}>{issue.tip}</Text>}
            <View style={styles.buttons}>
              <Chip
                label={speakingIndex === index ? 'Speaking…' : 'Hear it'}
                icon={speakingIndex === index ? 'stop' : 'volume-high-outline'}
                selected={speakingIndex === index}
                onPress={() => void hearCorrect(index, issue.word)}
              />
              {canHearYours && (
                <Chip
                  label={playingIndex === index ? 'Stop' : 'Hear yours'}
                  icon={playingIndex === index ? 'stop' : 'play'}
                  selected={playingIndex === index}
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

const styles = StyleSheet.create({
  pendingRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  issue: {
    gap: spacing.xs,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  word: { ...type.h3, color: colors.text, textTransform: 'capitalize' },
  tip: { ...type.body, color: colors.text },
  buttons: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
});

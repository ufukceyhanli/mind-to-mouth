import {
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioRecorder,
  useAudioRecorderState,
} from 'expo-audio';
import { File } from 'expo-file-system';
import * as Haptics from 'expo-haptics';
import { useKeepAwake } from 'expo-keep-awake';
import { router } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { describeCoachError, getCoachFeedback } from '../src/coach';
import { Button, Muted } from '../src/components/ui';
import { blendScore, scoreTalk } from '../src/scoring';
import {
  getAnthropicKey,
  getOpenAIKey,
  loadSessions,
  loadSettings,
  saveSession,
} from '../src/storage';
import { colors, formatClock, radius, spacing } from '../src/theme';
import { transcribeRecording } from '../src/transcribe';
import { DEFAULT_SETTINGS, type CoachFeedback, type Session, type Settings } from '../src/types';
import { pickWord } from '../src/words';

type Phase = 'loading' | 'no-permission' | 'reveal' | 'recording' | 'processing' | 'error';

type Recorded = { uri: string; durationSec: number };

export default function PracticeScreen() {
  useKeepAwake();
  const insets = useSafeAreaInsets();

  const recorder = useAudioRecorder({
    ...RecordingPresets.HIGH_QUALITY,
    numberOfChannels: 1,
    isMeteringEnabled: true,
  });
  const recorderState = useAudioRecorderState(recorder, 100);

  const [phase, setPhase] = useState<Phase>('loading');
  const [word, setWord] = useState('');
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [prepLeft, setPrepLeft] = useState(DEFAULT_SETTINGS.prepSeconds);
  const [elapsed, setElapsed] = useState(0);
  const [statusText, setStatusText] = useState('');
  const [errorText, setErrorText] = useState('');
  const [recorded, setRecorded] = useState<Recorded | null>(null);

  const recentWordsRef = useRef<string[]>([]);
  const startAtRef = useRef<number | null>(null);
  const reachedMinRef = useRef(false);
  const finishingRef = useRef(false);
  const openAIKeyRef = useRef<string | null>(null);
  const anthropicKeyRef = useRef<string | null>(null);

  // ---- Setup ---------------------------------------------------------------

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [loadedSettings, sessions, openAIKey, anthropicKey] = await Promise.all([
        loadSettings(),
        loadSessions(),
        getOpenAIKey(),
        getAnthropicKey(),
      ]);
      if (cancelled) return;
      openAIKeyRef.current = openAIKey;
      anthropicKeyRef.current = anthropicKey;
      recentWordsRef.current = sessions.slice(0, 30).map((s) => s.word);
      setSettings(loadedSettings);
      setPrepLeft(loadedSettings.prepSeconds);

      const permission = await requestRecordingPermissionsAsync();
      if (cancelled) return;
      if (!permission.granted) {
        setPhase('no-permission');
        return;
      }
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      if (cancelled) return;
      setWord(pickWord(recentWordsRef.current));
      setPhase('reveal');
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // ---- Recording control ---------------------------------------------------

  const startRecording = useCallback(async () => {
    if (startAtRef.current !== null) return;
    try {
      await recorder.prepareToRecordAsync();
      recorder.record();
      startAtRef.current = Date.now();
      reachedMinRef.current = false;
      setElapsed(0);
      setPhase('recording');
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch (e) {
      setErrorText(e instanceof Error ? e.message : 'Could not start the microphone.');
      setPhase('error');
    }
  }, [recorder]);

  const runPipeline = useCallback(
    async (recorded: Recorded, topic: string, currentSettings: Settings) => {
      setPhase('processing');
      try {
        const openAIKey = openAIKeyRef.current;
        if (!openAIKey) {
          throw new Error('No OpenAI API key. Add one in Settings to get transcripts.');
        }

        setStatusText('Transcribing your talk…');
        const transcription = await transcribeRecording({
          uri: recorded.uri,
          apiKey: openAIKey,
          topic,
        });
        if (transcription.text.length === 0) {
          throw new Error('The recording came back silent. Check the microphone and try again.');
        }

        setStatusText('Scoring…');
        const rubric = scoreTalk({
          transcription,
          topic,
          durationSec: recorded.durationSec,
          minSeconds: currentSettings.minSeconds,
        });

        let coach: CoachFeedback | null = null;
        let coachError: string | null = null;
        const anthropicKey = anthropicKeyRef.current;
        if (anthropicKey) {
          setStatusText('Asking your coach…');
          try {
            coach = await getCoachFeedback({
              apiKey: anthropicKey,
              topic,
              transcript: transcription.text,
              durationSec: recorded.durationSec,
              rubric,
            });
          } catch (e) {
            coachError = describeCoachError(e);
          }
        }

        const session: Session = {
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          word: topic,
          createdAt: new Date().toISOString(),
          durationSec: Math.round(recorded.durationSec),
          transcript: transcription.text,
          score: rubric,
          coach,
          coachError,
          finalScore: blendScore(rubric, coach),
        };
        await saveSession(session);

        try {
          new File(recorded.uri).delete();
        } catch {
          // The cache directory is cleaned by the OS eventually; not critical.
        }

        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        router.replace({ pathname: '/result/[id]', params: { id: session.id } });
      } catch (e) {
        setErrorText(e instanceof Error ? e.message : 'Something went wrong.');
        setPhase('error');
      }
    },
    [],
  );

  const finishRecording = useCallback(async () => {
    if (finishingRef.current || startAtRef.current === null) return;
    finishingRef.current = true;
    const durationSec = (Date.now() - startAtRef.current) / 1000;
    try {
      await recorder.stop();
    } catch {
      // If stop throws we still try to use whatever was written.
    }
    const uri = recorder.uri;
    startAtRef.current = null;
    finishingRef.current = false;
    if (!uri) {
      setErrorText('The recording could not be saved.');
      setPhase('error');
      return;
    }
    const result = { uri, durationSec };
    setRecorded(result);
    void runPipeline(result, word, settings);
  }, [recorder, runPipeline, word, settings]);

  const discard = useCallback(() => {
    Alert.alert('Discard this talk?', 'Nothing will be saved.', [
      { text: 'Keep going', style: 'cancel' },
      {
        text: 'Discard',
        style: 'destructive',
        onPress: async () => {
          if (startAtRef.current !== null) {
            startAtRef.current = null;
            try {
              await recorder.stop();
            } catch {
              // ignore
            }
          }
          router.back();
        },
      },
    ]);
  }, [recorder]);

  // ---- Timers --------------------------------------------------------------

  useEffect(() => {
    if (phase !== 'reveal') return;
    const id = setTimeout(() => {
      if (prepLeft <= 1) {
        void startRecording();
      } else {
        setPrepLeft((p) => p - 1);
      }
    }, 1000);
    return () => clearTimeout(id);
  }, [phase, prepLeft, startRecording]);

  useEffect(() => {
    if (phase !== 'recording') return;
    const id = setInterval(() => {
      if (startAtRef.current === null) return;
      const seconds = (Date.now() - startAtRef.current) / 1000;
      setElapsed(seconds);
      if (!reachedMinRef.current && seconds >= settings.minSeconds) {
        reachedMinRef.current = true;
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
      if (seconds >= settings.maxSeconds) {
        void finishRecording();
      }
    }, 250);
    return () => clearInterval(id);
  }, [phase, settings.minSeconds, settings.maxSeconds, finishRecording]);

  // ---- Render --------------------------------------------------------------

  const container = [
    styles.screen,
    { paddingTop: insets.top + spacing.lg, paddingBottom: insets.bottom + spacing.lg },
  ];

  if (phase === 'loading') {
    return (
      <View style={[container, styles.center]}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  if (phase === 'no-permission') {
    return (
      <View style={[container, styles.center]}>
        <Text style={styles.heading}>Microphone needed</Text>
        <Muted style={styles.centeredText}>
          Allow microphone access in iOS Settings, then come back to practise.
        </Muted>
        <Button title="Back" variant="secondary" onPress={() => router.back()} />
      </View>
    );
  }

  if (phase === 'reveal') {
    return (
      <View style={container}>
        <Muted style={styles.centeredText}>Your word is</Muted>
        <View style={styles.center}>
          <Text style={styles.word}>{word}</Text>
          <Text style={styles.prepNumber}>{prepLeft}</Text>
          <Muted style={styles.centeredText}>
            Think of a way in. Recording starts automatically.
          </Muted>
        </View>
        <View style={styles.actions}>
          <Button title="I’m ready, start now" onPress={() => void startRecording()} />
          <Button
            title="Different word"
            variant="ghost"
            onPress={() => {
              setWord(pickWord([...recentWordsRef.current, word]));
              setPrepLeft(settings.prepSeconds);
            }}
          />
        </View>
      </View>
    );
  }

  if (phase === 'recording') {
    const remaining = settings.minSeconds - elapsed;
    const reached = remaining <= 0;
    const level = meteringToLevel(recorderState.metering);
    const ringSize = 120 + level * 80;
    return (
      <View style={container}>
        <Muted style={styles.centeredText}>Talking about</Muted>
        <Text style={styles.wordSmall}>{word}</Text>

        <View style={styles.center}>
          <View style={styles.ringWrap}>
            <View
              style={[
                styles.ring,
                {
                  width: ringSize,
                  height: ringSize,
                  borderRadius: ringSize / 2,
                  backgroundColor: reached ? colors.success : colors.accent,
                  opacity: 0.15 + level * 0.35,
                },
              ]}
            />
            <View style={styles.dot} />
          </View>
          <Text style={[styles.timer, reached && { color: colors.success }]}>
            {reached ? `+${formatClock(-remaining)}` : formatClock(remaining)}
          </Text>
          <Muted style={styles.centeredText}>
            {reached
              ? 'Target reached. Land the plane whenever you like.'
              : `Keep going until the clock hits zero (${formatClock(settings.minSeconds)} total).`}
          </Muted>
        </View>

        <View style={styles.actions}>
          <Button
            title={reached ? 'Finish' : `Finish (unlocks at 0:00)`}
            onPress={() => void finishRecording()}
            disabled={!reached}
          />
          <Button title="Discard" variant="ghost" onPress={discard} />
        </View>
      </View>
    );
  }

  if (phase === 'processing') {
    return (
      <View style={[container, styles.center]}>
        <ActivityIndicator color={colors.accent} size="large" />
        <Text style={[styles.heading, { marginTop: spacing.lg }]}>{statusText}</Text>
        <Muted style={styles.centeredText}>This usually takes 10 to 30 seconds.</Muted>
      </View>
    );
  }

  return (
    <View style={[container, styles.center]}>
      <Text style={styles.heading}>That didn’t work</Text>
      <Muted style={[styles.centeredText, { marginBottom: spacing.lg }]}>{errorText}</Muted>
      <View style={styles.actionsInline}>
        {recorded && (
          <Button title="Retry" onPress={() => void runPipeline(recorded, word, settings)} />
        )}
        <Button title="Settings" variant="secondary" onPress={() => router.push('/settings')} />
        <Button title="Home" variant="ghost" onPress={() => router.replace('/')} />
      </View>
    </View>
  );
}

/** expo-audio reports metering in dBFS (roughly -160..0). Map to 0..1. */
function meteringToLevel(metering: number | undefined): number {
  if (typeof metering !== 'number' || !Number.isFinite(metering)) return 0;
  return Math.max(0, Math.min(1, (metering + 50) / 50));
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg, paddingHorizontal: spacing.lg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md },
  centeredText: { textAlign: 'center' },
  heading: { color: colors.text, fontSize: 22, fontWeight: '700', textAlign: 'center' },
  word: {
    color: colors.text,
    fontSize: 48,
    fontWeight: '800',
    textTransform: 'capitalize',
    textAlign: 'center',
    letterSpacing: -1,
  },
  wordSmall: {
    color: colors.text,
    fontSize: 28,
    fontWeight: '700',
    textTransform: 'capitalize',
    textAlign: 'center',
    marginTop: spacing.xs,
  },
  prepNumber: { color: colors.accent, fontSize: 96, fontWeight: '800', lineHeight: 104 },
  ringWrap: { width: 200, height: 200, alignItems: 'center', justifyContent: 'center' },
  ring: { position: 'absolute' },
  dot: { width: 24, height: 24, borderRadius: radius.pill, backgroundColor: colors.danger },
  timer: {
    color: colors.text,
    fontSize: 64,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
    letterSpacing: -1,
  },
  actions: { gap: spacing.sm },
  actionsInline: { width: '100%', gap: spacing.sm },
});

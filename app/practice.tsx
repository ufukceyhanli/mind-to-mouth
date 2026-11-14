import {
  AudioQuality,
  IOSOutputFormat,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioRecorder,
  useAudioRecorderState,
  type RecordingOptions,
} from 'expo-audio';
import { File } from 'expo-file-system';
import * as Haptics from 'expo-haptics';
import * as Linking from 'expo-linking';
import { useKeepAwake } from 'expo-keep-awake';
import { router } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  analyzePauses,
  isWav,
  measureVolume,
  parseWav,
  speechSecondsByChunk,
  splitIntoWindows,
  type PcmAudio,
  type VolumeStats,
} from '../src/audio';
import { coachConfigured, describeCoachError, getCoachFeedback } from '../src/coach';
import { DataSharingNotice } from '../src/components/DataSharingNotice';
import { Badge, BottomActions, Button, Card, MicDisc, Muted } from '../src/components/ui';
import { usePlan } from '../src/plan/PlanProvider';
import { effectiveMaxSeconds, freeTalksLeft } from '../src/plan/limits';
import { loadUsage, recordTalk } from '../src/plan/usage';
import { persistRecording } from '../src/recordings';
import { blendScore, scoreTalk } from '../src/scoring';
import {
  getDataSharingConsent,
  loadSessions,
  loadSettings,
  saveSession,
  setDataSharingConsent,
} from '../src/storage';
import { colors, formatClock, radius, spacing, type } from '../src/theme';
import {
  describeTranscriptionError,
  requestSpeechPermission,
  transcribeFile,
  type RecognizedWord,
} from '../src/transcribe';
import {
  DEFAULT_SETTINGS,
  type CoachFeedback,
  type Session,
  type Settings,
  type SpeechSegment,
  type Transcription,
} from '../src/types';
import { pickWord } from '../src/words';

type Phase =
  | 'loading'
  | 'consent'
  | 'no-permission'
  | 'no-speech-permission'
  | 'reveal'
  | 'recording'
  | 'processing'
  | 'error';

type Recorded = { uri: string; durationSec: number };

/**
 * Uncompressed 16 kHz mono WAV: the format Apple's recognizer reads from a
 * file, and easy to analyse for pauses and loudness on-device.
 */
const WAV_RECORDING: RecordingOptions = {
  extension: '.wav',
  sampleRate: 16000,
  numberOfChannels: 1,
  bitRate: 256000,
  isMeteringEnabled: true,
  ios: {
    outputFormat: IOSOutputFormat.LINEARPCM,
    audioQuality: AudioQuality.MAX,
    linearPCMBitDepth: 16,
    linearPCMIsBigEndian: false,
    linearPCMIsFloat: false,
  },
  android: {
    // Android's recorder cannot write WAV; the recognizer gets this file as-is.
    extension: '.m4a',
    outputFormat: 'mpeg4',
    audioEncoder: 'aac',
  },
  web: { mimeType: 'audio/wav' },
};

/** Length of the stretches the pace-over-time measure is taken on. */
const PACE_WINDOW_SEC = 15;

/**
 * Words per stretch of the talk, from the recognizer's word timestamps, next
 * to the seconds of actual speech in that stretch from the audio.
 */
function buildSegments(pcm: PcmAudio, words: RecognizedWord[]): SpeechSegment[] {
  const windows = splitIntoWindows(pcm, PACE_WINDOW_SEC);
  const speechSec = speechSecondsByChunk(pcm, windows);
  let startSec = 0;
  return windows.map((w, i) => {
    const durationSec = w.samples.length / pcm.sampleRate;
    const endSec = startSec + durationSec;
    const count = words.filter((word) => word.startSec >= startSec && word.startSec < endSec).length;
    startSec = endSec;
    return { words: count, durationSec, speechSec: speechSec[i] ?? durationSec };
  });
}

export default function PracticeScreen() {
  useKeepAwake();
  const insets = useSafeAreaInsets();
  const plan = usePlan();
  // Read inside callbacks that must not re-run when the plan changes.
  const planRef = useRef(plan);
  useEffect(() => {
    planRef.current = plan;
  }, [plan]);

  const recorder = useAudioRecorder(WAV_RECORDING);
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

  // ---- Setup ---------------------------------------------------------------

  const cancelledRef = useRef(false);

  // Asks for the microphone and speech recognition, then shows the word.
  // Runs once the user has agreed to the transcript going to the coach.
  const beginSession = useCallback(async () => {
    const permission = await requestRecordingPermissionsAsync();
    if (cancelledRef.current) return;
    if (!permission.granted) {
      setPhase('no-permission');
      return;
    }
    const speechAllowed = await requestSpeechPermission();
    if (cancelledRef.current) return;
    if (!speechAllowed) {
      setPhase('no-speech-permission');
      return;
    }
    await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
    if (cancelledRef.current) return;
    setWord(pickWord(recentWordsRef.current));
    setPhase('reveal');
  }, []);

  useEffect(() => {
    // Wait until it is known whether this is a Plus subscriber.
    if (!plan.ready) return;
    cancelledRef.current = false;
    (async () => {
      const [loadedSettings, sessions, consent, usage] = await Promise.all([
        loadSettings(),
        loadSessions(),
        getDataSharingConsent(),
        loadUsage(),
      ]);
      if (cancelledRef.current) return;
      // The free plan's weekly talks are used up: show Plus instead of a word.
      // Today already routes there; this covers every other way in.
      if (!planRef.current.isPlus && freeTalksLeft(usage, new Date()) === 0) {
        router.replace('/plus');
        return;
      }
      recentWordsRef.current = sessions.slice(0, 30).map((s) => s.word);
      setSettings(loadedSettings);
      setPrepLeft(loadedSettings.prepSeconds);

      if (!consent) {
        setPhase('consent');
        return;
      }
      await beginSession();
    })();
    return () => {
      cancelledRef.current = true;
    };
  }, [beginSession, plan.ready]);

  const agreeToSharing = useCallback(async () => {
    await setDataSharingConsent(true);
    if (cancelledRef.current) return;
    setPhase('loading');
    await beginSession();
  }, [beginSession]);

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
    async (rec: Recorded, topic: string, currentSettings: Settings) => {
      setPhase('processing');
      try {
        setStatusText('Measuring the audio…');
        let pcm: PcmAudio | null = null;
        let longestPauseSec: number | null = null;
        let volume: VolumeStats | null = null;
        try {
          const bytes = await new File(rec.uri).bytes();
          if (isWav(bytes)) {
            pcm = parseWav(bytes);
            longestPauseSec = analyzePauses(pcm).longestPauseSec;
            volume = measureVolume(pcm);
          }
        } catch {
          // Pause and volume measures are extras; the transcript is what matters.
        }

        setStatusText('Transcribing on your phone…');
        let transcribed;
        try {
          transcribed = await transcribeFile({
            uri: rec.uri,
            durationSec: rec.durationSec,
            onProgress: (soFar) => {
              const words = soFar.split(/\s+/).filter(Boolean).length;
              if (words > 0) setStatusText(`Transcribing on your phone… ${words} words`);
            },
          });
        } catch (e) {
          throw new Error(describeTranscriptionError(e));
        }
        const text = transcribed.text;
        if (text.length === 0) {
          throw new Error('No speech was recognised. Check the microphone and try again.');
        }
        // Words per stretch against its speaking time gives the pace over time.
        const segments: SpeechSegment[] = pcm ? buildSegments(pcm, transcribed.words) : [];
        const transcription: Transcription = {
          text,
          longestPauseSec,
          onDevice: transcribed.onDevice,
          segments,
          volume,
        };

        setStatusText('Scoring…');
        const rubric = scoreTalk({
          transcription,
          topic,
          durationSec: rec.durationSec,
          minSeconds: currentSettings.minSeconds,
        });

        let coach: CoachFeedback | null = null;
        let coachError: string | null = null;
        if (coachConfigured) {
          setStatusText('Asking your coach…');
          try {
            coach = await getCoachFeedback({
              topic,
              transcript: text,
              durationSec: rec.durationSec,
              rubric,
            });
          } catch (e) {
            coachError = describeCoachError(e);
          }
        } else {
          coachError = 'This build has no coach configured.';
        }

        const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

        // Keep the audio so the talk can be listened to again from History.
        let audioFile: string | null = null;
        try {
          audioFile = await persistRecording(rec.uri, id);
        } catch {
          // Playback is a nice-to-have; the transcript and scores still get saved.
        }

        const session: Session = {
          id,
          word: topic,
          createdAt: new Date().toISOString(),
          durationSec: Math.round(rec.durationSec),
          transcript: text,
          score: rubric,
          coach,
          coachError,
          finalScore: blendScore(rubric, coach),
          audioFile,
          // Checked lazily by the result screen so the score is not held up.
          pronunciation: {
            // A Plus feature. Runs on the phone when the result is first opened.
            status:
              planRef.current.isPlus && currentSettings.checkPronunciation && audioFile
                ? 'pending'
                : 'off',
            issues: [],
            error: null,
          },
        };
        await saveSession(session);
        // Counts towards the free plan's week only once a talk has been scored.
        await recordTalk();

        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        router.replace({ pathname: '/result/[id]', params: { id: session.id } });
      } catch (e) {
        setErrorText(e instanceof Error ? e.message : 'Something went wrong while scoring.');
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

  // Free talks auto-stop sooner than the length picked in Settings.
  const maxSeconds = effectiveMaxSeconds(settings, plan.isPlus);

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
      if (seconds >= maxSeconds) {
        void finishRecording();
      }
    }, 250);
    return () => clearInterval(id);
  }, [phase, settings.minSeconds, maxSeconds, finishRecording]);

  // ---- Render --------------------------------------------------------------

  const container = [
    styles.screen,
    { paddingTop: insets.top + spacing.md, paddingBottom: insets.bottom + spacing.md },
  ];

  if (phase === 'loading') {
    return (
      <View style={[container, styles.center]}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  if (phase === 'consent') {
    return (
      <View style={container}>
        <ScrollView contentContainerStyle={styles.consentContent}>
          <Text style={styles.heading}>Before your first talk</Text>
          <Muted style={styles.centeredText}>
            Your talk is turned into text on this phone. The text then goes to an AI coach for
            feedback. Here is exactly what happens.
          </Muted>
          <Card>
            <DataSharingNotice />
          </Card>
          <Muted style={styles.centeredText}>
            You can withdraw this at any time in Settings.
          </Muted>
        </ScrollView>
        <View style={styles.stacked}>
          <Button title="Agree and continue" icon="checkmark" onPress={() => void agreeToSharing()} />
          <Button title="Not now" variant="ghost" onPress={() => router.back()} />
        </View>
      </View>
    );
  }

  if (phase === 'no-permission' || phase === 'no-speech-permission') {
    const speech = phase === 'no-speech-permission';
    return (
      <View style={container}>
        <View style={styles.center}>
          <Text style={styles.heading}>
            {speech ? 'Speech recognition needed' : 'Microphone needed'}
          </Text>
          <Muted style={styles.centeredText}>
            {speech
              ? 'iOS turns your talk into text on this phone, and that needs Speech Recognition. Allow it for Mind to Mouth in iOS Settings, then come back to practise.'
              : 'Mind to Mouth cannot record a talk without the microphone. Allow it in iOS Settings, then come back to practise.'}
          </Muted>
        </View>
        <BottomActions>
          <Button
            title="Open Settings"
            icon="settings-outline"
            onPress={() => void Linking.openSettings()}
            style={styles.half}
          />
          <Button
            title="Back"
            variant="secondary"
            icon="chevron-back"
            onPress={() => router.back()}
            style={styles.half}
          />
        </BottomActions>
      </View>
    );
  }

  if (phase === 'reveal') {
    return (
      <View style={container}>
        <View style={styles.topRow}>
          <Badge tone="light" style={styles.centeredBadge}>
            Your word is
          </Badge>
        </View>
        <View style={styles.center}>
          <MicDisc size={160} />
          <Text style={styles.word}>{word}</Text>
          <Text style={styles.prepNumber}>{prepLeft}</Text>
          <Muted style={styles.centeredText}>
            Think of a way in. Recording starts automatically.
          </Muted>
        </View>
        <BottomActions>
          <Button
            title="I’m ready"
            icon="mic"
            onPress={() => void startRecording()}
            style={styles.half}
          />
          <Button
            title="Different word"
            variant="secondary"
            icon="shuffle"
            onPress={() => {
              setWord(pickWord([...recentWordsRef.current, word]));
              setPrepLeft(settings.prepSeconds);
            }}
            style={styles.half}
          />
        </BottomActions>
      </View>
    );
  }

  if (phase === 'recording') {
    const remaining = settings.minSeconds - elapsed;
    const reached = remaining <= 0;
    const level = meteringToLevel(recorderState.metering);
    const ringSize = 120 + level * 80;
    const tint = reached ? colors.success : colors.accent;
    return (
      <View style={container}>
        <View style={styles.topRow}>
          <Badge tone="light" style={styles.centeredBadge}>
            Talking about
          </Badge>
          <Text style={styles.wordSmall}>{word}</Text>
        </View>

        <View style={styles.center}>
          <View style={styles.ringWrap}>
            <View
              style={[
                styles.ring,
                {
                  width: ringSize,
                  height: ringSize,
                  borderRadius: ringSize / 2,
                  backgroundColor: tint,
                  opacity: 0.15 + level * 0.35,
                },
              ]}
            />
            <View style={[styles.dot, { backgroundColor: tint }]} />
          </View>
          <Text style={[styles.timer, reached && { color: colors.success }]}>
            {reached ? `+${formatClock(-remaining)}` : formatClock(remaining)}
          </Text>
          <Muted style={styles.centeredText}>
            {reached
              ? `Target reached. Land the plane whenever you like.${
                  plan.isPlus ? '' : ` Free talks stop at ${formatClock(maxSeconds)}.`
                }`
              : `Keep going until the clock hits zero (${formatClock(settings.minSeconds)} total).`}
          </Muted>
        </View>

        <BottomActions>
          <Button
            title={reached ? 'Finish' : 'Unlocks at 0:00'}
            icon={reached ? 'checkmark' : 'lock-closed-outline'}
            onPress={() => void finishRecording()}
            disabled={!reached}
            style={styles.half}
          />
          <Button
            title="Discard"
            variant="secondary"
            icon="close"
            onPress={discard}
            style={styles.half}
          />
        </BottomActions>
      </View>
    );
  }

  if (phase === 'processing') {
    return (
      <View style={[container, styles.center]}>
        <ActivityIndicator color={colors.accent} size="large" />
        <Text style={[styles.heading, { marginTop: spacing.lg }]}>{statusText}</Text>
        <Muted style={styles.centeredText}>This usually takes 15 to 45 seconds.</Muted>
      </View>
    );
  }

  return (
    <View style={container}>
      <View style={styles.center}>
        <Text style={styles.heading}>That didn’t work</Text>
        <Muted style={styles.centeredText}>{errorText}</Muted>
      </View>
      <View style={styles.actionsStacked}>
        {recorded && (
          <Button
            title="Retry"
            icon="refresh"
            onPress={() => void runPipeline(recorded, word, settings)}
          />
        )}
        <Button
          title="Settings"
          variant="secondary"
          icon="settings-outline"
          onPress={() => router.push('/settings')}
        />
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
  screen: { flex: 1, backgroundColor: colors.bg, paddingHorizontal: spacing.md },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md },
  centeredText: { textAlign: 'center', paddingHorizontal: spacing.md },
  consentContent: { gap: spacing.lg, paddingBottom: spacing.lg, paddingTop: spacing.lg },
  stacked: { gap: spacing.sm },
  topRow: { alignItems: 'center', gap: spacing.sm },
  centeredBadge: { alignSelf: 'center' },
  heading: { ...type.h2, color: colors.text, textAlign: 'center' },
  word: {
    ...type.title,
    fontSize: 40,
    lineHeight: 46,
    color: colors.text,
    textTransform: 'capitalize',
    textAlign: 'center',
  },
  wordSmall: {
    ...type.h2,
    fontSize: 28,
    lineHeight: 34,
    color: colors.text,
    textTransform: 'capitalize',
    textAlign: 'center',
  },
  prepNumber: {
    fontFamily: type.title.fontFamily,
    color: colors.accent,
    fontSize: 88,
    lineHeight: 96,
    fontVariant: ['tabular-nums'],
  },
  ringWrap: { width: 200, height: 200, alignItems: 'center', justifyContent: 'center' },
  ring: { position: 'absolute' },
  dot: { width: 28, height: 28, borderRadius: radius.pill },
  timer: {
    fontFamily: type.title.fontFamily,
    color: colors.text,
    fontSize: 64,
    lineHeight: 72,
    fontVariant: ['tabular-nums'],
    letterSpacing: -1,
  },
  half: { flex: 1 },
  actionsStacked: { gap: spacing.sm },
});

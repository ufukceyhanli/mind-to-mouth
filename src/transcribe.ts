/**
 * On-device speech to text via the platform recognizer (Apple's Speech
 * framework on iOS, the system recognizer on Android), wrapped by
 * expo-speech-recognition. Nothing is uploaded and there is no quota: the
 * recorded file is fed to the recognizer and the final utterances are
 * stitched back together, keeping each word's timing and confidence.
 */
import {
  ExpoSpeechRecognitionModule,
  type ExpoSpeechRecognitionErrorCode,
  type ExpoSpeechRecognitionResultSegment,
} from 'expo-speech-recognition';
import { Platform } from 'react-native';

export const TRANSCRIBE_LANG = 'en-US';

export class TranscriptionError extends Error {
  code: ExpoSpeechRecognitionErrorCode | 'timeout' | 'unavailable';
  constructor(code: TranscriptionError['code'], message: string) {
    super(message);
    this.name = 'TranscriptionError';
    this.code = code;
  }
}

/** One recognised word with where it sits in the recording. */
export type RecognizedWord = {
  text: string;
  startSec: number;
  endSec: number;
  /** 0–1 from the recognizer; 0 when it reported none. */
  confidence: number;
};

export type TranscribeResult = {
  text: string;
  words: RecognizedWord[];
  /** True when the audio never left the phone. */
  onDevice: boolean;
};

/** Asks for the speech recognizer permission (iOS prompts; Android has none). */
export async function requestSpeechPermission(): Promise<boolean> {
  if (Platform.OS !== 'ios') return true;
  try {
    const current = await ExpoSpeechRecognitionModule.getSpeechRecognizerPermissionsAsync();
    if (current.granted) return true;
    const asked = await ExpoSpeechRecognitionModule.requestSpeechRecognizerPermissionsAsync();
    return asked.granted;
  } catch {
    return false;
  }
}

/** Whether recognition can run fully offline for the practice language. */
export function supportsOnDevice(): boolean {
  try {
    return ExpoSpeechRecognitionModule.supportsOnDeviceRecognition();
  } catch {
    return false;
  }
}

function joinUtterances(finals: string[], interim: string): string {
  return [...finals, interim]
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function toWords(segments: ExpoSpeechRecognitionResultSegment[] | undefined): RecognizedWord[] {
  if (!segments) return [];
  return segments
    .filter((s) => s.segment.trim().length > 0)
    .map((s) => ({
      text: s.segment.trim(),
      startSec: s.startTimeMillis / 1000,
      endSec: s.endTimeMillis / 1000,
      confidence: Number.isFinite(s.confidence) ? Math.max(0, Math.min(1, s.confidence)) : 0,
    }));
}

/**
 * Transcribes a recorded file. Resolves once the recognizer emits `end`.
 *
 * On iOS 18+ Apple finalises each utterance separately, so several `result`
 * events arrive with `isFinal: true`; each carries just that utterance. They
 * are concatenated in order, plus whatever interim text was still pending
 * when the stream ended. Word timestamps are relative to the start of the
 * recording.
 */
export function transcribeFile(params: {
  uri: string;
  /** Recording length, used to size the safety timeout. */
  durationSec: number;
  onProgress?: (textSoFar: string) => void;
}): Promise<TranscribeResult> {
  const { uri, durationSec, onProgress } = params;
  const onDevice = supportsOnDevice();

  return new Promise<TranscribeResult>((resolve, reject) => {
    const finals: string[] = [];
    const finalWords: RecognizedWord[] = [];
    let interim = '';
    let interimWords: RecognizedWord[] = [];
    let failure: TranscriptionError | null = null;
    let settled = false;

    // The file is streamed to the recognizer far faster than real time, but
    // leave generous headroom for slow devices before giving up.
    const timeoutMs = Math.max(60_000, durationSec * 2_000);
    const timer = setTimeout(() => {
      failure = new TranscriptionError('timeout', 'Speech recognition took too long.');
      try {
        ExpoSpeechRecognitionModule.abort();
      } catch {
        finish();
      }
    }, timeoutMs);

    const subscriptions = [
      ExpoSpeechRecognitionModule.addListener('result', (event) => {
        const best = event.results[0];
        const transcript = best?.transcript ?? '';
        if (event.isFinal) {
          if (transcript.trim().length > 0) {
            finals.push(transcript.trim());
            finalWords.push(...toWords(best?.segments));
          }
          interim = '';
          interimWords = [];
        } else {
          interim = transcript;
          interimWords = toWords(best?.segments);
        }
        onProgress?.(joinUtterances(finals, interim));
      }),
      ExpoSpeechRecognitionModule.addListener('error', (event) => {
        // "no-speech" after some text was recognised just means the tail was quiet.
        if (event.error === 'no-speech' && finals.length > 0) return;
        if (!failure) failure = new TranscriptionError(event.error, event.message);
      }),
      ExpoSpeechRecognitionModule.addListener('end', finish),
    ];

    function finish() {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      for (const sub of subscriptions) sub.remove();
      const text = joinUtterances(finals, interim);
      if (failure && text.length === 0) {
        reject(failure);
      } else {
        resolve({ text, words: [...finalWords, ...interimWords], onDevice });
      }
    }

    try {
      ExpoSpeechRecognitionModule.start({
        lang: TRANSCRIBE_LANG,
        interimResults: true,
        continuous: true,
        requiresOnDeviceRecognition: onDevice,
        addsPunctuation: true,
        iosTaskHint: 'dictation',
        audioSource: { uri },
      });
    } catch (e) {
      failure = new TranscriptionError(
        'unavailable',
        e instanceof Error ? e.message : 'Speech recognition could not start.',
      );
      finish();
    }
  });
}

export function describeTranscriptionError(error: unknown): string {
  if (error instanceof TranscriptionError) {
    switch (error.code) {
      case 'not-allowed':
      case 'service-not-allowed':
        return 'Speech recognition is not allowed. Enable it for Mind to Mouth in iOS Settings → Privacy.';
      case 'language-not-supported':
        return 'This device cannot recognise English speech.';
      case 'no-speech':
      case 'audio-capture':
        return 'No speech was recognised. Check the microphone and try again.';
      case 'network':
        return 'Speech recognition needs a connection on this device. Check your network.';
      case 'timeout':
        return 'Transcription took too long. Try a shorter talk.';
      case 'unavailable':
        return `Speech recognition is unavailable: ${error.message}`;
      default:
        return `Speech recognition failed (${error.code}): ${error.message}`;
    }
  }
  if (error instanceof Error) return error.message;
  return 'Unknown transcription error.';
}

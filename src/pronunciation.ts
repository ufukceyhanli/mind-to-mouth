/**
 * Second pass over a saved talk: the same audio chunks the transcript came
 * from go back to the audio model with a "which words sounded off" prompt.
 * Runs the first time a result screen is opened, so the score is never held
 * up by it, and the outcome is written back onto the session.
 */
import { File } from 'expo-file-system';

import { encodeImaAdpcmWav, isWav, parseWav, splitAtQuietPoints } from './audio';
import { assessPronunciation, describeNvidiaError } from './nvidia';
import { recordingUri } from './recordings';
import { getNvidiaKey, loadSettings, updateSession } from './storage';
import type { PronunciationReport, Session } from './types';

export type ProgressListener = (done: number, total: number) => void;

const inFlight = new Map<string, Promise<PronunciationReport>>();

/**
 * Checks a talk's pronunciation and stores the report on the session.
 * Calling it again for the same talk while a check is running returns the
 * same promise instead of starting a second one.
 */
export function runPronunciationCheck(
  session: Session,
  onProgress?: ProgressListener,
): Promise<PronunciationReport> {
  const existing = inFlight.get(session.id);
  if (existing) return existing;
  const task = (async () => {
    const report = await check(session, onProgress);
    await updateSession(session.id, { pronunciation: report });
    return report;
  })().finally(() => inFlight.delete(session.id));
  inFlight.set(session.id, task);
  return task;
}

async function check(session: Session, onProgress?: ProgressListener): Promise<PronunciationReport> {
  try {
    if (!session.audioFile) throw new Error('No recording was kept for this talk.');
    const uri = recordingUri(session.audioFile);
    if (!uri) throw new Error('The recording is no longer on this device.');
    const [apiKey, settings] = await Promise.all([getNvidiaKey(), loadSettings()]);
    if (!apiKey) throw new Error('No NVIDIA API key. Add one in Settings.');

    const bytes = await new File(uri).bytes();
    const chunks = isWav(bytes) ? wavChunks(bytes) : [{ wavBytes: bytes, offsetSec: 0 }];
    const issues = await assessPronunciation({
      apiKey,
      model: settings.transcribeModel,
      chunks,
      onProgress,
    });
    return { status: 'done', issues, error: null };
  } catch (e) {
    return { status: 'error', issues: [], error: describeNvidiaError(e) };
  }
}

/** Same cut points as transcription, plus where each chunk starts in the talk. */
function wavChunks(bytes: Uint8Array): { wavBytes: Uint8Array; offsetSec: number }[] {
  const pcm = parseWav(bytes);
  let offsetSamples = 0;
  return splitAtQuietPoints(pcm).map((chunk) => {
    const entry = {
      wavBytes: encodeImaAdpcmWav(chunk),
      offsetSec: offsetSamples / pcm.sampleRate,
    };
    offsetSamples += chunk.samples.length;
    return entry;
  });
}

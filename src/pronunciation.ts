/**
 * Second pass over a saved talk: the recording goes through the on-device
 * recognizer again and the words it was least sure of are flagged as worth
 * a second listen. Runs the first time a result screen is opened, so the
 * score is never held up by it, and the outcome is written back onto the
 * session. Nothing leaves the phone.
 */
import { recordingUri } from './recordings';
import { updateSession } from './storage';
import { describeTranscriptionError, transcribeFile, type RecognizedWord } from './transcribe';
import type { PronunciationIssue, PronunciationReport, Session } from './types';

export type ProgressListener = (done: number, total: number) => void;

/** Words at or above this confidence are taken as clearly said. */
const MAX_FLAGGED_CONFIDENCE = 0.55;
const MIN_WORD_LENGTH = 3;
const MAX_ISSUES = 10;

// Function words and fillers are mumbled by everyone; flagging them is noise.
const SKIP_WORDS = new Set([
  'the', 'and', 'but', 'for', 'that', 'this', 'with', 'you', 'are', 'was', 'were', 'have',
  'has', 'had', 'not', 'from', 'they', 'them', 'then', 'than', 'there', 'their', 'what',
  'when', 'where', 'which', 'who', 'how', 'why', 'can', 'could', 'would', 'should', 'will',
  'just', 'like', 'yeah', 'okay', 'umm', 'uhh', 'hmm', 'well', 'know', 'mean', 'kind', 'sort',
  'thing', 'things', 'something', 'really', 'very', 'also', 'into', 'about', 'because', 'its',
  'your', 'our', 'his', 'her', 'she', 'him', 'one', 'two', 'all', 'any', 'some', 'more',
  'much', 'many', 'out', 'over', 'get', 'got', 'going', 'gonna', 'want', 'wanna',
]);

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

/** Keeps letters, digits, apostrophes and hyphens: enough for a dictionary word. */
function normaliseWord(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^\p{L}\p{N}'-]+/gu, ' ')
    .trim();
}

/**
 * Picks the words the recognizer was least sure of. Confidence is Apple's
 * own 0–1 figure per word; it reflects how clearly the word came through,
 * not accent. Returns null when the recognizer reported no confidences at
 * all, which some devices do.
 */
export function pickUnclearWords(words: RecognizedWord[]): PronunciationIssue[] | null {
  const measured = words.filter((w) => w.confidence > 0);
  if (measured.length === 0) return null;

  const candidates = measured
    .map((w) => ({ ...w, word: normaliseWord(w.text) }))
    .filter(
      (w) =>
        w.word.length >= MIN_WORD_LENGTH &&
        !SKIP_WORDS.has(w.word) &&
        w.confidence < MAX_FLAGGED_CONFIDENCE,
    )
    .sort((a, b) => a.confidence - b.confidence);

  const seen = new Set<string>();
  const picked: (RecognizedWord & { word: string })[] = [];
  for (const c of candidates) {
    if (seen.has(c.word)) continue;
    seen.add(c.word);
    picked.push(c);
    if (picked.length >= MAX_ISSUES) break;
  }
  picked.sort((a, b) => a.startSec - b.startSec);

  return picked.map((w) => ({
    word: w.word,
    heard: '',
    tip: `Recognised with ${Math.round(w.confidence * 100)}% confidence. Try it slower, one syllable at a time.`,
    atSec: Math.round(w.startSec * 10) / 10,
  }));
}

async function check(session: Session, onProgress?: ProgressListener): Promise<PronunciationReport> {
  try {
    if (!session.audioFile) throw new Error('No recording was kept for this talk.');
    const uri = recordingUri(session.audioFile);
    if (!uri) throw new Error('The recording is no longer on this device.');

    const total = Math.max(1, session.score.stats.wordCount);
    const { words } = await transcribeFile({
      uri,
      durationSec: session.durationSec,
      onProgress: (text) => {
        const done = text.split(/\s+/).filter(Boolean).length;
        onProgress?.(Math.min(done, total), total);
      },
    });
    const issues = pickUnclearWords(words);
    if (issues === null) {
      throw new Error('This device did not report how sure it was of each word.');
    }
    return { status: 'done', issues, error: null };
  } catch (e) {
    return { status: 'error', issues: [], error: describeTranscriptionError(e) };
  }
}

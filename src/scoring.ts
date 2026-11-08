import type {
  CoachFeedback,
  ScoreBreakdown,
  ScoreComponent,
  SpeechSegment,
  Transcription,
} from './types';

/**
 * Deterministic, on-device rubric. 100 points total:
 *   duration 15 · pace 15 · rate variation 10 · volume 10 · fluency 15 ·
 *   vocabulary 10 · relevance 15 · flow 10
 * Every component explains itself so the user can see exactly what moved.
 */

const FILLERS_MULTI = ['you know', 'kind of', 'sort of', 'i mean', 'or whatever'];
// "so", "right" and "okay" are left out on purpose: they are fillers in speech
// but far too common as ordinary words to count without context.
const FILLERS_SINGLE = new Set([
  'um', 'uh', 'umm', 'uhh', 'er', 'erm', 'hmm', 'like', 'basically', 'literally',
  'actually', 'obviously',
]);

const STOP_WORDS = new Set([
  'the', 'a', 'an', 'and', 'or', 'but', 'of', 'to', 'in', 'on', 'at', 'for',
  'with', 'is', 'it', 'that', 'this', 'i', 'you', 'we', 'they', 'he', 'she',
  'my', 'your', 'be', 'was', 'are', 'were', 'have', 'has', 'do', 'not', 'as',
]);

export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9'\s-]/g, ' ')
    .split(/\s+/)
    .map((w) => w.replace(/^['-]+|['-]+$/g, ''))
    .filter((w) => w.length > 0);
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n));
}

/** Linear ramp: 0 at `zero`, 1 at `full` (works in either direction). */
function ramp(value: number, zero: number, full: number): number {
  if (zero === full) return value >= full ? 1 : 0;
  return clamp((value - zero) / (full - zero), 0, 1);
}

function countFillers(tokens: string[], text: string): number {
  let count = 0;
  const lower = text.toLowerCase();
  for (const phrase of FILLERS_MULTI) {
    const re = new RegExp(`\\b${phrase.replace(' ', '\\s+')}\\b`, 'g');
    count += (lower.match(re) ?? []).length;
  }
  for (const t of tokens) {
    if (FILLERS_SINGLE.has(t)) count += 1;
  }
  return count;
}

/** Crude stemmer good enough to match "bridges", "bridged", "bridging" to "bridge". */
function stem(word: string): string {
  let w = word.toLowerCase();
  for (const suffix of ['ing', 'edly', 'ed', 'es', 's', 'ly', 'er', 'est']) {
    if (w.length > suffix.length + 3 && w.endsWith(suffix)) {
      w = w.slice(0, -suffix.length);
      break;
    }
  }
  return w.replace(/e$/, '');
}

function countTopicMentions(tokens: string[], topic: string): number {
  const topicTokens = tokenize(topic);
  if (topicTokens.length === 0) return 0;
  if (topicTokens.length === 1) {
    const target = stem(topicTokens[0]);
    return tokens.filter((t) => stem(t) === target).length;
  }
  // Multi-word topic ("time travel"): count any of the content words.
  const targets = new Set(topicTokens.filter((t) => !STOP_WORDS.has(t)).map(stem));
  return tokens.filter((t) => targets.has(stem(t))).length;
}

export function scoreTalk(params: {
  transcription: Transcription;
  topic: string;
  durationSec: number;
  minSeconds: number;
}): ScoreBreakdown {
  const { transcription, topic, durationSec, minSeconds } = params;
  const tokens = tokenize(transcription.text);
  const wordCount = tokens.length;
  const minutes = Math.max(durationSec, 1) / 60;
  const wpm = Math.round(wordCount / minutes);
  const fillerCount = countFillers(tokens, transcription.text);
  const fillersPer100 = wordCount > 0 ? (fillerCount / wordCount) * 100 : 0;
  const contentTokens = tokens.filter((t) => !STOP_WORDS.has(t));
  const uniqueWords = new Set(contentTokens).size;
  const topicMentions = countTopicMentions(tokens, topic);
  const pause = transcription.longestPauseSec;

  const components: ScoreComponent[] = [];

  // Duration (15): full marks for reaching the minimum.
  const durationRatio = clamp(durationSec / minSeconds, 0, 1);
  components.push({
    key: 'duration',
    label: 'Kept talking',
    points: Math.round(15 * durationRatio),
    max: 15,
    detail:
      durationRatio >= 1
        ? `You reached the ${Math.round(minSeconds / 60)}-minute target.`
        : `Stopped at ${Math.round(durationSec)}s of ${minSeconds}s.`,
  });

  // Pace (15): sweet spot 120-160 wpm; fades to zero at 70 and 230.
  let paceScore: number;
  if (wpm < 120) paceScore = ramp(wpm, 70, 120);
  else if (wpm <= 160) paceScore = 1;
  else paceScore = 1 - ramp(wpm, 160, 230);
  components.push({
    key: 'pace',
    label: 'Pace',
    points: Math.round(15 * paceScore),
    max: 15,
    detail:
      wpm < 120
        ? `${wpm} words/min is on the slow side. Aim for 120–160.`
        : wpm > 160
          ? `${wpm} words/min is quick. Aim for 120–160 so ideas land.`
          : `${wpm} words/min sits in the conversational sweet spot.`,
  });

  // Rate variation (10): a voice that speeds up for the story and slows down
  // for the point holds attention; a flat rate sends people to sleep.
  const variety = measurePaceVariation(transcription.segments);
  let varietyScore: number;
  let varietyDetail: string;
  if (variety === null) {
    varietyScore = wordCount > 0 ? 0.7 : 0;
    varietyDetail = 'Not enough timing data to measure changes of pace.';
  } else {
    const { cv, min, max } = variety;
    // Rates are measured while actually speaking, with pauses left out, so a
    // pause does not read as "slow". Unrehearsed talks naturally spread about
    // 10%; under ~5% reads as monotone, ~20% and up is lively and deliberate.
    varietyScore = ramp(cv, 0.05, 0.2);
    // Past ~45% the changes stop feeling deliberate; ease the score back.
    if (cv > 0.45) varietyScore *= 1 - 0.5 * ramp(cv, 0.45, 0.8);
    varietyDetail =
      cv < 0.05
        ? `While speaking you held a steady ${min}–${max} words/min. Speed up for a story, slow down for the point.`
        : cv > 0.45
          ? `While speaking your rate swung from ${min} to ${max} words/min. Vary it on purpose, not at random.`
          : cv < 0.2
            ? `While speaking your rate moved between ${min} and ${max} words/min. More contrast would hold attention.`
            : `While speaking your rate ranged from ${min} to ${max} words/min. Good variety.`;
  }
  components.push({
    key: 'variety',
    label: 'Rate variation',
    points: Math.round(10 * varietyScore),
    max: 10,
    detail: varietyDetail,
  });

  // Volume (10): sit around 7 on the 0-10 scale most of the time, so there is
  // room to drop to 4 for intimacy and push to 9 for emphasis, and use it.
  const volume = transcription.volume;
  let volumeScore: number;
  let volumeDetail: string;
  if (!volume) {
    volumeScore = wordCount > 0 ? 0.7 : 0;
    volumeDetail = 'Not enough audio data to measure volume.';
  } else {
    const { typicalLevel, lowLevel, highLevel } = volume;
    // Level: full marks between 6.5 and 7.5; zero at 4.5 (quiet) and 9.5 (shouting).
    const levelScore =
      typicalLevel < 6.5 ? ramp(typicalLevel, 4.5, 6.5) : 1 - ramp(typicalLevel, 7.5, 9.5);
    // Dynamics: a spread of two levels (8 dB) between quiet and loud stretches is lively.
    const spread = highLevel - lowLevel;
    const dynamicsScore = ramp(spread, 0.5, 2);
    volumeScore = 0.6 * levelScore + 0.4 * dynamicsScore;
    const where = `Volume sat around ${typicalLevel.toFixed(1)}/10 most of the time (${lowLevel.toFixed(1)}–${highLevel.toFixed(1)}).`;
    volumeDetail =
      typicalLevel < 6.5
        ? `${where} Project more: aim for 7 so you can drop to 4 and push to 9.`
        : typicalLevel > 7.5
          ? `${where} A touch loud throughout. Settle at 7 and save 9 for key moments.`
          : spread < 1
            ? `${where} Good level. Now vary it: down to 4 for intimacy, up to 9 for emphasis.`
            : `${where} Good level and good dynamics.`;
  }
  components.push({
    key: 'volume',
    label: 'Volume',
    points: Math.round(10 * volumeScore),
    max: 10,
    detail: volumeDetail,
  });

  // Fluency (15): ≤1 filler per 100 words is clean; ≥8 per 100 is zero.
  const fluencyScore = wordCount === 0 ? 0 : 1 - ramp(fillersPer100, 1, 8);
  components.push({
    key: 'fluency',
    label: 'Fluency',
    points: Math.round(15 * fluencyScore),
    max: 15,
    detail:
      fillerCount === 0
        ? 'No filler words detected.'
        : `${fillerCount} filler word${fillerCount === 1 ? '' : 's'} (${fillersPer100.toFixed(1)} per 100 words).`,
  });

  // Vocabulary (10): root type-token ratio, ~0.55 counts as rich for a 2-min talk.
  const rootTtr = contentTokens.length > 0 ? uniqueWords / Math.sqrt(contentTokens.length) : 0;
  const vocabScore = ramp(rootTtr, 3.5, 8);
  components.push({
    key: 'vocabulary',
    label: 'Vocabulary range',
    points: Math.round(10 * vocabScore),
    max: 10,
    detail: `${uniqueWords} distinct content words out of ${contentTokens.length}.`,
  });

  // Relevance (15): did the talk actually orbit the prompt?
  let relevanceScore: number;
  if (topicMentions === 0) relevanceScore = 0;
  else if (topicMentions === 1) relevanceScore = 0.5;
  else if (topicMentions === 2) relevanceScore = 0.8;
  else relevanceScore = 1;
  components.push({
    key: 'relevance',
    label: 'On topic',
    points: Math.round(15 * relevanceScore),
    max: 15,
    detail:
      topicMentions === 0
        ? `"${topic}" never came up. Tie your ideas back to the word.`
        : `You returned to "${topic}" ${topicMentions} time${topicMentions === 1 ? '' : 's'}.`,
  });

  // Flow (10): long silences break the spell. <1.5s fine, ≥4s is zero.
  let flowScore: number;
  let flowDetail: string;
  if (pause === null) {
    flowScore = wordCount > 0 ? 0.7 : 0;
    flowDetail = 'Not enough timing data to measure pauses.';
  } else {
    flowScore = 1 - ramp(pause, 1.5, 4);
    flowDetail =
      pause < 1.5
        ? `Longest pause ${pause}s. Smooth.`
        : `Longest pause ${pause}s. A bridging phrase beats silence.`;
  }
  components.push({
    key: 'flow',
    label: 'Flow',
    points: Math.round(10 * flowScore),
    max: 10,
    detail: flowDetail,
  });

  const total = components.reduce((sum, c) => sum + c.points, 0);

  return {
    total,
    components,
    stats: {
      wordCount,
      wordsPerMinute: wpm,
      fillerCount,
      uniqueWords,
      topicMentions,
      longestPauseSec: pause,
      paceRange: variety ? [variety.min, variety.max] : null,
      volumeLevel: volume ? volume.typicalLevel : null,
      volumeRange: volume ? [volume.lowLevel, volume.highLevel] : null,
    },
  };
}

/** Chunks with this little speech, or this few words, say nothing reliable about pace. */
const MIN_SEGMENT_SPEECH_SEC = 3;
const MIN_SEGMENT_WORDS = 5;
const MIN_SEGMENTS = 3;

/**
 * How much the speaking rate changes over a talk, from the words per minute
 * of actual speech in each transcribed chunk. Returns the coefficient of
 * variation (standard deviation over the mean) plus the slowest and fastest
 * chunk, or null when there are too few usable chunks to say anything.
 */
export function measurePaceVariation(
  segments: SpeechSegment[],
): { cv: number; min: number; max: number } | null {
  const rates = segments
    .filter((s) => s.speechSec >= MIN_SEGMENT_SPEECH_SEC && s.words >= MIN_SEGMENT_WORDS)
    .map((s) => (s.words / s.speechSec) * 60);
  if (rates.length < MIN_SEGMENTS) return null;
  const mean = rates.reduce((a, b) => a + b, 0) / rates.length;
  if (mean <= 0) return null;
  const variance = rates.reduce((a, r) => a + (r - mean) ** 2, 0) / rates.length;
  return {
    cv: Math.sqrt(variance) / mean,
    min: Math.round(Math.min(...rates)),
    max: Math.round(Math.max(...rates)),
  };
}

/**
 * Final score shown to the user. Without coach feedback it is the rubric.
 * With it, 60% rubric + 40% coach (coherence, structure, relevance out of 30).
 */
export function blendScore(rubric: ScoreBreakdown, coach: CoachFeedback | null): number {
  if (!coach) return rubric.total;
  const coachTotal = clamp(coach.coherence + coach.structure + coach.relevance, 0, 30);
  const coachPct = (coachTotal / 30) * 100;
  return Math.round(0.6 * rubric.total + 0.4 * coachPct);
}

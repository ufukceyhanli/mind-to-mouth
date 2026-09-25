import type {
  CoachFeedback,
  ScoreBreakdown,
  ScoreComponent,
  Transcription,
} from './types';

/**
 * Deterministic, on-device rubric. 100 points total:
 *   duration 20 · pace 20 · fluency 20 · vocabulary 15 · relevance 15 · flow 10
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

  // Duration (20): full marks for reaching the minimum.
  const durationRatio = clamp(durationSec / minSeconds, 0, 1);
  components.push({
    key: 'duration',
    label: 'Kept talking',
    points: Math.round(20 * durationRatio),
    max: 20,
    detail:
      durationRatio >= 1
        ? `You reached the ${Math.round(minSeconds / 60)}-minute target.`
        : `Stopped at ${Math.round(durationSec)}s of ${minSeconds}s.`,
  });

  // Pace (20): sweet spot 120-160 wpm; fades to zero at 70 and 230.
  let paceScore: number;
  if (wpm < 120) paceScore = ramp(wpm, 70, 120);
  else if (wpm <= 160) paceScore = 1;
  else paceScore = 1 - ramp(wpm, 160, 230);
  components.push({
    key: 'pace',
    label: 'Pace',
    points: Math.round(20 * paceScore),
    max: 20,
    detail:
      wpm < 120
        ? `${wpm} words/min is on the slow side. Aim for 120–160.`
        : wpm > 160
          ? `${wpm} words/min is quick. Aim for 120–160 so ideas land.`
          : `${wpm} words/min sits in the conversational sweet spot.`,
  });

  // Fluency (20): ≤1 filler per 100 words is clean; ≥8 per 100 is zero.
  const fluencyScore = wordCount === 0 ? 0 : 1 - ramp(fillersPer100, 1, 8);
  components.push({
    key: 'fluency',
    label: 'Fluency',
    points: Math.round(20 * fluencyScore),
    max: 20,
    detail:
      fillerCount === 0
        ? 'No filler words detected.'
        : `${fillerCount} filler word${fillerCount === 1 ? '' : 's'} (${fillersPer100.toFixed(1)} per 100 words).`,
  });

  // Vocabulary (15): root type-token ratio, ~0.55 counts as rich for a 2-min talk.
  const rootTtr = contentTokens.length > 0 ? uniqueWords / Math.sqrt(contentTokens.length) : 0;
  const vocabScore = ramp(rootTtr, 3.5, 8);
  components.push({
    key: 'vocabulary',
    label: 'Vocabulary range',
    points: Math.round(15 * vocabScore),
    max: 15,
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
    },
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

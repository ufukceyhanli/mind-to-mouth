/**
 * Client for the coaching Worker (see worker/). The app only knows the
 * Worker's URL and an optional shared token, both baked in at build time via
 * EXPO_PUBLIC_* variables. The prompt and model live in the Worker.
 */
import type { CoachFeedback, ScoreBreakdown } from './types';

const COACH_URL = (process.env.EXPO_PUBLIC_COACH_URL ?? '').trim().replace(/\/+$/, '');
const COACH_TOKEN = (process.env.EXPO_PUBLIC_COACH_TOKEN ?? '').trim();

/** False in builds without a coach URL; the rubric is shown on its own. */
export const coachConfigured = COACH_URL.length > 0;

/** Host name shown in Settings so the user knows where transcripts go. */
export function coachHost(): string | null {
  if (!coachConfigured) return null;
  try {
    return new URL(COACH_URL).host;
  } catch {
    return COACH_URL;
  }
}

export class CoachApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = 'CoachApiError';
    this.status = status;
  }
}

function clampScore(n: unknown): number {
  const v = typeof n === 'number' ? n : Number(n);
  if (!Number.isFinite(v)) return 0;
  return Math.max(0, Math.min(10, Math.round(v)));
}

function stringList(v: unknown, max: number): string[] {
  if (!Array.isArray(v)) return [];
  return v
    .filter((s): s is string => typeof s === 'string')
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
    .slice(0, max);
}

export async function getCoachFeedback(params: {
  topic: string;
  transcript: string;
  durationSec: number;
  rubric: ScoreBreakdown;
}): Promise<CoachFeedback> {
  if (!coachConfigured) {
    throw new CoachApiError(0, 'This build has no coach configured.');
  }
  const { topic, transcript, durationSec, rubric } = params;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  };
  if (COACH_TOKEN) headers['x-app-token'] = COACH_TOKEN;

  const response = await fetch(`${COACH_URL}/coach`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      topic,
      transcript,
      durationSec,
      stats: {
        wordCount: rubric.stats.wordCount,
        wordsPerMinute: rubric.stats.wordsPerMinute,
        fillerCount: rubric.stats.fillerCount,
        topicMentions: rubric.stats.topicMentions,
      },
    }),
  });

  const text = await response.text();
  let data: { coach?: Record<string, unknown>; error?: string } = {};
  try {
    data = JSON.parse(text) as typeof data;
  } catch {
    // Non-JSON body; handled below.
  }

  if (!response.ok) {
    throw new CoachApiError(response.status, data.error || text.slice(0, 200) || `HTTP ${response.status}`);
  }
  const coach = data.coach;
  const summary = typeof coach?.summary === 'string' ? coach.summary.trim() : '';
  if (!coach || !summary) {
    throw new CoachApiError(response.status, 'The coach returned no feedback.');
  }

  return {
    summary,
    coherence: clampScore(coach.coherence),
    structure: clampScore(coach.structure),
    relevance: clampScore(coach.relevance),
    strengths: stringList(coach.strengths, 3),
    improvements: stringList(coach.improvements, 3),
    nextDrill: typeof coach.nextDrill === 'string' ? coach.nextDrill.trim() : '',
  };
}

export function describeCoachError(error: unknown): string {
  if (error instanceof CoachApiError) {
    switch (error.status) {
      case 0:
        return error.message;
      case 401:
        return 'The coach rejected this build of the app.';
      case 429:
        return 'The coach is busy. Try again in a minute.';
      case 503:
        return 'The coach has used up today’s free quota. Your rubric score still counts.';
      default:
        return `Coach error ${error.status}: ${error.message}`;
    }
  }
  if (error instanceof TypeError) return 'Could not reach the coach. Check your connection.';
  if (error instanceof Error) return error.message;
  return 'Unknown coach error.';
}

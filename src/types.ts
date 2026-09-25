export type Transcription = {
  text: string;
  /** Longest silence in the recording, measured from the audio itself. */
  longestPauseSec: number | null;
  /** How many audio chunks were sent for transcription. */
  chunkCount: number;
};

export type ScoreComponent = {
  key: 'duration' | 'pace' | 'fluency' | 'vocabulary' | 'relevance' | 'flow';
  label: string;
  points: number;
  max: number;
  /** Short human explanation of how the points were earned. */
  detail: string;
};

export type ScoreBreakdown = {
  total: number;
  components: ScoreComponent[];
  stats: {
    wordCount: number;
    wordsPerMinute: number;
    fillerCount: number;
    uniqueWords: number;
    topicMentions: number;
    longestPauseSec: number | null;
  };
};

export type CoachFeedback = {
  summary: string;
  coherence: number;
  structure: number;
  relevance: number;
  strengths: string[];
  improvements: string[];
  nextDrill: string;
};

export type Session = {
  id: string;
  word: string;
  createdAt: string;
  durationSec: number;
  transcript: string;
  score: ScoreBreakdown;
  coach: CoachFeedback | null;
  coachError: string | null;
  /** Blended score shown to the user: local rubric + coach when available. */
  finalScore: number;
};

export type Settings = {
  /** Minimum talk length before "Finish" unlocks, in seconds. */
  minSeconds: number;
  /** Hard cap on recording length, in seconds. */
  maxSeconds: number;
  /** Thinking time between seeing the word and recording, in seconds. */
  prepSeconds: number;
  /** build.nvidia.com model id used to turn audio into text. */
  transcribeModel: string;
  /** build.nvidia.com model id used for coaching and content scores. */
  coachModel: string;
};

export const DEFAULT_SETTINGS: Settings = {
  minSeconds: 120,
  maxSeconds: 300,
  prepSeconds: 10,
  transcribeModel: 'google/gemma-3n-e4b-it',
  coachModel: 'nvidia/nemotron-3-ultra-550b-a55b',
};

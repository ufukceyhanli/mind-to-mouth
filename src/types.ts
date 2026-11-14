import type { VolumeStats } from './audio';

/** One stretch of the talk: how many words were said, over how long. */
export type SpeechSegment = {
  words: number;
  /** Wall-clock length of the stretch. */
  durationSec: number;
  /** Seconds of actual speech in the stretch (silences removed). */
  speechSec: number;
};

export type Transcription = {
  text: string;
  /** Longest silence in the recording, measured from the audio itself. */
  longestPauseSec: number | null;
  /** True when speech recognition ran fully on the phone. */
  onDevice: boolean;
  /** Word counts and durations per stretch of the talk, in order; empty when unknown. */
  segments: SpeechSegment[];
  /** Loudness over the talk, measured from the audio; null when unknown. */
  volume: VolumeStats | null;
};

export type ScoreComponent = {
  key: 'duration' | 'pace' | 'variety' | 'volume' | 'fluency' | 'vocabulary' | 'relevance' | 'flow';
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
    /** Slowest and fastest speaking rate (words/min while talking), or null when not measured. */
    paceRange: [number, number] | null;
    /** Typical speaking level on the 0–10 volume scale, or null when not measured. */
    volumeLevel: number | null;
    /** Quietest and loudest stretches on the same scale, or null when not measured. */
    volumeRange: [number, number] | null;
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

export type PronunciationIssue = {
  /** The word the speaker meant. */
  word: string;
  /** What it sounded like; empty when the check cannot tell. */
  heard: string;
  /** One short sentence on how to say it. */
  tip: string;
  /** Seconds from the start of the talk, or null when unknown. */
  atSec: number | null;
};

export type PronunciationReport = {
  /**
   * pending: not checked yet (runs the first time the result is opened)
   * done: checked; `issues` may be empty
   * error: the check failed; `error` says why
   * off: the setting was disabled when this talk was recorded
   */
  status: 'pending' | 'done' | 'error' | 'off';
  issues: PronunciationIssue[];
  error: string | null;
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
  /**
   * File name of the stored recording inside the app's recordings folder,
   * or null when the audio could not be kept. Absent on sessions saved
   * before playback existed.
   */
  audioFile?: string | null;
  /** Words worth a second listen. Absent on sessions saved before the feature existed. */
  pronunciation?: PronunciationReport;
};

export type Settings = {
  /** Minimum talk length before "Finish" unlocks, in seconds. */
  minSeconds: number;
  /** Hard cap on recording length, in seconds. */
  maxSeconds: number;
  /** Thinking time between seeing the word and recording, in seconds. */
  prepSeconds: number;
  /** Run a second pass over the recording to flag words worth practising. */
  checkPronunciation: boolean;
};

export const DEFAULT_SETTINGS: Settings = {
  minSeconds: 120,
  maxSeconds: 300,
  prepSeconds: 10,
  checkPronunciation: true,
};

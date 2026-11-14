import AsyncStorage from '@react-native-async-storage/async-storage';

import { deleteRecording } from './recordings';
import { DEFAULT_SETTINGS, type Session, type Settings } from './types';

const SESSIONS_KEY = 'mtm.sessions.v1';
const SETTINGS_KEY = 'mtm.settings.v1';
const CONSENT_KEY = 'mtm.consent.v1';

// ---- Sessions -------------------------------------------------------------

export async function loadSessions(): Promise<Session[]> {
  try {
    const raw = await AsyncStorage.getItem(SESSIONS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Session[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function saveSession(session: Session): Promise<void> {
  const sessions = await loadSessions();
  const next = [session, ...sessions.filter((s) => s.id !== session.id)];
  await AsyncStorage.setItem(SESSIONS_KEY, JSON.stringify(next));
}

/** Merges `patch` into a stored session. A session that no longer exists is left alone. */
export async function updateSession(id: string, patch: Partial<Session>): Promise<void> {
  const sessions = await loadSessions();
  if (!sessions.some((s) => s.id === id)) return;
  const next = sessions.map((s) => (s.id === id ? { ...s, ...patch } : s));
  await AsyncStorage.setItem(SESSIONS_KEY, JSON.stringify(next));
}

export async function getSession(id: string): Promise<Session | null> {
  const sessions = await loadSessions();
  return sessions.find((s) => s.id === id) ?? null;
}

export async function deleteSession(id: string): Promise<void> {
  const sessions = await loadSessions();
  const target = sessions.find((s) => s.id === id);
  await AsyncStorage.setItem(SESSIONS_KEY, JSON.stringify(sessions.filter((s) => s.id !== id)));
  if (target?.audioFile) deleteRecording(target.audioFile);
}

/** Removes every talk, its scores and its recording from the device. */
export async function deleteAllSessions(): Promise<void> {
  const sessions = await loadSessions();
  await AsyncStorage.removeItem(SESSIONS_KEY);
  for (const s of sessions) if (s.audioFile) deleteRecording(s.audioFile);
}

// ---- Data-sharing consent ---------------------------------------------------
//
// The text of each talk goes to a third-party AI service for coaching. Apple
// requires explicit permission before that happens, and a way to take it
// back, so the date of agreement is kept and cleared on request.

/** ISO date the user agreed to send transcripts to the coach, or null. */
export async function getDataSharingConsent(): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(CONSENT_KEY);
  } catch {
    return null;
  }
}

export async function setDataSharingConsent(agreed: boolean): Promise<void> {
  if (agreed) await AsyncStorage.setItem(CONSENT_KEY, new Date().toISOString());
  else await AsyncStorage.removeItem(CONSENT_KEY);
}

// ---- Settings -------------------------------------------------------------

export async function loadSettings(): Promise<Settings> {
  try {
    const raw = await AsyncStorage.getItem(SETTINGS_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    // Only known keys are kept, so fields from older builds (model ids) drop out.
    const stored = JSON.parse(raw) as Partial<Record<keyof Settings, unknown>>;
    const num = (v: unknown, fallback: number) => (typeof v === 'number' && Number.isFinite(v) ? v : fallback);
    return {
      minSeconds: num(stored.minSeconds, DEFAULT_SETTINGS.minSeconds),
      maxSeconds: num(stored.maxSeconds, DEFAULT_SETTINGS.maxSeconds),
      prepSeconds: num(stored.prepSeconds, DEFAULT_SETTINGS.prepSeconds),
      checkPronunciation:
        typeof stored.checkPronunciation === 'boolean'
          ? stored.checkPronunciation
          : DEFAULT_SETTINGS.checkPronunciation,
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export async function saveSettings(settings: Settings): Promise<void> {
  await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

// ---- Derived stats --------------------------------------------------------

function dayKey(date: Date): string {
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

/**
 * Number of consecutive days (ending today or yesterday) with at least one
 * session. A streak that ended yesterday is still alive until midnight.
 */
export function computeStreak(sessions: Session[]): number {
  if (sessions.length === 0) return 0;
  const days = new Set(sessions.map((s) => dayKey(new Date(s.createdAt))));
  const cursor = new Date();
  if (!days.has(dayKey(cursor))) {
    cursor.setDate(cursor.getDate() - 1);
    if (!days.has(dayKey(cursor))) return 0;
  }
  let streak = 0;
  while (days.has(dayKey(cursor))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

export function practisedToday(sessions: Session[]): boolean {
  const today = dayKey(new Date());
  return sessions.some((s) => dayKey(new Date(s.createdAt)) === today);
}

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';

import { DEFAULT_SETTINGS, type Session, type Settings } from './types';

const SESSIONS_KEY = 'mtm.sessions.v1';
const SETTINGS_KEY = 'mtm.settings.v1';
const NVIDIA_KEY = 'mtm_nvidia_api_key';

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

export async function getSession(id: string): Promise<Session | null> {
  const sessions = await loadSessions();
  return sessions.find((s) => s.id === id) ?? null;
}

export async function deleteSession(id: string): Promise<void> {
  const sessions = await loadSessions();
  await AsyncStorage.setItem(
    SESSIONS_KEY,
    JSON.stringify(sessions.filter((s) => s.id !== id)),
  );
}

// ---- Settings -------------------------------------------------------------

export async function loadSettings(): Promise<Settings> {
  try {
    const raw = await AsyncStorage.getItem(SETTINGS_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    return { ...DEFAULT_SETTINGS, ...(JSON.parse(raw) as Partial<Settings>) };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export async function saveSettings(settings: Settings): Promise<void> {
  await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

// ---- API keys (kept in the device keychain, never in plain storage) --------

async function getSecret(key: string): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(key);
  } catch {
    return null;
  }
}

async function setSecret(key: string, value: string): Promise<void> {
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    await SecureStore.deleteItemAsync(key);
  } else {
    await SecureStore.setItemAsync(key, trimmed);
  }
}

export const getNvidiaKey = () => getSecret(NVIDIA_KEY);
export const setNvidiaKey = (v: string) => setSecret(NVIDIA_KEY, v);

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

import * as SecureStore from 'expo-secure-store';

/**
 * When scored talks happened, for the free plan's weekly allowance. Kept
 * apart from the talks themselves so deleting a talk does not hand the slot
 * back, and in the keychain rather than app storage so reinstalling the app
 * does not reset the count. Only timestamps are stored, and only on the phone.
 */
const USAGE_KEY = 'mtm_talk_usage_v1';
/** Anything older can no longer matter to a weekly count. */
const KEEP_MS = 14 * 86_400_000;

export async function loadUsage(): Promise<number[]> {
  try {
    const raw = await SecureStore.getItemAsync(USAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((t): t is number => typeof t === 'number') : [];
  } catch {
    return [];
  }
}

/** Records one scored talk, now. Returns the updated list. */
export async function recordTalk(): Promise<number[]> {
  const now = Date.now();
  const next = [...(await loadUsage()).filter((t) => now - t < KEEP_MS), now];
  try {
    await SecureStore.setItemAsync(USAGE_KEY, JSON.stringify(next));
  } catch {
    // A failed write only means this talk is not counted.
  }
  return next;
}

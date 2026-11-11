/**
 * What the free plan allows, and the pure maths around it. No storage and no
 * store calls here, so the numbers are easy to change and to test.
 *
 * Free: FREE_TALKS_PER_WEEK scored talks per calendar week (Monday to Sunday,
 * local time), each up to FREE_MAX_SECONDS long, with the full score and coach
 * notes. Plus: no weekly cap, the talk length chosen in Settings, and the
 * pronunciation check.
 */

/** App Store Connect product id of the monthly subscription. */
export const PLUS_PRODUCT_ID = 'com.mindtomouth.app.plus.monthly';
export const PLUS_NAME = 'Mind to Mouth Plus';
/** Shown only while the App Store has not answered with the localised price. */
export const PLUS_FALLBACK_PRICE = 'US$4.90';

export const FREE_TALKS_PER_WEEK = 3;
export const FREE_MAX_SECONDS = 180;

/** Monday 00:00 local time of the week `now` falls in. */
export function weekStart(now: Date): Date {
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const sinceMonday = (start.getDay() + 6) % 7;
  start.setDate(start.getDate() - sinceMonday);
  return start;
}

/** When the weekly allowance refills: the coming Monday, 00:00 local time. */
export function nextReset(now: Date): Date {
  const next = weekStart(now);
  next.setDate(next.getDate() + 7);
  return next;
}

/** How many of the recorded talk times (ms since epoch) fall in the current week. */
export function talksThisWeek(usage: number[], now: Date): number {
  const from = weekStart(now).getTime();
  return usage.filter((t) => t >= from && t <= now.getTime()).length;
}

export function freeTalksLeft(usage: number[], now: Date): number {
  return Math.max(0, FREE_TALKS_PER_WEEK - talksThisWeek(usage, now));
}

/**
 * Where recording auto-stops. Free talks stop at FREE_MAX_SECONDS, but never
 * before the minimum the user picked, so "Finish" can always unlock.
 */
export function effectiveMaxSeconds(
  settings: { minSeconds: number; maxSeconds: number },
  isPlus: boolean,
): number {
  if (isPlus) return settings.maxSeconds;
  return Math.max(Math.min(settings.maxSeconds, FREE_MAX_SECONDS), settings.minSeconds);
}

/** "Monday" for a reset later this week, "tomorrow" when it is. */
export function describeReset(now: Date): string {
  const reset = nextReset(now);
  const days = Math.round((reset.getTime() - new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()) / 86_400_000);
  return days <= 1 ? 'tomorrow' : 'on Monday';
}

export const colors = {
  bg: '#0B0F14',
  card: '#151B23',
  cardAlt: '#1C242E',
  border: '#232C37',
  text: '#F2F4F7',
  muted: '#8B95A5',
  accent: '#FF7A45',
  accentSoft: '#3A2418',
  success: '#3DDC97',
  warn: '#FFC857',
  danger: '#FF5C5C',
  info: '#6CB4FF',
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};

export const radius = {
  sm: 8,
  md: 14,
  lg: 22,
  pill: 999,
};

export function scoreColor(score: number): string {
  if (score >= 80) return colors.success;
  if (score >= 60) return colors.warn;
  return colors.danger;
}

export function formatClock(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r.toString().padStart(2, '0')}`;
}

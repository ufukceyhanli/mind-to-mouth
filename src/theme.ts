import type { TextStyle, ViewStyle } from 'react-native';

/**
 * Design tokens. Warm cream pages, one orange accent, everything rounded.
 * Every screen and component reads from here; nothing hard-codes a colour.
 */
export const colors = {
  /** Page background. */
  bg: '#FDF4EA',
  /** Inset containers: cards, inputs, pill rows. */
  surface: '#F4ECE2',
  /** Slightly deeper beige for tracks and dividers inside a surface. */
  surfaceAlt: '#EBE1D4',
  /** Only the selected segment of a segmented control is pure white. */
  white: '#FFFFFF',
  border: '#EADFD2',
  text: '#17130F',
  muted: '#8A7F74',
  accent: '#F26B2E',
  accentLight: '#F58A4B',
  /** Pale orange tint: chip fills, secondary buttons, highlights. */
  accentSoft: '#FDE4D3',
  onAccent: '#FFFFFF',
  /** Dark olive hero card. */
  hero: '#5C5844',
  heroMuted: '#CFC8B6',
  /** Dark floating bar, as in a "now playing" strip. */
  dark: '#1E2A22',
  success: '#2F9E6B',
  warn: '#E0A021',
  danger: '#D9482B',
  info: '#3A7BD5',
};

/** Lato, loaded in the root layout. Falls back to the system font if it fails. */
export const fonts = {
  regular: 'Lato_400Regular',
  bold: 'Lato_700Bold',
  black: 'Lato_900Black',
};

export const type = {
  /** Huge page titles. */
  title: { fontFamily: fonts.black, fontSize: 34, lineHeight: 40, letterSpacing: -0.5 },
  /** Section headings. */
  h2: { fontFamily: fonts.bold, fontSize: 24, lineHeight: 30 },
  h3: { fontFamily: fonts.bold, fontSize: 19, lineHeight: 25 },
  /** Large, relaxed body copy. */
  bodyLarge: { fontFamily: fonts.regular, fontSize: 20, lineHeight: 30 },
  body: { fontFamily: fonts.regular, fontSize: 16, lineHeight: 24 },
  bodyBold: { fontFamily: fonts.bold, fontSize: 16, lineHeight: 24 },
  caption: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 18 },
  captionBold: { fontFamily: fonts.bold, fontSize: 13, lineHeight: 18 },
  label: { fontFamily: fonts.bold, fontSize: 15, lineHeight: 20 },
} satisfies Record<string, TextStyle>;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};

export const radius = {
  sm: 12,
  md: 16,
  lg: 20,
  xl: 28,
  pill: 999,
};

/** Soft warm drop shadow for cards and covers. */
export const shadow: ViewStyle = {
  shadowColor: '#8A4A1E',
  shadowOpacity: 0.14,
  shadowRadius: 18,
  shadowOffset: { width: 0, height: 8 },
  elevation: 5,
};

/** Accent colours for talk tiles; picked by word so a talk always looks the same. */
export const talkColors = ['#1F6F5B', '#2B4C8C', '#B8231F', '#B5771A', '#2F6F9F', '#7A3E2E', '#5B3F8C', '#C2521C'];

export function hashString(seed: string): number {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  return hash;
}

export function talkColor(seed: string): string {
  return talkColors[hashString(seed) % talkColors.length];
}

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

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

/** Palette of "book cover" colours for talks; picked by word so it is stable. */
export const coverColors = [
  { bg: '#1F4D3A', fg: '#F6EFD9' }, // forest
  { bg: '#1E2A44', fg: '#F2E7C9' }, // navy
  { bg: '#B8231F', fg: '#FFF3E6' }, // red
  { bg: '#D9A520', fg: '#1A1A1A' }, // mustard
  { bg: '#D7E8EC', fg: '#1E2A44' }, // ice
  { bg: '#3A6B5E', fg: '#F6EFD9' }, // teal
  { bg: '#7A3E2E', fg: '#FBE7D6' }, // clay
  { bg: '#F7EBB8', fg: '#3B2A14' }, // straw
];

export function coverColor(seed: string): { bg: string; fg: string } {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  return coverColors[hash % coverColors.length];
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

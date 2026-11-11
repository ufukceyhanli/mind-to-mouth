import Ionicons from '@expo/vector-icons/Ionicons';
import type { ComponentProps, PropsWithChildren, ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from 'react-native';

import { colors, fonts, radius, scoreColor, shadow, spacing, type } from '../theme';

export type IconName = ComponentProps<typeof Ionicons>['name'];

// ---- Buttons ---------------------------------------------------------------

type ButtonProps = {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'dark' | 'outline';
  icon?: IconName;
  disabled?: boolean;
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
};

/**
 * Pill button, 56pt tall. Primary is filled orange, secondary pale orange,
 * dark is near-black with white text (third-party sign-in), outline is a thin
 * dark ring on the page colour.
 */
export function Button({
  title,
  onPress,
  variant = 'primary',
  icon,
  disabled = false,
  loading = false,
  style,
}: ButtonProps) {
  const isDisabled = disabled || loading;
  const textColor =
    variant === 'primary' || variant === 'dark'
      ? colors.onAccent
      : variant === 'danger'
        ? colors.danger
        : variant === 'ghost'
          ? colors.muted
          : variant === 'outline'
            ? colors.text
            : colors.accent;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: isDisabled }}
      onPress={onPress}
      disabled={isDisabled}
      style={({ pressed }) => [
        styles.button,
        variant === 'primary' && styles.buttonPrimary,
        variant === 'secondary' && styles.buttonSecondary,
        variant === 'ghost' && styles.buttonGhost,
        variant === 'danger' && styles.buttonDanger,
        variant === 'dark' && styles.buttonDark,
        variant === 'outline' && styles.buttonOutline,
        isDisabled && styles.buttonDisabled,
        pressed && !isDisabled && styles.buttonPressed,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={textColor} />
      ) : (
        <View style={styles.buttonInner}>
          {icon && <Ionicons name={icon} size={22} color={textColor} />}
          <Text
            style={[styles.buttonText, { color: textColor }]}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.8}
          >
            {title}
          </Text>
        </View>
      )}
    </Pressable>
  );
}

/** Round icon-only button on a pale orange disc. */
export function IconButton({
  icon,
  onPress,
  accessibilityLabel,
  color = colors.accent,
  size = 44,
  style,
}: {
  icon: IconName;
  onPress: () => void;
  accessibilityLabel: string;
  color?: string;
  size?: number;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      hitSlop={8}
      style={({ pressed }) => [
        styles.iconButton,
        { width: size, height: size, borderRadius: size / 2 },
        pressed && styles.buttonPressed,
        style,
      ]}
    >
      <Ionicons name={icon} size={Math.round(size * 0.5)} color={color} />
    </Pressable>
  );
}

/** Two side-by-side CTAs docked at the bottom of a screen. */
export function BottomActions({
  children,
  style,
}: PropsWithChildren<{ style?: StyleProp<ViewStyle> }>) {
  return <View style={[styles.bottomActions, style]}>{children}</View>;
}

// ---- Surfaces --------------------------------------------------------------

export function Card({
  children,
  style,
  elevated = false,
}: PropsWithChildren<{ style?: StyleProp<ViewStyle>; elevated?: boolean }>) {
  return <View style={[styles.card, elevated && shadow, style]}>{children}</View>;
}

/** Dark olive hero card with a white heading. */
export function HeroCard({
  children,
  style,
  onPress,
  disabled,
  accessibilityLabel,
}: PropsWithChildren<{
  style?: StyleProp<ViewStyle>;
  onPress?: () => void;
  disabled?: boolean;
  accessibilityLabel?: string;
}>) {
  if (!onPress) return <View style={[styles.hero, style]}>{children}</View>;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [styles.hero, pressed && { opacity: 0.92 }, style]}
    >
      {children}
    </Pressable>
  );
}

// ---- Text ------------------------------------------------------------------

/** Huge left-aligned page title with optional controls on the right. */
export function PageHeader({
  title,
  subtitle,
  right,
  style,
}: {
  title: string;
  subtitle?: string;
  right?: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={[styles.pageHeader, style]}>
      <View style={{ flex: 1 }}>
        <Text style={styles.pageTitle}>{title}</Text>
        {subtitle ? <Muted style={{ marginTop: spacing.xs }}>{subtitle}</Muted> : null}
      </View>
      {right ? <View style={styles.pageHeaderRight}>{right}</View> : null}
    </View>
  );
}

export function SectionTitle({
  children,
  style,
}: {
  children: ReactNode;
  style?: StyleProp<TextStyle>;
}) {
  return <Text style={[styles.sectionTitle, style]}>{children}</Text>;
}

/** Bold title left, orange action link right. */
export function SectionHeader({
  title,
  actionLabel,
  onAction,
  style,
}: {
  title: ReactNode;
  actionLabel?: string;
  onAction?: () => void;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={[styles.sectionHeader, style]}>
      <SectionTitle style={{ marginBottom: 0, flex: 1 }}>{title}</SectionTitle>
      {actionLabel && onAction ? (
        <Pressable accessibilityRole="button" onPress={onAction} hitSlop={8}>
          <Text style={styles.link}>{actionLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

export function Muted({ children, style }: { children: ReactNode; style?: StyleProp<TextStyle> }) {
  return <Text style={[styles.muted, style]}>{children}</Text>;
}

export function Body({ children, style }: { children: ReactNode; style?: StyleProp<TextStyle> }) {
  return <Text style={[styles.body, style]}>{children}</Text>;
}

export function Link({
  children,
  onPress,
  style,
}: {
  children: ReactNode;
  onPress: () => void;
  style?: StyleProp<TextStyle>;
}) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} hitSlop={8}>
      <Text style={[styles.link, style]}>{children}</Text>
    </Pressable>
  );
}

// ---- Chips and pills -------------------------------------------------------

/** Outlined orange chip; selected chips fill solid. */
export function Chip({
  label,
  selected = false,
  onPress,
  icon,
  style,
}: {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  icon?: IconName;
  style?: StyleProp<ViewStyle>;
}) {
  const color = selected ? colors.onAccent : colors.accent;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      disabled={!onPress}
      style={({ pressed }) => [
        styles.chip,
        selected && styles.chipSelected,
        pressed && onPress && styles.buttonPressed,
        style,
      ]}
    >
      {icon && <Ionicons name={icon} size={16} color={color} />}
      <Text style={[styles.chipText, { color }]}>{label}</Text>
    </Pressable>
  );
}

export type PillItem = { icon?: IconName; label: string; color?: string };

/** Beige info pill with icon + label pairs separated by thin dividers. */
export function PillRow({ items, style }: { items: PillItem[]; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[styles.pillRow, style]}>
      {items.map((item, i) => (
        <View key={`${item.label}-${i}`} style={styles.pillItemWrap}>
          {i > 0 && <View style={styles.pillDivider} />}
          <View style={styles.pillItem}>
            {item.icon && <Ionicons name={item.icon} size={18} color={item.color ?? colors.muted} />}
            <Text style={[styles.pillLabel, item.color ? { color: item.color } : null]} numberOfLines={1}>
              {item.label}
            </Text>
          </View>
        </View>
      ))}
    </View>
  );
}

/** Small translucent pill, used for countdowns and badges on dark cards. */
export function Badge({
  children,
  tone = 'dark',
  style,
}: PropsWithChildren<{ tone?: 'dark' | 'accent' | 'light'; style?: StyleProp<ViewStyle> }>) {
  return (
    <View
      style={[
        styles.badge,
        tone === 'dark' && { backgroundColor: 'rgba(0,0,0,0.28)' },
        tone === 'accent' && { backgroundColor: colors.accent },
        tone === 'light' && { backgroundColor: colors.accentSoft },
        style,
      ]}
    >
      <Text
        style={[
          styles.badgeText,
          tone === 'light' && { color: colors.accent },
        ]}
      >
        {children}
      </Text>
    </View>
  );
}

/** Round profile disc with the account's initial; the way into the Profile screen. */
export function Avatar({
  email,
  size = 44,
  onPress,
  style,
}: {
  email: string | null;
  size?: number;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
}) {
  const initial = email?.trim().charAt(0).toUpperCase() || '';
  const disc = (
    <View style={[styles.avatar, { width: size, height: size, borderRadius: size / 2 }, style]}>
      {initial ? (
        <Text style={[styles.avatarText, { fontSize: Math.round(size * 0.44) }]}>{initial}</Text>
      ) : (
        <Ionicons name="person" size={Math.round(size * 0.5)} color={colors.onAccent} />
      )}
    </View>
  );
  if (!onPress) return disc;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Profile"
      onPress={onPress}
      hitSlop={8}
      style={({ pressed }) => pressed && styles.buttonPressed}
    >
      {disc}
    </Pressable>
  );
}

/** Round microphone emblem with soft concentric rings; the app's "audio" mark. */
export function MicDisc({ size = 112, style }: { size?: number; style?: StyleProp<ViewStyle> }) {
  const inner = size * 0.56;
  const mid = size * 0.78;
  return (
    <View style={[styles.micOuter, { width: size, height: size, borderRadius: size / 2 }, style]}>
      <View style={[styles.micMid, { width: mid, height: mid, borderRadius: mid / 2 }]}>
        <View style={[styles.micInner, shadow, { width: inner, height: inner, borderRadius: inner / 2 }]}>
          <Ionicons name="mic" size={Math.round(inner * 0.5)} color={colors.onAccent} />
        </View>
      </View>
    </View>
  );
}

// ---- Data display ----------------------------------------------------------

export function ProgressBar({
  value,
  max,
  color,
  height = 6,
}: {
  value: number;
  max: number;
  color?: string;
  height?: number;
}) {
  const pct = max > 0 ? Math.max(0, Math.min(1, value / max)) : 0;
  return (
    <View style={[styles.barTrack, { height, borderRadius: height }]}>
      <View
        style={[
          styles.barFill,
          { width: `${Math.round(pct * 100)}%`, backgroundColor: color ?? colors.accent },
        ]}
      />
    </View>
  );
}

export function ScoreBadge({ score, size = 120 }: { score: number; size?: number }) {
  const color = scoreColor(score);
  return (
    <View
      style={[
        styles.scoreBadge,
        shadow,
        { width: size, height: size, borderRadius: size / 2, borderColor: color },
      ]}
    >
      <Text style={[styles.scoreNumber, { color, fontSize: size * 0.38 }]}>{score}</Text>
      <Text style={styles.scoreOutOf}>out of 100</Text>
    </View>
  );
}

export function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: 56,
    paddingHorizontal: spacing.md + 2,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonInner: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  buttonPrimary: { backgroundColor: colors.accent },
  buttonSecondary: { backgroundColor: colors.accentSoft },
  buttonGhost: { backgroundColor: 'transparent', minHeight: 48 },
  buttonDanger: { backgroundColor: 'transparent', borderWidth: 1.5, borderColor: colors.danger },
  buttonDark: { backgroundColor: colors.dark },
  buttonOutline: { backgroundColor: colors.bg, borderWidth: 1.5, borderColor: colors.dark },
  buttonDisabled: { opacity: 0.45 },
  buttonPressed: { opacity: 0.85, transform: [{ scale: 0.99 }] },
  buttonText: { ...type.h3, fontSize: 17, lineHeight: 22 },
  iconButton: {
    backgroundColor: colors.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bottomActions: { flexDirection: 'row', gap: spacing.md },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
  },
  hero: {
    backgroundColor: colors.hero,
    borderRadius: radius.xl,
    padding: spacing.lg,
  },
  pageHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  pageHeaderRight: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  pageTitle: { ...type.title, color: colors.text },
  sectionTitle: { ...type.h2, color: colors.text, marginBottom: spacing.sm },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
    gap: spacing.md,
  },
  link: { ...type.bodyBold, color: colors.accent },
  muted: { ...type.body, fontSize: 15, lineHeight: 22, color: colors.muted },
  body: { ...type.body, color: colors.text },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    borderRadius: radius.pill,
    backgroundColor: colors.accentSoft,
    borderWidth: 1.5,
    borderColor: colors.accentLight,
  },
  chipSelected: { backgroundColor: colors.accent, borderColor: colors.accent },
  chipText: { ...type.label, fontSize: 15 },
  pillRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    paddingVertical: 14,
    paddingHorizontal: spacing.sm,
  },
  pillItemWrap: { flex: 1, flexDirection: 'row', alignItems: 'center' },
  pillDivider: { width: 1, alignSelf: 'stretch', backgroundColor: colors.border },
  pillItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: spacing.xs,
  },
  pillLabel: { ...type.label, color: colors.text },
  badge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.pill,
  },
  badgeText: { ...type.captionBold, fontSize: 14, color: colors.white, fontVariant: ['tabular-nums'] },
  avatar: { backgroundColor: colors.hero, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontFamily: fonts.black, color: colors.onAccent },
  micOuter: { backgroundColor: colors.accentSoft, alignItems: 'center', justifyContent: 'center' },
  micMid: { backgroundColor: '#FBC9A6', alignItems: 'center', justifyContent: 'center' },
  micInner: { backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' },
  barTrack: { backgroundColor: colors.surfaceAlt, overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: radius.pill },
  scoreBadge: {
    borderWidth: 6,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    backgroundColor: colors.bg,
  },
  scoreNumber: { fontFamily: fonts.black, letterSpacing: -1 },
  scoreOutOf: { ...type.caption, fontSize: 11, color: colors.muted, marginTop: -2 },
  stat: { flex: 1, alignItems: 'center' },
  statValue: { ...type.h3, fontSize: 20, color: colors.text },
  statLabel: { ...type.caption, color: colors.muted, marginTop: 2 },
});

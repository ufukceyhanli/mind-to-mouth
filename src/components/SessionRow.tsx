import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import {
  colors,
  formatClock,
  hashString,
  radius,
  scoreColor,
  shadow,
  spacing,
  talkColor,
  type,
} from '../theme';
import type { Session } from '../types';
import { Muted, ProgressBar } from './ui';

function openSession(session: Session) {
  router.push({ pathname: '/result/[id]', params: { id: session.id } });
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

/** Deterministic bar heights (0.2..1) so a talk's waveform never changes. */
function waveformHeights(seed: string, bars: number): number[] {
  let h = hashString(seed) || 1;
  const out: number[] = [];
  for (let i = 0; i < bars; i++) {
    h = (h * 1103515245 + 12345) >>> 0;
    const r = (h >>> 8) / 0xffffff;
    // Gentle envelope so the middle is louder than the edges.
    const env = 0.55 + 0.45 * Math.sin((Math.PI * (i + 0.5)) / bars);
    out.push(0.2 + 0.8 * r * env);
  }
  return out;
}

/** Row of rounded bars that stands in for the audio of a talk. */
export function Waveform({
  seed,
  bars,
  height,
  color,
  barWidth = 4,
  gap = 3,
}: {
  seed: string;
  bars: number;
  height: number;
  color: string;
  barWidth?: number;
  gap?: number;
}) {
  const heights = waveformHeights(seed, bars);
  return (
    <View style={[styles.wave, { height, gap }]}>
      {heights.map((h, i) => (
        <View
          key={i}
          style={{
            width: barWidth,
            height: Math.max(barWidth, Math.round(h * height)),
            borderRadius: barWidth / 2,
            backgroundColor: color,
          }}
        />
      ))}
    </View>
  );
}

/**
 * Audio tile for a talk: a tinted rounded card with the talk's waveform, a
 * play mark and, when given, the duration. Replaces the idea of a cover image.
 */
export function TalkTile({
  seed,
  width,
  height,
  durationSec,
  showPlay = true,
  style,
}: {
  seed: string;
  width?: number;
  height: number;
  durationSec?: number;
  showPlay?: boolean;
  style?: object;
}) {
  const tint = talkColor(seed);
  const compact = height < 80;
  const barWidth = compact ? 3 : 5;
  const gap = compact ? 2 : 4;
  const inner = (width ?? 320) - (compact ? 12 : 56);
  const bars = Math.max(5, Math.floor(inner / (barWidth + gap)));
  return (
    <View
      style={[
        styles.tile,
        compact ? styles.tileCompact : shadow,
        { height, backgroundColor: `${tint}22` },
        width !== undefined ? { width } : null,
        style,
      ]}
    >
      <Waveform
        seed={seed}
        bars={bars}
        height={compact ? height * 0.55 : height * 0.42}
        color={tint}
        barWidth={barWidth}
        gap={gap}
      />
      {!compact && showPlay && (
        <View style={[styles.playMark, { backgroundColor: tint }]}>
          <Ionicons name="play" size={14} color={colors.white} style={{ marginLeft: 2 }} />
        </View>
      )}
      {!compact && durationSec !== undefined && (
        <View style={styles.durationPill}>
          <Ionicons name="time-outline" size={13} color={colors.white} />
          <Text style={styles.durationText}>{formatClock(durationSec)}</Text>
        </View>
      )}
    </View>
  );
}

/** Spoken description for screen readers: word, score and date. */
function describeSession(session: Session): string {
  return `${session.word}, ${session.finalScore} out of 100, ${formatDate(session.createdAt)}`;
}

/** Carousel card: audio tile on top, score bar, date and word below. */
export function SessionCard({ session, width = 164 }: { session: Session; width?: number }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={describeSession(session)}
      onPress={() => openSession(session)}
      style={({ pressed }) => [styles.card, { width }, pressed && { opacity: 0.85 }]}
    >
      <TalkTile seed={session.word} width={width} height={116} durationSec={session.durationSec} />
      <ProgressBar value={session.finalScore} max={100} color={scoreColor(session.finalScore)} height={5} />
      <View style={styles.cardMeta}>
        <View style={{ flex: 1 }}>
          <Muted style={styles.cardDate}>{formatDate(session.createdAt)}</Muted>
          <Text style={styles.cardWord} numberOfLines={2}>
            {session.word}
          </Text>
        </View>
        <Text style={[styles.cardScore, { color: scoreColor(session.finalScore) }]}>
          {session.finalScore}
        </Text>
      </View>
    </Pressable>
  );
}

/** List row: small waveform thumbnail, word, date and duration, score on the right. */
export function SessionRow({
  session,
  onLongPress,
}: {
  session: Session;
  onLongPress?: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={describeSession(session)}
      accessibilityHint={onLongPress ? 'Double-tap to open, long-press to delete' : undefined}
      onPress={() => openSession(session)}
      onLongPress={onLongPress}
      style={({ pressed }) => [styles.row, pressed && { opacity: 0.85 }]}
    >
      <TalkTile seed={session.word} width={60} height={60} />
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={styles.rowWord} numberOfLines={1}>
          {session.word}
        </Text>
        <View style={styles.rowMeta}>
          <Ionicons name="time-outline" size={14} color={colors.muted} />
          <Muted style={styles.rowMetaText}>
            {formatClock(session.durationSec)} · {formatDate(session.createdAt)} ·{' '}
            {session.score.stats.wordsPerMinute} wpm
          </Muted>
        </View>
      </View>
      <View style={styles.rowScoreWrap}>
        <Text style={[styles.rowScore, { color: scoreColor(session.finalScore) }]}>
          {session.finalScore}
        </Text>
        <Ionicons name="chevron-forward" size={18} color={colors.muted} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wave: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  tile: {
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  tileCompact: { borderRadius: radius.md },
  playMark: {
    position: 'absolute',
    left: spacing.sm + 4,
    bottom: spacing.sm + 4,
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  durationPill: {
    position: 'absolute',
    right: spacing.sm + 4,
    bottom: spacing.sm + 4,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  durationText: { ...type.captionBold, fontSize: 12, color: colors.white, fontVariant: ['tabular-nums'] },
  card: { gap: spacing.sm },
  cardMeta: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  cardDate: { ...type.caption, color: colors.muted },
  cardWord: { ...type.h3, color: colors.text, textTransform: 'capitalize' },
  cardScore: { ...type.h3, fontSize: 20, marginTop: 2 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.sm,
    paddingRight: spacing.md,
    marginBottom: spacing.sm,
  },
  rowWord: { ...type.h3, color: colors.text, textTransform: 'capitalize' },
  rowMeta: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  rowMetaText: { ...type.caption, color: colors.muted },
  rowScoreWrap: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  rowScore: { fontFamily: type.title.fontFamily, fontSize: 24 },
});

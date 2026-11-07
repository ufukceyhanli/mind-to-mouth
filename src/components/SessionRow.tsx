import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, coverColor, formatClock, radius, scoreColor, shadow, spacing, type } from '../theme';
import type { Session } from '../types';
import { Muted, ProgressBar } from './ui';

function openSession(session: Session) {
  router.push({ pathname: '/result/[id]', params: { id: session.id } });
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

/** Book-cover style tile for a talk: the word set large on a coloured card. */
export function Cover({
  word,
  width,
  height,
  caption,
  fontSize = 22,
}: {
  word: string;
  width: number;
  height: number;
  caption?: string;
  fontSize?: number;
}) {
  const palette = coverColor(word);
  if (width < 80) {
    // Thumbnail: just the initial, the full word sits next to it.
    return (
      <View style={[styles.cover, shadow, styles.coverThumb, { width, height, backgroundColor: palette.bg }]}>
        <Text style={[styles.coverWord, { color: palette.fg, fontSize: width * 0.5 }]}>
          {word.slice(0, 1)}
        </Text>
      </View>
    );
  }
  return (
    <View
      style={[styles.cover, shadow, { width, height, backgroundColor: palette.bg }]}
    >
      <Text
        style={[styles.coverWord, { color: palette.fg, fontSize, lineHeight: fontSize * 1.1 }]}
        numberOfLines={3}
        adjustsFontSizeToFit
      >
        {word}
      </Text>
      <Ionicons name="mic" size={Math.round(width * 0.22)} color={palette.fg} style={{ opacity: 0.85 }} />
      {caption ? (
        <Text style={[styles.coverCaption, { color: palette.fg }]} numberOfLines={1}>
          {caption}
        </Text>
      ) : null}
    </View>
  );
}

/** Carousel card: cover on top, score bar, date and word below. */
export function SessionCard({ session, width = 150 }: { session: Session; width?: number }) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => openSession(session)}
      style={({ pressed }) => [styles.card, { width }, pressed && { opacity: 0.85 }]}
    >
      <Cover word={session.word} width={width} height={width * 1.4} caption="Mind to Mouth" />
      <ProgressBar value={session.finalScore} max={100} color={scoreColor(session.finalScore)} height={5} />
      <View style={styles.cardMeta}>
        <View style={{ flex: 1 }}>
          <Muted style={styles.cardDate}>
            {formatDate(session.createdAt)} · {formatClock(session.durationSec)}
          </Muted>
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

/** List row: small cover thumbnail, word, date and duration, score on the right. */
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
      onPress={() => openSession(session)}
      onLongPress={onLongPress}
      style={({ pressed }) => [styles.row, pressed && { opacity: 0.85 }]}
    >
      <Cover word={session.word} width={52} height={68} fontSize={11} />
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
  cover: {
    borderRadius: radius.md,
    padding: spacing.sm,
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
  },
  coverThumb: { justifyContent: 'center', paddingVertical: 0 },
  coverWord: {
    fontFamily: type.title.fontFamily,
    textAlign: 'center',
    textTransform: 'capitalize',
  },
  coverCaption: { ...type.captionBold, fontSize: 10, opacity: 0.8 },
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

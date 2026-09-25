import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, formatClock, radius, scoreColor, spacing } from '../theme';
import type { Session } from '../types';
import { Muted } from './ui';

export function SessionRow({
  session,
  onLongPress,
}: {
  session: Session;
  onLongPress?: () => void;
}) {
  const date = new Date(session.createdAt);
  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => router.push({ pathname: '/result/[id]', params: { id: session.id } })}
      onLongPress={onLongPress}
      style={({ pressed }) => [styles.row, pressed && { opacity: 0.8 }]}
    >
      <View style={{ flex: 1 }}>
        <Text style={styles.rowWord}>{session.word}</Text>
        <Muted>
          {date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} ·{' '}
          {formatClock(session.durationSec)} · {session.score.stats.wordsPerMinute} wpm
        </Muted>
      </View>
      <Text style={[styles.rowScore, { color: scoreColor(session.finalScore) }]}>
        {session.finalScore}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  rowWord: { color: colors.text, fontSize: 17, fontWeight: '600', textTransform: 'capitalize' },
  rowScore: { fontSize: 24, fontWeight: '800', marginLeft: spacing.md },
});

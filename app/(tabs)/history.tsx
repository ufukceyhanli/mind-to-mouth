import Ionicons from '@expo/vector-icons/Ionicons';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { SwipeableSessionRow } from '../../src/components/SwipeableSessionRow';
import { Muted, PageHeader } from '../../src/components/ui';
import { deleteSession, loadSessions } from '../../src/storage';
import { colors, spacing, type } from '../../src/theme';
import type { Session } from '../../src/types';

export default function HistoryScreen() {
  const insets = useSafeAreaInsets();
  const [sessions, setSessions] = useState<Session[]>([]);

  const reload = useCallback(() => {
    let cancelled = false;
    loadSessions().then((list) => {
      if (!cancelled) setSessions(list);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useFocusEffect(reload);

  // The row asks for confirmation (or takes a full swipe as the answer) and
  // animates out before calling this.
  const removeSession = useCallback(async (session: Session) => {
    await deleteSession(session.id);
    setSessions((list) => list.filter((s) => s.id !== session.id));
  }, []);

  return (
    <FlatList
      style={styles.screen}
      contentContainerStyle={[
        styles.content,
        { paddingTop: insets.top + spacing.lg, paddingBottom: spacing.xl },
      ]}
      data={sessions}
      keyExtractor={(s) => s.id}
      renderItem={({ item }) => (
        <SwipeableSessionRow session={item} onDelete={() => removeSession(item)} />
      )}
      ListHeaderComponent={
        <PageHeader
          title="Talks"
          subtitle={
            sessions.length > 0
              ? `${sessions.length} talk${sessions.length === 1 ? '' : 's'}. Swipe left to delete.`
              : undefined
          }
          style={styles.header}
        />
      }
      ListEmptyComponent={
        <View style={styles.empty}>
          <View style={styles.emptyIcon}>
            <Ionicons name="mic-outline" size={36} color={colors.accent} />
          </View>
          <Text style={styles.emptyTitle}>No talks yet</Text>
          <Muted style={{ textAlign: 'center' }}>
            Your first two minutes are the hardest. Everything after that is practice.
          </Muted>
        </View>
      }
    />
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { paddingHorizontal: spacing.md },
  header: { marginBottom: spacing.lg },
  empty: { alignItems: 'center', paddingTop: spacing.xl, gap: spacing.sm, paddingHorizontal: spacing.lg },
  emptyIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  emptyTitle: { ...type.h2, color: colors.text },
});

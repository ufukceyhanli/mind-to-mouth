import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, FlatList, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { SessionRow } from '../src/components/SessionRow';
import { Muted } from '../src/components/ui';
import { deleteSession, loadSessions } from '../src/storage';
import { colors, spacing } from '../src/theme';
import type { Session } from '../src/types';

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

  const confirmDelete = (session: Session) => {
    Alert.alert(`Delete "${session.word}"?`, 'This talk will be removed from your history.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await deleteSession(session.id);
          setSessions((list) => list.filter((s) => s.id !== session.id));
        },
      },
    ]);
  };

  return (
    <FlatList
      style={styles.screen}
      contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.xl }]}
      data={sessions}
      keyExtractor={(s) => s.id}
      renderItem={({ item }) => (
        <SessionRow session={item} onLongPress={() => confirmDelete(item)} />
      )}
      ListHeaderComponent={
        sessions.length > 0 ? (
          <Muted style={{ marginBottom: spacing.sm }}>
            {sessions.length} talk{sessions.length === 1 ? '' : 's'}. Long-press to delete.
          </Muted>
        ) : null
      }
      ListEmptyComponent={
        <View style={styles.empty}>
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
  content: { padding: spacing.md },
  empty: { alignItems: 'center', paddingTop: spacing.xxl, gap: spacing.sm },
  emptyTitle: { color: colors.text, fontSize: 20, fontWeight: '700' },
});

import Ionicons from '@expo/vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';
import { useCallback, useRef } from 'react';
import { Alert, Pressable, StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';
import Swipeable, { type SwipeableMethods } from 'react-native-gesture-handler/ReanimatedSwipeable';
import Animated, {
  useAnimatedReaction,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { colors, radius, spacing, type } from '../theme';
import type { Session } from '../types';
import { SessionRow } from './SessionRow';

/** Width of the red Delete action a partial swipe reveals. */
const ACTION_WIDTH = 96;
/** Dragging past this share of the row is a full swipe: the talk goes without asking. */
const FULL_SWIPE_RATIO = 0.6;
const COLLAPSE_MS = 220;

/**
 * A talk row that can be swiped left to delete. A short swipe reveals a
 * Delete button that asks first; a swipe across most of the row deletes at
 * once. Long-press and the VoiceOver "Delete talk" action still work, both
 * with confirmation. The row collapses before `onDelete` runs.
 */
export function SwipeableSessionRow({
  session,
  onDelete,
}: {
  session: Session;
  /** Removes the talk from storage and the list. Called once the row has animated out. */
  onDelete: () => void | Promise<void>;
}) {
  const swipeable = useRef<SwipeableMethods>(null);
  const removing = useRef(false);
  const rowWidth = useSharedValue(0);
  const rowHeight = useSharedValue(0);
  /** True while the finger is past the full-swipe threshold. */
  const armed = useSharedValue(false);
  /** 0 = in place, 1 = collapsed away. */
  const removed = useSharedValue(0);

  const collapseStyle = useAnimatedStyle(() =>
    removed.get() === 0
      ? {}
      : {
          height: rowHeight.get() * (1 - removed.get()),
          marginBottom: spacing.sm * (1 - removed.get()),
          opacity: 1 - removed.get(),
        },
  );

  const onLayout = (e: LayoutChangeEvent) => {
    rowWidth.set(e.nativeEvent.layout.width);
    rowHeight.set(e.nativeEvent.layout.height);
  };

  const animateOut = useCallback(() => {
    if (removing.current) return;
    removing.current = true;
    const finish = () => void onDelete();
    removed.set(
      withTiming(1, { duration: COLLAPSE_MS }, () => {
        'worklet';
        scheduleOnRN(finish);
      }),
    );
  }, [onDelete, removed]);

  const confirmDelete = useCallback(() => {
    Alert.alert(`Delete "${session.word}"?`, 'This talk and its recording will be removed from your phone.', [
      { text: 'Cancel', style: 'cancel', onPress: () => swipeable.current?.close() },
      { text: 'Delete', style: 'destructive', onPress: animateOut },
    ]);
  }, [animateOut, session.word]);

  const renderRightActions = useCallback(
    (_progress: SharedValue<number>, translation: SharedValue<number>) => (
      <DeleteAction translation={translation} rowWidth={rowWidth} armed={armed} onPress={confirmDelete} />
    ),
    [armed, confirmDelete, rowWidth],
  );

  return (
    <Animated.View style={[styles.outer, collapseStyle]} onLayout={onLayout}>
      <Swipeable
        ref={swipeable}
        renderRightActions={renderRightActions}
        rightThreshold={ACTION_WIDTH / 2}
        onSwipeableWillOpen={() => {
          // Fires before the row springs back to the open position, so the
          // flag still reflects how far the finger went.
          if (armed.get()) animateOut();
        }}
      >
        <SessionRow session={session} onDelete={confirmDelete} style={styles.row} />
      </Swipeable>
    </Animated.View>
  );
}

function buzz() {
  void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
}

/**
 * The red pane under the row. Its layout slot stays `ACTION_WIDTH` wide (the
 * swipeable measures it to know where "open" is); the visible pane is
 * absolutely positioned and stretches left to follow the finger.
 */
function DeleteAction({
  translation,
  rowWidth,
  armed,
  onPress,
}: {
  translation: SharedValue<number>;
  rowWidth: SharedValue<number>;
  armed: SharedValue<boolean>;
  onPress: () => void;
}) {
  useAnimatedReaction(
    () => translation.get(),
    (x) => {
      const threshold = rowWidth.get() * FULL_SWIPE_RATIO;
      const past = threshold > 0 && -x >= threshold;
      if (past !== armed.get()) {
        armed.set(past);
        if (past) scheduleOnRN(buzz);
      }
    },
  );

  const paneStyle = useAnimatedStyle(() => ({
    width: Math.max(ACTION_WIDTH, -translation.get()),
  }));

  return (
    <View style={styles.actionSlot}>
      <Animated.View style={[styles.pane, paneStyle]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Delete talk"
          onPress={onPress}
          style={({ pressed }) => [styles.deleteButton, pressed && { opacity: 0.8 }]}
        >
          <Ionicons name="trash-outline" size={22} color={colors.white} />
          <Text style={styles.deleteText}>Delete</Text>
        </Pressable>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  outer: { marginBottom: spacing.sm, overflow: 'hidden' },
  row: { marginBottom: 0 },
  actionSlot: { width: ACTION_WIDTH },
  pane: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    backgroundColor: colors.danger,
    borderRadius: radius.lg,
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  deleteButton: {
    width: ACTION_WIDTH,
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  deleteText: { ...type.captionBold, fontSize: 14, color: colors.white },
});

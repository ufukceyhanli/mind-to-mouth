import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';

import { FREE_TALKS_PER_WEEK, describeReset, freeTalksLeft } from './limits';
import { loadUsage } from './usage';

export type Allowance = {
  /** False until the counter has been read once. */
  loaded: boolean;
  /** Free talks still available this week. */
  left: number;
  total: number;
  /** "on Monday" or "tomorrow". */
  resets: string;
};

/** The free plan's weekly allowance, re-read every time the screen comes into focus. */
export function useAllowance(): Allowance {
  const [usage, setUsage] = useState<number[] | null>(null);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      loadUsage().then((u) => {
        if (!cancelled) setUsage(u);
      });
      return () => {
        cancelled = true;
      };
    }, []),
  );

  const now = new Date();
  return {
    loaded: usage !== null,
    left: freeTalksLeft(usage ?? [], now),
    total: FREE_TALKS_PER_WEEK,
    resets: describeReset(now),
  };
}

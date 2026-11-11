import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useRef, useState, type ReactNode } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { WordTile } from '../../src/components/auth';
import { Badge, Button, MicDisc, ProgressBar, ScoreBadge } from '../../src/components/ui';
import { colors, radius, shadow, spacing, talkColor, type } from '../../src/theme';

/** Prompt words shown in the header strip; the bank has about 250 more. */
const SAMPLE_WORDS = ['Lighthouse', 'Regret', 'Umbrella'];

type Slide = { key: string; title: string; body: string; art: () => ReactNode };

const SLIDES: Slide[] = [
  {
    key: 'word',
    title: 'A new word, every day',
    body: 'A random prompt, a few seconds to think, then you talk. No script, no slides.',
    art: () => (
      <View style={styles.artRow}>
        <WordTile word="Lighthouse" rotate="-8deg" width={96} style={{ marginRight: -12, marginBottom: 24 }} />
        <WordTile word="Patience" rotate="7deg" width={96} style={{ marginTop: 12 }} />
        <Badge tone="accent" style={styles.artBadge}>
          10s to think
        </Badge>
      </View>
    ),
  },
  {
    key: 'talk',
    title: 'Talk for two minutes',
    body: 'The clock counts down from 2:00 and only lets you finish once you get there.',
    art: () => (
      <View style={styles.artRow}>
        <MicDisc size={150} />
        <Badge tone="dark" style={styles.artBadge}>
          2:00
        </Badge>
      </View>
    ),
  },
  {
    key: 'score',
    title: 'Scored, then coached',
    body: 'A delivery rubric runs on your phone. An AI coach reads the transcript and sets one drill for tomorrow.',
    art: () => (
      <View style={styles.artRow}>
        <ScoreBadge score={82} size={132} />
        <View style={styles.bars}>
          {[0.9, 0.7, 0.55].map((v, i) => (
            <ProgressBar key={i} value={v} max={1} height={8} color={[colors.success, colors.warn, colors.accent][i]} />
          ))}
        </View>
      </View>
    ),
  },
  {
    key: 'streak',
    title: 'Keep the streak alive',
    body: 'One talk a day. Every talk, recording and score stays on your phone.',
    art: () => (
      <View style={styles.artColumn}>
        <View style={styles.streakDisc}>
          <Ionicons name="flame" size={60} color={colors.onAccent} />
        </View>
        <View style={styles.days}>
          {(['M', 'T', 'W', 'T', 'F', 'S', 'S'] as const).map((d, i) => (
            <View key={i} style={[styles.day, i < 5 && styles.dayDone]}>
              <Text style={[styles.dayText, i < 5 && { color: colors.onAccent }]}>{d}</Text>
            </View>
          ))}
        </View>
      </View>
    ),
  },
];

/**
 * First screen for anyone without a session: what the app does, in four
 * swipeable cards, then "Get Started" (create an account) or "I have an
 * account" (sign in). Nothing else is reachable until one of those succeeds.
 */
export default function WelcomeScreen() {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const [page, setPage] = useState(0);
  const scrollRef = useRef<ScrollView>(null);

  // Tracked from every scroll event rather than momentum end, which a drag
  // that stops exactly on a page boundary never fires.
  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const next = Math.round(e.nativeEvent.contentOffset.x / width);
    if (next !== page) setPage(Math.max(0, Math.min(SLIDES.length - 1, next)));
  };

  return (
    <View style={[styles.screen, { paddingTop: insets.top + spacing.xl, paddingBottom: insets.bottom + spacing.md }]}>
      <View style={styles.top}>
        <Text style={styles.headline}>Think on your feet, out loud</Text>
        <View style={styles.wordStrip}>
          {SAMPLE_WORDS.map((w) => (
            <View key={w} style={[styles.wordChip, { backgroundColor: talkColor(w) }]}>
              <Text style={styles.wordChipText}>{w}</Text>
            </View>
          ))}
          <Text style={styles.wordMore}>+250</Text>
        </View>
      </View>

      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={onScroll}
        scrollEventThrottle={32}
        style={{ flexGrow: 0 }}
        contentContainerStyle={{ alignItems: 'center' }}
      >
        {SLIDES.map((slide, i) => (
          <View key={slide.key} style={[styles.page, { width }]}>
            {/* Offset tinted card behind, so the stack looks like a pile. */}
            <View style={[styles.cardShadow, { transform: [{ rotate: i % 2 === 0 ? '-4deg' : '4deg' }] }]} />
            <View style={[styles.card, shadow]}>
              <View style={styles.art}>{slide.art()}</View>
              <Text style={styles.cardTitle}>{slide.title}</Text>
              <Text style={styles.cardBody}>{slide.body}</Text>
            </View>
          </View>
        ))}
      </ScrollView>

      <View style={styles.dots} accessibilityRole="progressbar" accessibilityLabel={`Slide ${page + 1} of ${SLIDES.length}`}>
        {SLIDES.map((s, i) => (
          <Pressable
            key={s.key}
            hitSlop={8}
            onPress={() => {
              scrollRef.current?.scrollTo({ x: i * width, animated: true });
              setPage(i);
            }}
            style={[styles.dot, i === page && styles.dotActive]}
          />
        ))}
      </View>

      <View style={styles.actions}>
        <Button title="Get Started" onPress={() => router.push('/auth')} />
        <Pressable accessibilityRole="button" onPress={() => router.push('/auth/sign-in')} hitSlop={8} style={styles.haveAccount}>
          <Text style={styles.haveAccountText}>I have an account</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg, justifyContent: 'space-between' },
  top: { paddingHorizontal: spacing.lg, gap: spacing.md, alignItems: 'center' },
  headline: { ...type.title, fontSize: 30, lineHeight: 36, color: colors.text, textAlign: 'center' },
  wordStrip: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  wordChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: radius.sm },
  wordChipText: { ...type.captionBold, fontSize: 14, color: colors.white },
  wordMore: { ...type.h3, color: colors.muted, marginLeft: spacing.xs },
  page: { paddingHorizontal: spacing.md, alignItems: 'center', justifyContent: 'center' },
  cardShadow: {
    position: 'absolute',
    left: spacing.md + 6,
    right: spacing.md + 6,
    top: 10,
    bottom: 10,
    borderRadius: radius.xl,
    backgroundColor: colors.heroMuted,
  },
  card: {
    width: '100%',
    backgroundColor: colors.accentSoft,
    borderRadius: radius.xl,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
    paddingBottom: spacing.lg,
    alignItems: 'center',
    gap: spacing.md,
  },
  art: { height: 190, alignItems: 'center', justifyContent: 'center', alignSelf: 'stretch' },
  artRow: { alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: spacing.md },
  artBadge: { position: 'absolute', bottom: -14, alignSelf: 'center' },
  bars: { width: 96, gap: 10 },
  artColumn: { alignItems: 'center', justifyContent: 'center', gap: spacing.md },
  streakDisc: {
    width: 112,
    height: 112,
    borderRadius: 56,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  days: { flexDirection: 'row', gap: 6 },
  day: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayDone: { backgroundColor: colors.hero },
  dayText: { ...type.captionBold, color: colors.muted },
  cardTitle: { ...type.h2, color: colors.text, textAlign: 'center' },
  cardBody: { ...type.body, fontSize: 17, lineHeight: 25, color: colors.text, textAlign: 'center' },
  dots: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 6 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.border },
  dotActive: { width: 28, backgroundColor: colors.text },
  actions: { paddingHorizontal: spacing.md, gap: spacing.sm },
  haveAccount: { minHeight: 48, alignItems: 'center', justifyContent: 'center' },
  haveAccountText: { ...type.h3, fontSize: 18, color: colors.text },
});

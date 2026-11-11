import Ionicons from '@expo/vector-icons/Ionicons';
import * as AppleAuthentication from 'expo-apple-authentication';
import * as Linking from 'expo-linking';
import { router } from 'expo-router';
import { forwardRef, useEffect, useState, type ReactNode } from 'react';
import {
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAuth } from '../auth/AuthProvider';
import { describeAuthError } from '../auth/supabase';
import { PRIVACY_POLICY_URL } from '../links';
import { colors, radius, shadow, spacing, talkColor, type } from '../theme';
import { Button, ProgressBar } from './ui';

/** Shared pieces of the sign-up and sign-in screens. */

export const MIN_PASSWORD = 6;
export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type Notice = { tone: 'info' | 'error'; text: string } | null;

/**
 * One in-flight auth action at a time, with the error (or confirmation) shown
 * as a notice under the form. `run` swallows the error so callers only write
 * the happy path.
 */
export function useAuthAction<Kind extends string>() {
  const [busy, setBusy] = useState<Kind | null>(null);
  const [notice, setNotice] = useState<Notice>(null);
  const run = async (kind: Kind, task: () => Promise<void>) => {
    setNotice(null);
    setBusy(kind);
    try {
      await task();
    } catch (e) {
      setNotice({ tone: 'error', text: describeAuthError(e) });
    } finally {
      setBusy(null);
    }
  };
  return { busy, notice, setNotice, run };
}

// ---- Header ----------------------------------------------------------------

/**
 * Back chevron, thin progress bar and "step / total" on the right, the way an
 * onboarding questionnaire shows where you are. Without `step` only the back
 * chevron is drawn.
 */
export function StepHeader({
  step,
  total,
  onBack,
  style,
}: {
  step?: number;
  total?: number;
  onBack?: () => void;
  style?: StyleProp<ViewStyle>;
}) {
  const insets = useSafeAreaInsets();
  const back = onBack ?? (() => (router.canGoBack() ? router.back() : router.replace('/auth/welcome')));
  return (
    <View style={[styles.header, { paddingTop: insets.top + spacing.sm }, style]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Back"
        onPress={back}
        hitSlop={12}
        style={({ pressed }) => [styles.back, pressed && { opacity: 0.6 }]}
      >
        <Ionicons name="chevron-back" size={28} color={colors.accent} />
      </Pressable>
      {step !== undefined && total !== undefined ? (
        <>
          <View style={{ flex: 1 }}>
            <ProgressBar value={step} max={total} height={8} />
          </View>
          <Text style={styles.stepLabel}>
            {step}/{total}
          </Text>
        </>
      ) : (
        <View style={{ flex: 1 }} />
      )}
    </View>
  );
}

// ---- Copy ------------------------------------------------------------------

export function AuthTitle({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <View style={styles.titleBlock}>
      <Text style={styles.title}>{title}</Text>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
    </View>
  );
}

/** "By continuing, I agree with the Privacy Policy." with a tappable link. */
export function LegalFooter({ style }: { style?: StyleProp<ViewStyle> }) {
  return (
    <Text style={[styles.legal, style]}>
      By continuing, I agree with the{' '}
      <Text
        style={styles.legalLink}
        accessibilityRole="link"
        onPress={() => void Linking.openURL(PRIVACY_POLICY_URL)}
      >
        Privacy Policy
      </Text>
      .
    </Text>
  );
}

export function AuthNotice({ notice }: { notice: Notice }) {
  if (!notice) return null;
  return (
    <Text style={[styles.notice, notice.tone === 'error' ? styles.noticeError : styles.noticeInfo]}>
      {notice.text}
    </Text>
  );
}

/** Small centred prompt with an orange action, e.g. "New here? Create an account". */
export function SwitchRow({
  prompt,
  action,
  onPress,
}: {
  prompt: string;
  action: string;
  onPress: () => void;
}) {
  return (
    <View style={styles.switchRow}>
      <Text style={styles.switchPrompt}>{prompt}</Text>
      <Pressable accessibilityRole="button" onPress={onPress} hitSlop={8}>
        <Text style={styles.switchAction}>{action}</Text>
      </Pressable>
    </View>
  );
}

// ---- Fields ----------------------------------------------------------------

type FieldProps = TextInputProps & {
  label: string;
  /** Rendered to the right of the label, e.g. a "Forgot password?" link. */
  trailing?: ReactNode;
};

/** Labelled text input in the app's rounded style. */
export const AuthField = forwardRef<TextInput, FieldProps>(function AuthField(
  { label, trailing, style, ...input },
  ref,
) {
  return (
    <View>
      <View style={styles.labelRow}>
        <Text style={styles.label}>{label}</Text>
        {trailing}
      </View>
      <TextInput
        ref={ref}
        placeholderTextColor={colors.muted}
        autoCapitalize="none"
        autoCorrect={false}
        accessibilityLabel={label}
        style={[styles.input, style]}
        {...input}
      />
    </View>
  );
});

// ---- Third-party sign-in ---------------------------------------------------

/** True on iOS devices that can show Apple's sheet. */
export function useAppleAvailable(): boolean {
  const [available, setAvailable] = useState(false);
  useEffect(() => {
    if (Platform.OS !== 'ios') return;
    AppleAuthentication.isAvailableAsync().then(setAvailable, () => setAvailable(false));
  }, []);
  return available;
}

/**
 * "Continue with Apple" (Apple's own button, as its guidelines require) and
 * "Continue with Google", stacked. Apple's button is skipped where Apple's
 * sheet is unavailable, Google's until the Supabase project has the provider
 * switched on. Renders nothing when neither applies.
 */
export function ProviderButtons({
  onApple,
  onGoogle,
  busy,
  disabled,
}: {
  onApple: () => void;
  onGoogle: () => void;
  busy: 'apple' | 'google' | null;
  disabled: boolean;
}) {
  const appleAvailable = useAppleAvailable();
  const { googleEnabled } = useAuth();
  if (!appleAvailable && !googleEnabled) return null;
  return (
    <View style={styles.providers}>
      {appleAvailable && (
        <AppleAuthentication.AppleAuthenticationButton
          buttonType={AppleAuthentication.AppleAuthenticationButtonType.CONTINUE}
          buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
          cornerRadius={radius.pill}
          style={[styles.apple, (disabled || busy === 'apple') && { opacity: 0.5 }]}
          onPress={disabled ? () => {} : onApple}
        />
      )}
      {googleEnabled && (
        <Button
          title="Continue with Google"
          variant="dark"
          icon="logo-google"
          onPress={onGoogle}
          loading={busy === 'google'}
          disabled={disabled && busy !== 'google'}
        />
      )}
    </View>
  );
}

/** Thin rule with a word in the middle: "or with email". */
export function Divider({ label }: { label: string }) {
  return (
    <View style={styles.divider}>
      <View style={styles.rule} />
      <Text style={styles.dividerLabel}>{label}</Text>
      <View style={styles.rule} />
    </View>
  );
}

// ---- Illustration ----------------------------------------------------------

/** A small tilted talk tile with a prompt word, the app's stand-in for a book cover. */
export function WordTile({
  word,
  rotate,
  width = 84,
  style,
}: {
  word: string;
  rotate: string;
  width?: number;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View
      style={[
        styles.wordTile,
        shadow,
        { width, height: width * 1.3, backgroundColor: talkColor(word), transform: [{ rotate }] },
        style,
      ]}
    >
      <Ionicons name="mic" size={Math.round(width * 0.22)} color="rgba(255,255,255,0.85)" />
      <Text
        style={[styles.wordTileText, { fontSize: Math.round(width * 0.17) }]}
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.6}
      >
        {word}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
  },
  back: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center', marginLeft: -8 },
  stepLabel: { ...type.h3, color: colors.text, minWidth: 40, textAlign: 'right' },
  titleBlock: { alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.md },
  title: { ...type.title, fontSize: 30, lineHeight: 36, color: colors.text, textAlign: 'center' },
  subtitle: { ...type.bodyLarge, fontSize: 18, lineHeight: 26, color: colors.text, textAlign: 'center' },
  legal: { ...type.caption, fontSize: 14, lineHeight: 20, color: colors.muted, textAlign: 'center' },
  legalLink: { color: colors.muted, textDecorationLine: 'underline' },
  notice: { ...type.caption, lineHeight: 19 },
  noticeError: { color: colors.danger },
  noticeInfo: { color: colors.success },
  switchRow: { flexDirection: 'row', justifyContent: 'center', gap: spacing.xs },
  switchPrompt: { ...type.body, fontSize: 15, color: colors.muted },
  switchAction: { ...type.bodyBold, fontSize: 15, color: colors.accent },
  labelRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  label: { ...type.label, color: colors.text, marginBottom: spacing.sm },
  input: {
    ...type.body,
    backgroundColor: colors.bg,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    color: colors.text,
    paddingHorizontal: spacing.md,
    paddingVertical: 14,
  },
  providers: { gap: spacing.md },
  apple: { width: '100%', height: 56 },
  divider: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  rule: { flex: 1, height: 1, backgroundColor: colors.border },
  dividerLabel: { ...type.captionBold, color: colors.muted },
  wordTile: {
    borderRadius: radius.md,
    padding: 10,
    justifyContent: 'space-between',
  },
  wordTileText: { fontFamily: type.bodyBold.fontFamily, color: colors.white },
});

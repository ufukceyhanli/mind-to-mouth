import { useEffect, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button, Card, Muted, SectionTitle } from '../src/components/ui';
import {
  getAnthropicKey,
  getOpenAIKey,
  loadSettings,
  saveSettings,
  setAnthropicKey,
  setOpenAIKey,
} from '../src/storage';
import { colors, radius, spacing } from '../src/theme';
import { DEFAULT_SETTINGS, type Settings } from '../src/types';

const PREP_OPTIONS = [5, 10, 20, 30];
const MIN_OPTIONS = [60, 90, 120, 180];
const MAX_OPTIONS = [180, 300, 600];

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const [openAI, setOpenAI] = useState('');
  const [anthropic, setAnthropic] = useState('');
  const [reveal, setReveal] = useState(false);
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [saving, setSaving] = useState(false);
  const [justSaved, setJustSaved] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [o, a, s] = await Promise.all([getOpenAIKey(), getAnthropicKey(), loadSettings()]);
      if (cancelled) return;
      setOpenAI(o ?? '');
      setAnthropic(a ?? '');
      setSettings(s);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const save = async () => {
    setSaving(true);
    try {
      const safeSettings: Settings = {
        ...settings,
        maxSeconds: Math.max(settings.maxSeconds, settings.minSeconds + 30),
      };
      await Promise.all([
        setOpenAIKey(openAI),
        setAnthropicKey(anthropic),
        saveSettings(safeSettings),
      ]);
      setSettings(safeSettings);
      setJustSaved(true);
      setTimeout(() => setJustSaved(false), 2500);
    } finally {
      setSaving(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={100}
    >
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.xl }]}
        keyboardShouldPersistTaps="handled"
      >
        <View>
          <SectionTitle>API keys</SectionTitle>
          <Card style={{ gap: spacing.md }}>
            <View>
              <Text style={styles.label}>OpenAI (required for transcription)</Text>
              <TextInput
                value={openAI}
                onChangeText={setOpenAI}
                placeholder="sk-…"
                placeholderTextColor={colors.muted}
                autoCapitalize="none"
                autoCorrect={false}
                secureTextEntry={!reveal}
                style={styles.input}
              />
              <Muted style={styles.hint}>Used for Whisper speech-to-text.</Muted>
            </View>
            <View>
              <Text style={styles.label}>Anthropic (optional, for coaching)</Text>
              <TextInput
                value={anthropic}
                onChangeText={setAnthropic}
                placeholder="sk-ant-…"
                placeholderTextColor={colors.muted}
                autoCapitalize="none"
                autoCorrect={false}
                secureTextEntry={!reveal}
                style={styles.input}
              />
              <Muted style={styles.hint}>
                Claude reads the transcript and scores coherence, structure and relevance, with
                written notes.
              </Muted>
            </View>
            <Pressable onPress={() => setReveal((v) => !v)}>
              <Text style={styles.link}>{reveal ? 'Hide keys' : 'Show keys'}</Text>
            </Pressable>
            <Muted style={styles.hint}>
              Keys are stored in the device keychain and only ever sent to the provider they belong
              to.
            </Muted>
          </Card>
        </View>

        <View>
          <SectionTitle>Practice</SectionTitle>
          <Card style={{ gap: spacing.md }}>
            <OptionRow
              label="Thinking time"
              options={PREP_OPTIONS}
              value={settings.prepSeconds}
              format={(v) => `${v}s`}
              onChange={(prepSeconds) => setSettings((s) => ({ ...s, prepSeconds }))}
            />
            <OptionRow
              label="Minimum talk"
              options={MIN_OPTIONS}
              value={settings.minSeconds}
              format={(v) => (v % 60 === 0 ? `${v / 60} min` : `${v}s`)}
              onChange={(minSeconds) => setSettings((s) => ({ ...s, minSeconds }))}
            />
            <OptionRow
              label="Auto-stop after"
              options={MAX_OPTIONS}
              value={settings.maxSeconds}
              format={(v) => `${v / 60} min`}
              onChange={(maxSeconds) => setSettings((s) => ({ ...s, maxSeconds }))}
            />
          </Card>
        </View>

        <Button
          title={justSaved ? 'Saved' : 'Save'}
          onPress={() => void save()}
          loading={saving}
        />

        <View>
          <SectionTitle>How scoring works</SectionTitle>
          <Card>
            <Muted>
              The delivery rubric runs on your phone: keeping going (20), pace (20), fluency (20),
              vocabulary range (15), staying on topic (15) and flow (10). With an Anthropic key,
              the coach adds three content scores out of 10 and the final number is 60% rubric,
              40% coach.
            </Muted>
          </Card>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function OptionRow({
  label,
  options,
  value,
  format,
  onChange,
}: {
  label: string;
  options: number[];
  value: number;
  format: (v: number) => string;
  onChange: (v: number) => void;
}) {
  return (
    <View>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.pills}>
        {options.map((opt) => {
          const selected = opt === value;
          return (
            <Pressable
              key={opt}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              onPress={() => onChange(opt)}
              style={[styles.pill, selected && styles.pillSelected]}
            >
              <Text style={[styles.pillText, selected && styles.pillTextSelected]}>
                {format(opt)}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.md, gap: spacing.lg },
  label: { color: colors.text, fontSize: 15, fontWeight: '600', marginBottom: spacing.sm },
  input: {
    backgroundColor: colors.cardAlt,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    color: colors.text,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    fontSize: 15,
  },
  hint: { fontSize: 13, marginTop: 6 },
  link: { color: colors.accent, fontWeight: '600' },
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  pill: {
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    borderRadius: radius.pill,
    backgroundColor: colors.cardAlt,
    borderWidth: 1,
    borderColor: colors.border,
  },
  pillSelected: { backgroundColor: colors.accent, borderColor: colors.accent },
  pillText: { color: colors.text, fontSize: 14, fontWeight: '600' },
  pillTextSelected: { color: colors.bg },
});

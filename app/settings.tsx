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
import { getNvidiaKey, loadSettings, saveSettings, setNvidiaKey } from '../src/storage';
import { colors, radius, spacing } from '../src/theme';
import { DEFAULT_SETTINGS, type Settings } from '../src/types';

const PREP_OPTIONS = [5, 10, 20, 30];
const MIN_OPTIONS = [60, 90, 120, 180];
const MAX_OPTIONS = [180, 300, 600];

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const [apiKey, setApiKey] = useState('');
  const [reveal, setReveal] = useState(false);
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [saving, setSaving] = useState(false);
  const [justSaved, setJustSaved] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [key, s] = await Promise.all([getNvidiaKey(), loadSettings()]);
      if (cancelled) return;
      setApiKey(key ?? '');
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
        transcribeModel: settings.transcribeModel.trim() || DEFAULT_SETTINGS.transcribeModel,
        coachModel: settings.coachModel.trim() || DEFAULT_SETTINGS.coachModel,
      };
      await Promise.all([setNvidiaKey(apiKey), saveSettings(safeSettings)]);
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
          <SectionTitle>NVIDIA API</SectionTitle>
          <Card style={{ gap: spacing.md }}>
            <View>
              <Text style={styles.label}>API key</Text>
              <TextInput
                value={apiKey}
                onChangeText={setApiKey}
                placeholder="nvapi-…"
                placeholderTextColor={colors.muted}
                autoCapitalize="none"
                autoCorrect={false}
                secureTextEntry={!reveal}
                style={styles.input}
              />
              <Muted style={styles.hint}>
                Free at build.nvidia.com. Used for both transcription and coaching. Stored in the
                device keychain and only ever sent to integrate.api.nvidia.com.
              </Muted>
            </View>
            <Pressable onPress={() => setReveal((v) => !v)}>
              <Text style={styles.link}>{reveal ? 'Hide key' : 'Show key'}</Text>
            </Pressable>
          </Card>
        </View>

        <View>
          <SectionTitle>Models</SectionTitle>
          <Card style={{ gap: spacing.md }}>
            <ModelField
              label="Speech to text"
              value={settings.transcribeModel}
              defaultValue={DEFAULT_SETTINGS.transcribeModel}
              hint="Must accept audio input over chat completions. Gemma 3n does; each chunk is under 30 seconds."
              onChange={(transcribeModel) => setSettings((s) => ({ ...s, transcribeModel }))}
            />
            <ModelField
              label="Coach"
              value={settings.coachModel}
              defaultValue={DEFAULT_SETTINGS.coachModel}
              hint="Any text model on build.nvidia.com that can return JSON. Nemotron 3 Ultra is NVIDIA's most capable."
              onChange={(coachModel) => setSettings((s) => ({ ...s, coachModel }))}
            />
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

        <Button title={justSaved ? 'Saved' : 'Save'} onPress={() => void save()} loading={saving} />

        <View>
          <SectionTitle>How scoring works</SectionTitle>
          <Card>
            <Muted>
              The delivery rubric runs on your phone: keeping going (20), pace (20), fluency (20),
              vocabulary range (15), staying on topic (15) and flow (10). The coach model adds
              three content scores out of 10 and the final number is 60% rubric, 40% coach.
            </Muted>
          </Card>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function ModelField({
  label,
  value,
  defaultValue,
  hint,
  onChange,
}: {
  label: string;
  value: string;
  defaultValue: string;
  hint: string;
  onChange: (v: string) => void;
}) {
  return (
    <View>
      <View style={styles.labelRow}>
        <Text style={styles.label}>{label}</Text>
        {value !== defaultValue && (
          <Pressable onPress={() => onChange(defaultValue)}>
            <Text style={styles.link}>Reset</Text>
          </Pressable>
        )}
      </View>
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder={defaultValue}
        placeholderTextColor={colors.muted}
        autoCapitalize="none"
        autoCorrect={false}
        style={styles.input}
      />
      <Muted style={styles.hint}>{hint}</Muted>
    </View>
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
  labelRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
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

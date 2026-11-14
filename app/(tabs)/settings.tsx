import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { router } from 'expo-router';

import { coachHost } from '../../src/coach';
import { Button, Card, Chip, Link, Muted, PageHeader, SectionTitle } from '../../src/components/ui';
import { usePlan } from '../../src/plan/PlanProvider';
import { FREE_MAX_SECONDS } from '../../src/plan/limits';
import { loadSettings, saveSettings } from '../../src/storage';
import { colors, spacing, type } from '../../src/theme';
import { supportsOnDevice } from '../../src/transcribe';
import { DEFAULT_SETTINGS, type Settings } from '../../src/types';

const PREP_OPTIONS = [5, 10, 20, 30];
const MIN_OPTIONS = [60, 90, 120, 180];
const MAX_OPTIONS = [180, 300, 600];

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const plan = usePlan();
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [saving, setSaving] = useState(false);
  const [justSaved, setJustSaved] = useState(false);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const s = await loadSettings();
      if (cancelled) return;
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
      await saveSettings(safeSettings);
      setSettings(safeSettings);
      setJustSaved(true);
      setTimeout(() => setJustSaved(false), 2500);
    } finally {
      setSaving(false);
    }
  };

  const host = coachHost();
  const onDevice = supportsOnDevice();

  return (
    <View style={styles.screen}>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + spacing.lg, paddingBottom: spacing.xl },
        ]}
      >
        <PageHeader title="Settings" subtitle="Your account and privacy choices live under Profile on the Today tab." />

        <View>
          <SectionTitle>Practice</SectionTitle>
          <Card style={{ gap: spacing.lg }}>
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
              hint={
                plan.isPlus
                  ? undefined
                  : `On the free plan talks stop at ${FREE_MAX_SECONDS / 60} minutes. Plus uses the length you pick here.`
              }
            />
            <View>
              <View style={styles.switchRow}>
                <Text style={[styles.label, { marginBottom: 0 }]}>Pronunciation check</Text>
                {plan.isPlus ? (
                  <Switch
                    value={settings.checkPronunciation}
                    onValueChange={(checkPronunciation) =>
                      setSettings((s) => ({ ...s, checkPronunciation }))
                    }
                    trackColor={{ true: colors.accent, false: colors.surfaceAlt }}
                    thumbColor={colors.white}
                  />
                ) : (
                  <Link onPress={() => router.push('/plus')}>Part of Plus</Link>
                )}
              </View>
              <Muted style={styles.hint}>
                After scoring, runs the recording through the phone’s speech recognizer once more
                and flags the words it was least sure of. Nothing is sent anywhere; it adds a few
                seconds on the result screen.
              </Muted>
            </View>
          </Card>
        </View>

        <Button
          title={justSaved ? 'Saved' : 'Save'}
          icon={justSaved ? 'checkmark' : undefined}
          onPress={() => void save()}
          loading={saving}
        />

        <View>
          <SectionTitle>Where your talk goes</SectionTitle>
          <Card style={{ gap: spacing.lg }}>
            <InfoRow
              label="Speech to text"
              value={onDevice ? 'On this phone' : 'Apple speech service'}
              hint={
                onDevice
                  ? 'iOS turns the recording into text without sending audio anywhere.'
                  : 'This device cannot recognise speech offline, so iOS sends the audio to Apple for recognition.'
              }
            />
            <InfoRow
              label="Coach"
              value={host ?? 'Not configured'}
              hint={
                host
                  ? 'Only the text of your talk and the measured stats are sent, never the recording.'
                  : 'This build scores with the on-device rubric alone.'
              }
            />
          </Card>
        </View>

        <View>
          <SectionTitle>How scoring works</SectionTitle>
          <Card>
            <Muted>
              The delivery rubric runs on your phone: pace (25), rate variation (15), volume
              (15), fluency (25) and vocabulary range (20). The coach adds three content scores
              out of 10 and the final number is 60% rubric, 40% coach.
            </Muted>
          </Card>
        </View>
      </ScrollView>
    </View>
  );
}

function InfoRow({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <View>
      <View style={styles.labelRow}>
        <Text style={[styles.label, { marginBottom: 0 }]}>{label}</Text>
        <Text style={styles.value}>{value}</Text>
      </View>
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
  hint,
}: {
  label: string;
  options: number[];
  value: number;
  format: (v: number) => string;
  onChange: (v: number) => void;
  hint?: string;
}) {
  return (
    <View>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.chips}>
        {options.map((opt) => (
          <Chip
            key={opt}
            label={format(opt)}
            selected={opt === value}
            onPress={() => onChange(opt)}
          />
        ))}
      </View>
      {hint && <Muted style={styles.hint}>{hint}</Muted>}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { paddingHorizontal: spacing.md, gap: spacing.lg },
  label: { ...type.label, color: colors.text, marginBottom: spacing.sm },
  labelRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  switchRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  value: { ...type.label, color: colors.accent, flexShrink: 1, textAlign: 'right' },
  hint: { ...type.caption, marginTop: 8 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
});

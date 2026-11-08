import Constants from 'expo-constants';
import * as Linking from 'expo-linking';
import { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';

import { DataSharingNotice } from '../../src/components/DataSharingNotice';
import { Button, Card, Chip, Link, Muted, PageHeader, SectionTitle } from '../../src/components/ui';
import { PRIVACY_POLICY_URL, SUPPORT_URL } from '../../src/links';
import {
  deleteAllSessions,
  getDataSharingConsent,
  getStoredNvidiaKey,
  hasBundledNvidiaKey,
  loadSessions,
  loadSettings,
  saveSettings,
  setDataSharingConsent,
  setNvidiaKey,
} from '../../src/storage';
import { colors, radius, spacing, type } from '../../src/theme';
import { DEFAULT_SETTINGS, type Settings } from '../../src/types';

const appVersion = Constants.expoConfig?.version ?? '1.0.0';

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
  const [consentDate, setConsentDate] = useState<string | null>(null);
  const [talkCount, setTalkCount] = useState(0);

  // Consent and the talk count can change elsewhere (first practice, deleting
  // from Talks), so they reload every time the tab is shown.
  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      Promise.all([getDataSharingConsent(), loadSessions()]).then(([consent, sessions]) => {
        if (cancelled) return;
        setConsentDate(consent);
        setTalkCount(sessions.length);
      });
      return () => {
        cancelled = true;
      };
    }, []),
  );

  const withdrawConsent = () => {
    Alert.alert(
      'Stop sending recordings?',
      'You will be asked again before your next talk. Talks cannot be scored without it.',
      [
        { text: 'Keep sharing', style: 'cancel' },
        {
          text: 'Withdraw',
          style: 'destructive',
          onPress: async () => {
            await setDataSharingConsent(false);
            setConsentDate(null);
          },
        },
      ],
    );
  };

  const deleteEverything = () => {
    Alert.alert(
      'Delete all talks?',
      `${talkCount} talk${talkCount === 1 ? '' : 's'}, with every recording, transcript and score, will be removed from this phone. This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete all',
          style: 'destructive',
          onPress: async () => {
            await deleteAllSessions();
            setTalkCount(0);
          },
        },
      ],
    );
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [key, s] = await Promise.all([getStoredNvidiaKey(), loadSettings()]);
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
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + spacing.lg, paddingBottom: spacing.xl },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        <PageHeader title="Settings" />

        {!hasBundledNvidiaKey && (
          <View>
            <SectionTitle>Access key</SectionTitle>
            <Card style={{ gap: spacing.md }}>
              <View>
                <Text style={styles.label}>Key</Text>
                <TextInput
                  value={apiKey}
                  onChangeText={setApiKey}
                  placeholder="Paste your access key"
                  placeholderTextColor={colors.muted}
                  autoCapitalize="none"
                  autoCorrect={false}
                  secureTextEntry={!reveal}
                  style={styles.input}
                />
                <Muted style={styles.hint}>
                  Used for transcription and coaching. Stored in the device keychain and only sent
                  to the transcription service.
                </Muted>
              </View>
              <Link onPress={() => setReveal((v) => !v)}>{reveal ? 'Hide key' : 'Show key'}</Link>
            </Card>
          </View>
        )}

        {!hasBundledNvidiaKey && (
          <View>
            <SectionTitle>Models</SectionTitle>
            <Card style={{ gap: spacing.md }}>
              <ModelField
                label="Speech to text"
                value={settings.transcribeModel}
                defaultValue={DEFAULT_SETTINGS.transcribeModel}
                hint="Must accept audio input over chat completions; each chunk is under 30 seconds."
                onChange={(transcribeModel) => setSettings((s) => ({ ...s, transcribeModel }))}
              />
              <ModelField
                label="Coach"
                value={settings.coachModel}
                defaultValue={DEFAULT_SETTINGS.coachModel}
                hint="Any text model that can return JSON."
                onChange={(coachModel) => setSettings((s) => ({ ...s, coachModel }))}
              />
            </Card>
          </View>
        )}

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
            />
            <View>
              <View style={styles.switchRow}>
                <Text style={[styles.label, { marginBottom: 0 }]}>Pronunciation check</Text>
                <Switch
                  value={settings.checkPronunciation}
                  onValueChange={(checkPronunciation) =>
                    setSettings((s) => ({ ...s, checkPronunciation }))
                  }
                  trackColor={{ true: colors.accent, false: colors.surfaceAlt }}
                  thumbColor={colors.white}
                />
              </View>
              <Muted style={styles.hint}>
                After scoring, listens to the talk again for words worth practising, with the
                speech-to-text model. Doubles the audio requests and adds 15 to 30 seconds on the
                result screen.
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
          <SectionTitle>Privacy</SectionTitle>
          <Card style={{ gap: spacing.lg }}>
            <DataSharingNotice />
            <View style={styles.switchRow}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.label, { marginBottom: 0 }]}>Sending recordings</Text>
                <Muted style={styles.hint}>
                  {consentDate
                    ? `Agreed on ${new Date(consentDate).toLocaleDateString()}.`
                    : 'Not agreed yet. You will be asked before your next talk.'}
                </Muted>
              </View>
              {consentDate && <Link onPress={withdrawConsent}>Withdraw</Link>}
            </View>
            <Button
              title={talkCount === 0 ? 'No talks to delete' : 'Delete all talks and recordings'}
              variant="danger"
              icon="trash-outline"
              disabled={talkCount === 0}
              onPress={deleteEverything}
            />
          </Card>
        </View>

        <View>
          <SectionTitle>About</SectionTitle>
          <Card style={{ gap: spacing.md }}>
            <Link onPress={() => void Linking.openURL(PRIVACY_POLICY_URL)}>Privacy policy</Link>
            <Link onPress={() => void Linking.openURL(SUPPORT_URL)}>Contact and report a problem</Link>
            <Muted style={styles.hint}>
              Version {appVersion}. Feedback from the coach is AI-generated and can be wrong.
            </Muted>
          </Card>
        </View>

        <View>
          <SectionTitle>How scoring works</SectionTitle>
          <Card>
            <Muted>
              The delivery rubric runs on your phone: keeping going (15), pace (15), rate
              variation (10), volume (10), fluency (15), vocabulary range (10), staying on topic
              (15) and flow (10). The coach adds three content scores out of 10 and the final
              number is 60% rubric, 40% coach.
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
        {value !== defaultValue && <Link onPress={() => onChange(defaultValue)}>Reset</Link>}
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
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { paddingHorizontal: spacing.md, gap: spacing.lg },
  label: { ...type.label, color: colors.text, marginBottom: spacing.sm },
  labelRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  switchRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
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
  hint: { ...type.caption, marginTop: 8 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
});

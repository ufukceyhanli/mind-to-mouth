import Ionicons from '@expo/vector-icons/Ionicons';
import * as Linking from 'expo-linking';
import { StyleSheet, Text, View } from 'react-native';

import { PRIVACY_POLICY_URL, COACH_SERVICE_NAME } from '../links';
import { colors, spacing, type } from '../theme';
import { Link, Muted, type IconName } from './ui';

const POINTS: { icon: IconName; title: string; body: string }[] = [
  {
    icon: 'mic-outline',
    title: 'Your talk is recorded and transcribed here',
    body: 'iOS turns the recording into text on this phone. The recording, the transcript and the scores stay on the phone. Delete any talk from Talks, or everything from Profile.',
  },
  {
    icon: 'cloud-upload-outline',
    title: `The text is sent to ${COACH_SERVICE_NAME}`,
    body: 'Only the transcript and a few measured numbers go there, so an AI coach can give feedback. The audio never leaves the phone. The service processes the text only to return the result, under its own privacy policy.',
  },
  {
    icon: 'eye-off-outline',
    title: 'Nothing else leaves the phone',
    body: 'No analytics, no advertising, no tracking. Your account never holds your talks. Only the words you say during a talk are sent, and only after you agree.',
  },
];

/**
 * The plain-language disclosure shown before the first recording. Apple asks
 * for explicit permission before personal data (here: the text of the talk)
 * goes to a third-party AI service, so this is where the user grants it.
 * Withdrawal and the policy link live under Profile → About afterwards.
 */
export function DataSharingNotice() {
  return (
    <View style={styles.list}>
      {POINTS.map((p) => (
        <View key={p.title} style={styles.point}>
          <View style={styles.iconWrap}>
            <Ionicons name={p.icon} size={20} color={colors.accent} />
          </View>
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={styles.title}>{p.title}</Text>
            <Muted style={styles.body}>{p.body}</Muted>
          </View>
        </View>
      ))}
      <Link onPress={() => void Linking.openURL(PRIVACY_POLICY_URL)} style={styles.policy}>
        Read the privacy policy
      </Link>
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: spacing.md },
  point: { flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start' },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { ...type.label, color: colors.text },
  body: { ...type.caption, lineHeight: 19 },
  policy: { alignSelf: 'flex-start' },
});

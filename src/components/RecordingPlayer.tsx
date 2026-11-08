import Ionicons from '@expo/vector-icons/Ionicons';
import { setAudioModeAsync, useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { useEffect, useMemo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { recordingUri } from '../recordings';
import { colors, formatClock, radius, spacing, type } from '../theme';
import { Card, Muted, ProgressBar } from './ui';

/**
 * Play/pause control for a talk's stored recording. Shows a short notice
 * instead when the audio file is no longer on the device.
 */
export function RecordingPlayer({
  fileName,
  durationSec,
}: {
  fileName: string;
  durationSec: number;
}) {
  const uri = useMemo(() => recordingUri(fileName), [fileName]);
  if (!uri) {
    return (
      <Card>
        <Muted>This recording is no longer on this device.</Muted>
      </Card>
    );
  }
  return <Player uri={uri} fallbackDurationSec={durationSec} />;
}

function Player({ uri, fallbackDurationSec }: { uri: string; fallbackDurationSec: number }) {
  const player = useAudioPlayer({ uri });
  const status = useAudioPlayerStatus(player);

  // The practice screen leaves the session in recording mode, which on iOS
  // routes output to the quiet earpiece. Switch back to normal playback.
  useEffect(() => {
    void setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true });
  }, []);

  const duration = status.duration > 0 ? status.duration : fallbackDurationSec;
  const position = Math.min(status.currentTime, duration);
  const atEnd = status.didJustFinish || (duration > 0 && position >= duration - 0.05);

  const toggle = async () => {
    if (status.playing) {
      player.pause();
      return;
    }
    if (atEnd) await player.seekTo(0);
    player.play();
  };

  return (
    <Card>
      <View style={styles.row}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={status.playing ? 'Pause recording' : 'Play recording'}
          onPress={() => void toggle()}
          disabled={!status.isLoaded}
          style={({ pressed }) => [
            styles.playButton,
            !status.isLoaded && styles.playButtonDisabled,
            pressed && status.isLoaded && styles.playButtonPressed,
          ]}
        >
          <Ionicons
            name={status.playing ? 'pause' : 'play'}
            size={24}
            color={colors.onAccent}
            style={status.playing ? undefined : { marginLeft: 3 }}
          />
        </Pressable>
        <View style={styles.track}>
          <ProgressBar value={position} max={Math.max(duration, 1)} color={colors.accent} />
          <View style={styles.times}>
            <Muted style={styles.time}>{formatClock(position)}</Muted>
            <Muted style={styles.time}>{formatClock(duration)}</Muted>
          </View>
        </View>
      </View>
      {status.error ? (
        <Muted style={{ marginTop: spacing.sm }}>Could not play this recording.</Muted>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  playButton: {
    width: 56,
    height: 56,
    borderRadius: radius.pill,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playButtonDisabled: { opacity: 0.4 },
  playButtonPressed: { opacity: 0.8 },
  track: { flex: 1, gap: spacing.sm },
  times: { flexDirection: 'row', justifyContent: 'space-between' },
  time: { ...type.caption, fontVariant: ['tabular-nums'] },
});

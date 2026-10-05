import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import {
  setAudioModeAsync,
  useAudioPlayer,
  useAudioPlayerStatus,
  type AudioSource,
  type AudioPlayer,
} from 'expo-audio';

import { tokenStorage } from '@/api/token-storage';
import { ThemedText } from '@/components/themed-text';
import { Icon } from '@/components/ui/icon';
import { Radius, Spacing, Typography } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

// Chỉ phát 1 tin thoại cùng lúc: player khác tạm dừng khi bấm play tin mới.
let activeVoicePlayer: AudioPlayer | null = null;
let playModeReady = false;

// Cho phép phát khi máy ở chế độ im lặng (iOS) — thực hiện 1 lần.
function ensurePlayMode() {
  if (playModeReady) return;
  playModeReady = true;
  void setAudioModeAsync({
    playsInSilentMode: true,
    interruptionMode: 'duckOthers',
  }).catch(() => {
    playModeReady = false;
  });
}

export function formatAudioTime(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

interface Props {
  uri: string;
  /** Thời lượng lấy từ server (giây) — hiển thị trước khi status load xong. */
  durationSeconds?: number | null;
  /** Bubble của mình → tông màu đảo (nút trắng, chữ trắng trên nền primary). */
  isMine?: boolean;
  style?: StyleProp<ViewStyle>;
}

export function VoicePlayer({ uri, durationSeconds, isMine, style }: Props) {
  const theme = useTheme();
  const [headers, setHeaders] = useState<Record<string, string> | undefined>();
  const isRemote = /^https?:\/\//i.test(uri);

  // Download URL cần Bearer token — resolve token trước khi tạo source.
  useEffect(() => {
    if (!isRemote) return;
    let cancelled = false;
    void tokenStorage.getAccessToken().then((token) => {
      if (!cancelled && token) setHeaders({ Authorization: `Bearer ${token}` });
    });
    return () => {
      cancelled = true;
    };
  }, [isRemote]);

  // Chưa có token → chưa tạo source (tránh request 401 rồi tạo lại).
  const source: AudioSource | null = !uri
    ? null
    : isRemote
      ? headers
        ? { uri, headers }
        : null
      : uri;
  const player = useAudioPlayer(source, { updateInterval: 250 });
  const status = useAudioPlayerStatus(player);

  const duration = status.duration > 0 ? status.duration : (durationSeconds ?? 0);
  const progress =
    duration > 0 ? Math.min(1, status.currentTime / duration) : 0;
  const loadingSource = isRemote && !headers;

  const toggle = () => {
    ensurePlayMode();
    const ended =
      status.didJustFinish || (duration > 0 && status.currentTime >= duration - 0.1);
    if (ended) {
      activeVoicePlayer = player;
      void player.seekTo(0).then(() => player.play());
      return;
    }
    if (status.playing) {
      player.pause();
      return;
    }
    try {
      activeVoicePlayer?.pause();
    } catch {
      /* player cũ có thể đã release khi đổi source */
    }
    activeVoicePlayer = player;
    player.play();
  };

  const trackColor = isMine ? 'rgba(255,255,255,0.35)' : theme.border;
  const fillColor = isMine ? '#FFFFFF' : theme.primary;
  const btnBg = isMine ? '#FFFFFF' : theme.primary;
  const btnIcon = isMine ? theme.primary : '#FFFFFF';
  const timeColor = isMine ? 'rgba(255,255,255,0.9)' : theme.textSecondary;
  const fillPct = Math.round(progress * 100);

  return (
    <View style={[styles.row, style]}>
      <Pressable
        onPress={toggle}
        disabled={!source}
        hitSlop={6}
        style={[styles.playBtn, { backgroundColor: btnBg }]}>
        {loadingSource ? (
          <ActivityIndicator size="small" color={btnIcon} />
        ) : (
          <Icon name={status.playing ? 'pause' : 'play'} size={18} color={btnIcon} />
        )}
      </Pressable>
      <View style={styles.meta}>
        <View style={[styles.track, { backgroundColor: trackColor }]}>
          <View
            style={[
              styles.fill,
              {
                backgroundColor: fillColor,
                width: `${fillPct}%` as `${number}%`,
              },
            ]}
          />
        </View>
        <ThemedText style={[styles.time, { color: timeColor }]}>
          {formatAudioTime(duration)}
        </ThemedText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    width: 200,
    paddingVertical: 2,
  },
  playBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  meta: {
    flex: 1,
    gap: 4,
  },
  track: {
    height: 4,
    borderRadius: Radius.sm,
    overflow: 'hidden',
  },
  fill: {
    height: 4,
    borderRadius: Radius.sm,
  },
  time: {
    ...Typography.caption,
    fontSize: 11,
  },
});

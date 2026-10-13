import { Image } from 'expo-image';
import { StyleSheet, View } from 'react-native';
import { RTCView, type MediaStream } from 'react-native-webrtc';

import { ThemedText } from '@/components/themed-text';
import { Icon } from '@/components/ui/icon';
import type { GroupCallParticipant } from '@/types/group-call';

const COLORS = {
  tileBg: '#161B22',
  text: '#FFFFFF',
  avatarBg: 'rgba(255,255,255,0.12)',
  badgeBg: 'rgba(0,0,0,0.55)',
};

interface Props {
  participant: GroupCallParticipant;
  stream?: MediaStream | null;
  isLocal?: boolean;
  /** Ghi đè muted/video cho tile local (context chưa sync map local). */
  muted?: boolean;
  videoEnabled?: boolean;
}

/**
 * Ô participant trong lưới cuộc gọi nhóm — video RTCView khi có stream +
 * camera bật, ngược lại avatar + tên. Badge mic-off/video-off overlay.
 */
export function GroupCallParticipantTile({
  participant,
  stream,
  isLocal,
  muted,
  videoEnabled,
}: Props) {
  const showMuted = muted ?? participant.muted;
  const showVideo = videoEnabled ?? participant.video_enabled;
  const name = participant.display_name || participant.user_id;
  const showVideoView = !!stream && showVideo;

  return (
    <View style={styles.tile}>
      {showVideoView && stream ? (
        <RTCView
          streamURL={stream.toURL()}
          style={StyleSheet.absoluteFill}
          objectFit="cover"
          mirror={isLocal}
          zOrder={0}
        />
      ) : (
        <View style={styles.center}>
          {participant.avatar_uri ? (
            <Image
              source={{ uri: participant.avatar_uri }}
              style={styles.avatar}
              contentFit="cover"
            />
          ) : (
            <View style={[styles.avatar, styles.avatarPlaceholder]}>
              <ThemedText style={styles.avatarLetter}>
                {name[0]?.toUpperCase() || '?'}
              </ThemedText>
            </View>
          )}
        </View>
      )}

      {/* Tên + badge */}
      <View style={styles.footer}>
        <ThemedText style={styles.name} numberOfLines={1}>
          {name}
        </ThemedText>
        {showMuted && (
          <View style={styles.badge}>
            <Icon name="micOff" size={12} color={COLORS.text} />
          </View>
        )}
        {!showVideo && (
          <View style={styles.badge}>
            <Icon name="videoOff" size={12} color={COLORS.text} />
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  tile: {
    flex: 1,
    backgroundColor: COLORS.tileBg,
    borderRadius: 12,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  center: {
    position: 'absolute' as const, top: 0, right: 0, bottom: 0, left: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
  },
  avatarPlaceholder: {
    backgroundColor: COLORS.avatarBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarLetter: {
    fontSize: 24,
    fontWeight: '600',
    color: COLORS.text,
  },
  footer: {
    position: 'absolute',
    left: 8,
    right: 8,
    bottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  name: {
    flex: 1,
    color: COLORS.text,
    fontSize: 12,
    fontWeight: '600',
  },
  badge: {
    backgroundColor: COLORS.badgeBg,
    borderRadius: 10,
    paddingHorizontal: 5,
    paddingVertical: 2,
  },
});

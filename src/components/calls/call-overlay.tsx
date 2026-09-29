import { Image } from 'expo-image';
import { Pressable, StyleSheet, View } from 'react-native';
import { RTCView } from 'react-native-webrtc';

import { ThemedText } from '@/components/themed-text';
import { Icon } from '@/components/ui/icon';
import { useCall } from '@/contexts/call-context';
import { useTranslation } from '@/hooks/useTranslation';
import type { IconName } from '@/constants/icon-map';

const COLORS = {
  bg: '#0C0F14',
  text: '#FFFFFF',
  subtext: 'rgba(255,255,255,0.65)',
  control: 'rgba(255,255,255,0.16)',
  green: '#22C55E',
  red: '#EF4444',
  avatarBg: 'rgba(255,255,255,0.12)',
};

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

interface ControlButtonProps {
  icon: IconName;
  label: string;
  onPress: () => void;
  backgroundColor?: string;
  /** Xoay icon cuá»™c gá»i 135Â° â€” kiá»ƒu nÃºt tá»« chá»‘i/káº¿t thÃºc chuáº©n iOS. */
  declineStyle?: boolean;
}

function ControlButton({
  icon,
  label,
  onPress,
  backgroundColor = COLORS.control,
  declineStyle,
}: ControlButtonProps) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityLabel={label}
      accessibilityRole="button"
      hitSlop={6}
      style={({ pressed }) => [
        styles.control,
        { backgroundColor },
        pressed && styles.controlPressed,
      ]}>
      <Icon
        name={icon}
        size={28}
        color={COLORS.text}
        style={declineStyle ? styles.declineIcon : undefined}
      />
    </Pressable>
  );
}

/**
 * Overlay cuá»™c gá»i toÃ n mÃ n hÃ¬nh â€” mount táº¡i root layout nÃªn hiá»ƒn thá»‹ á»Ÿ
 * báº¥t ká»³ mÃ n hÃ¬nh nÃ o: gá»i ra, gá»i tá»›i, Ä‘ang tham gia, hoáº·c Ä‘Ã£ káº¿t thÃºc.
 */
export function CallOverlay() {
  const { t } = useTranslation();
  const {
    phase,
    call,
    lastStatus,
    duration,
    localStream,
    remoteStream,
    localMuted,
    localVideoOn,
    remoteVideoOn,
    acceptCall,
    rejectCall,
    endCall,
    toggleMute,
    toggleVideo,
    dismiss,
  } = useCall();

  if (phase === 'idle') return null;

  const isVideo = call?.callType === 'video';
  const peer = call?.peer;
  const peerName = peer?.display_name || t('call.unknown');

  const statusLabel = (): string | null => {
    if (phase === 'outgoing') return t('call.outgoing');
    if (phase === 'incoming') {
      return isVideo ? t('call.incomingVideo') : t('call.incomingVoice');
    }
    if (phase === 'ended' && lastStatus) {
      switch (lastStatus) {
        case 'calling':
        case 'ringing':
          return t('call.statusCalling');
        case 'missed':
          return t('call.statusMissed');
        case 'rejected':
          return t('call.statusRejected');
        case 'busy':
          return t('call.statusBusy');
        case 'cancelled':
          return t('call.statusCancelled');
        default:
          return t('call.statusEnded');
      }
    }
    return null; // active â†’ hiá»ƒn thá»‹ duration
  };

  const showRemoteVideo =
    phase === 'active' && isVideo && remoteVideoOn && !!remoteStream;
  const showLocalVideo =
    phase === 'active' && isVideo && localVideoOn && !!localStream;

  return (
    <View style={styles.overlay}>
      {showRemoteVideo && remoteStream ? (
        <RTCView
          streamURL={remoteStream.toURL()}
          style={StyleSheet.absoluteFill}
          objectFit="cover"
          zOrder={0}
        />
      ) : (
        <View style={styles.center}>
          {peer?.avatar_uri ? (
            <Image source={{ uri: peer.avatar_uri }} style={styles.avatar} contentFit="cover" />
          ) : (
            <View style={[styles.avatar, styles.avatarPlaceholder]}>
              <ThemedText style={styles.avatarLetter}>
                {peerName[0]?.toUpperCase() || '?'}
              </ThemedText>
            </View>
          )}
        </View>
      )}

      {showLocalVideo && localStream && (
        <View style={styles.pipWrap}>
          <RTCView
            streamURL={localStream.toURL()}
            style={styles.pip}
            mirror
            zOrder={1}
            objectFit="cover"
          />
        </View>
      )}

      <View style={styles.topInfo}>
        <ThemedText style={styles.name} numberOfLines={1}>
          {peerName}
        </ThemedText>
        <ThemedText style={styles.status}>
          {statusLabel() ?? formatDuration(duration)}
        </ThemedText>
      </View>

      <View style={styles.controls}>
        {phase === 'incoming' && (
          <>
            <ControlButton
              icon="call"
              declineStyle
              label={t('call.reject')}
              backgroundColor={COLORS.red}
              onPress={rejectCall}
            />
            <ControlButton
              icon="call"
              label={t('call.accept')}
              backgroundColor={COLORS.green}
              onPress={() => void acceptCall()}
            />
          </>
        )}

        {phase === 'outgoing' && (
          <ControlButton
            icon="call"
            declineStyle
            label={t('call.cancel')}
            backgroundColor={COLORS.red}
            onPress={endCall}
          />
        )}

        {phase === 'active' && (
          <>
            <ControlButton
              icon={localMuted ? 'micOff' : 'mic'}
              label={localMuted ? t('call.unmute') : t('call.mute')}
              onPress={toggleMute}
            />
            {isVideo && (
              <ControlButton
                icon={localVideoOn ? 'video' : 'videoOff'}
                label={localVideoOn ? t('call.videoOff') : t('call.videoOn')}
                onPress={toggleVideo}
              />
            )}
            <ControlButton
              icon="call"
              declineStyle
              label={t('call.end')}
              backgroundColor={COLORS.red}
              onPress={endCall}
            />
          </>
        )}

        {phase === 'ended' && (
          <ControlButton icon="close" label={t('call.statusEnded')} onPress={dismiss} />
        )}
      </View>
    </View>
  );
}

const AVATAR_SIZE = 120;

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute' as const, top: 0, right: 0, bottom: 0, left: 0,
    backgroundColor: COLORS.bg,
    zIndex: 999,
    elevation: 999,
  },
  center: {
    position: 'absolute' as const, top: 0, right: 0, bottom: 0, left: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatar: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: AVATAR_SIZE / 2,
  },
  avatarPlaceholder: {
    backgroundColor: COLORS.avatarBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarLetter: {
    fontSize: 48,
    fontWeight: '600',
    color: COLORS.text,
  },
  pipWrap: {
    position: 'absolute',
    top: 56,
    right: 16,
    width: 110,
    height: 160,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
  },
  pip: {
    flex: 1,
  },
  topInfo: {
    position: 'absolute',
    top: 56,
    left: 24,
    right: 24,
    alignItems: 'center',
    gap: 6,
  },
  name: {
    color: COLORS.text,
    fontSize: 24,
    fontWeight: '600',
    textAlign: 'center',
  },
  status: {
    color: COLORS.subtext,
    fontSize: 15,
    textAlign: 'center',
  },
  controls: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 48,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 28,
  },
  control: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  controlPressed: {
    opacity: 0.75,
  },
  declineIcon: {
    transform: [{ rotate: '135deg' }],
  },
});

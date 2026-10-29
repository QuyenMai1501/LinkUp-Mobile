import { Image } from 'expo-image';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { RTCView } from 'react-native-webrtc';

import { ThemedText } from '@/components/themed-text';
import { Icon } from '@/components/ui/icon';
import { useCall } from '@/contexts/call-context';
import { useTranslation } from '@/hooks/useTranslation';
import type { IconName } from '@/constants/icon-map';

const COLORS = {
  bg: '#0C0F14',
  miniBg: '#1A1D22',
  text: '#FFFFFF',
  subtext: 'rgba(255,255,255,0.65)',
  control: 'rgba(255,255,255,0.16)',
  green: '#22C55E',
  red: '#EF4444',
  avatarBg: 'rgba(255,255,255,0.12)',
  border: 'rgba(255,255,255,0.18)',
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
  /** Xoay icon cuộc gọi 135° — kiểu nút từ chối/kết thúc chuẩn iOS. */
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

function MiniButton({
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
        styles.miniBtn,
        { backgroundColor },
        pressed && styles.controlPressed,
      ]}>
      <Icon
        name={icon}
        size={16}
        color={COLORS.text}
        style={declineStyle ? styles.miniDeclineIcon : undefined}
      />
    </Pressable>
  );
}

/**
 * Overlay cuộc gọi toàn màn hình — mount tại root layout nên hiển thị ở
 * bất kỳ màn hình nào: gọi ra, gọi tới, đang tham gia, hoặc đã kết thúc.
 * Cuộc gọi đang diễn ra có thể thu nhỏ về mini bar nổi (mirror Web).
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
    remoteMuted,
    remoteVideoOn,
    acceptCall,
    rejectCall,
    endCall,
    toggleMute,
    toggleVideo,
    dismiss,
  } = useCall();

  const [minimized, setMinimized] = useState(false);
  // Reset trạng thái thu nhỏ khi bắt đầu cuộc gọi mới (adjust-state-during-render,
  // tránh setState đồng bộ trong effect bị react-compiler lint bắt)
  const [prevCallId, setPrevCallId] = useState<string | undefined>(call?.callId);
  if (call?.callId !== prevCallId) {
    setPrevCallId(call?.callId);
    setMinimized(false);
  }

  if (phase === 'idle') return null;

  const isVideo = call?.callType === 'video';
  const peer = call?.peer;
  const peerName = peer?.display_name || t('call.unknown');

  const activeLabel = isVideo ? t('call.inCallVideo') : t('call.inCallVoice');

  const statusLabel = (): string | null => {
    if (phase === 'outgoing') return t('call.outgoing');
    if (phase === 'incoming') {
      return isVideo ? t('call.incomingVideo') : t('call.incomingVoice');
    }
    if (phase === 'active') {
      return `${activeLabel} · ${formatDuration(duration)}`;
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
    return null;
  };

  const showRemoteVideo =
    phase === 'active' && isVideo && remoteVideoOn && !!remoteStream;
  const showLocalVideo =
    phase === 'active' && isVideo && localVideoOn && !!localStream;

  // Thu nhỏ: chỉ render mini bar nổi — WebRTC/streams vẫn chạy trong context
  if (phase === 'active' && minimized) {
    const miniShowVideo = isVideo && remoteVideoOn && !!remoteStream;
    return (
      <View style={styles.miniWrap} pointerEvents="box-none">
        <View style={styles.miniCard}>
          <Pressable
            style={styles.miniMain}
            onPress={() => setMinimized(false)}
            accessibilityLabel={t('call.expand')}
            accessibilityRole="button">
            {miniShowVideo && remoteStream ? (
              <RTCView
                streamURL={remoteStream.toURL()}
                style={styles.miniThumb}
                objectFit="cover"
                zOrder={0}
              />
            ) : peer?.avatar_uri ? (
              <Image source={{ uri: peer.avatar_uri }} style={styles.miniAvatar} contentFit="cover" />
            ) : (
              <View style={[styles.miniAvatar, styles.avatarPlaceholder]}>
                <ThemedText style={styles.miniAvatarLetter}>
                  {peerName[0]?.toUpperCase() || '?'}
                </ThemedText>
              </View>
            )}
            <View style={styles.miniTextWrap}>
              <ThemedText style={styles.miniName} numberOfLines={1}>
                {peerName}
              </ThemedText>
              <View style={styles.miniStatusRow}>
                <ThemedText style={styles.miniStatus}>
                  {formatDuration(duration)}
                </ThemedText>
                {remoteMuted && (
                  <Icon name="micOff" size={12} color={COLORS.red} />
                )}
              </View>
            </View>
          </Pressable>

          <View style={styles.miniControls}>
            <MiniButton
              icon={localMuted ? 'micOff' : 'mic'}
              label={localMuted ? t('call.unmute') : t('call.mute')}
              onPress={toggleMute}
            />
            {isVideo && (
              <MiniButton
                icon={localVideoOn ? 'video' : 'videoOff'}
                label={localVideoOn ? t('call.videoOff') : t('call.videoOn')}
                onPress={toggleVideo}
              />
            )}
            <MiniButton
              icon="expand"
              label={t('call.expand')}
              onPress={() => setMinimized(false)}
            />
            <MiniButton
              icon="call"
              declineStyle
              label={t('call.end')}
              backgroundColor={COLORS.red}
              onPress={endCall}
            />
          </View>
        </View>
      </View>
    );
  }

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
        <View style={styles.statusRow}>
          <ThemedText style={styles.status}>{statusLabel()}</ThemedText>
          {phase === 'active' && remoteMuted && (
            <Icon name="micOff" size={14} color={COLORS.red} />
          )}
        </View>
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
              icon="chevronDown"
              label={t('call.minimize')}
              onPress={() => setMinimized(true)}
            />
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
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
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
  miniDeclineIcon: {
    transform: [{ rotate: '135deg' }],
  },

  /* Mini bar nổi — mirror Web miniBar (CallOverlay.tsx) */
  miniWrap: {
    position: 'absolute' as const, top: 0, right: 0, bottom: 0, left: 0,
    zIndex: 999,
    elevation: 999,
    justifyContent: 'flex-end',
    alignItems: 'flex-end',
    paddingBottom: 96,
    paddingRight: 12,
  },
  miniCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: COLORS.miniBg,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 8,
    maxWidth: 300,
  },
  miniMain: {
    flexShrink: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  miniThumb: {
    width: 96,
    height: 54,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: '#000',
  },
  miniAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  miniAvatarLetter: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.text,
  },
  miniTextWrap: {
    flexShrink: 1,
    gap: 2,
  },
  miniName: {
    color: COLORS.text,
    fontSize: 13,
    fontWeight: '600',
  },
  miniStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  miniStatus: {
    color: COLORS.subtext,
    fontSize: 11,
  },
  miniControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  miniBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

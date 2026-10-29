import { Image } from 'expo-image';
import { Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import { RTCView } from 'react-native-webrtc';

import { GroupCallParticipantTile } from '@/components/calls/group-call-participant-tile';
import { ThemedText } from '@/components/themed-text';
import { Icon } from '@/components/ui/icon';
import { useAuth } from '@/contexts/auth-context';
import { useGroupCall } from '@/contexts/group-call-context';
import { useTranslation } from '@/hooks/useTranslation';
import type { IconName } from '@/constants/icon-map';
import type { GroupCallParticipant } from '@/types/group-call';

const COLORS = {
  bg: '#0C0F14',
  miniBg: '#1A1D22',
  text: '#FFFFFF',
  subtext: 'rgba(255,255,255,0.65)',
  control: 'rgba(255,255,255,0.16)',
  red: '#EF4444',
  card: 'rgba(22,27,34,0.96)',
  border: 'rgba(255,255,255,0.18)',
  avatarBg: 'rgba(255,255,255,0.12)',
};

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function columnsFor(count: number): number {
  if (count <= 1) return 1;
  if (count <= 4) return 2;
  return 3;
}

interface ControlButtonProps {
  icon: IconName;
  label: string;
  onPress: () => void;
  backgroundColor?: string;
  active?: boolean;
  declineStyle?: boolean;
}

function ControlButton({
  icon,
  label,
  onPress,
  backgroundColor = COLORS.control,
  active,
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
        active && styles.controlActive,
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
 * Overlay cuộc gọi nhóm full-screen — mount tại root, chỉ hiện khi
 * phase=active. Lưới participant (1/2/3 cột), controls mic/video/minimize/end,
 * hàng chờ join-request cho host. Thu nhỏ về mini bar nổi mirror Web
 * GroupCallBubble (minimized phase).
 */
export function GroupCallOverlay() {
  const { t } = useTranslation();
  const { width: winW } = useWindowDimensions();
  const { user } = useAuth();
  const myUserId = user?.id ?? '';
  const {
    phase,
    call,
    duration,
    localStream,
    localMuted,
    localVideoOn,
    isCreator,
    remoteStreams,
    toggleMute,
    toggleVideo,
    endGroupCall,
    acceptJoinRequest,
    rejectJoinRequest,
    minimized,
    minimize,
    expand,
  } = useGroupCall();

  if (phase !== 'active' || !call) return null;

  // Không tự render tile của chính mình 2 lần — mirror Web
  // GroupCallOverlay (caller = tôi bị ẩn nếu chưa có remote stream).
  const participants = Array.from(call.participants.values()).filter(
    (p) => p.user_id !== myUserId || remoteStreams.has(p.user_id),
  );
  const localParticipant: GroupCallParticipant = {
    user_id: '',
    display_name: t('groupCall.you'),
    avatar_uri: '',
    muted: localMuted,
    video_enabled: localVideoOn,
    is_active: true,
  };
  const allParticipants = [localParticipant, ...participants];
  const participantCount = allParticipants.length;

  // Mini bar — mirror Web GroupCallBubble: thumbnail local (camera đang bật)
  // hoặc stream remote đầu tiên có video.
  const miniThumbStream = (() => {
    if (localVideoOn && localStream) return localStream;
    for (const p of participants) {
      const s = remoteStreams.get(p.user_id);
      if (s && p.video_enabled) return s;
    }
    return null;
  })();

  if (minimized) {
    return (
      <View style={styles.miniWrap} pointerEvents="box-none">
        <View style={styles.miniCard}>
          <Pressable
            style={styles.miniMain}
            onPress={expand}
            accessibilityLabel={t('call.expand')}
            accessibilityRole="button">
            {miniThumbStream ? (
              <RTCView
                streamURL={miniThumbStream.toURL()}
                style={styles.miniThumb}
                mirror={miniThumbStream === localStream}
                objectFit="cover"
                zOrder={0}
              />
            ) : (
              <View style={[styles.miniAvatar, styles.miniAvatarPh]}>
                <Icon name="people" size={22} color={COLORS.text} />
              </View>
            )}
            <View style={styles.miniTextWrap}>
              <ThemedText style={styles.miniName} numberOfLines={1}>
                {t('groupCall.callHistoryLabel')}
              </ThemedText>
              <ThemedText style={styles.miniStatus}>
                {formatDuration(duration)} · {participantCount}
              </ThemedText>
            </View>
          </Pressable>

          <View style={styles.miniControls}>
            <MiniButton
              icon={localMuted ? 'micOff' : 'mic'}
              label={localMuted ? t('call.unmute') : t('call.mute')}
              onPress={toggleMute}
            />
            <MiniButton icon="expand" label={t('call.expand')} onPress={expand} />
            <MiniButton
              icon="call"
              declineStyle
              label={t('call.end')}
              backgroundColor={COLORS.red}
              onPress={endGroupCall}
            />
          </View>
        </View>
      </View>
    );
  }

  const cols = columnsFor(participantCount);
  const gap = 6;
  const gridPad = 12;
  const cell = Math.floor((winW - gridPad * 2 - gap * (cols - 1)) / cols);
  const cellH = Math.floor(cell * 1.2);

  return (
    <View style={styles.overlay}>
      {/* Grid */}
      <View style={[styles.grid, { paddingHorizontal: gridPad, gap }]}>
        {allParticipants.map((p, idx) => {
          const isLocal = idx === 0;
          const stream = isLocal
            ? localStream
            : remoteStreams.get(p.user_id);
          return (
            <View
              key={isLocal ? 'local' : p.user_id}
              style={{ width: cell, height: cellH }}>
              <GroupCallParticipantTile
                participant={p}
                stream={stream}
                isLocal={isLocal}
                muted={isLocal ? localMuted : undefined}
                videoEnabled={isLocal ? localVideoOn : undefined}
              />
            </View>
          );
        })}
      </View>

      {/* Top info */}
      <View style={styles.topInfo}>
        <ThemedText style={styles.duration}>
          {formatDuration(duration)}
        </ThemedText>
        <ThemedText style={styles.count}>
          <Icon name="people" size={14} color={COLORS.subtext} />{' '}
          {participantCount}
        </ThemedText>
      </View>

      {/* Controls */}
      <View style={styles.controls}>
        <ControlButton
          icon={localMuted ? 'micOff' : 'mic'}
          label={localMuted ? t('call.unmute') : t('call.mute')}
          onPress={toggleMute}
          active={localMuted}
        />
        <ControlButton
          icon={localVideoOn ? 'video' : 'videoOff'}
          label={localVideoOn ? t('call.videoOff') : t('call.videoOn')}
          onPress={toggleVideo}
          active={!localVideoOn}
        />
        <ControlButton
          icon="chevronDown"
          label={t('call.minimize')}
          onPress={minimize}
        />
        <ControlButton
          icon="call"
          declineStyle
          label={t('call.end')}
          backgroundColor={COLORS.red}
          onPress={endGroupCall}
        />
      </View>

      {/* Pending join requests — host approve/reject */}
      {isCreator && call.pendingRequests.length > 0 && (
        <View style={styles.pendingWrap}>
          <ThemedText style={styles.pendingTitle}>
            {t('groupCall.pendingRequestTitle')}
          </ThemedText>
          {call.pendingRequests.map((uid) => {
            const p = call.participants.get(uid);
            const name = p?.display_name || uid;
            return (
              <View key={uid} style={styles.pendingItem}>
                {p?.avatar_uri ? (
                  <Image
                    source={{ uri: p.avatar_uri }}
                    style={styles.pendingAvatar}
                    contentFit="cover"
                  />
                ) : (
                  <View style={[styles.pendingAvatar, styles.pendingAvatarPh]}>
                    <ThemedText style={styles.pendingLetter}>
                      {name[0]?.toUpperCase() || '?'}
                    </ThemedText>
                  </View>
                )}
                <ThemedText style={styles.pendingName} numberOfLines={1}>
                  {t('groupCall.pendingRequestBody', { name })}
                </ThemedText>
                <Pressable
                  onPress={() => acceptJoinRequest(uid)}
                  style={[styles.pendingBtn, { backgroundColor: '#22C55E' }]}>
                  <Icon name="check" size={18} color={COLORS.text} />
                </Pressable>
                <Pressable
                  onPress={() => rejectJoinRequest(uid)}
                  style={[styles.pendingBtn, { backgroundColor: COLORS.red }]}>
                  <Icon name="close" size={18} color={COLORS.text} />
                </Pressable>
              </View>
            );
          })}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute' as const, top: 0, right: 0, bottom: 0, left: 0,
    backgroundColor: COLORS.bg,
    zIndex: 999,
    elevation: 999,
  },
  grid: {
    flex: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignContent: 'center',
    justifyContent: 'center',
    paddingTop: 96,
  },
  topInfo: {
    position: 'absolute',
    top: 56,
    left: 0,
    right: 0,
    alignItems: 'center',
    gap: 4,
  },
  duration: {
    color: COLORS.text,
    fontSize: 18,
    fontWeight: '600',
  },
  count: {
    color: COLORS.subtext,
    fontSize: 14,
  },
  controls: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 28,
    paddingBottom: 48,
    paddingTop: 16,
  },
  control: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  controlActive: {
    backgroundColor: 'rgba(255,255,255,0.28)',
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
  pendingWrap: {
    position: 'absolute',
    top: 100,
    left: 16,
    right: 16,
    backgroundColor: COLORS.card,
    borderRadius: 12,
    padding: 12,
    gap: 8,
  },
  pendingTitle: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: '700',
  },
  pendingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  pendingAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
  },
  pendingAvatarPh: {
    backgroundColor: COLORS.control,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pendingLetter: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: '600',
  },
  pendingName: {
    flex: 1,
    color: COLORS.text,
    fontSize: 13,
  },
  pendingBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },

  /* Mini bar nổi — mirror Web GroupCallBubble */
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
  miniAvatarPh: {
    backgroundColor: COLORS.avatarBg,
    alignItems: 'center',
    justifyContent: 'center',
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

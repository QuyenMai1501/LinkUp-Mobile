import { Image } from 'expo-image';
import { Modal, Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Icon } from '@/components/ui/icon';
import { useGroupCall } from '@/contexts/group-call-context';
import { useTranslation } from '@/hooks/useTranslation';

const COLORS = {
  card: '#161B22',
  text: '#FFFFFF',
  subtext: 'rgba(255,255,255,0.65)',
  green: '#22C55E',
  red: '#EF4444',
  avatarBg: 'rgba(255,255,255,0.12)',
};

/**
 * Modal cuộc gọi nhóm gọi tới — hiện ở root (phase=ringing), nút
 * Từ chối/Tham gia mirror Web GroupCallIncomingModal.
 */
export function GroupCallIncomingModal() {
  const { t } = useTranslation();
  const { phase, call, joinGroupCall, declineGroupCall } = useGroupCall();

  if (phase !== 'ringing' || !call) return null;

  const caller = call.participants.get(call.callerId);
  const callerName = caller?.display_name || t('groupCall.incomingTitle');

  return (
    <Modal visible transparent animationType="fade" onRequestClose={declineGroupCall}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <View style={styles.iconWrap}>
            <Icon name={call.isVideo ? 'video' : 'call'} size={36} color={COLORS.text} />
          </View>

          <ThemedText style={styles.title}>{t('groupCall.incomingTitle')}</ThemedText>
          <ThemedText style={styles.from}>
            {t('groupCall.incomingFrom', { name: callerName })}
          </ThemedText>

          {caller?.avatar_uri ? (
            <Image source={{ uri: caller.avatar_uri }} style={styles.avatar} contentFit="cover" />
          ) : (
            <View style={[styles.avatar, styles.avatarPh]}>
              <ThemedText style={styles.avatarLetter}>
                {callerName[0]?.toUpperCase() || '?'}
              </ThemedText>
            </View>
          )}

          <ThemedText style={styles.count}>
            <Icon name="people" size={14} color={COLORS.subtext} />{' '}
            {call.participants.size}
          </ThemedText>

          <View style={styles.actions}>
            <Pressable
              onPress={declineGroupCall}
              style={[styles.actionBtn, { backgroundColor: COLORS.red }]}>
              <Icon name="call" size={26} color={COLORS.text} style={styles.declineIcon} />
            </Pressable>
            <Pressable
              onPress={() => void joinGroupCall(call.callId)}
              style={[styles.actionBtn, { backgroundColor: COLORS.green }]}>
              <Icon name="call" size={26} color={COLORS.text} />
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  card: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: COLORS.card,
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    gap: 10,
  },
  iconWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: COLORS.avatarBg,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  title: {
    color: COLORS.text,
    fontSize: 20,
    fontWeight: '700',
  },
  from: {
    color: COLORS.subtext,
    fontSize: 14,
    textAlign: 'center',
  },
  avatar: {
    width: 88,
    height: 88,
    borderRadius: 44,
    marginVertical: 8,
  },
  avatarPh: {
    backgroundColor: COLORS.avatarBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarLetter: {
    fontSize: 32,
    fontWeight: '600',
    color: COLORS.text,
  },
  count: {
    color: COLORS.subtext,
    fontSize: 14,
    marginBottom: 10,
  },
  actions: {
    flexDirection: 'row',
    gap: 36,
    marginTop: 8,
  },
  actionBtn: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  declineIcon: {
    transform: [{ rotate: '135deg' }],
  },
});

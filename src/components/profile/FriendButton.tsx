import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Radius, Typography } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useTranslation } from '@/hooks/useTranslation';
import { getFriendStatus, toggleFriendRequest, acceptFriendRequest, unfriend } from '@/api/friends';
import type { FriendStatusResponse } from '@/types/profile';

interface FriendButtonProps {
  userId: string;
  onStatusChange?: (status: string) => void;
}

export function FriendButton({ userId, onStatusChange }: FriendButtonProps) {
  const theme = useTheme();
  const { t } = useTranslation();
  const [status, setStatus] = useState<FriendStatusResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getFriendStatus(userId)
      .then((res) => { if (!cancelled) setStatus(res); })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [userId]);

  const handlePress = async () => {
    if (!status || actionLoading) return;
    setActionLoading(true);

    try {
      if (status.status === 'none') {
        await toggleFriendRequest(userId);
        setStatus({ status: 'sent' });
        onStatusChange?.('sent');
      } else if (status.status === 'sent') {
        await toggleFriendRequest(userId);
        setStatus({ status: 'none' });
        onStatusChange?.('none');
      } else if (status.status === 'received' && status.request_id) {
        await acceptFriendRequest(status.request_id);
        setStatus({ status: 'accepted' });
        onStatusChange?.('accepted');
      } else if (status.status === 'accepted') {
        Alert.alert(
          t('friends.confirm.removeFriend', { name: '' }),
          '',
          [
            { text: t('common.cancel'), style: 'cancel' },
            {
              text: t('common.confirm'),
              onPress: async () => {
                await unfriend(userId);
                setStatus({ status: 'none' });
                onStatusChange?.('none');
              },
            },
          ],
        );
      }
    } catch {
      Alert.alert(t('common.error'), '');
    } finally {
      setActionLoading(false);
    }
  };

  if (loading || !status || status.status === 'self') return null;

  const getButtonConfig = () => {
    switch (status.status) {
      case 'none':
        return { label: t('friends.actions.addFriend'), bg: theme.primary, text: '#FFFFFF' };
      case 'sent':
        return { label: t('friends.actions.revoke'), bg: theme.border, text: theme.text };
      case 'received':
        return { label: t('friends.actions.accept'), bg: theme.primary, text: '#FFFFFF' };
      case 'accepted':
        return { label: t('friends.actions.removeFriend'), bg: theme.border, text: theme.text };
      default:
        return { label: '', bg: theme.border, text: theme.text };
    }
  };

  const config = getButtonConfig();

  return (
    <Pressable
      onPress={handlePress}
      disabled={actionLoading}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: config.bg },
        pressed && styles.pressed,
        actionLoading && styles.disabled,
      ]}>
      {actionLoading ? (
        <ActivityIndicator color={config.text} size="small" />
      ) : (
        <ThemedText style={[styles.label, { color: config.text }]}>
          {config.label}
        </ThemedText>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 40,
  },
  label: { ...Typography.body, fontWeight: 600 },
  pressed: { opacity: 0.7 },
  disabled: { opacity: 0.5 },
});

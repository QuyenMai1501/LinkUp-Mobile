import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
  FlatList,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { Image } from 'expo-image';

import { ThemedText } from '@/components/themed-text';
import { Icon } from '@/components/ui/icon';
import { Spacing, Typography } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useTranslation } from '@/hooks/useTranslation';
import { getFriends } from '@/api/friends';
import { searchFriends, sharePostToChat } from '@/api/chat';
import type { FriendUser } from '@/types/friend';
import type { UserSearchResult } from '@/types/chat';

interface ShareUser {
  user_id: string;
  display_name: string;
  avatar_uri: string;
}

function toShareUser(u: FriendUser | UserSearchResult): ShareUser {
  return {
    user_id: 'user_id' in u ? u.user_id : u.id,
    display_name: u.display_name,
    avatar_uri: u.avatar_uri,
  };
}

interface Props {
  visible: boolean;
  onClose: () => void;
  postId: string;
}

export function ShareToChatModal({ visible, onClose, postId }: Props) {
  const theme = useTheme();
  const { t } = useTranslation();
  const [friends, setFriends] = useState<ShareUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [keyword, setKeyword] = useState('');
  const [selected, setSelected] = useState<Map<string, ShareUser>>(new Map());
  const [sending, setSending] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevVisibleRef = useRef(false);

  useEffect(() => {
    if (visible && !prevVisibleRef.current) {
      setKeyword('');
      setFriends([]);
      setSelected(new Map());
      setLoading(true);
      getFriends(1, 50)
        .then((res) => setFriends(res.data.map(toShareUser)))
        .catch(() => {})
        .finally(() => setLoading(false));
    }
    prevVisibleRef.current = visible;
  }, [visible]);

  const doSearch = useCallback((q: string) => {
    setLoading(true);
    if (!q.trim()) {
      getFriends(1, 50)
        .then((res) => setFriends(res.data.map(toShareUser)))
        .catch(() => {})
        .finally(() => setLoading(false));
      return;
    }
    searchFriends(q)
      .then((res) => setFriends(res.users.map(toShareUser)))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleChangeText = useCallback(
    (text: string) => {
      setKeyword(text);
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => doSearch(text), 400);
    },
    [doSearch],
  );

  const handleClose = useCallback(() => {
    if (sending) return;
    setKeyword('');
    setFriends([]);
    setSelected(new Map());
    onClose();
  }, [sending, onClose]);

  const toggleFriend = useCallback((user: ShareUser) => {
    setSelected((prev) => {
      const next = new Map(prev);
      if (next.has(user.user_id)) next.delete(user.user_id);
      else next.set(user.user_id, user);
      return next;
    });
  }, []);

  const handleShare = useCallback(async () => {
    if (selected.size === 0 || sending) return;
    setSending(true);
    try {
      const results = await Promise.allSettled(
        Array.from(selected.values()).map((u) => sharePostToChat(u.user_id, postId)),
      );
      const success = results.filter((r) => r.status === 'fulfilled').length;
      const failed = results.length - success;
      if (failed === 0) {
        Alert.alert(t('chat.shareSent', { count: success }));
      } else if (success === 0) {
        Alert.alert(t('common.error'), t('chat.shareSomeFailed', { count: failed }));
      } else {
        Alert.alert(t('chat.shareSent', { count: success }), t('chat.shareSomeFailed', { count: failed }));
      }
      handleClose();
    } catch {
      Alert.alert(t('common.error'), t('chat.shareSomeFailed', { count: selected.size }));
    } finally {
      setSending(false);
    }
  }, [selected, sending, postId, t, handleClose]);

  const renderItem = useCallback(
    ({ item }: { item: ShareUser }) => {
      const isSelected = selected.has(item.user_id);
      return (
        <Pressable
          style={({ pressed }) => [styles.row, { backgroundColor: pressed ? theme.bgHover : 'transparent' }]}
          onPress={() => toggleFriend(item)}>
          {item.avatar_uri ? (
            <Image source={{ uri: item.avatar_uri }} style={styles.avatar} contentFit="cover" />
          ) : (
            <View style={[styles.avatar, styles.avatarPlaceholder, { backgroundColor: theme.primaryLight }]}>
              <ThemedText style={[styles.avatarLetter, { color: theme.primary }]}>
                {(item.display_name || '?')[0]?.toUpperCase()}
              </ThemedText>
            </View>
          )}
          <ThemedText style={[styles.name, { color: theme.text }]} numberOfLines={1}>
            {item.display_name}
          </ThemedText>
          <View
            style={[
              styles.check,
              {
                borderColor: isSelected ? theme.primary : theme.border,
                backgroundColor: isSelected ? theme.primary : 'transparent',
              },
            ]}>
            {isSelected && <Icon name="check" size={14} color="#fff" />}
          </View>
        </Pressable>
      );
    },
    [theme, selected, toggleFriend],
  );

  const selectedList = Array.from(selected.values());

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={handleClose}>
      <View style={[styles.container, { backgroundColor: theme.bg }]}>
        <View style={[styles.header, { borderBottomColor: theme.border }]}>
          <Pressable onPress={handleClose} hitSlop={8} style={styles.cancelBtn}>
            <ThemedText style={[styles.cancelText, { color: theme.primary }]}>{t('common.cancel')}</ThemedText>
          </Pressable>
          <ThemedText style={[styles.title, { color: theme.text }]}>{t('chat.shareTitle')}</ThemedText>
          <View style={styles.cancelBtn} />
        </View>

        <View style={[styles.searchWrap, { backgroundColor: theme.bgSecondary }]}>
          <Icon name="search" size={14} color={theme.textSecondary} />
          <TextInput
            style={[styles.searchInput, { color: theme.text }]}
            value={keyword}
            onChangeText={handleChangeText}
            placeholder={t('chat.searchPlaceholder')}
            placeholderTextColor={theme.textSecondary}
          />
          {keyword.length > 0 && (
            <Pressable onPress={() => handleChangeText('')} hitSlop={8}>
              <Icon name="close" size={14} color={theme.textSecondary} />
            </Pressable>
          )}
        </View>

        {selectedList.length > 0 && (
          <ScrollView
            horizontal
            contentContainerStyle={styles.chips}
            showsHorizontalScrollIndicator={false}>
            {selectedList.map((u) => (
              <Pressable
                key={u.user_id}
                onPress={() => toggleFriend(u)}
                style={[styles.chip, { backgroundColor: theme.bgSecondary, borderColor: theme.border }]}>
                <ThemedText style={[styles.chipText, { color: theme.text }]} numberOfLines={1}>
                  {u.display_name}
                </ThemedText>
                <Icon name="close" size={12} color={theme.textSecondary} />
              </Pressable>
            ))}
          </ScrollView>
        )}

        {loading ? (
          <View style={styles.center}>
            <ThemedText themeColor="textSecondary">{t('common.loading')}</ThemedText>
          </View>
        ) : friends.length === 0 ? (
          <View style={styles.center}>
            <ThemedText themeColor="textSecondary">
              {keyword ? t('chat.noResults') : t('chat.noChats')}
            </ThemedText>
          </View>
        ) : (
          <FlatList
            data={friends}
            keyExtractor={(item) => item.user_id}
            renderItem={renderItem}
            ItemSeparatorComponent={() => (
              <View style={[styles.separator, { backgroundColor: theme.border }]} />
            )}
          />
        )}

        <View style={[styles.footer, { borderTopColor: theme.border }]}>
          <Pressable
            onPress={handleShare}
            disabled={selected.size === 0 || sending}
            style={({ pressed }) => [
              styles.shareBtn,
              {
                backgroundColor:
                  selected.size > 0 && !sending ? theme.primary : theme.bgSecondary,
                opacity: pressed ? 0.85 : 1,
              },
            ]}>
            <ThemedText
              style={[
                styles.shareBtnText,
                { color: selected.size > 0 && !sending ? '#fff' : theme.textSecondary },
              ]}>
              {sending
                ? t('common.loading')
                : t('chat.shareSend', { count: selected.size })}
            </ThemedText>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  cancelBtn: {
    width: 60,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelText: {
    ...Typography.body,
    fontSize: 15,
  },
  title: {
    ...Typography.h2,
    fontSize: 17,
  },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: Spacing.md,
    marginTop: Spacing.sm,
    paddingHorizontal: Spacing.sm,
    borderRadius: 8,
    gap: Spacing.xs,
  },
  searchInput: {
    flex: 1,
    ...Typography.body,
    paddingVertical: Spacing.sm,
    fontSize: 14,
  },
  chips: {
    flexDirection: 'row',
    gap: Spacing.xs,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    maxWidth: 160,
  },
  chipText: {
    ...Typography.body,
    fontSize: 13,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    gap: Spacing.sm,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  avatarPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarLetter: {
    ...Typography.body,
    fontWeight: 600,
    fontSize: 16,
  },
  name: {
    ...Typography.body,
    flex: 1,
  },
  check: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  separator: {
    height: StyleSheet.hairlineWidth,
    marginLeft: 76,
  },
  footer: {
    padding: Spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  shareBtn: {
    borderRadius: 10,
    paddingVertical: Spacing.sm + 2,
    alignItems: 'center',
  },
  shareBtnText: {
    ...Typography.body,
    fontWeight: 600,
    fontSize: 15,
  },
});

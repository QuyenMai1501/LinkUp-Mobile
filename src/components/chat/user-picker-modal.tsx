import { useCallback, useEffect, useRef, useState } from 'react';
import { FlatList, Modal, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { Image } from 'expo-image';

import { ThemedText } from '@/components/themed-text';
import { Spacing, Typography } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useTranslation } from '@/hooks/useTranslation';
import { getFriends } from '@/api/friends';
import { searchFriends } from '@/api/chat';
import type { FriendUser } from '@/types/friend';
import type { UserSearchResult } from '@/types/chat';

interface PickerUser {
  user_id: string;
  display_name: string;
  avatar_uri: string;
}

function toPickerUser(u: FriendUser | UserSearchResult): PickerUser {
  return {
    user_id: 'user_id' in u ? u.user_id : u.id,
    display_name: u.display_name,
    avatar_uri: u.avatar_uri,
  };
}

interface Props {
  visible: boolean;
  onClose: () => void;
  onPick: (user: PickerUser) => void;
}

export function UserPickerModal({ visible, onClose, onPick }: Props) {
  const theme = useTheme();
  const { t } = useTranslation();
  const [friends, setFriends] = useState<PickerUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [keyword, setKeyword] = useState('');
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevVisibleRef = useRef(false);

  useEffect(() => {
    if (visible && !prevVisibleRef.current) {
      // Modal just opened — fetch friends
      setKeyword('');
      setFriends([]);
      setLoading(true);
      getFriends(1, 50)
        .then((res) => setFriends(res.data.map(toPickerUser)))
        .catch(() => {})
        .finally(() => setLoading(false));
    }
    prevVisibleRef.current = visible;
  }, [visible]);

  const doSearch = useCallback(
    (q: string) => {
      if (!q.trim()) {
        setLoading(true);
        getFriends(1, 50)
          .then((res) => setFriends(res.data.map(toPickerUser)))
          .catch(() => {})
          .finally(() => setLoading(false));
        return;
      }
      setLoading(true);
      searchFriends(q)
        .then((res) => setFriends(res.users.map(toPickerUser)))
        .catch(() => {})
        .finally(() => setLoading(false));
    },
    [],
  );

  const handleChangeText = useCallback(
    (text: string) => {
      setKeyword(text);
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => doSearch(text), 400);
    },
    [doSearch],
  );

  const renderItem = useCallback(
    ({ item }: { item: PickerUser }) => (
      <Pressable
        style={({ pressed }) => [styles.row, { backgroundColor: pressed ? theme.bgHover : 'transparent' }]}
        onPress={() => onPick(item)}>
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
      </Pressable>
    ),
    [theme, onPick],
  );

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={[styles.container, { backgroundColor: theme.bg }]}>
        <View style={[styles.header, { borderBottomColor: theme.border }]}>
          <Pressable onPress={onClose} hitSlop={8} style={styles.cancelBtn}>
            <ThemedText style={[styles.cancelText, { color: theme.primary }]}>{t('common.cancel')}</ThemedText>
          </Pressable>
          <ThemedText style={[styles.title, { color: theme.text }]}>{t('chat.newMessage')}</ThemedText>
          <View style={styles.cancelBtn} />
        </View>

        <View style={[styles.searchWrap, { backgroundColor: theme.bgSecondary }]}>
          <ThemedText style={styles.searchIcon}>🔍</ThemedText>
          <TextInput
            style={[styles.searchInput, { color: theme.text }]}
            value={keyword}
            onChangeText={handleChangeText}
            placeholder={t('chat.searchPlaceholder')}
            placeholderTextColor={theme.textSecondary}
            autoFocus
          />
          {keyword.length > 0 && (
            <Pressable onPress={() => handleChangeText('')} hitSlop={8}>
              <ThemedText style={styles.clearIcon}>✕</ThemedText>
            </Pressable>
          )}
        </View>

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
  searchIcon: {
    fontSize: 14,
  },
  searchInput: {
    flex: 1,
    ...Typography.body,
    paddingVertical: Spacing.sm,
    fontSize: 14,
  },
  clearIcon: {
    fontSize: 14,
    opacity: 0.5,
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
  separator: {
    height: StyleSheet.hairlineWidth,
    marginLeft: 76,
  },
});

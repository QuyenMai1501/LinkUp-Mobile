import { Image } from 'expo-image';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  TextInput,
  View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { showAlert } from '@/utils/alert';
import { addGroupMember } from '@/api/group-chat';
import { searchFriends } from '@/api/chat';
import { getFriends } from '@/api/friends';
import { ThemedText } from '@/components/themed-text';
import { Icon } from '@/components/ui/icon';
import { Spacing, Typography } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useTranslation } from '@/hooks/useTranslation';
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
  chatId: string;
  /** user_id của các thành viên đã có trong nhóm — loại khỏi danh sách chọn. */
  memberIds: Set<string>;
  /** Gọi sau khi gửi ít nhất 1 lời mời thành công (caller refetch settings). */
  onMembersAdded?: () => void;
}

/**
 * Modal thêm thành viên vào nhóm (P1.4) — multi-select, mirror Web
 * AddGroupMemberModal: list bạn bè khi chưa gõ, search debounce 400ms,
 * loop POST add-member từng user, báo đếm kết quả.
 */
export function AddGroupMemberModal({
  visible,
  onClose,
  chatId,
  memberIds,
  onMembersAdded,
}: Props) {
  const theme = useTheme();
  const { t } = useTranslation();
  const [friends, setFriends] = useState<PickerUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [keyword, setKeyword] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [adding, setAdding] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevVisibleRef = useRef(false);

  const loadFriends = useCallback(() => {
    setLoading(true);
    getFriends(1, 50)
      .then((res) =>
        setFriends(
          res.data.map(toPickerUser).filter((u) => !memberIds.has(u.user_id)),
        ),
      )
      .catch(() => setFriends([]))
      .finally(() => setLoading(false));
  }, [memberIds]);

  const doSearch = useCallback(
    (q: string) => {
      if (!q.trim()) {
        loadFriends();
        return;
      }
      setLoading(true);
      searchFriends(q)
        .then((res) =>
          setFriends(
            res.users.map(toPickerUser).filter((u) => !memberIds.has(u.user_id)),
          ),
        )
        .catch(() => setFriends([]))
        .finally(() => setLoading(false));
    },
    [loadFriends, memberIds],
  );

  useEffect(() => {
    if (visible && !prevVisibleRef.current) {
      // Modal vừa mở — reset rồi load danh sách bạn bè.
      setKeyword('');
      setSelectedIds(new Set());
      loadFriends();
    }
    prevVisibleRef.current = visible;
  }, [visible, loadFriends]);

  const handleChangeText = useCallback(
    (text: string) => {
      setKeyword(text);
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => doSearch(text), 400);
    },
    [doSearch],
  );

  useEffect(
    () => () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    },
    [],
  );

  const toggleSelect = useCallback((userId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      return next;
    });
  }, []);

  const handleAdd = useCallback(async () => {
    if (selectedIds.size === 0 || adding) return;
    setAdding(true);
    let addedCount = 0;
    let lastError = '';
    for (const userId of selectedIds) {
      try {
        await addGroupMember(chatId, userId);
        addedCount++;
      } catch (err) {
        lastError = err instanceof Error ? err.message : String(err);
      }
    }
    setAdding(false);
    if (addedCount > 0) {
      showAlert(
        t('common.success'),
        t('chat.memberInviteSent', { count: addedCount }),
      );
      onMembersAdded?.();
    } else if (lastError) {
      showAlert(t('common.error'), lastError);
    }
    onClose();
  }, [selectedIds, adding, chatId, onMembersAdded, onClose, t]);

  const renderItem = useCallback(
    ({ item }: { item: PickerUser }) => {
      const isSelected = selectedIds.has(item.user_id);
      return (
        <Pressable
          style={({ pressed }) => [
            styles.row,
            { backgroundColor: pressed ? theme.bgHover : 'transparent' },
          ]}
          onPress={() => toggleSelect(item.user_id)}>
          {item.avatar_uri ? (
            <Image
              source={{ uri: item.avatar_uri }}
              style={styles.avatar}
              contentFit="cover"
            />
          ) : (
            <View
              style={[
                styles.avatar,
                styles.avatarPlaceholder,
                { backgroundColor: theme.primaryLight },
              ]}>
              <ThemedText style={[styles.avatarLetter, { color: theme.primary }]}>
                {(item.display_name || '?')[0]?.toUpperCase()}
              </ThemedText>
            </View>
          )}
          <ThemedText style={[styles.name, { color: theme.text }]} numberOfLines={1}>
            {item.display_name}
          </ThemedText>
          <Icon
            name={isSelected ? 'checkCircle' : 'add'}
            size={20}
            color={isSelected ? theme.primary : theme.textSecondary}
          />
        </Pressable>
      );
    },
    [selectedIds, theme, toggleSelect],
  );

  const selectedCount = selectedIds.size;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}>
      <View style={[styles.container, { backgroundColor: theme.bg }]}>
        <SafeAreaView edges={['top']} style={styles.flex}>
          <View style={[styles.header, { borderBottomColor: theme.border }]}>
            <Pressable onPress={onClose} hitSlop={8} style={styles.cancelBtn}>
              <ThemedText style={[styles.cancelText, { color: theme.primary }]}>
                {t('common.cancel')}
              </ThemedText>
            </Pressable>
            <ThemedText style={[styles.title, { color: theme.text }]}>
              {t('chat.addMembers')}
            </ThemedText>
            <View style={styles.cancelBtn} />
          </View>

          <KeyboardAvoidingView
            style={styles.flex}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
            <View
              style={[styles.searchWrap, { backgroundColor: theme.bgSecondary }]}>
              <Icon name="search" size={14} color={theme.textSecondary} />
              <TextInput
                style={[styles.searchInput, { color: theme.text }]}
                value={keyword}
                onChangeText={handleChangeText}
                placeholder={t('chat.searchFriends')}
                placeholderTextColor={theme.textSecondary}
                autoFocus
              />
              {keyword.length > 0 && (
                <Pressable onPress={() => handleChangeText('')} hitSlop={8}>
                  <Icon name="close" size={14} color={theme.textSecondary} />
                </Pressable>
              )}
            </View>

            {loading ? (
              <View style={styles.center}>
                <ActivityIndicator color={theme.primary} />
                <ThemedText themeColor="textSecondary">
                  {t('common.loading')}
                </ThemedText>
              </View>
            ) : friends.length === 0 ? (
              <View style={styles.center}>
                <ThemedText themeColor="textSecondary">
                  {keyword ? t('chat.noResults') : t('chat.noFriends')}
                </ThemedText>
              </View>
            ) : (
              <FlatList
                data={friends}
                keyExtractor={(item) => item.user_id}
                renderItem={renderItem}
                ItemSeparatorComponent={() => (
                  <View
                    style={[styles.separator, { backgroundColor: theme.border }]}
                  />
                )}
                style={styles.flex}
                contentContainerStyle={styles.listContent}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
                ListHeaderComponent={
                  keyword.trim().length === 0 && friends.length > 0 ? (
                    <ThemedText
                      themeColor="textSecondary"
                      style={styles.sectionLabel}>
                      {t('chat.friends')}
                    </ThemedText>
                  ) : null
                }
              />
            )}

            {/* Footer: đếm lựa chọn + nút gửi */}
            <View
              style={[styles.footer, { borderTopColor: theme.border }]}>
              <ThemedText themeColor="textSecondary">
                {selectedCount > 0
                  ? t('chat.selectedCount', { count: selectedCount })
                  : ''}
              </ThemedText>
              <Pressable
                onPress={() => void handleAdd()}
                disabled={selectedCount === 0 || adding}
                style={[
                  styles.addBtn,
                  {
                    backgroundColor:
                      selectedCount === 0 || adding
                        ? theme.bgSecondary
                        : theme.primary,
                  },
                ]}>
                {adding ? (
                  <ActivityIndicator size={14} color={theme.textOnPrimary} />
                ) : (
                  <ThemedText style={[styles.addBtnText, { color: theme.textOnPrimary }]}>
                    {t('chat.sendInviteCount', { count: selectedCount })}
                  </ThemedText>
                )}
              </Pressable>
            </View>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  flex: { flex: 1 },
  listContent: {
    paddingTop: Spacing.xs,
    paddingBottom: Spacing.lg,
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
    width: 70,
    alignItems: 'flex-start',
  },
  cancelText: { ...Typography.body, fontSize: 15 },
  title: { ...Typography.h2, fontSize: 17 },
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
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
  },
  sectionLabel: {
    ...Typography.caption,
    fontWeight: '600',
    textTransform: 'uppercase',
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    gap: Spacing.sm,
  },
  avatar: { width: 40, height: 40, borderRadius: 20 },
  avatarPlaceholder: { alignItems: 'center', justifyContent: 'center' },
  avatarLetter: { ...Typography.body, fontWeight: 600, fontSize: 16 },
  name: { ...Typography.body, flex: 1 },
  separator: { height: StyleSheet.hairlineWidth, marginLeft: 76 },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: Spacing.sm,
  },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: 8,
    minWidth: 150,
  },
  addBtnText: { ...Typography.body, fontWeight: '600', fontSize: 14 },
});

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
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { getGroupSettings } from '@/api/group-chat';
import { ThemedText } from '@/components/themed-text';
import { Icon } from '@/components/ui/icon';
import { Spacing, Typography } from '@/constants/theme';
import { useAuth } from '@/contexts/auth-context';
import { useTheme } from '@/hooks/use-theme';
import { useTranslation } from '@/hooks/useTranslation';
import type { GroupChatMember } from '@/types/group-chat';

interface Props {
  visible: boolean;
  onClose: () => void;
  chatId: string;
  /** Gọi với mảng user_id đã chọn — context sẽ startGroupCall. */
  onStartCall: (selectedIds: string[]) => void;
}

/**
 * Modal chọn thành viên để gọi nhóm (C2) — load members từ group settings,
 * multi-select + search, mirror Web GroupCallMemberSelectModal.
 */
export function GroupCallMemberSelectModal({
  visible,
  onClose,
  chatId,
  onStartCall,
}: Props) {
  const theme = useTheme();
  const { t } = useTranslation();
  const { user } = useAuth();
  const myUserId = user?.id ?? '';
  const [members, setMembers] = useState<GroupChatMember[]>([]);
  const [loading, setLoading] = useState(false);
  const [keyword, setKeyword] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const prevVisibleRef = useRef(false);

  useEffect(() => {
    if (visible && !prevVisibleRef.current) {
      setKeyword('');
      setSelectedIds(new Set());
      setLoading(true);
      getGroupSettings(chatId)
        .then((res) => {
          const list = (res.data.members ?? []).filter(
            (m) => m.user_id !== myUserId,
          );
          setMembers(list);
        })
        .catch(() => setMembers([]))
        .finally(() => setLoading(false));
    }
    prevVisibleRef.current = visible;
  }, [visible, chatId, myUserId]);

  const filtered = keyword.trim()
    ? members.filter((m) =>
        m.display_name.toLowerCase().includes(keyword.toLowerCase()),
      )
    : members;

  const toggleSelect = useCallback((userId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      return next;
    });
  }, []);

  const allSelected = filtered.length > 0 && filtered.every((m) => selectedIds.has(m.user_id));

  const toggleAll = useCallback(() => {
    setSelectedIds((prev) => {
      if (allSelected) return new Set();
      return new Set(filtered.map((m) => m.user_id));
    });
  }, [allSelected, filtered]);

  const handleStart = useCallback(() => {
    if (selectedIds.size === 0) return;
    onStartCall(Array.from(selectedIds));
    onClose();
  }, [selectedIds, onStartCall, onClose]);

  const renderItem = useCallback(
    ({ item }: { item: GroupChatMember }) => {
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
              {t('groupCall.selectMembers')}
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
                onChangeText={setKeyword}
                placeholder={t('common.search')}
                placeholderTextColor={theme.textSecondary}
              />
              {keyword.length > 0 && (
                <Pressable onPress={() => setKeyword('')} hitSlop={8}>
                  <Icon name="close" size={14} color={theme.textSecondary} />
                </Pressable>
              )}
            </View>

            {/* Chọn tất cả */}
            {filtered.length > 0 && (
              <Pressable
                style={styles.row}
                onPress={toggleAll}>
                <View style={styles.avatarPlaceholder}>
                  <Icon
                    name={allSelected ? 'checkCircle' : 'add'}
                    size={20}
                    color={allSelected ? theme.primary : theme.textSecondary}
                  />
                </View>
                <ThemedText style={[styles.name, { color: theme.text }]}>
                  {allSelected
                    ? t('groupCall.deselectAll')
                    : t('groupCall.selectAll')}
                </ThemedText>
                <ThemedText themeColor="textSecondary">{filtered.length}</ThemedText>
              </Pressable>
            )}

            {loading ? (
              <View style={styles.center}>
                <ActivityIndicator color={theme.primary} />
                <ThemedText themeColor="textSecondary">
                  {t('common.loading')}
                </ThemedText>
              </View>
            ) : filtered.length === 0 ? (
              <View style={styles.center}>
                <ThemedText themeColor="textSecondary">
                  {t('chat.noResults')}
                </ThemedText>
              </View>
            ) : (
              <FlatList
                data={filtered}
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
              />
            )}

            {/* Footer: đếm lựa chọn + nút gọi */}
            <View
              style={[styles.footer, { borderTopColor: theme.border }]}>
              <ThemedText themeColor="textSecondary">
                {selectedCount > 0
                  ? t('chat.selectedCount', { count: selectedCount })
                  : ''}
              </ThemedText>
              <Pressable
                onPress={handleStart}
                disabled={selectedCount === 0}
                style={[
                  styles.startBtn,
                  {
                    backgroundColor:
                      selectedCount === 0 ? theme.bgSecondary : theme.primary,
                  },
                ]}>
                <Icon name="video" size={16} color="#FFF" />
                <ThemedText style={styles.startBtnText}>
                  {t('groupCall.startCall')} ({selectedCount})
                </ThemedText>
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
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    gap: Spacing.sm,
  },
  avatar: { width: 40, height: 40, borderRadius: 20 },
  avatarPlaceholder: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
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
  startBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: 8,
    minWidth: 150,
    gap: Spacing.xs,
  },
  startBtnText: { ...Typography.body, color: '#FFF', fontWeight: '600', fontSize: 14 },
});

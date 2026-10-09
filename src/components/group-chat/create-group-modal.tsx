import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
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

import { getFriends } from '@/api/friends';
import { searchFriends } from '@/api/chat';
import { createGroupChat } from '@/api/group-chat';
import { uploadMedia } from '@/api/profile';
import { ThemedText } from '@/components/themed-text';
import { Icon } from '@/components/ui/icon';
import { Spacing, Typography } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useTranslation } from '@/hooks/useTranslation';
import type { FriendUser } from '@/types/friend';
import type { UserSearchResult } from '@/types/chat';

interface PickUser {
  user_id: string;
  display_name: string;
  avatar_uri: string;
}

function toPickUser(u: FriendUser | UserSearchResult): PickUser {
  return {
    user_id: 'user_id' in u ? u.user_id : u.id,
    display_name: u.display_name,
    avatar_uri: u.avatar_uri,
  };
}

interface Props {
  visible: boolean;
  onClose: () => void;
  onCreated: (groupId: string) => void;
}

export function CreateGroupModal({ visible, onClose, onCreated }: Props) {
  const theme = useTheme();
  const { t } = useTranslation();
  const [name, setName] = useState('');
  const [avatarUri, setAvatarUri] = useState<string | null>(null);
  const [friends, setFriends] = useState<PickUser[]>([]);
  const [selected, setSelected] = useState<Map<string, PickUser>>(new Map());
  const [keyword, setKeyword] = useState('');
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevVisibleRef = useRef(false);

  // Reset + load danh sách bạn khi mở modal.
  useEffect(() => {
    if (visible && !prevVisibleRef.current) {
      setName('');
      setAvatarUri(null);
      setSelected(new Map());
      setKeyword('');
      setCreating(false);
      setLoading(true);
      getFriends(1, 100)
        .then((res) => setFriends(res.data.map(toPickUser)))
        .catch(() => {})
        .finally(() => setLoading(false));
    }
    prevVisibleRef.current = visible;
  }, [visible]);

  const doSearch = useCallback((q: string) => {
    setLoading(true);
    const req = q.trim()
      ? searchFriends(q.trim())
      : getFriends(1, 100).then((res) => ({ users: res.data }));
    req
      .then((res) => setFriends(res.users.map(toPickUser)))
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

  const toggleUser = useCallback((user: PickUser) => {
    setSelected((prev) => {
      const next = new Map(prev);
      if (next.has(user.user_id)) next.delete(user.user_id);
      else next.set(user.user_id, user);
      return next;
    });
  }, []);

  const handlePickAvatar = useCallback(async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(t('common.error'), t('chat.groupAvatarPermission'));
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) {
      setAvatarUri(result.assets[0].uri);
    }
  }, [t]);

  const nameValid = name.trim().length >= 3 && name.trim().length <= 50;
  const canCreate = nameValid && selected.size > 0 && !creating;

  const handleCreate = useCallback(async () => {
    if (!canCreate || creating) return;
    setCreating(true);
    try {
      let avatar: string | undefined;
      if (avatarUri) {
        const uploaded = await uploadMedia(
          avatarUri,
          'group-avatar.jpg',
          'image/jpeg',
        );
        avatar = uploaded?.data?.file_uri ?? undefined;
      }
      const res = await createGroupChat({
        name: name.trim(),
        member_ids: [...selected.keys()],
        ...(avatar ? { avatar_uri: avatar } : {}),
      });
      onCreated(res.group_id);
      onClose();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      Alert.alert(t('common.error'), msg || t('common.error'));
    } finally {
      setCreating(false);
    }
  }, [canCreate, creating, avatarUri, name, selected, onCreated, onClose, t]);

  const renderItem = useCallback(
    ({ item }: { item: PickUser }) => {
      const isSelected = selected.has(item.user_id);
      return (
        <Pressable
          style={({ pressed }) => [
            styles.row,
            { backgroundColor: pressed ? theme.bgHover : 'transparent' },
          ]}
          onPress={() => toggleUser(item)}>
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
    [selected, theme, toggleUser],
  );

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}>
      <View style={[styles.container, { backgroundColor: theme.bg }]}>
        <SafeAreaView edges={['top']} style={styles.flex}>
        <View style={[styles.header, { borderBottomColor: theme.border }]}>
          <Pressable onPress={onClose} hitSlop={8} style={styles.headerBtn}>
            <ThemedText style={[styles.headerBtnText, { color: theme.primary }]}>
              {t('common.cancel')}
            </ThemedText>
          </Pressable>
          <ThemedText style={[styles.title, { color: theme.text }]}>
            {t('chat.createGroupTitle')}
          </ThemedText>
          <Pressable
            onPress={() => void handleCreate()}
            disabled={!canCreate}
            style={styles.headerBtn}>
            {creating ? (
              <ActivityIndicator size="small" color={theme.primary} />
            ) : (
              <ThemedText
                style={[
                  styles.headerBtnText,
                  { color: canCreate ? theme.primary : theme.textSecondary },
                ]}>
                {t('chat.create')}
              </ThemedText>
            )}
          </Pressable>
        </View>

        {/* Nội dung bị bàn phím đẩy — pattern share-to-chat-modal */}
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        {/* Avatar + tên nhóm */}
        <View style={[styles.infoRow, { borderBottomColor: theme.border }]}>
          <Pressable onPress={() => void handlePickAvatar()}>
            {avatarUri ? (
              <Image
                source={{ uri: avatarUri }}
                style={styles.groupAvatar}
                contentFit="cover"
              />
            ) : (
              <View
                style={[
                  styles.groupAvatar,
                  styles.avatarPlaceholder,
                  { backgroundColor: theme.primaryLight },
                ]}>
                <Icon name="people" size={24} color={theme.primary} />
              </View>
            )}
            <View style={[styles.cameraBadge, { backgroundColor: theme.primary }]}>
              <Icon name="camera" size={12} color="#FFF" />
            </View>
          </Pressable>
          <TextInput
            style={[styles.nameInput, { color: theme.text }]}
            value={name}
            onChangeText={setName}
            placeholder={t('chat.groupNamePlaceholder')}
            placeholderTextColor={theme.textSecondary}
            maxLength={50}
          />
        </View>
        {keyword.trim().length === 0 && name.length > 0 && !nameValid && (
          <ThemedText themeColor="danger" style={styles.nameHint}>
            {t('chat.groupNameInvalid')}
          </ThemedText>
        )}

        {/* Search bạn */}
        <View style={[styles.searchWrap, { backgroundColor: theme.bgSecondary }]}>
          <Icon name="search" size={14} color={theme.textSecondary} />
          <TextInput
            style={[styles.searchInput, { color: theme.text }]}
            value={keyword}
            onChangeText={handleChangeText}
            placeholder={t('chat.selectMembers')}
            placeholderTextColor={theme.textSecondary}
          />
          {keyword.length > 0 && (
            <Pressable onPress={() => handleChangeText('')} hitSlop={8}>
              <Icon name="close" size={14} color={theme.textSecondary} />
            </Pressable>
          )}
        </View>

        {selected.size > 0 && (
          <ThemedText
            themeColor="textSecondary"
            style={styles.selectedCount}>
            {t('chat.membersCount', { count: selected.size })}
          </ThemedText>
        )}

        {loading ? (
          <View style={styles.center}>
            <ThemedText themeColor="textSecondary">{t('common.loading')}</ThemedText>
          </View>
        ) : friends.length === 0 ? (
          <View style={styles.center}>
            <ThemedText themeColor="textSecondary">{t('chat.noResults')}</ThemedText>
          </View>
        ) : (
          <FlatList
            data={friends}
            keyExtractor={(item) => item.user_id}
            renderItem={renderItem}
            ItemSeparatorComponent={() => (
              <View style={[styles.separator, { backgroundColor: theme.border }]} />
            )}
            style={styles.flex}
            contentContainerStyle={styles.listContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          />
        )}
        </KeyboardAvoidingView>
        </SafeAreaView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  flex: {
    flex: 1,
  },
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
  headerBtn: {
    minWidth: 60,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerBtnText: {
    ...Typography.body,
    fontSize: 15,
    fontWeight: '600',
  },
  title: {
    ...Typography.h2,
    fontSize: 17,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  groupAvatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
  },
  avatarPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  cameraBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nameInput: {
    flex: 1,
    ...Typography.body,
    paddingVertical: Spacing.sm,
  },
  nameHint: {
    ...Typography.caption,
    paddingHorizontal: Spacing.md,
    paddingTop: 4,
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
  selectedCount: {
    ...Typography.caption,
    paddingHorizontal: Spacing.md,
    paddingTop: 6,
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

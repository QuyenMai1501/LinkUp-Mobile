import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  getGroupSettings,
  leaveGroup,
  updateGroupSettings,
} from '@/api/group-chat';
import { uploadMedia } from '@/api/profile';
import { ThemedText } from '@/components/themed-text';
import { Icon } from '@/components/ui/icon';
import { Radius, Spacing, Typography } from '@/constants/theme';
import { useAuth } from '@/contexts/auth-context';
import { useTheme } from '@/hooks/use-theme';
import { useTranslation } from '@/hooks/useTranslation';
import type {
  GroupChatMember,
  GroupChatSettings,
  GroupLeaveHistoryMode,
  GroupLeaveMode,
} from '@/types/group-chat';
import { notifyChatListDirty } from '@/utils/chat-list-dirty';

/**
 * Cài đặt nhóm (P0.2 + P0.3): xem info/members, admin sửa tên + ảnh,
 * và rời nhóm (public/silent × keep/anonymize — mirror Web GroupSettingsPanel).
 */
export default function GroupChatSettingsScreen() {
  const { chatId } = useLocalSearchParams<{ chatId: string }>();
  const theme = useTheme();
  const { t } = useTranslation();
  const router = useRouter();
  const { user } = useAuth();
  const myUserId = user?.id ?? '';

  const [settings, setSettings] = useState<GroupChatSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [editingName, setEditingName] = useState(false);
  const [nameValue, setNameValue] = useState('');
  const [savingName, setSavingName] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  // Leave modal state.
  const [leaveOpen, setLeaveOpen] = useState(false);
  const [leaveMode, setLeaveMode] = useState<GroupLeaveMode>('public');
  const [leaveHistoryMode, setLeaveHistoryMode] =
    useState<GroupLeaveHistoryMode>('keep');
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    if (!chatId) return;
    let cancelled = false;
    // Dùng .then (không async fn trong effect) để tránh lint
    // react-hooks/set-state-in-effect — setState chỉ chạy trong callback.
    getGroupSettings(chatId)
      .then((res) => {
        if (cancelled) return;
        setSettings(res.data);
        setNameValue(res.data.name);
      })
      .catch(() => {
        if (!cancelled) Alert.alert(t('common.error'));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [chatId, t]);

  const members: GroupChatMember[] = settings?.members ?? [];
  const isAdmin =
    members.some(
      (m) => m.user_id === myUserId && m.role === 'CHAT_ADMIN',
    ) ?? false;

  const handleSaveName = useCallback(async () => {
    const trimmed = nameValue.trim();
    if (trimmed.length < 3 || trimmed.length > 50) {
      Alert.alert(t('common.error'), t('chat.groupNameInvalid'));
      return;
    }
    if (!chatId) return;
    setSavingName(true);
    try {
      const res = await updateGroupSettings(chatId, { name: trimmed });
      setSettings(res.data);
      setNameValue(res.data.name);
      setEditingName(false);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      Alert.alert(t('common.error'), msg || t('common.error'));
    } finally {
      setSavingName(false);
    }
  }, [chatId, nameValue, t]);

  const handleChangeAvatar = useCallback(async () => {
    if (!chatId) return;
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
    if (result.canceled || !result.assets[0]) return;
    setUploadingAvatar(true);
    try {
      const uploaded = await uploadMedia(
        result.assets[0].uri,
        'group-avatar.jpg',
        'image/jpeg',
      );
      const avatarUri = uploaded?.data?.file_uri as string | undefined;
      if (!avatarUri) throw new Error('upload failed');
      const res = await updateGroupSettings(chatId, { avatar_uri: avatarUri });
      setSettings(res.data);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      Alert.alert(t('common.error'), msg || t('common.error'));
    } finally {
      setUploadingAvatar(false);
    }
  }, [chatId, t]);

  const handleLeave = useCallback(async () => {
    if (!chatId || leaving) return;
    setLeaving(true);
    try {
      await leaveGroup(chatId, leaveMode, leaveHistoryMode);
      // Refresh danh sách hội thoại + thoát cả phòng lẫn settings.
      notifyChatListDirty();
      setLeaveOpen(false);
      Alert.alert(t('common.success'), t('chat.leftGroupSuccess'), [
        {
          text: t('common.ok'),
          onPress: () => router.replace('/(drawer)/messages'),
        },
      ]);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      Alert.alert(t('common.error'), msg || t('common.error'));
    } finally {
      setLeaving(false);
    }
  }, [chatId, leaveMode, leaveHistoryMode, leaving, router, t]);

  const groupName = settings?.name || t('chat.groupChat');

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.bg }]} edges={['top']}>
      {/* Header */}
      <View
        style={[
          styles.header,
          { borderBottomColor: theme.border, backgroundColor: theme.bg },
        ]}>
        <Pressable onPress={() => router.back()} hitSlop={8} style={styles.backBtn}>
          <ThemedText style={styles.backIcon}>←</ThemedText>
        </Pressable>
        <ThemedText style={styles.headerTitle}>{t('chat.groupSettings')}</ThemedText>
        <View style={styles.backBtn} />
      </View>

      {loading && !settings ? (
        <View style={styles.center}>
          <ActivityIndicator color={theme.primary} />
          <ThemedText themeColor="textSecondary">{t('common.loading')}</ThemedText>
        </View>
      ) : !settings ? (
        <View style={styles.center}>
          <ThemedText themeColor="textSecondary">{t('common.error')}</ThemedText>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.body}>
          {/* Hero: avatar + tên + số thành viên */}
          <View style={styles.hero}>
            {settings.avatar_uri ? (
              <Image
                source={{ uri: settings.avatar_uri }}
                style={styles.heroAvatar}
                contentFit="cover"
              />
            ) : (
              <View
                style={[
                  styles.heroAvatar,
                  styles.avatarPlaceholder,
                  { backgroundColor: theme.primaryLight },
                ]}>
                <Icon name="people" size={32} color={theme.primary} />
              </View>
            )}
            <ThemedText style={styles.heroName} numberOfLines={2}>
              {groupName}
            </ThemedText>
            <ThemedText themeColor="textSecondary">
              {t('chat.membersCount', { count: members.length })}
            </ThemedText>
            {isAdmin && (
              <View style={[styles.adminBadge, { backgroundColor: theme.primaryLight }]}>
                <Icon name="shield" size={12} color={theme.primary} />
                <ThemedText style={[styles.adminBadgeText, { color: theme.primary }]}>
                  {t('chat.groupInfoAdmin')}
                </ThemedText>
              </View>
            )}
          </View>

          {/* Admin: đổi tên + đổi ảnh */}
          {isAdmin && (
            <View style={[styles.section, { backgroundColor: theme.card }]}>
              <ThemedText themeColor="textSecondary" style={styles.sectionTitle}>
                {t('chat.editGroupName')}
              </ThemedText>
              {editingName ? (
                <View style={styles.nameEditRow}>
                  <TextInput
                    value={nameValue}
                    onChangeText={setNameValue}
                    style={[
                      styles.nameInput,
                      { color: theme.text, borderColor: theme.border, backgroundColor: theme.bg },
                    ]}
                    maxLength={50}
                    autoFocus
                    placeholder={t('chat.groupNamePlaceholder')}
                    placeholderTextColor={theme.textSecondary}
                  />
                  <Pressable
                    onPress={() => void handleSaveName()}
                    disabled={savingName}
                    style={[styles.saveBtn, { backgroundColor: theme.primary }]}>
                    {savingName ? (
                      <ActivityIndicator size={12} color="#FFF" />
                    ) : (
                      <ThemedText style={styles.saveBtnText}>{t('common.success')}</ThemedText>
                    )}
                  </Pressable>
                </View>
              ) : (
                <Pressable
                  onPress={() => setEditingName(true)}
                  style={styles.settingRow}>
                  <ThemedText style={{ flex: 1, color: theme.text }} numberOfLines={1}>
                    {settings.name}
                  </ThemedText>
                  <Icon name="chevronRight" size={16} color={theme.textSecondary} />
                </Pressable>
              )}

              <View style={[styles.divider, { backgroundColor: theme.border }]} />

              <Pressable
                onPress={() => void handleChangeAvatar()}
                disabled={uploadingAvatar}
                style={styles.settingRow}>
                <ThemedText style={{ flex: 1, color: theme.text }}>
                  {t('chat.changeGroupAvatar')}
                </ThemedText>
                {uploadingAvatar ? (
                  <ActivityIndicator size={16} color={theme.primary} />
                ) : (
                  <Icon name="camera" size={16} color={theme.textSecondary} />
                )}
              </Pressable>
            </View>
          )}

          {/* Danh sách thành viên */}
          <View style={[styles.section, { backgroundColor: theme.card }]}>
            <ThemedText themeColor="textSecondary" style={styles.sectionTitle}>
              {t('chat.groupMembers')}
            </ThemedText>
            {members.map((m) => (
              <View key={m.user_id} style={styles.memberRow}>
                {m.avatar_uri ? (
                  <Image
                    source={{ uri: m.avatar_uri }}
                    style={styles.memberAvatar}
                    contentFit="cover"
                  />
                ) : (
                  <View
                    style={[
                      styles.memberAvatar,
                      styles.avatarPlaceholder,
                      { backgroundColor: theme.primaryLight },
                    ]}>
                    <ThemedText style={{ color: theme.primary, fontWeight: '600' }}>
                      {(m.display_name || '?')[0]?.toUpperCase()}
                    </ThemedText>
                  </View>
                )}
                <View style={styles.memberInfo}>
                  <ThemedText style={{ color: theme.text }} numberOfLines={1}>
                    {m.display_name}
                    {m.user_id === myUserId ? ` (${t('chat.you')})` : ''}
                  </ThemedText>
                  <View style={styles.memberTags}>
                    {m.role === 'CHAT_ADMIN' && (
                      <ThemedText
                        style={[styles.memberTag, { color: theme.primary }]}>
                        {t('chat.roleAdmin')}
                      </ThemedText>
                    )}
                    {m.is_muted && (
                      <ThemedText
                        style={[styles.memberTag, { color: theme.danger }]}>
                        {t('chat.mutedBadge')}
                      </ThemedText>
                    )}
                  </View>
                </View>
              </View>
            ))}
          </View>

          {/* Rời nhóm */}
          <Pressable
            onPress={() => setLeaveOpen(true)}
            style={[styles.leaveBtn, { backgroundColor: theme.dangerLight }]}>
            <Icon name="logout" size={16} color={theme.danger} />
            <ThemedText style={[styles.leaveBtnText, { color: theme.danger }]}>
              {t('chat.leaveGroup')}
            </ThemedText>
          </Pressable>
        </ScrollView>
      )}

      {/* Leave confirm modal */}
      {leaveOpen && (
        <View style={styles.leaveOverlay}>
          <Pressable
            style={styles.leaveOverlayBg}
            onPress={() => !leaving && setLeaveOpen(false)}
          />
          <View style={[styles.leaveDialog, { backgroundColor: theme.card }]}>
            <ThemedText style={[styles.leaveTitle, { color: theme.text }]}>
              {t('chat.leaveGroup')}
            </ThemedText>
            <ThemedText themeColor="textSecondary" style={styles.leaveDesc}>
              {t('chat.leaveGroupConfirm', { name: groupName })}
            </ThemedText>

            {/* Leave mode */}
            {(['public', 'silent'] as const).map((mode) => (
              <Pressable
                key={mode}
                onPress={() => setLeaveMode(mode)}
                style={styles.radioRow}>
                <Icon
                  name={leaveMode === mode ? 'checkCircle' : 'close'}
                  size={18}
                  color={leaveMode === mode ? theme.primary : theme.textSecondary}
                />
                <View style={styles.radioTexts}>
                  <ThemedText style={{ color: theme.text }}>
                    {mode === 'public'
                      ? t('chat.leaveModePublic')
                      : t('chat.leaveModeSilent')}
                  </ThemedText>
                  <ThemedText themeColor="textSecondary" style={styles.radioDesc}>
                    {mode === 'public'
                      ? t('chat.leaveModePublicDesc')
                      : t('chat.leaveModeSilentDesc')}
                  </ThemedText>
                </View>
              </Pressable>
            ))}

            {/* History mode */}
            {(['keep', 'anonymize'] as const).map((hm) => (
              <Pressable
                key={hm}
                onPress={() => setLeaveHistoryMode(hm)}
                style={styles.radioRow}>
                <Icon
                  name={leaveHistoryMode === hm ? 'checkCircle' : 'close'}
                  size={18}
                  color={leaveHistoryMode === hm ? theme.primary : theme.textSecondary}
                />
                <View style={styles.radioTexts}>
                  <ThemedText style={{ color: theme.text }}>
                    {hm === 'keep'
                      ? t('chat.leaveHistoryKeep')
                      : t('chat.leaveHistoryAnonymize')}
                  </ThemedText>
                  <ThemedText themeColor="textSecondary" style={styles.radioDesc}>
                    {hm === 'keep'
                      ? t('chat.leaveHistoryKeepDesc')
                      : t('chat.leaveHistoryAnonymizeDesc')}
                  </ThemedText>
                </View>
              </Pressable>
            ))}

            <View style={styles.leaveActions}>
              <Pressable
                style={[styles.leaveActionBtn, { backgroundColor: theme.bgSecondary }]}
                onPress={() => setLeaveOpen(false)}
                disabled={leaving}>
                <ThemedText style={{ color: theme.text }}>{t('common.cancel')}</ThemedText>
              </Pressable>
              <Pressable
                style={[styles.leaveActionBtn, { backgroundColor: theme.danger }]}
                onPress={() => void handleLeave()}
                disabled={leaving}>
                {leaving ? (
                  <ActivityIndicator size={14} color="#FFF" />
                ) : (
                  <ThemedText style={{ color: '#FFF' }}>{t('chat.leaveGroup')}</ThemedText>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
  },
  backBtn: {
    width: 36,
    alignItems: 'center',
  },
  backIcon: {
    fontSize: 20,
    color: '#000',
  },
  headerTitle: {
    ...Typography.body,
    flex: 1,
    textAlign: 'center',
    fontWeight: '600',
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
  },
  body: {
    padding: Spacing.md,
    gap: Spacing.md,
    paddingBottom: Spacing.xl,
  },
  hero: {
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.md,
  },
  heroAvatar: {
    width: 88,
    height: 88,
    borderRadius: 44,
  },
  avatarPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroName: {
    ...Typography.body,
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
  },
  adminBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 3,
    borderRadius: Radius.sm,
  },
  adminBadgeText: {
    ...Typography.caption,
    fontSize: 11,
    fontWeight: '600',
  },
  section: {
    borderRadius: Radius.md,
    padding: Spacing.md,
    gap: Spacing.sm,
  },
  sectionTitle: {
    ...Typography.caption,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.xs,
  },
  nameEditRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  nameInput: {
    flex: 1,
    borderWidth: 1,
    borderRadius: Radius.sm,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    fontSize: 14,
  },
  saveBtn: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.sm,
    alignItems: 'center',
  },
  saveBtnText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '600',
  },
  divider: {
    height: 1,
  },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.xs,
  },
  memberAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
  },
  memberInfo: {
    flex: 1,
    gap: 2,
  },
  memberTags: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  memberTag: {
    ...Typography.caption,
    fontSize: 11,
    fontWeight: '600',
  },
  leaveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.md,
    borderRadius: Radius.md,
  },
  leaveBtnText: {
    ...Typography.body,
    fontWeight: '600',
  },
  leaveOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    padding: Spacing.lg,
    zIndex: 50,
  },
  leaveOverlayBg: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  leaveDialog: {
    borderRadius: Radius.md,
    padding: Spacing.md,
    gap: Spacing.sm,
    zIndex: 51,
  },
  leaveTitle: {
    ...Typography.body,
    fontSize: 16,
    fontWeight: '700',
  },
  leaveDesc: {
    ...Typography.body,
    fontSize: 13,
  },
  radioRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
    paddingVertical: Spacing.xs,
  },
  radioTexts: {
    flex: 1,
    gap: 2,
  },
  radioDesc: {
    fontSize: 12,
  },
  leaveActions: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginTop: Spacing.sm,
  },
  leaveActionBtn: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: Spacing.sm,
    borderRadius: Radius.sm,
  },
});

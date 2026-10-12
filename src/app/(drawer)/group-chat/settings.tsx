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
  Switch,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  banGroupMember,
  getGroupChatBackground,
  getGroupSettings,
  leaveGroup,
  muteGroupMember,
  transferGroupAdmin,
  unmuteGroupMember,
  updateGroupSettings,
  type GroupChatBackground,
} from '@/api/group-chat';
import { uploadMedia } from '@/api/profile';
import { AddGroupMemberModal } from '@/components/chat/add-group-member-modal';
import { ChatBackgroundPicker } from '@/components/chat/chat-background-picker';
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
 * Cài đặt nhóm: xem info/members, admin sửa tên + ảnh, rời nhóm (P0);
 * P1 thêm: thêm thành viên, admin mute/ban/transfer, toggles
 * allow_member_add + notifications. Mirror Web GroupSettingsPanel.
 */

// Mirror Web GroupSettingsPanel MUTE_REASONS/MUTE_DURATIONS — binding oneof
// phía server (dto.MuteMemberInput). Labels qua i18n thay vì hardcode.
const MUTE_REASONS = [
  'spam',
  'abuse',
  'harassment',
  'violation',
  'other',
] as const;
const MUTE_DURATIONS = [1, 30, 60, 1440, 0] as const;

const MUTE_REASON_KEYS: Record<string, string> = {
  spam: 'chat.muteReasonSpam',
  abuse: 'chat.muteReasonAbuse',
  harassment: 'chat.muteReasonHarassment',
  violation: 'chat.muteReasonViolation',
  other: 'chat.muteReasonOther',
};
const MUTE_DURATION_KEYS: Record<number, string> = {
  1: 'chat.muteDuration1m',
  30: 'chat.muteDuration30m',
  60: 'chat.muteDuration1h',
  1440: 'chat.muteDuration24h',
  0: 'chat.muteDurationForever',
};
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

  // P1.4: modal thêm thành viên (multi-select).
  const [addMemberOpen, setAddMemberOpen] = useState(false);
  // P1.5: mute modal (target + reason/duration) và confirm dialogs.
  const [muteTarget, setMuteTarget] = useState<GroupChatMember | null>(null);
  const [muteReason, setMuteReason] = useState<string>('spam');
  const [muteDuration, setMuteDuration] = useState<number>(60);
  const [confirmBan, setConfirmBan] = useState<GroupChatMember | null>(null);
  const [confirmTransfer, setConfirmTransfer] = useState<GroupChatMember | null>(null);
  // Đang chạy 1 action admin (mute/ban/transfer/toggle) → disable nút.
  const [actionBusy, setActionBusy] = useState(false);

  // P3b: nền trò chuyện per-group.
  const [background, setBackground] = useState<GroupChatBackground | null>(
    null,
  );
  const [backgroundPickerOpen, setBackgroundPickerOpen] = useState(false);

  // Leave modal state.
  const [leaveOpen, setLeaveOpen] = useState(false);
  const [leaveMode, setLeaveMode] = useState<GroupLeaveMode>('public');
  const [leaveHistoryMode, setLeaveHistoryMode] =
    useState<GroupLeaveHistoryMode>('keep');
  const [leaving, setLeaving] = useState(false);

  // Mirror Web loadSettings — chạy mount + refetch sau mỗi action (P1).
  // Không setLoading(true) sync trong effect (lint react-hooks/set-state-in-effect);
  // loading chỉ điều khiển spinner màn hình đầu, refetch im lặng khi settings đã có.
  const loadSettings = useCallback(() => {
    if (!chatId) return;
    getGroupSettings(chatId)
      .then((res) => {
        setSettings(res.data);
        setNameValue(res.data.name);
      })
      .catch(() => {
        Alert.alert(t('common.error'));
      })
      .finally(() => {
        setLoading(false);
      });
    // P3b: load nền song song (im lặng — không block spinner).
    getGroupChatBackground(chatId)
      .then((res) => {
        const bg = res.data;
        setBackground(bg?.type ? bg : null);
      })
      .catch(() => {});
  }, [chatId, t]);

  useEffect(() => {
    if (!chatId) return;
    loadSettings();
  }, [chatId, loadSettings]);

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

  // Sort mirror Web GroupMemberList: self → admin → còn lại.
  const sortedMembers: GroupChatMember[] = [...members].sort((a, b) => {
    if (a.user_id === myUserId) return -1;
    if (b.user_id === myUserId) return 1;
    if (a.role === 'CHAT_ADMIN' && b.role !== 'CHAT_ADMIN') return -1;
    if (a.role !== 'CHAT_ADMIN' && b.role === 'CHAT_ADMIN') return 1;
    return 0;
  });

  const memberIds = new Set(members.map((m) => m.user_id));

  // ===== P1.5: admin actions (HTTP mirror Web) =====

  const runAdminAction = useCallback(
    async (action: () => Promise<unknown>, successMsg: string) => {
      if (!chatId || actionBusy) return false;
      setActionBusy(true);
      try {
        await action();
        Alert.alert(t('common.success'), successMsg);
        loadSettings();
        return true;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        Alert.alert(t('common.error'), msg || t('common.error'));
        return false;
      } finally {
        setActionBusy(false);
      }
    },
    [chatId, actionBusy, loadSettings, t],
  );

  const handleBan = useCallback(
    (member: GroupChatMember) => {
      setConfirmBan(null);
      void runAdminAction(
        () => banGroupMember(chatId!, member.user_id),
        t('chat.memberBanned'),
      );
    },
    [runAdminAction, chatId, t],
  );

  const handleConfirmMute = useCallback(async () => {
    if (!muteTarget) return;
    const ok = await runAdminAction(
      () =>
        muteGroupMember(chatId!, muteTarget.user_id, muteReason, muteDuration),
      t('chat.memberMuted'),
    );
    if (ok) {
      setMuteTarget(null);
      setMuteReason('spam');
      setMuteDuration(60);
    }
  }, [muteTarget, muteReason, muteDuration, runAdminAction, chatId, t]);

  const handleUnmute = useCallback(
    (member: GroupChatMember) => {
      void runAdminAction(
        () => unmuteGroupMember(chatId!, member.user_id),
        t('chat.memberUnmuted'),
      );
    },
    [runAdminAction, chatId, t],
  );

  const handleConfirmTransfer = useCallback(() => {
    if (!confirmTransfer) return;
    const target = confirmTransfer;
    setConfirmTransfer(null);
    void runAdminAction(
      () => transferGroupAdmin(chatId!, target.user_id),
      t('chat.adminTransferred'),
    );
  }, [confirmTransfer, runAdminAction, chatId, t]);

  // ===== P1.6: toggles =====

  const handleToggleAllowMemberAdd = useCallback(() => {
    if (!settings || actionBusy) return;
    const enabled = !settings.allow_member_add;
    void runAdminAction(
      () =>
        updateGroupSettings(chatId!, { allow_member_add: enabled }).then(
          (res) => setSettings(res.data),
        ),
      enabled ? t('chat.allowMemberAddOn') : t('chat.allowMemberAddOff'),
    );
  }, [settings, actionBusy, runAdminAction, chatId, t]);

  const handleToggleNotifications = useCallback(() => {
    if (!settings || actionBusy) return;
    const enabled = !settings.member_settings.notifications_enabled;
    void runAdminAction(
      () =>
        updateGroupSettings(chatId!, {
          notifications_enabled: enabled,
        }).then((res) => setSettings(res.data)),
      enabled ? t('chat.notificationsOn') : t('chat.notificationsOff'),
    );
  }, [settings, actionBusy, runAdminAction, chatId, t]);

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

          {/* Thêm thành viên — hiện cho mọi member (server tự enforce
              allow_member_add: nếu tắt thì chỉ admin được mời) */}
          <View style={[styles.section, { backgroundColor: theme.card }]}>
            <ThemedText themeColor="textSecondary" style={styles.sectionTitle}>
              {t('chat.addMember')}
            </ThemedText>
            <Pressable
              onPress={() => setAddMemberOpen(true)}
              style={styles.settingRow}>
              <Icon name="personAdd" size={18} color={theme.primary} />
              <ThemedText style={{ flex: 1, color: theme.text }}>
                {t('chat.addMembers')}
              </ThemedText>
              <Icon name="chevronRight" size={16} color={theme.textSecondary} />
            </Pressable>
          </View>

          {/* Danh sách thành viên */}
          <View style={[styles.section, { backgroundColor: theme.card }]}>
            <ThemedText themeColor="textSecondary" style={styles.sectionTitle}>
              {t('chat.groupMembers')}
            </ThemedText>
            {sortedMembers.map((m) => {
              const isSelf = m.user_id === myUserId;
              const memberIsAdmin = m.role === 'CHAT_ADMIN';
              // Mirror Web GroupMemberList: admin thấy action với non-admin khác.
              const showActions = isAdmin && !isSelf && !memberIsAdmin;
              return (
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
                      {isSelf ? ` (${t('chat.you')})` : ''}
                    </ThemedText>
                    <View style={styles.memberTags}>
                      {memberIsAdmin && (
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
                  {showActions && (
                    <View style={styles.memberActions}>
                      <Pressable
                        hitSlop={6}
                        disabled={actionBusy}
                        onPress={() =>
                          m.is_muted
                            ? handleUnmute(m)
                            : setMuteTarget(m)
                        }>
                        <Icon
                          name={m.is_muted ? 'volumeHigh' : 'volumeMute'}
                          size={18}
                          color={m.is_muted ? theme.primary : theme.textSecondary}
                        />
                      </Pressable>
                      <Pressable
                        hitSlop={6}
                        disabled={actionBusy}
                        onPress={() => setConfirmBan(m)}>
                        <Icon name="ban" size={18} color={theme.danger} />
                      </Pressable>
                      <Pressable
                        hitSlop={6}
                        disabled={actionBusy}
                        onPress={() => setConfirmTransfer(m)}>
                        <Icon name="star" size={18} color={theme.primary} />
                      </Pressable>
                    </View>
                  )}
                </View>
              );
            })}
          </View>

          {/* Admin settings toggle (chỉ admin) */}
          {isAdmin && (
            <View style={[styles.section, { backgroundColor: theme.card }]}>
              <ThemedText themeColor="textSecondary" style={styles.sectionTitle}>
                {t('chat.adminSettings')}
              </ThemedText>
              <View style={styles.toggleRow}>
                <ThemedText style={{ flex: 1, color: theme.text }}>
                  {t('chat.allowMemberAdd')}
                </ThemedText>
                <Switch
                  value={settings.allow_member_add}
                  onValueChange={() => handleToggleAllowMemberAdd()}
                  disabled={actionBusy}
                  trackColor={{ false: theme.border, true: theme.primaryLight }}
                  thumbColor={settings.allow_member_add ? theme.primary : undefined}
                />
              </View>
            </View>
          )}

          {/* Notifications toggle (per-member, mọi member) */}
          <View style={[styles.section, { backgroundColor: theme.card }]}>
            <ThemedText themeColor="textSecondary" style={styles.sectionTitle}>
              {t('chat.notificationSettings')}
            </ThemedText>
            <View style={styles.toggleRow}>
              <ThemedText style={{ flex: 1, color: theme.text }}>
                {t('chat.notifications')}
              </ThemedText>
              <Switch
                value={settings.member_settings.notifications_enabled}
                onValueChange={() => handleToggleNotifications()}
                disabled={actionBusy}
                trackColor={{ false: theme.border, true: theme.primaryLight }}
                thumbColor={
                  settings.member_settings.notifications_enabled
                    ? theme.primary
                    : undefined
                }
              />
            </View>
          </View>

          {/* Nội dung đã chia sẻ — media/files/links/posts trong nhóm */}
          <View style={[styles.section, { backgroundColor: theme.card }]}>
            <ThemedText themeColor="textSecondary" style={styles.sectionTitle}>
              {t('chat.sharedContent')}
            </ThemedText>
            <Pressable
              onPress={() => {
                if (!chatId) return;
                (router as any).push({
                  pathname: '/(drawer)/group-chat/shared-content',
                  params: { chatId },
                });
              }}
              style={styles.settingRow}>
              <Icon name="images" size={18} color={theme.primary} />
              <ThemedText style={{ flex: 1, color: theme.text }}>
                {t('chat.sharedContent')}
              </ThemedText>
              <Icon name="chevronRight" size={16} color={theme.textSecondary} />
            </Pressable>
          </View>

          {/* Nền trò chuyện per-group */}
          <View style={[styles.section, { backgroundColor: theme.card }]}>
            <ThemedText themeColor="textSecondary" style={styles.sectionTitle}>
              {t('chat.background')}
            </ThemedText>
            <Pressable
              onPress={() => setBackgroundPickerOpen(true)}
              style={styles.settingRow}>
              <Icon name="palette" size={18} color={theme.primary} />
              <ThemedText style={{ flex: 1, color: theme.text }}>
                {background?.value
                  ? background.type === 'solid'
                    ? background.value
                    : t('chat.backgroundApplied')
                  : t('chat.backgroundDefault')}
              </ThemedText>
              {background?.type === 'solid' && background.value ? (
                <View
                  style={[
                    styles.bgSwatch,
                    { backgroundColor: background.value, borderColor: theme.border },
                  ]}
                />
              ) : null}
              <Icon name="chevronRight" size={16} color={theme.textSecondary} />
            </Pressable>
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

      {/* Thêm thành viên (multi-select modal) */}
      <AddGroupMemberModal
        visible={addMemberOpen}
        onClose={() => setAddMemberOpen(false)}
        chatId={chatId ?? ''}
        memberIds={memberIds}
        onMembersAdded={loadSettings}
      />

      {/* Background picker (P3b) */}
      <ChatBackgroundPicker
        visible={backgroundPickerOpen}
        onClose={() => setBackgroundPickerOpen(false)}
        chatId={chatId ?? ''}
        currentBackground={background}
        onApplied={(bg) => {
          setBackground(bg);
          notifyChatListDirty(); // conversations list có background_type → refresh
        }}
      />

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

      {/* Mute modal — lý do × thời hạn (radio pattern như leave modal,
          mirror Web selects) */}
      {muteTarget && (
        <View style={styles.leaveOverlay}>
          <Pressable
            style={styles.leaveOverlayBg}
            onPress={() => !actionBusy && setMuteTarget(null)}
          />
          <View style={[styles.leaveDialog, { backgroundColor: theme.card }]}>
            <ThemedText style={[styles.leaveTitle, { color: theme.text }]}>
              {t('chat.muteMember')}
            </ThemedText>
            <ThemedText themeColor="textSecondary" style={styles.leaveDesc}>
              {muteTarget.display_name}
            </ThemedText>

            <ThemedText themeColor="textSecondary" style={styles.dialogLabel}>
              {t('chat.muteReason')}
            </ThemedText>
            {MUTE_REASONS.map((reason) => (
              <Pressable
                key={reason}
                onPress={() => setMuteReason(reason)}
                style={styles.radioRow}>
                <Icon
                  name={muteReason === reason ? 'checkCircle' : 'close'}
                  size={18}
                  color={muteReason === reason ? theme.primary : theme.textSecondary}
                />
                <ThemedText style={{ flex: 1, color: theme.text }}>
                  {t(MUTE_REASON_KEYS[reason])}
                </ThemedText>
              </Pressable>
            ))}

            <ThemedText themeColor="textSecondary" style={styles.dialogLabel}>
              {t('chat.muteDuration')}
            </ThemedText>
            {MUTE_DURATIONS.map((duration) => (
              <Pressable
                key={duration}
                onPress={() => setMuteDuration(duration)}
                style={styles.radioRow}>
                <Icon
                  name={muteDuration === duration ? 'checkCircle' : 'close'}
                  size={18}
                  color={
                    muteDuration === duration ? theme.primary : theme.textSecondary
                  }
                />
                <ThemedText style={{ flex: 1, color: theme.text }}>
                  {t(MUTE_DURATION_KEYS[duration])}
                </ThemedText>
              </Pressable>
            ))}

            <View style={styles.leaveActions}>
              <Pressable
                style={[
                  styles.leaveActionBtn,
                  { backgroundColor: theme.bgSecondary },
                ]}
                onPress={() => setMuteTarget(null)}
                disabled={actionBusy}>
                <ThemedText style={{ color: theme.text }}>
                  {t('common.cancel')}
                </ThemedText>
              </Pressable>
              <Pressable
                style={[
                  styles.leaveActionBtn,
                  { backgroundColor: theme.primary },
                ]}
                onPress={() => void handleConfirmMute()}
                disabled={actionBusy}>
                {actionBusy ? (
                  <ActivityIndicator size={14} color="#FFF" />
                ) : (
                  <ThemedText style={{ color: '#FFF' }}>
                    {t('chat.mute')}
                  </ThemedText>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      )}

      {/* Confirm ban */}
      {confirmBan && (
        <View style={styles.leaveOverlay}>
          <Pressable
            style={styles.leaveOverlayBg}
            onPress={() => !actionBusy && setConfirmBan(null)}
          />
          <View style={[styles.leaveDialog, { backgroundColor: theme.card }]}>
            <ThemedText style={[styles.leaveTitle, { color: theme.text }]}>
              {t('chat.confirmBan')}
            </ThemedText>
            <ThemedText themeColor="textSecondary" style={styles.leaveDesc}>
              {t('chat.confirmBanMessage', {
                name: confirmBan.display_name,
              })}
            </ThemedText>
            <View style={styles.leaveActions}>
              <Pressable
                style={[
                  styles.leaveActionBtn,
                  { backgroundColor: theme.bgSecondary },
                ]}
                onPress={() => setConfirmBan(null)}
                disabled={actionBusy}>
                <ThemedText style={{ color: theme.text }}>
                  {t('common.cancel')}
                </ThemedText>
              </Pressable>
              <Pressable
                style={[styles.leaveActionBtn, { backgroundColor: theme.danger }]}
                onPress={() => handleBan(confirmBan)}
                disabled={actionBusy}>
                {actionBusy ? (
                  <ActivityIndicator size={14} color="#FFF" />
                ) : (
                  <ThemedText style={{ color: '#FFF' }}>
                    {t('chat.ban')}
                  </ThemedText>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      )}

      {/* Confirm transfer admin */}
      {confirmTransfer && (
        <View style={styles.leaveOverlay}>
          <Pressable
            style={styles.leaveOverlayBg}
            onPress={() => !actionBusy && setConfirmTransfer(null)}
          />
          <View style={[styles.leaveDialog, { backgroundColor: theme.card }]}>
            <ThemedText style={[styles.leaveTitle, { color: theme.text }]}>
              {t('chat.confirmTransferAdmin')}
            </ThemedText>
            <ThemedText themeColor="textSecondary" style={styles.leaveDesc}>
              {t('chat.confirmTransferAdminMessage', {
                name: confirmTransfer.display_name,
              })}
            </ThemedText>
            <View style={styles.leaveActions}>
              <Pressable
                style={[
                  styles.leaveActionBtn,
                  { backgroundColor: theme.bgSecondary },
                ]}
                onPress={() => setConfirmTransfer(null)}
                disabled={actionBusy}>
                <ThemedText style={{ color: theme.text }}>
                  {t('common.cancel')}
                </ThemedText>
              </Pressable>
              <Pressable
                style={[
                  styles.leaveActionBtn,
                  { backgroundColor: theme.primary },
                ]}
                onPress={handleConfirmTransfer}
                disabled={actionBusy}>
                {actionBusy ? (
                  <ActivityIndicator size={14} color="#FFF" />
                ) : (
                  <ThemedText style={{ color: '#FFF' }}>
                    {t('chat.transferAdmin')}
                  </ThemedText>
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
  bgSwatch: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: StyleSheet.hairlineWidth,
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
  memberActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.xs,
  },
  dialogLabel: {
    ...Typography.caption,
    fontWeight: '600',
    textTransform: 'uppercase',
    marginTop: Spacing.xs,
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

import { useCallback, useState } from 'react';
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
import { Image } from 'expo-image';
import { useFocusEffect, useRouter } from 'expo-router';

import {
  communityErrorText,
  getCommunityMembers,
  kickMember,
  updateMemberRole,
} from '@/api/communities';
import { ThemedText } from '@/components/themed-text';
import { Icon } from '@/components/ui/icon';
import { Radius, Spacing } from '@/constants/spacing';
import { Typography } from '@/constants/typography';
import { useTheme } from '@/hooks/use-theme';
import { useShimmer } from '@/hooks/use-shimmer';
import { useTranslation } from '@/hooks/useTranslation';
import type {
  CommunityMember,
  CommunityRole,
  ManageableRole,
} from '@/types/community';

const SKELETON_ROWS = 5;
const ROLE_OPTIONS: ManageableRole[] = ['GROUP_ADMIN', 'GROUP_MOD', 'GROUP_MEMBER'];

interface MemberListProps {
  communityId: string;
  isAdmin: boolean;
}

const roleLabelKey = (role: CommunityRole): string =>
  role === 'COMMUNITY_ADMIN' || role === 'GROUP_ADMIN'
    ? 'communities.roleAdmin'
    : role === 'GROUP_MOD'
      ? 'communities.roleMod'
      : 'communities.roleMember';

function RoleBadge({ role, theme }: { role: CommunityRole; theme: ReturnType<typeof useTheme> }) {
  const { t } = useTranslation();
  const isAdminRole = role === 'COMMUNITY_ADMIN' || role === 'GROUP_ADMIN';
  const isMod = role === 'GROUP_MOD';
  const bg = isAdminRole
    ? theme.primaryLight
    : isMod
      ? 'rgba(255, 111, 0, 0.14)'
      : theme.bgSecondary;
  const color = isAdminRole ? theme.primary : isMod ? theme.accent : theme.textSecondary;
  return (
    <View style={[styles.roleBadge, { backgroundColor: bg }]}>
      <ThemedText style={[styles.roleBadgeText, { color }]}>{t(roleLabelKey(role))}</ThemedText>
    </View>
  );
}

/** Port CommunityMemberList — danh sách thành viên + admin: đổi vai trò / kick. */
export default function MemberList({ communityId, isAdmin }: MemberListProps) {
  const { t } = useTranslation();
  const theme = useTheme();
  const shimmer = useShimmer();
  const router = useRouter();

  const [members, setMembers] = useState<CommunityMember[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [menuMember, setMenuMember] = useState<CommunityMember | null>(null);
  const [kickTarget, setKickTarget] = useState<CommunityMember | null>(null);
  const [kickReason, setKickReason] = useState('');

  const load = useCallback(async () => {
    try {
      const res = await getCommunityMembers(communityId);
      setMembers(res.members);
      setLoadError(null);
    } catch (err) {
      setMembers((prev) => prev ?? []);
      setLoadError(communityErrorText(err, t('common.error')));
    }
  }, [communityId, t]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const handleChangeRole = useCallback(
    async (member: CommunityMember, role: ManageableRole) => {
      setMenuMember(null);
      setBusy(true);
      try {
        await updateMemberRole(communityId, member.user_id, role);
        Alert.alert(t('common.success'), t('communities.roleChanged'));
        await load();
      } catch (err) {
        Alert.alert(t('common.error'), communityErrorText(err, t('communities.roleError')));
      } finally {
        setBusy(false);
      }
    },
    [communityId, load, t],
  );

  const handleKick = useCallback(async () => {
    if (!kickTarget || !kickReason.trim() || busy) return;
    setBusy(true);
    try {
      await kickMember(communityId, kickTarget.user_id, kickReason.trim());
      Alert.alert(t('common.success'), t('communities.kicked'));
      setKickTarget(null);
      setKickReason('');
      await load();
    } catch (err) {
      Alert.alert(t('common.error'), communityErrorText(err, t('communities.kickError')));
    } finally {
      setBusy(false);
    }
  }, [busy, communityId, kickReason, kickTarget, load, t]);

  const closeKick = useCallback(() => {
    if (busy) return;
    setKickTarget(null);
    setKickReason('');
  }, [busy]);

  const openProfile = (userId: string) =>
    (router as any).push(`/(drawer)/profile/${userId}`);

  const renderRow = ({ item: member }: { item: CommunityMember }) => {
    const canModerate = isAdmin && member.role !== 'COMMUNITY_ADMIN';
    return (
      <Pressable
        onPress={() => openProfile(member.user_id)}
        style={({ pressed }) => [
          styles.row,
          { backgroundColor: pressed ? theme.bgHover : theme.card, borderColor: theme.border },
        ]}>
        {member.avatar_uri ? (
          <Image source={{ uri: member.avatar_uri }} style={styles.avatar} contentFit="cover" />
        ) : (
          <View style={[styles.avatar, styles.avatarFallback, { backgroundColor: theme.bgSecondary }]}>
            <Icon name="person" size={20} color={theme.textSecondary} />
          </View>
        )}
        <View style={styles.rowInfo}>
          <ThemedText numberOfLines={1} style={styles.rowName}>
            {member.display_name}
          </ThemedText>
        </View>
        <RoleBadge role={member.role} theme={theme} />
        {canModerate && (
          <Pressable
            hitSlop={8}
            disabled={busy}
            onPress={() => setMenuMember(member)}
            style={({ pressed }) => [styles.moreBtn, pressed && styles.pressed]}>
            <Icon name="more" size={18} color={theme.textSecondary} />
          </Pressable>
        )}
      </Pressable>
    );
  };

  const content = () => {
    if (members === null && !loadError) {
      return (
        <View style={styles.list}>
          {Array.from({ length: SKELETON_ROWS }).map((_, i) => (
            <View
              key={i}
              style={[
                styles.row,
                {
                  backgroundColor: theme.card,
                  borderColor: theme.border,
                  opacity: shimmer,
                },
              ]}>
              <View style={[styles.avatar, styles.avatarFallback, { backgroundColor: theme.bgSecondary }]} />
              <View style={[styles.skeletonLine, { backgroundColor: theme.bgSecondary }]} />
            </View>
          ))}
        </View>
      );
    }
    if (loadError && (!members || members.length === 0)) {
      return (
        <View style={styles.stateWrap}>
          <ThemedText themeColor="textSecondary" style={styles.stateText}>
            {loadError}
          </ThemedText>
          <Pressable
            onPress={() => {
              setMembers(null);
              setLoadError(null);
              void load();
            }}
            style={({ pressed }) => [
              styles.retryBtn,
              { backgroundColor: theme.primary },
              pressed && styles.pressed,
            ]}>
            <ThemedText style={[styles.retryText, { color: theme.textOnPrimary }]}>{t('common.retry')}</ThemedText>
          </Pressable>
        </View>
      );
    }
    if (members && members.length === 0) {
      return (
        <View style={styles.stateWrap}>
          <Icon name="people" size={32} color={theme.textSecondary} />
          <ThemedText themeColor="textSecondary" style={styles.stateText}>
            {t('communities.noMembers')}
          </ThemedText>
        </View>
      );
    }
    return (
      <FlatList
        data={members ?? []}
        keyExtractor={(m) => m.user_id}
        renderItem={renderRow}
        contentContainerStyle={styles.list}
        keyboardShouldPersistTaps="handled"
      />
    );
  };

  return (
    <View style={styles.wrap}>
      {content()}

      {/* Menu hành động admin: đổi vai trò / kick */}
      <Modal
        visible={menuMember !== null}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() => setMenuMember(null)}>
        <Pressable style={styles.backdrop} onPress={() => setMenuMember(null)}>
          <Pressable
            style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}
            onPress={(e) => e.stopPropagation()}>
            {menuMember && (
              <>
                <View style={styles.menuHead}>
                  {menuMember.avatar_uri ? (
                    <Image
                      source={{ uri: menuMember.avatar_uri }}
                      style={styles.menuAvatar}
                      contentFit="cover"
                    />
                  ) : (
                    <View
                      style={[
                        styles.menuAvatar,
                        styles.avatarFallback,
                        { backgroundColor: theme.bgSecondary },
                      ]}>
                      <Icon name="person" size={16} color={theme.textSecondary} />
                    </View>
                  )}
                  <ThemedText numberOfLines={1} style={styles.menuName}>
                    {menuMember.display_name}
                  </ThemedText>
                </View>

                {ROLE_OPTIONS.map((role) => {
                  const active = menuMember.role === role;
                  return (
                    <Pressable
                      key={role}
                      disabled={busy}
                      onPress={() => void handleChangeRole(menuMember, role)}
                      style={({ pressed }) => [
                        styles.menuItem,
                        { borderColor: theme.border },
                        pressed && styles.pressed,
                      ]}>
                      <ThemedText
                        style={[styles.menuItemText, active && { color: theme.primary }]}>
                        {t(roleLabelKey(role))}
                      </ThemedText>
                      {active && <Icon name="check" size={16} color={theme.primary} />}
                    </Pressable>
                  );
                })}

                <Pressable
                  disabled={busy}
                  onPress={() => {
                    const target = menuMember;
                    setMenuMember(null);
                    setKickTarget(target);
                  }}
                  style={({ pressed }) => [styles.menuItem, { borderColor: theme.border }, pressed && styles.pressed]}>
                  <ThemedText style={[styles.menuItemText, { color: theme.danger }]}>
                    {t('communities.kickConfirm')}
                  </ThemedText>
                  <Icon name="ban" size={16} color={theme.danger} />
                </Pressable>

                <Pressable
                  onPress={() => setMenuMember(null)}
                  style={({ pressed }) => [styles.menuCancel, pressed && styles.pressed]}>
                  <ThemedText style={styles.menuCancelText}>{t('common.cancel')}</ThemedText>
                </Pressable>
              </>
            )}
          </Pressable>
        </Pressable>
      </Modal>

      {/* Modal kick: yêu cầu lý do */}
      <Modal
        visible={kickTarget !== null}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={closeKick}>
        <Pressable style={styles.backdrop} onPress={closeKick}>
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            style={styles.centerWrap}>
            <Pressable
              style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}
              onPress={(e) => e.stopPropagation()}>
              <ThemedText style={styles.kickTitle}>{t('communities.kickConfirm')}</ThemedText>
              {kickTarget && (
                <View style={styles.kickMember}>
                  {kickTarget.avatar_uri ? (
                    <Image
                      source={{ uri: kickTarget.avatar_uri }}
                      style={styles.menuAvatar}
                      contentFit="cover"
                    />
                  ) : (
                    <View
                      style={[
                        styles.menuAvatar,
                        styles.avatarFallback,
                        { backgroundColor: theme.bgSecondary },
                      ]}>
                      <Icon name="person" size={16} color={theme.textSecondary} />
                    </View>
                  )}
                  <ThemedText numberOfLines={1} style={styles.menuName}>
                    {kickTarget.display_name}
                  </ThemedText>
                </View>
              )}
              <ThemedText themeColor="textSecondary" style={styles.kickLabel}>
                {t('communities.kickReason')}
              </ThemedText>
              <TextInput
                style={[
                  styles.kickInput,
                  {
                    backgroundColor: theme.bgSecondary,
                    borderColor: theme.border,
                    color: theme.text,
                  },
                ]}
                value={kickReason}
                onChangeText={setKickReason}
                placeholder={t('communities.kickReason')}
                placeholderTextColor={theme.textSecondary}
                maxLength={500}
                multiline
                numberOfLines={3}
                editable={!busy}
              />
              <View style={styles.kickActions}>
                <Pressable
                  onPress={closeKick}
                  disabled={busy}
                  style={({ pressed }) => [
                    styles.kickCancel,
                    { borderColor: theme.border },
                    pressed && styles.pressed,
                  ]}>
                  <ThemedText style={styles.kickCancelText}>{t('common.cancel')}</ThemedText>
                </Pressable>
                <Pressable
                  onPress={() => void handleKick()}
                  disabled={busy || !kickReason.trim()}
                  style={({ pressed }) => [
                    styles.kickSubmit,
                    {
                      backgroundColor: theme.danger,
                      opacity: busy || !kickReason.trim() ? 0.6 : 1,
                    },
                    pressed && styles.pressed,
                  ]}>
                  {busy ? (
                    <ActivityIndicator size="small" color={theme.textOnPrimary} />
                  ) : (
                    <ThemedText style={[styles.kickSubmitText, { color: theme.textOnPrimary }]}>{t('communities.kick')}</ThemedText>
                  )}
                </Pressable>
              </View>
            </Pressable>
          </KeyboardAvoidingView>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
  },
  list: {
    padding: Spacing.md,
    gap: Spacing.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    borderWidth: 1,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.sm + 4,
    paddingVertical: Spacing.sm,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    overflow: 'hidden',
  },
  avatarFallback: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowInfo: {
    flex: 1,
    minWidth: 0,
  },
  rowName: {
    ...Typography.body,
    fontWeight: '600',
  },
  roleBadge: {
    borderRadius: Radius.pill,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 3,
  },
  roleBadgeText: {
    ...Typography.caption,
    fontWeight: '700',
    fontSize: 11,
  },
  moreBtn: {
    paddingHorizontal: Spacing.xs,
  },
  skeletonLine: {
    flex: 1,
    height: 14,
    borderRadius: Radius.sm,
  },
  stateWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.md,
    paddingVertical: Spacing.xl * 2,
    paddingHorizontal: Spacing.lg,
  },
  stateText: {
    ...Typography.body,
    textAlign: 'center',
  },
  retryBtn: {
    borderRadius: Radius.pill,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
  },
  retryText: {
    ...Typography.body,
    fontWeight: '600',
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    paddingHorizontal: Spacing.xl,
  },
  centerWrap: {
    width: '100%',
  },
  card: {
    borderRadius: Radius.lg,
    borderWidth: 1,
    padding: Spacing.md,
    gap: Spacing.sm,
  },
  menuHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.xs,
  },
  menuAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    overflow: 'hidden',
  },
  menuName: {
    ...Typography.body,
    fontWeight: '600',
    flex: 1,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    paddingVertical: Spacing.sm + 2,
  },
  menuItemText: {
    ...Typography.body,
    fontWeight: '600',
  },
  menuCancel: {
    alignItems: 'center',
    paddingVertical: Spacing.sm,
    marginTop: Spacing.xs,
  },
  menuCancelText: {
    ...Typography.body,
    fontWeight: '600',
  },
  kickTitle: {
    ...Typography.h2,
    fontSize: 17,
  },
  kickMember: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  kickLabel: {
    ...Typography.caption,
  },
  kickInput: {
    borderWidth: 1,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.sm + 4,
    paddingVertical: Spacing.sm,
    ...Typography.body,
    fontSize: 14,
    minHeight: 76,
    textAlignVertical: 'top',
  },
  kickActions: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginTop: Spacing.xs,
  },
  kickCancel: {
    flex: 1,
    borderWidth: 1,
    borderRadius: Radius.pill,
    paddingVertical: Spacing.sm + 2,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 42,
  },
  kickCancelText: {
    ...Typography.body,
    fontWeight: '600',
  },
  kickSubmit: {
    flex: 1,
    borderRadius: Radius.pill,
    paddingVertical: Spacing.sm + 2,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 42,
  },
  kickSubmitText: {
    ...Typography.body,
    fontWeight: '600',
  },
  pressed: {
    opacity: 0.8,
  },
});

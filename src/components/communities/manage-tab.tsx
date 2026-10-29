import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Clipboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  TextInput,
  View
} from 'react-native';
import { Image } from 'expo-image';
import { useFocusEffect } from 'expo-router';

import { showAlert } from '@/utils/alert';
import {
  approveJoinRequest,
  communityErrorText,
  createInviteCode,
  deactivateInviteCode,
  listInviteCodes,
  listJoinRequests,
  rejectJoinRequest,
  transferOwnership,
  updateCommunity,
} from '@/api/communities';
import { getContributionPolicy, updateContributionPolicy } from '@/api/contribution';
import { ThemedText } from '@/components/themed-text';
import { Icon } from '@/components/ui/icon';
import { Radius, Spacing } from '@/constants/spacing';
import { Typography } from '@/constants/typography';
import { useTheme } from '@/hooks/use-theme';
import { useShimmer } from '@/hooks/use-shimmer';
import { useTranslation } from '@/hooks/useTranslation';
import type {
  CommunityDetail,
  CommunityInviteCode,
  CommunityJoinRequest,
  CommunityPrivacy,
} from '@/types/community';
import type { ContributionPolicy } from '@/types/contribution';

type ManageSection = 'settings' | 'policy' | 'requests' | 'codes' | 'transfer';

const SECTIONS: {
  key: ManageSection;
  labelKey: string;
  icon: 'settings' | 'medal' | 'personAdd' | 'key' | 'share';
}[] = [
  { key: 'settings', labelKey: 'communities.settings', icon: 'settings' },
  { key: 'policy', labelKey: 'contribution.policyTitle', icon: 'medal' },
  { key: 'requests', labelKey: 'communities.joinRequests', icon: 'personAdd' },
  { key: 'codes', labelKey: 'communities.inviteCodes', icon: 'key' },
  { key: 'transfer', labelKey: 'communities.transferOwnership', icon: 'share' },
];

interface ManageTabProps {
  communityId: string;
  community: CommunityDetail;
  onUpdate: () => void;
}

/** Port CommunityManageTab — 5 section: settings / policy / join-requests / invite-codes / transfer. */
export default function ManageTab({ communityId, community, onUpdate }: ManageTabProps) {
  const { t } = useTranslation();
  const theme = useTheme();
  const [section, setSection] = useState<ManageSection>('settings');

  return (
    <View style={styles.wrap}>
      <View style={styles.nav}>
        {SECTIONS.map((item) => {
          const active = section === item.key;
          return (
            <Pressable
              key={item.key}
              onPress={() => setSection(item.key)}
              style={({ pressed }) => [
                styles.navChip,
                {
                  backgroundColor: active ? theme.primary : theme.bgSecondary,
                  borderColor: active ? theme.primary : theme.border,
                },
                pressed && styles.pressed,
              ]}>
              <Icon
                name={item.icon}
                size={14}
                color={active ? theme.textOnPrimary : theme.textSecondary}
              />
              <ThemedText
                numberOfLines={1}
                style={[
                  styles.navChipText,
                  { color: active ? theme.textOnPrimary : theme.text },
                ]}>
                {t(item.labelKey)}
              </ThemedText>
            </Pressable>
          );
        })}
      </View>

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {section === 'settings' && (
          <SettingsSection communityId={communityId} community={community} onUpdate={onUpdate} />
        )}
        {section === 'policy' && <PolicySection communityId={communityId} />}
        {section === 'requests' && <RequestsSection communityId={communityId} />}
        {section === 'codes' && <CodesSection communityId={communityId} />}
        {section === 'transfer' && <TransferSection communityId={communityId} onUpdate={onUpdate} />}
      </ScrollView>
    </View>
  );
}

/* ---------------------------------- Settings ---------------------------------- */

function SettingsSection({
  communityId,
  community,
  onUpdate,
}: {
  communityId: string;
  community: CommunityDetail;
  onUpdate: () => void;
}) {
  const { t } = useTranslation();
  const theme = useTheme();

  const [name, setName] = useState(community.name);
  const [description, setDescription] = useState(community.description);
  const [privacy, setPrivacy] = useState<CommunityPrivacy>(community.privacy);
  const [autoApprove, setAutoApprove] = useState(community.auto_approve);
  const [loading, setLoading] = useState(false);

  const nameValid = name.trim().length >= 3;

  const handleSave = useCallback(async () => {
    if (!nameValid || loading) return;
    setLoading(true);
    try {
      await updateCommunity(communityId, {
        name: name.trim(),
        description: description.trim(),
        privacy,
        auto_approve: autoApprove,
      });
      showAlert(t('common.success'), t('communities.settingsSaved'));
      onUpdate();
    } catch (err) {
      showAlert(t('common.error'), communityErrorText(err, t('communities.settingsError')));
    } finally {
      setLoading(false);
    }
  }, [autoApprove, communityId, description, loading, name, nameValid, onUpdate, privacy, t]);

  const privacyOptions: { value: CommunityPrivacy; icon: 'globe' | 'lock'; labelKey: string }[] = [
    { value: 'public', icon: 'globe', labelKey: 'communities.privacyPublic' },
    { value: 'invitation_only', icon: 'lock', labelKey: 'communities.privacyInvitation' },
  ];

  return (
    <View style={styles.section}>
      <ThemedText themeColor="textSecondary" style={styles.label}>
        {t('communities.settingsName')}
      </ThemedText>
      <TextInput
        style={[styles.input, fieldStyle(theme)]}
        value={name}
        onChangeText={setName}
        maxLength={100}
        editable={!loading}
        placeholder={t('communities.settingsName')}
        placeholderTextColor={theme.textSecondary}
      />
      <ThemedText themeColor="textSecondary" style={styles.hint}>
        {name.length}/100
      </ThemedText>

      <ThemedText themeColor="textSecondary" style={styles.label}>
        {t('communities.settingsDesc')}
      </ThemedText>
      <TextInput
        style={[styles.input, styles.textarea, fieldStyle(theme)]}
        value={description}
        onChangeText={setDescription}
        maxLength={500}
        multiline
        editable={!loading}
        placeholder={t('communities.settingsDesc')}
        placeholderTextColor={theme.textSecondary}
      />
      <ThemedText themeColor="textSecondary" style={styles.hint}>
        {description.length}/500
      </ThemedText>

      <ThemedText themeColor="textSecondary" style={styles.label}>
        {t('communities.settingsPrivacy')}
      </ThemedText>
      <View style={styles.chips}>
        {privacyOptions.map((opt) => {
          const active = privacy === opt.value;
          return (
            <Pressable
              key={opt.value}
              disabled={loading}
              onPress={() => setPrivacy(opt.value)}
              style={({ pressed }) => [
                styles.chip,
                {
                  backgroundColor: active ? theme.primaryLight : theme.bgSecondary,
                  borderColor: active ? theme.primary : theme.border,
                },
                pressed && styles.pressed,
              ]}>
              <Icon name={opt.icon} size={14} color={active ? theme.primary : theme.textSecondary} />
              <ThemedText style={[styles.chipText, { color: active ? theme.primary : theme.text }]}>
                {t(opt.labelKey)}
              </ThemedText>
            </Pressable>
          );
        })}
      </View>

      <ThemedText themeColor="textSecondary" style={styles.label}>
        {t('communities.settingsAutoApprove')}
      </ThemedText>
      <View style={styles.toggleRow}>
        <Switch
          value={autoApprove}
          onValueChange={setAutoApprove}
          disabled={loading}
          trackColor={{ true: theme.primary, false: theme.border }}
          thumbColor={theme.textOnPrimary}
        />
        <ThemedText style={styles.toggleLabel}>
          {autoApprove ? t('communities.autoApproveOn') : t('communities.autoApproveOff')}
        </ThemedText>
      </View>

      <Pressable
        onPress={() => void handleSave()}
        disabled={loading || !nameValid}
        style={({ pressed }) => [
          styles.primaryBtn,
          {
            backgroundColor: theme.primary,
            opacity: loading || !nameValid ? 0.6 : 1,
          },
          pressed && styles.pressed,
        ]}>
        {loading ? (
          <ActivityIndicator size="small" color={theme.textOnPrimary} />
        ) : (
          <ThemedText style={[styles.primaryBtnText, { color: theme.textOnPrimary }]}>{t('communities.settingsSave')}</ThemedText>
        )}
      </Pressable>
    </View>
  );
}

/* ---------------------------------- Policy ---------------------------------- */

function PolicySection({ communityId }: { communityId: string }) {
  const { t } = useTranslation();
  const theme = useTheme();
  const shimmer = useShimmer();

  const [policy, setPolicy] = useState<ContributionPolicy | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await getContributionPolicy(communityId);
      setPolicy(res.data);
      setLoadError(null);
    } catch (err) {
      setPolicy(null);
      setLoadError(communityErrorText(err, t('contribution.policyError')));
    }
  }, [communityId, t]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  if (policy === null && !loadError) {
    return (
      <Animated.View style={[styles.section, { opacity: shimmer }]}>
        {Array.from({ length: 4 }).map((_, i) => (
          <View key={i} style={[styles.skeletonLine, { backgroundColor: theme.bgSecondary }]} />
        ))}
      </Animated.View>
    );
  }

  if (loadError || !policy) {
    return (
      <View style={styles.section}>
        <Icon name="warning" size={28} color={theme.accent} />
        <ThemedText themeColor="textSecondary" style={styles.hint}>
          {loadError ?? t('contribution.policyError')}
        </ThemedText>
        <Pressable
          onPress={() => {
            setLoadError(null);
            void load();
          }}
          style={({ pressed }) => [styles.primaryBtn, { backgroundColor: theme.primary }, pressed && styles.pressed]}>
          <ThemedText style={[styles.primaryBtnText, { color: theme.textOnPrimary }]}>
            {t('common.retry')}
          </ThemedText>
        </Pressable>
      </View>
    );
  }

  return <PolicyForm communityId={communityId} initial={policy} onSaved={() => void load()} />;
}

function PolicyForm({
  communityId,
  initial,
  onSaved,
}: {
  communityId: string;
  initial: ContributionPolicy;
  onSaved: () => void;
}) {
  const { t } = useTranslation();
  const theme = useTheme();

  const [postWeight, setPostWeight] = useState(String(initial.post_weight));
  const [commentWeight, setCommentWeight] = useState(String(initial.comment_weight));
  const [reactionWeight, setReactionWeight] = useState(String(initial.reaction_weight));
  const [eventWeight, setEventWeight] = useState(String(initial.event_weight));
  const [topThreshold, setTopThreshold] = useState(String(initial.top_contributor_threshold));
  const [modThreshold, setModThreshold] = useState(String(initial.moderator_promotion_threshold));
  const [autoPromote, setAutoPromote] = useState(initial.auto_promote_enabled);
  const [badgeEnabled, setBadgeEnabled] = useState(initial.badge_enabled);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  const weightFields: { label: string; value: string; onChange: (v: string) => void }[] = [
    { label: t('contribution.postWeight'), value: postWeight, onChange: setPostWeight },
    { label: t('contribution.commentWeight'), value: commentWeight, onChange: setCommentWeight },
    { label: t('contribution.reactionWeight'), value: reactionWeight, onChange: setReactionWeight },
    { label: t('contribution.eventWeight'), value: eventWeight, onChange: setEventWeight },
  ];

  const weightValues = [postWeight, commentWeight, reactionWeight, eventWeight];
  const weightsValid = weightValues.every((value) => {
    const numeric = Number(value);
    return value.trim() !== '' && Number.isInteger(numeric) && numeric >= 0 && numeric <= 100;
  });
  const topValue = Number(topThreshold);
  const modValue = Number(modThreshold);
  const thresholdsValid =
    topThreshold.trim() !== '' &&
    modThreshold.trim() !== '' &&
    Number.isInteger(topValue) &&
    topValue > 0 &&
    Number.isInteger(modValue) &&
    modValue > 0;
  const orderValid = modValue > topValue;
  const canSave = weightsValid && thresholdsValid && orderValid && !saving;

  const handleSave = useCallback(async () => {
    if (!canSave) return;
    setFormError('');
    setSaving(true);
    try {
      await updateContributionPolicy(communityId, {
        post_weight: Number(postWeight),
        comment_weight: Number(commentWeight),
        reaction_weight: Number(reactionWeight),
        event_weight: Number(eventWeight),
        top_contributor_threshold: topValue,
        moderator_promotion_threshold: modValue,
        auto_promote_enabled: autoPromote,
        badge_enabled: badgeEnabled,
      });
      showAlert(t('common.success'), t('contribution.policySaved'));
      onSaved();
    } catch (err) {
      setFormError(communityErrorText(err, t('contribution.policyError')));
    } finally {
      setSaving(false);
    }
  }, [
    autoPromote,
    badgeEnabled,
    canSave,
    commentWeight,
    communityId,
    eventWeight,
    modValue,
    onSaved,
    postWeight,
    reactionWeight,
    t,
    topValue,
  ]);

  return (
    <View style={styles.section}>
      <ThemedText themeColor="textSecondary" style={styles.hint}>
        {t('contribution.policySubtitle')}
      </ThemedText>

      <View style={styles.grid2}>
        {weightFields.map((field) => (
          <View key={field.label} style={styles.gridItem}>
            <ThemedText themeColor="textSecondary" style={styles.label}>
              {field.label}
            </ThemedText>
            <TextInput
              style={[styles.input, fieldStyle(theme)]}
              value={field.value}
              onChangeText={field.onChange}
              keyboardType="number-pad"
              editable={!saving}
            />
          </View>
        ))}
      </View>

      <ThemedText themeColor="textSecondary" style={styles.label}>
        {t('contribution.topThreshold')}
      </ThemedText>
      <TextInput
        style={[styles.input, fieldStyle(theme)]}
        value={topThreshold}
        onChangeText={setTopThreshold}
        keyboardType="number-pad"
        editable={!saving}
      />

      <ThemedText themeColor="textSecondary" style={styles.label}>
        {t('contribution.modThreshold')}
      </ThemedText>
      <TextInput
        style={[styles.input, fieldStyle(theme)]}
        value={modThreshold}
        onChangeText={setModThreshold}
        keyboardType="number-pad"
        editable={!saving}
      />
      <ThemedText
        style={[
          styles.hint,
          thresholdsValid && !orderValid && { color: theme.danger, fontWeight: '600' },
        ]}>
        {thresholdsValid && !orderValid
          ? t('contribution.policyThresholdOrder')
          : t('contribution.thresholdHint')}
      </ThemedText>

      <ThemedText themeColor="textSecondary" style={styles.label}>
        {t('contribution.badgeEnabled')}
      </ThemedText>
      <View style={styles.toggleRow}>
        <Switch
          value={badgeEnabled}
          onValueChange={setBadgeEnabled}
          disabled={saving}
          trackColor={{ true: theme.primary, false: theme.border }}
          thumbColor={theme.textOnPrimary}
        />
        <ThemedText style={styles.toggleLabel}>
          {badgeEnabled ? t('communities.yes') : t('communities.no')}
        </ThemedText>
      </View>

      <ThemedText themeColor="textSecondary" style={styles.label}>
        {t('contribution.autoPromote')}
      </ThemedText>
      <View style={styles.toggleRow}>
        <Switch
          value={autoPromote}
          onValueChange={setAutoPromote}
          disabled={saving}
          trackColor={{ true: theme.primary, false: theme.border }}
          thumbColor={theme.textOnPrimary}
        />
        <ThemedText style={styles.toggleLabel}>
          {autoPromote ? t('communities.yes') : t('communities.no')}
        </ThemedText>
      </View>

      {formError ? (
        <ThemedText style={[styles.hint, { color: theme.danger, fontWeight: '600' }]}>
          {formError}
        </ThemedText>
      ) : null}

      <Pressable
        onPress={() => void handleSave()}
        disabled={!canSave}
        style={({ pressed }) => [
          styles.primaryBtn,
          { backgroundColor: theme.primary, opacity: canSave ? 1 : 0.6 },
          pressed && styles.pressed,
        ]}>
        {saving ? (
          <ActivityIndicator size="small" color={theme.textOnPrimary} />
        ) : (
          <ThemedText style={[styles.primaryBtnText, { color: theme.textOnPrimary }]}>
            {t('contribution.policySave')}
          </ThemedText>
        )}
      </Pressable>
    </View>
  );
}

/* ---------------------------------- Requests ---------------------------------- */

function RequestsSection({ communityId }: { communityId: string }) {
  const { t, language } = useTranslation();
  const theme = useTheme();
  const locale = language === 'vi' ? 'vi-VN' : 'en-US';

  const [requests, setRequests] = useState<CommunityJoinRequest[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await listJoinRequests(communityId);
      setRequests(res.requests);
      setLoadError(null);
    } catch (err) {
      setRequests((prev) => prev ?? []);
      setLoadError(communityErrorText(err, t('communities.requestError')));
    }
  }, [communityId, t]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const decide = useCallback(
    async (requestId: string, approve: boolean) => {
      setBusyId(requestId);
      try {
        if (approve) await approveJoinRequest(communityId, requestId);
        else await rejectJoinRequest(communityId, requestId);
        await load();
      } catch (err) {
        showAlert(t('common.error'), communityErrorText(err, t('communities.requestError')));
      } finally {
        setBusyId(null);
      }
    },
    [communityId, load, t],
  );

  const list = requests ?? [];

  if (requests === null && !loadError) return <SkeletonRows theme={theme} rows={3} />;

  if (loadError && list.length === 0) {
    return (
      <StateView
        message={loadError}
        onRetry={() => {
          setRequests(null);
          setLoadError(null);
          void load();
        }}
        theme={theme}
        t={t}
      />
    );
  }

  if (list.length === 0) {
    return (
      <View style={styles.emptyWrap}>
        <Icon name="personAdd" size={32} color={theme.textSecondary} />
        <ThemedText themeColor="textSecondary" style={styles.emptyText}>
          {t('communities.noJoinRequests')}
        </ThemedText>
      </View>
    );
  }

  return (
    <View style={styles.section}>
      {list.map((req) => {
        const busy = busyId === req.id;
        return (
          <View
            key={req.id}
            style={[styles.row, { backgroundColor: theme.card, borderColor: theme.border }]}>
            {req.avatar_uri ? (
              <Image source={{ uri: req.avatar_uri }} style={styles.rowAvatar} contentFit="cover" />
            ) : (
              <View style={[styles.rowAvatar, styles.avatarFallback, { backgroundColor: theme.bgSecondary }]}>
                <Icon name="person" size={18} color={theme.textSecondary} />
              </View>
            )}
            <View style={styles.rowInfo}>
              <ThemedText numberOfLines={1} style={styles.rowName}>
                {req.display_name}
              </ThemedText>
              <ThemedText themeColor="textSecondary" style={styles.rowMeta}>
                {new Date(req.created_at).toLocaleDateString(locale)}
              </ThemedText>
            </View>
            <Pressable
              disabled={busy}
              onPress={() => void decide(req.id, true)}
              accessibilityLabel={t('communities.approve')}
              hitSlop={6}
              style={({ pressed }) => [
                styles.decideBtn,
                { backgroundColor: theme.success },
                (busy || pressed) && styles.pressed,
              ]}>
              <Icon name="check" size={16} color={theme.textOnPrimary} />
            </Pressable>
            <Pressable
              disabled={busy}
              onPress={() => void decide(req.id, false)}
              accessibilityLabel={t('communities.reject')}
              hitSlop={6}
              style={({ pressed }) => [
                styles.decideBtn,
                { backgroundColor: theme.danger },
                (busy || pressed) && styles.pressed,
              ]}>
              <Icon name="close" size={16} color={theme.textOnPrimary} />
            </Pressable>
          </View>
        );
      })}
    </View>
  );
}

/* -------------------------------- Invite codes -------------------------------- */

function CodesSection({ communityId }: { communityId: string }) {
  const { t, language } = useTranslation();
  const theme = useTheme();
  const locale = language === 'vi' ? 'vi-VN' : 'en-US';

  const [codes, setCodes] = useState<CommunityInviteCode[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [maxUses, setMaxUses] = useState('0');
  const [creating, setCreating] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await listInviteCodes(communityId);
      setCodes(res);
      setLoadError(null);
    } catch (err) {
      setCodes((prev) => prev ?? []);
      setLoadError(communityErrorText(err, t('communities.codeError')));
    }
  }, [communityId, t]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const handleCreate = useCallback(async () => {
    if (creating) return;
    setCreating(true);
    try {
      const parsed = Math.max(0, Number.parseInt(maxUses, 10) || 0);
      await createInviteCode(communityId, parsed);
      showAlert(t('common.success'), t('communities.codeCreated'));
      setShowCreate(false);
      setMaxUses('0');
      await load();
    } catch (err) {
      showAlert(t('common.error'), communityErrorText(err, t('communities.codeError')));
    } finally {
      setCreating(false);
    }
  }, [creating, communityId, load, maxUses, t]);

  const handleDeactivate = useCallback(
    async (codeId: string) => {
      setBusyId(codeId);
      try {
        await deactivateInviteCode(communityId, codeId);
        showAlert(t('common.success'), t('communities.codeDeactivated'));
        await load();
      } catch (err) {
        showAlert(t('common.error'), communityErrorText(err, t('communities.codeError')));
      } finally {
        setBusyId(null);
      }
    },
    [communityId, load, t],
  );

  const handleCopy = useCallback(
    (code: string) => {
      Clipboard.setString(code);
      showAlert(t('common.success'), t('communities.codeCopied'));
    },
    [t],
  );

  const list = codes ?? [];
  const closeCreate = () => {
    if (creating) return;
    setShowCreate(false);
    setMaxUses('0');
  };

  return (
    <View style={styles.section}>
      <Pressable
        onPress={() => setShowCreate(true)}
        style={({ pressed }) => [
          styles.primaryBtn,
          { backgroundColor: theme.primary, opacity: pressed ? 0.8 : 1 },
        ]}>
        <Icon name="add" size={16} color={theme.textOnPrimary} />
        <ThemedText style={[styles.primaryBtnText, { color: theme.textOnPrimary }]}>{t('communities.createCode')}</ThemedText>
      </Pressable>

      {codes === null && !loadError ? (
        <SkeletonRows theme={theme} rows={3} />
      ) : loadError && list.length === 0 ? (
        <StateView
          message={loadError}
          onRetry={() => {
            setCodes(null);
            setLoadError(null);
            void load();
          }}
          theme={theme}
          t={t}
        />
      ) : list.length === 0 ? (
        <View style={styles.emptyWrap}>
          <Icon name="key" size={32} color={theme.textSecondary} />
          <ThemedText themeColor="textSecondary" style={styles.emptyText}>
            {t('communities.noCodes')}
          </ThemedText>
        </View>
      ) : (
        list.map((code) => (
          <View
            key={code.id}
            style={[styles.row, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <View style={styles.rowInfo}>
              <ThemedText style={styles.codeValue}>{code.code}</ThemedText>
              <ThemedText themeColor="textSecondary" style={styles.rowMeta}>
                {`${code.used_count}/${code.max_uses || '∞'} · ${new Date(code.created_at).toLocaleDateString(locale)}`}
                {code.is_active ? '' : ` · ${t('communities.deactivate')}`}
              </ThemedText>
            </View>
            <Pressable
              onPress={() => handleCopy(code.code)}
              accessibilityLabel={t('communities.copyCode')}
              hitSlop={6}
              style={({ pressed }) => [styles.rowAction, pressed && styles.pressed]}>
              <Icon name="copy" size={16} color={theme.textSecondary} />
            </Pressable>
            {code.is_active && (
              <Pressable
                disabled={busyId === code.id}
                onPress={() => void handleDeactivate(code.id)}
                accessibilityLabel={t('communities.deactivate')}
                hitSlop={6}
                style={({ pressed }) => [styles.rowAction, (busyId === code.id || pressed) && styles.pressed]}>
                <Icon name="ban" size={16} color={theme.danger} />
              </Pressable>
            )}
          </View>
        ))
      )}

      {/* Tạo mã */}
      <Modal
        visible={showCreate}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={closeCreate}>
        <Pressable style={styles.backdrop} onPress={closeCreate}>
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            style={styles.centerWrap}>
            <Pressable
              style={[styles.modalCard, { backgroundColor: theme.card, borderColor: theme.border }]}
              onPress={(e) => e.stopPropagation()}>
              <ThemedText style={styles.modalTitle}>{t('communities.createCode')}</ThemedText>
              <ThemedText themeColor="textSecondary" style={styles.label}>
                {t('communities.codeMaxUses')}
              </ThemedText>
              <TextInput
                style={[styles.input, fieldStyle(theme)]}
                value={maxUses}
                onChangeText={(v) => setMaxUses(v.replace(/[^0-9]/g, ''))}
                keyboardType="number-pad"
                maxLength={6}
                editable={!creating}
                placeholder="0"
                placeholderTextColor={theme.textSecondary}
              />
              <View style={styles.modalActions}>
                <Pressable
                  onPress={closeCreate}
                  disabled={creating}
                  style={({ pressed }) => [
                    styles.ghostBtn,
                    { borderColor: theme.border },
                    pressed && styles.pressed,
                  ]}>
                  <ThemedText style={styles.ghostBtnText}>{t('common.cancel')}</ThemedText>
                </Pressable>
                <Pressable
                  onPress={() => void handleCreate()}
                  disabled={creating}
                  style={({ pressed }) => [
                    styles.primaryBtn,
                    { backgroundColor: theme.primary, opacity: creating ? 0.6 : 1 },
                    pressed && styles.pressed,
                  ]}>
                  {creating ? (
                    <ActivityIndicator size="small" color={theme.textOnPrimary} />
                  ) : (
                    <ThemedText style={[styles.primaryBtnText, { color: theme.textOnPrimary }]}>{t('communities.createCode')}</ThemedText>
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

/* ---------------------------------- Transfer ---------------------------------- */

function TransferSection({ communityId, onUpdate }: { communityId: string; onUpdate: () => void }) {
  const { t } = useTranslation();
  const theme = useTheme();

  const [targetUserId, setTargetUserId] = useState('');
  const [keepAdmin, setKeepAdmin] = useState(true);
  const [loading, setLoading] = useState(false);

  const trimmed = targetUserId.trim();

  const handleTransfer = useCallback(() => {
    if (!trimmed || loading) return;
    showAlert(t('communities.transferOwnership'), t('communities.transferWarning'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('communities.transferOwnership'),
        style: 'destructive',
        onPress: () => {
          void (async () => {
            setLoading(true);
            try {
              await transferOwnership(communityId, trimmed, keepAdmin);
              showAlert(t('common.success'), t('communities.transferSuccess'));
              setTargetUserId('');
              onUpdate();
            } catch (err) {
              showAlert(
                t('common.error'),
                communityErrorText(err, t('communities.transferError')),
              );
            } finally {
              setLoading(false);
            }
          })();
        },
      },
    ]);
  }, [communityId, keepAdmin, loading, onUpdate, t, trimmed]);

  return (
    <View style={styles.section}>
      <View style={[styles.warningBox, { backgroundColor: theme.primaryLight }]}>
        <Icon name="warning" size={16} color={theme.warning} />
        <ThemedText themeColor="textSecondary" style={styles.warningText}>
          {t('communities.transferConfirm')}
        </ThemedText>
      </View>

      <ThemedText themeColor="textSecondary" style={styles.label}>
        {t('communities.transferTo')}
      </ThemedText>
      <TextInput
        style={[styles.input, fieldStyle(theme)]}
        value={targetUserId}
        onChangeText={setTargetUserId}
        placeholder={t('communities.transferToPlaceholder')}
        placeholderTextColor={theme.textSecondary}
        autoCapitalize="none"
        autoCorrect={false}
        editable={!loading}
      />

      <ThemedText themeColor="textSecondary" style={styles.label}>
        {t('communities.keepAdmin')}
      </ThemedText>
      <View style={styles.toggleRow}>
        <Switch
          value={keepAdmin}
          onValueChange={setKeepAdmin}
          disabled={loading}
          trackColor={{ true: theme.primary, false: theme.border }}
          thumbColor={theme.textOnPrimary}
        />
        <ThemedText style={styles.toggleLabel}>
          {keepAdmin ? t('communities.yes') : t('communities.no')}
        </ThemedText>
      </View>

      <Pressable
        onPress={handleTransfer}
        disabled={loading || !trimmed}
        style={({ pressed }) => [
          styles.primaryBtn,
          {
            backgroundColor: theme.danger,
            opacity: loading || !trimmed ? 0.6 : 1,
          },
          pressed && styles.pressed,
        ]}>
        {loading ? (
          <ActivityIndicator size="small" color={theme.textOnPrimary} />
        ) : (
          <ThemedText style={[styles.primaryBtnText, { color: theme.textOnPrimary }]}>
            {t('communities.transferOwnership')}
          </ThemedText>
        )}
      </Pressable>
    </View>
  );
}

/* ----------------------------------- Shared ----------------------------------- */

function SkeletonRows({
  theme,
  rows,
}: {
  theme: ReturnType<typeof useTheme>;
  rows: number;
}) {
  const shimmer = useShimmer();
  return (
    <Animated.View style={[styles.section, { opacity: shimmer }]}>
      {Array.from({ length: rows }).map((_, i) => (
        <View
          key={i}
          style={[styles.row, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <View style={[styles.rowAvatar, styles.avatarFallback, { backgroundColor: theme.bgSecondary }]} />
          <View style={[styles.skeletonLine, { backgroundColor: theme.bgSecondary }]} />
        </View>
      ))}
    </Animated.View>
  );
}

function StateView({
  message,
  onRetry,
  theme,
  t,
}: {
  message: string;
  onRetry: () => void;
  theme: ReturnType<typeof useTheme>;
  t: (key: string) => string;
}) {
  return (
    <View style={styles.emptyWrap}>
      <ThemedText themeColor="textSecondary" style={styles.emptyText}>
        {message}
      </ThemedText>
      <Pressable
        onPress={onRetry}
        style={({ pressed }) => [
          styles.ghostBtn,
          { borderColor: theme.border },
          pressed && styles.pressed,
        ]}>
        <ThemedText style={styles.ghostBtnText}>{t('common.retry')}</ThemedText>
      </Pressable>
    </View>
  );
}

const fieldStyle = (theme: ReturnType<typeof useTheme>) =>
  ({
    backgroundColor: theme.bgSecondary,
    borderColor: theme.border,
    color: theme.text,
  }) as const;

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
  },
  nav: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  navChip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    minHeight: 34,
    gap: Spacing.xs + 2,
    borderWidth: 1,
    borderRadius: Radius.pill,
    paddingHorizontal: Spacing.sm + 4,
    paddingVertical: Spacing.xs + 4,
  },
  navChipText: {
    ...Typography.caption,
    fontWeight: '600',
    fontSize: 12,
  },
  content: {
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.xl,
    gap: Spacing.sm,
  },
  section: {
    gap: Spacing.sm,
  },
  grid2: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  gridItem: {
    flex: 1,
    minWidth: 140,
    gap: 4,
  },
  label: {
    ...Typography.caption,
    marginTop: Spacing.xs,
  },
  input: {
    borderWidth: 1,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.sm + 4,
    paddingVertical: Spacing.sm,
    ...Typography.body,
    fontSize: 14,
  },
  textarea: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  hint: {
    ...Typography.caption,
    fontSize: 11,
    textAlign: 'right',
    marginTop: -Spacing.xs,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs + 2,
    borderWidth: 1,
    borderRadius: Radius.pill,
    paddingHorizontal: Spacing.sm + 4,
    paddingVertical: Spacing.xs + 2,
  },
  chipText: {
    ...Typography.caption,
    fontWeight: '600',
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  toggleLabel: {
    ...Typography.body,
    fontSize: 14,
  },
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs + 2,
    borderRadius: Radius.pill,
    paddingVertical: Spacing.sm + 2,
    marginTop: Spacing.xs,
    minHeight: 42,
  },
  primaryBtnText: {
    ...Typography.body,
    fontWeight: '600',
  },
  ghostBtn: {
    flex: 1,
    borderWidth: 1,
    borderRadius: Radius.pill,
    paddingVertical: Spacing.sm + 2,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 42,
  },
  ghostBtnText: {
    ...Typography.body,
    fontWeight: '600',
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
  rowAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    overflow: 'hidden',
  },
  avatarFallback: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowInfo: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  rowName: {
    ...Typography.body,
    fontSize: 14,
    fontWeight: '600',
  },
  rowMeta: {
    ...Typography.caption,
    fontSize: 11,
  },
  rowAction: {
    padding: Spacing.xs,
  },
  decideBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  codeValue: {
    ...Typography.body,
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 1.5,
  },
  emptyWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.md,
    paddingVertical: Spacing.xl * 2,
    paddingHorizontal: Spacing.lg,
  },
  emptyText: {
    ...Typography.body,
    textAlign: 'center',
  },
  skeletonLine: {
    flex: 1,
    height: 14,
    borderRadius: Radius.sm,
  },
  warningBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
    borderRadius: Radius.md,
    padding: Spacing.sm + 4,
  },
  warningText: {
    ...Typography.caption,
    flex: 1,
    lineHeight: 18,
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
  modalCard: {
    borderRadius: Radius.lg,
    borderWidth: 1,
    padding: Spacing.md,
    gap: Spacing.sm,
  },
  modalTitle: {
    ...Typography.h2,
    fontSize: 17,
  },
  modalActions: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginTop: Spacing.xs,
  },
  pressed: {
    opacity: 0.8,
  },
});

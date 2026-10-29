import { useCallback, useState, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Animated,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import { useFocusEffect, useRouter } from 'expo-router';

import { showAlert } from '@/utils/alert';
import { communityErrorText } from '@/api/communities';
import {
  createChallenge,
  getChallengeParticipants,
  joinChallenge,
  listChallenges,
  updateChallenge,
} from '@/api/contribution';
import { ThemedText } from '@/components/themed-text';
import { Icon } from '@/components/ui/icon';
import { Radius, Spacing } from '@/constants/spacing';
import { Typography } from '@/constants/typography';
import { useShimmer } from '@/hooks/use-shimmer';
import { useTheme } from '@/hooks/use-theme';
import { useTranslation } from '@/hooks/useTranslation';
import type {
  ChallengeParticipant,
  ChallengeState,
  ChallengeStatus,
  CommunityChallenge,
} from '@/types/contribution';

type FilterKey = 'active' | 'upcoming' | 'ended';

interface ChallengesTabProps {
  communityId: string;
  isMember: boolean;
  canManage: boolean;
  /** CommunityHeader — scroll cùng nội dung (mirror web page-level header). */
  header?: ReactNode;
}

const STATE_LABEL: Record<ChallengeState, string> = {
  active: 'contribution.stateActive',
  upcoming: 'contribution.stateUpcoming',
  ended: 'contribution.stateEnded',
  cancelled: 'contribution.stateCancelled',
};

function localeOf(language: string) {
  return language === 'vi' ? 'vi-VN' : 'en-GB';
}

function formatDate(iso: string, language: string, short = false) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString(
    localeOf(language),
    short
      ? { day: '2-digit', month: '2-digit' }
      : { day: '2-digit', month: '2-digit', year: 'numeric' },
  );
}

/** ISO → chuỗi cho TextInput datetime (`YYYY-MM-DD HH:mm`, giờ máy). */
function toDateTimeInput(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** Chuỗi datetime-local → Date (hỗ trợ ' ' hoặc 'T'). */
function parseDateTime(value: string): Date | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const date = new Date(trimmed.includes('T') ? trimmed : trimmed.replace(' ', 'T'));
  return Number.isNaN(date.getTime()) ? null : date;
}

function defaultStart() {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  date.setHours(9, 0, 0, 0);
  return toDateTimeInput(date.toISOString());
}

function defaultEnd() {
  const date = new Date();
  date.setDate(date.getDate() + 8);
  date.setHours(21, 0, 0, 0);
  return toDateTimeInput(date.toISOString());
}

/** Port CommunityChallenges — filter pills, card grid, join, create/edit, participants. */
export default function ChallengesTab({
  communityId,
  isMember,
  canManage,
  header,
}: ChallengesTabProps) {
  const { t, language } = useTranslation();
  const theme = useTheme();
  const shimmer = useShimmer();

  const [data, setData] = useState<CommunityChallenge[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterKey>('active');
  const [joiningID, setJoiningID] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<CommunityChallenge | null>(null);
  const [participantsFor, setParticipantsFor] = useState<CommunityChallenge | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await listChallenges(communityId, true);
      setData(res.data);
      setLoadError(null);
    } catch (err) {
      setData((prev) => prev ?? []);
      setLoadError(communityErrorText(err, t('contribution.loadError')));
    }
  }, [communityId, t]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const groups = { active: [], upcoming: [], ended: [] } as Record<
    'active' | 'upcoming' | 'ended',
    CommunityChallenge[]
  >;
  for (const challenge of data ?? []) {
    if (challenge.state === 'active') groups.active.push(challenge);
    else if (challenge.state === 'upcoming') groups.upcoming.push(challenge);
    else groups.ended.push(challenge);
  }

  const filters: { key: FilterKey; label: string; count: number }[] = [
    { key: 'active', label: t('contribution.filterActive'), count: groups.active.length },
    { key: 'upcoming', label: t('contribution.filterUpcoming'), count: groups.upcoming.length },
    { key: 'ended', label: t('contribution.filterEnded'), count: groups.ended.length },
  ];
  const visible = groups[filter];

  const handleJoin = useCallback(
    async (challenge: CommunityChallenge) => {
      if (joiningID) return;
      setJoiningID(challenge.id);
      try {
        await joinChallenge(communityId, challenge.id);
        showAlert(t('common.success'), t('contribution.joinSuccess'));
        await load();
      } catch (err) {
        showAlert(
          t('common.error'),
          communityErrorText(err, t('contribution.joinError')),
        );
      } finally {
        setJoiningID(null);
      }
    },
    [communityId, joiningID, load, t],
  );

  const stateColors = (state: ChallengeState) => {
    switch (state) {
      case 'active':
        return { bg: theme.successLight, fg: theme.success };
      case 'upcoming':
        return { bg: theme.primaryLight, fg: theme.primary };
      case 'ended':
        return { bg: theme.bgSecondary, fg: theme.textSecondary };
      default:
        return { bg: 'rgba(0,0,0,0.06)', fg: theme.danger };
    }
  };

  const cardStyle = [styles.card, { backgroundColor: theme.card, borderColor: theme.border }];

  const renderCard = (challenge: CommunityChallenge) => {
    const dailyLimit = challenge.daily_post_limit || 3;
    const awarded = Math.min(challenge.daily_posts_awarded, dailyLimit);
    const quotaFull = awarded >= dailyLimit;
    const maxParticipants = challenge.max_participants ?? 0;
    const progress =
      maxParticipants > 0
        ? Math.min(100, Math.round((challenge.participants_count / maxParticipants) * 100))
        : 0;
    const sc = stateColors(challenge.state);

    return (
      <View key={challenge.id} style={cardStyle}>
        <View style={styles.cardTop}>
          <View style={[styles.statePill, { backgroundColor: sc.bg }]}>
            {challenge.state === 'active' && (
              <View style={[styles.liveDot, { backgroundColor: theme.success }]} />
            )}
            <ThemedText style={[styles.statePillText, { color: sc.fg }]}>
              {t(STATE_LABEL[challenge.state])}
            </ThemedText>
          </View>
          <View style={[styles.pointsChip, { backgroundColor: theme.bgSecondary }]}>
            <Icon name="star" size={12} color={theme.accent} />
            <ThemedText style={[styles.pointsChipText, { color: theme.textSecondary }]}>
              {t('contribution.pointsPerPost', { points: challenge.points_per_post })}
            </ThemedText>
          </View>
        </View>

        <ThemedText style={styles.cardTitle}>{challenge.title}</ThemedText>
        {challenge.description ? (
          <ThemedText themeColor="textSecondary" style={styles.cardDesc}>
            {challenge.description}
          </ThemedText>
        ) : null}

        <View style={styles.metaRow}>
          <ThemedText style={[styles.hashtag, { color: theme.primary }]}>
            {challenge.hashtag}
          </ThemedText>
          <View style={styles.metaItem}>
            <Icon name="calendar" size={13} color={theme.textSecondary} />
            <ThemedText themeColor="textSecondary" style={styles.metaText}>
              {formatDate(challenge.start_date, language, true)} –{' '}
              {formatDate(challenge.end_date, language)}
            </ThemedText>
          </View>
        </View>

        <View style={styles.participantsRow}>
          <View style={styles.metaItem}>
            <Icon name="people" size={13} color={theme.textSecondary} />
            <ThemedText themeColor="textSecondary" style={styles.metaText}>
              {t('contribution.participantsCount', { count: challenge.participants_count })}
            </ThemedText>
          </View>
          {maxParticipants > 0 ? (
            <View style={[styles.progressTrack, { backgroundColor: theme.bgSecondary }]}>
              <View
                style={[
                  styles.progressFill,
                  { backgroundColor: theme.primary, width: `${progress}%` },
                ]}
              />
            </View>
          ) : (
            <ThemedText themeColor="textSecondary" style={styles.metaText}>
              {t('contribution.unlimited')}
            </ThemedText>
          )}
        </View>

        {challenge.joined && challenge.state !== 'cancelled' && (
          <View style={styles.quota}>
            <View style={styles.quotaDots}>
              {Array.from({ length: dailyLimit }).map((_, dot) => (
                <View
                  key={dot}
                  style={[
                    styles.quotaDot,
                    {
                      backgroundColor:
                        dot < awarded ? theme.primary : theme.bgSecondary,
                    },
                  ]}
                />
              ))}
            </View>
            <ThemedText
              themeColor={quotaFull ? 'text' : 'textSecondary'}
              style={[styles.quotaText, quotaFull && { color: theme.danger }]}>
              {quotaFull
                ? t('contribution.dailyQuotaFull', { limit: dailyLimit })
                : t('contribution.dailyQuota', { used: awarded, limit: dailyLimit })}
            </ThemedText>
          </View>
        )}

        {challenge.joined && challenge.state === 'active' && (
          <ThemedText themeColor="textSecondary" style={styles.hashtagHint}>
            {t('contribution.hashtagHint', { hashtag: challenge.hashtag })}
          </ThemedText>
        )}

        <View style={styles.cardActions}>
          {challenge.state === 'active' && !challenge.joined && (
            <Pressable
              onPress={() => void handleJoin(challenge)}
              disabled={!isMember || joiningID !== null}
              style={({ pressed }) => [
                styles.joinBtn,
                {
                  backgroundColor: isMember ? theme.primary : theme.bgSecondary,
                  borderColor: isMember ? theme.primary : theme.bgSecondary,
                },
                (pressed || joiningID === challenge.id) && styles.pressed,
              ]}>
              {joiningID === challenge.id ? (
                <ActivityIndicator
                  size="small"
                  color={isMember ? theme.textOnPrimary : theme.textSecondary}
                />
              ) : (
                <ThemedText
                  style={[
                    styles.joinBtnText,
                    { color: isMember ? theme.textOnPrimary : theme.textSecondary },
                  ]}>
                  {joiningID === challenge.id
                    ? t('contribution.joining')
                    : t('contribution.join')}
                </ThemedText>
              )}
            </Pressable>
          )}
          {challenge.joined && (
            <View style={[styles.joinedBadge, { backgroundColor: theme.successLight }]}>
              <Icon name="check" size={13} color={theme.success} />
              <ThemedText style={[styles.joinedBadgeText, { color: theme.success }]}>
                {t('contribution.joined')}
              </ThemedText>
            </View>
          )}
          {challenge.state === 'upcoming' && !challenge.joined && (
            <View style={styles.metaItem}>
              <Icon name="hourglass" size={13} color={theme.textSecondary} />
              <ThemedText themeColor="textSecondary" style={styles.metaText}>
                {t('contribution.startsAt', {
                  date: formatDate(challenge.start_date, language),
                })}
              </ThemedText>
            </View>
          )}
          <View style={{ flex: 1 }} />
          <Pressable
            onPress={() => setParticipantsFor(challenge)}
            style={({ pressed }) => [
              styles.ghostBtn,
              { borderColor: theme.border },
              pressed && styles.pressed,
            ]}>
            <Icon name="people" size={14} color={theme.textSecondary} />
            <ThemedText themeColor="textSecondary" style={styles.ghostBtnText}>
              {t('contribution.viewParticipants')}
            </ThemedText>
          </Pressable>
          {canManage && (
            <Pressable
              onPress={() => {
                setEditing(challenge);
                setFormOpen(true);
              }}
              style={({ pressed }) => [
                styles.iconBtn,
                { borderColor: theme.border },
                pressed && styles.pressed,
              ]}>
              <Icon name="pencil" size={15} color={theme.textSecondary} />
            </Pressable>
          )}
        </View>
      </View>
    );
  };

  const sectionHeader = (
    <View style={styles.headerRow}>
      <View style={styles.headerText}>
        <View style={styles.eyebrow}>
          <Icon name="trophy" size={13} color={theme.accent} />
          <ThemedText style={[styles.eyebrowText, { color: theme.accent }]}>
            {t('contribution.challengesBadge')}
          </ThemedText>
        </View>
        <ThemedText style={styles.title}>{t('contribution.challengesTitle')}</ThemedText>
        <ThemedText themeColor="textSecondary" style={styles.subtitle}>
          {t('contribution.challengesSubtitle')}
        </ThemedText>
      </View>
      {canManage && (
        <Pressable
          onPress={() => {
            setEditing(null);
            setFormOpen(true);
          }}
          style={({ pressed }) => [
            styles.createBtn,
            { backgroundColor: theme.primary },
            pressed && styles.pressed,
          ]}>
          <Icon name="add" size={16} color={theme.textOnPrimary} />
          <ThemedText style={[styles.createBtnText, { color: theme.textOnPrimary }]}>
            {t('contribution.createChallenge')}
          </ThemedText>
        </Pressable>
      )}
    </View>
  );

  const stateWrap = [styles.stateWrap, { backgroundColor: theme.card, borderColor: theme.border }];

  return (
    <ScrollView contentContainerStyle={styles.wrap} keyboardShouldPersistTaps="handled">
      {header}
      {sectionHeader}

      {data === null && !loadError ? (
        <View style={styles.cardList}>
          {Array.from({ length: 3 }).map((_, i) => (
            <Animated.View
              key={i}
              style={[
                styles.card,
                {
                  backgroundColor: theme.card,
                  borderColor: theme.border,
                  opacity: shimmer,
                },
              ]}>
              <View style={[styles.skelPill, { backgroundColor: theme.bgSecondary }]} />
              <View style={[styles.skelLine, { backgroundColor: theme.bgSecondary, width: '72%' }]} />
              <View style={[styles.skelLine, { backgroundColor: theme.bgSecondary, width: '100%' }]} />
              <View style={[styles.skelLine, { backgroundColor: theme.bgSecondary, width: '54%' }]} />
            </Animated.View>
          ))}
        </View>
      ) : loadError ? (
        <View style={stateWrap}>
          <Icon name="warning" size={32} color={theme.accent} />
          <ThemedText style={styles.stateTitle}>{loadError}</ThemedText>
          <Pressable
            onPress={() => {
              setData(null);
              setLoadError(null);
              void load();
            }}
            style={({ pressed }) => [
              styles.primaryBtn,
              { backgroundColor: theme.primary },
              pressed && styles.pressed,
            ]}>
            <ThemedText style={[styles.primaryBtnText, { color: theme.textOnPrimary }]}>
              {t('common.retry')}
            </ThemedText>
          </Pressable>
        </View>
      ) : (
        <>
          <View style={styles.filters}>
            {filters.map((item) => {
              const active = filter === item.key;
              return (
                <Pressable
                  key={item.key}
                  onPress={() => setFilter(item.key)}
                  style={({ pressed }) => [
                    styles.filterBtn,
                    {
                      backgroundColor: active ? theme.primaryLight : theme.bgSecondary,
                      borderColor: active ? theme.primary : 'transparent',
                    },
                    pressed && styles.pressed,
                  ]}>
                  <ThemedText
                    style={[
                      styles.filterBtnText,
                      { color: active ? theme.primary : theme.textSecondary },
                    ]}>
                    {item.label}
                  </ThemedText>
                  <ThemedText
                    style={[
                      styles.filterCount,
                      { color: active ? theme.primary : theme.textSecondary },
                    ]}>
                    {item.count}
                  </ThemedText>
                </Pressable>
              );
            })}
          </View>

          {visible.length === 0 ? (
            <View style={stateWrap}>
              <View style={[styles.emptyIcon, { backgroundColor: theme.primaryLight }]}>
                <Icon name="flag" size={26} color={theme.primary} />
              </View>
              <ThemedText style={styles.stateTitle}>{t('contribution.noChallenges')}</ThemedText>
              <ThemedText themeColor="textSecondary" style={styles.stateHint}>
                {canManage
                  ? t('contribution.noChallengesHint')
                  : t('contribution.noChallengesMemberHint')}
              </ThemedText>
              {canManage && filter === 'active' && (
                <Pressable
                  onPress={() => {
                    setEditing(null);
                    setFormOpen(true);
                  }}
                  style={({ pressed }) => [
                    styles.createBtn,
                    { backgroundColor: theme.primary },
                    pressed && styles.pressed,
                  ]}>
                  <Icon name="add" size={16} color={theme.textOnPrimary} />
                  <ThemedText
                    style={[styles.createBtnText, { color: theme.textOnPrimary }]}>
                    {t('contribution.createChallenge')}
                  </ThemedText>
                </Pressable>
              )}
            </View>
          ) : (
            <View style={styles.cardList}>{visible.map(renderCard)}</View>
          )}
        </>
      )}

      {!isMember && (
        <View style={styles.memberHint}>
          <Icon name="info" size={14} color={theme.primary} />
          <ThemedText themeColor="textSecondary" style={styles.memberHintText}>
            {t('contribution.joinRequiresMember')}
          </ThemedText>
        </View>
      )}

      {formOpen && (
        <ChallengeFormModal
          communityId={communityId}
          challenge={editing}
          onClose={() => setFormOpen(false)}
          onSaved={() => {
            setFormOpen(false);
            void load();
          }}
        />
      )}

      {participantsFor && (
        <ParticipantsModal
          communityId={communityId}
          challenge={participantsFor}
          onClose={() => setParticipantsFor(null)}
        />
      )}
    </ScrollView>
  );
}

/** Form tạo/sửa thử thách — datetime nhập dạng `YYYY-MM-DD HH:mm` (không thêm dep picker). */
function ChallengeFormModal({
  communityId,
  challenge,
  onClose,
  onSaved,
}: {
  communityId: string;
  challenge: CommunityChallenge | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { t } = useTranslation();
  const theme = useTheme();
  const isEdit = challenge !== null;

  const [title, setTitle] = useState(challenge?.title ?? '');
  const [description, setDescription] = useState(challenge?.description ?? '');
  const [hashtag, setHashtag] = useState(challenge?.hashtag ?? '#');
  const [points, setPoints] = useState(
    challenge ? String(challenge.points_per_post) : '10',
  );
  const [start, setStart] = useState(
    challenge ? toDateTimeInput(challenge.start_date) : defaultStart(),
  );
  const [end, setEnd] = useState(
    challenge ? toDateTimeInput(challenge.end_date) : defaultEnd(),
  );
  const [maxParticipants, setMaxParticipants] = useState(
    challenge?.max_participants ? String(challenge.max_participants) : '',
  );
  const [status, setStatus] = useState<ChallengeStatus>(() => {
    const current = challenge?.status;
    return current === 'completed' || current === 'cancelled' ? current : 'active';
  });
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  const startDate = parseDateTime(start);
  const endDate = parseDateTime(end);
  const pointsNumber = Number(points);
  const maxNumber = maxParticipants.trim() === '' ? 0 : Number(maxParticipants);

  const titleValid = title.trim().length >= 5;
  const hashtagValid = hashtag.trim().replace(/^#+/, '').length > 0;
  const pointsValid = Number.isInteger(pointsNumber) && pointsNumber >= 1 && pointsNumber <= 1000;
  const datesValid =
    startDate !== null && endDate !== null && endDate.getTime() > startDate.getTime();
  const maxValid =
    maxNumber === 0 || (Number.isInteger(maxNumber) && maxNumber >= 1 && maxNumber <= 100000);
  const canSubmit = titleValid && hashtagValid && pointsValid && datesValid && maxValid && !saving;

  const handleSubmit = useCallback(async () => {
    if (!canSubmit || startDate === null || endDate === null) return;
    if (!isEdit && startDate.getTime() <= Date.now()) {
      setFormError(t('contribution.startMustBeFuture'));
      return;
    }
    setFormError('');
    setSaving(true);
    const normalizedHashtag = `#${hashtag.trim().replace(/^#+/, '')}`;
    try {
      if (isEdit && challenge) {
        await updateChallenge(communityId, challenge.id, {
          title: title.trim(),
          description: description.trim(),
          hashtag: normalizedHashtag,
          points_per_post: pointsNumber,
          start_date: startDate.toISOString(),
          end_date: endDate.toISOString(),
          max_participants: maxNumber,
          status,
        });
        showAlert(t('common.success'), t('contribution.updateSuccess'));
      } else {
        await createChallenge(communityId, {
          title: title.trim(),
          description: description.trim(),
          hashtag: normalizedHashtag,
          points_per_post: pointsNumber,
          start_date: startDate.toISOString(),
          end_date: endDate.toISOString(),
          ...(maxNumber > 0 ? { max_participants: maxNumber } : {}),
        });
        showAlert(t('common.success'), t('contribution.createSuccess'));
      }
      onSaved();
    } catch (err) {
      setFormError(
        communityErrorText(
          err,
          isEdit ? t('contribution.updateError') : t('contribution.createError'),
        ),
      );
    } finally {
      setSaving(false);
    }
  }, [
    canSubmit,
    challenge,
    communityId,
    description,
    endDate,
    hashtag,
    isEdit,
    maxNumber,
    onSaved,
    pointsNumber,
    startDate,
    status,
    t,
    title,
  ]);

  const fieldLabel = [styles.fieldLabel, { color: theme.textSecondary }];
  const inputStyle = [
    styles.input,
    { backgroundColor: theme.bgSecondary, borderColor: theme.border, color: theme.text },
  ];

  return (
    <Modal visible transparent animationType="fade" statusBarTranslucent onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={saving ? undefined : onClose}>
        <Pressable
          style={[styles.modal, { backgroundColor: theme.card, borderColor: theme.border }]}
          onPress={(e) => e.stopPropagation()}>
          <ThemedText style={styles.modalTitle}>
            {isEdit ? t('contribution.editTitle') : t('contribution.createTitle')}
          </ThemedText>

          <ScrollView style={styles.formScroll} keyboardShouldPersistTaps="handled">
            <ThemedText style={fieldLabel}>{t('contribution.fieldTitle')}</ThemedText>
            <TextInput
              value={title}
              onChangeText={setTitle}
              maxLength={255}
              editable={!saving}
              placeholder={t('contribution.fieldTitlePlaceholder')}
              placeholderTextColor={theme.textSecondary}
              style={inputStyle}
            />
            <ThemedText themeColor="textSecondary" style={styles.hint}>
              {title.length}/255
            </ThemedText>

            <ThemedText style={fieldLabel}>{t('contribution.fieldDescription')}</ThemedText>
            <TextInput
              value={description}
              onChangeText={setDescription}
              maxLength={2000}
              editable={!saving}
              multiline
              numberOfLines={3}
              placeholder={t('contribution.fieldDescriptionPlaceholder')}
              placeholderTextColor={theme.textSecondary}
              style={[inputStyle, styles.inputMultiline]}
            />
            <ThemedText themeColor="textSecondary" style={styles.hint}>
              {description.length}/2000
            </ThemedText>

            <ThemedText style={fieldLabel}>{t('contribution.fieldHashtag')}</ThemedText>
            <TextInput
              value={hashtag}
              onChangeText={setHashtag}
              maxLength={100}
              editable={!saving}
              autoCapitalize="none"
              placeholder="#MuaHeXanh"
              placeholderTextColor={theme.textSecondary}
              style={inputStyle}
            />
            <ThemedText themeColor="textSecondary" style={styles.hint}>
              {t('contribution.fieldHashtagHint')}
            </ThemedText>

            <ThemedText style={fieldLabel}>{t('contribution.fieldPoints')}</ThemedText>
            <TextInput
              value={points}
              onChangeText={setPoints}
              keyboardType="number-pad"
              editable={!saving}
              style={inputStyle}
            />
            <ThemedText themeColor="textSecondary" style={styles.hint}>
              {t('contribution.fieldPointsHint')}
            </ThemedText>

            <ThemedText style={fieldLabel}>{t('contribution.fieldStart')}</ThemedText>
            <TextInput
              value={start}
              onChangeText={setStart}
              editable={!saving}
              autoCapitalize="none"
              placeholder="YYYY-MM-DDTHH:mm"
              placeholderTextColor={theme.textSecondary}
              style={inputStyle}
            />

            <ThemedText style={fieldLabel}>{t('contribution.fieldEnd')}</ThemedText>
            <TextInput
              value={end}
              onChangeText={setEnd}
              editable={!saving}
              autoCapitalize="none"
              placeholder="YYYY-MM-DDTHH:mm"
              placeholderTextColor={theme.textSecondary}
              style={inputStyle}
            />
            {!datesValid && (
              <ThemedText style={[styles.fieldError, { color: theme.danger }]}>
                {t('contribution.endAfterStart')}
              </ThemedText>
            )}

            <ThemedText style={fieldLabel}>{t('contribution.fieldMax')}</ThemedText>
            <TextInput
              value={maxParticipants}
              onChangeText={setMaxParticipants}
              keyboardType="number-pad"
              editable={!saving}
              placeholder="0"
              placeholderTextColor={theme.textSecondary}
              style={inputStyle}
            />
            <ThemedText themeColor="textSecondary" style={styles.hint}>
              {t('contribution.fieldMaxHint')}
            </ThemedText>

            {isEdit && (
              <>
                <ThemedText style={fieldLabel}>{t('contribution.fieldStatus')}</ThemedText>
                <View style={styles.statusRow}>
                  {(
                    [
                      { key: 'active', label: t('contribution.statusActive') },
                      { key: 'completed', label: t('contribution.statusCompleted') },
                      { key: 'cancelled', label: t('contribution.statusCancelled') },
                    ] as { key: ChallengeStatus; label: string }[]
                  ).map((opt) => {
                    const active = status === opt.key;
                    return (
                      <Pressable
                        key={opt.key}
                        disabled={saving}
                        onPress={() => setStatus(opt.key)}
                        style={[
                          styles.statusBtn,
                          {
                            backgroundColor: active ? theme.primaryLight : theme.bgSecondary,
                            borderColor: active ? theme.primary : theme.border,
                          },
                        ]}>
                        <ThemedText
                          style={[
                            styles.statusText,
                            { color: active ? theme.primary : theme.textSecondary },
                          ]}>
                          {opt.label}
                        </ThemedText>
                      </Pressable>
                    );
                  })}
                </View>
              </>
            )}

            {formError ? (
              <ThemedText style={[styles.fieldError, { color: theme.danger }]}>
                {formError}
              </ThemedText>
            ) : null}
          </ScrollView>

          <View style={styles.modalFooter}>
            <Pressable
              onPress={saving ? undefined : onClose}
              style={({ pressed }) => [
                styles.modalBtn,
                { borderColor: theme.border },
                pressed && styles.pressed,
              ]}>
              <ThemedText themeColor="textSecondary" style={styles.modalBtnText}>
                {t('common.cancel')}
              </ThemedText>
            </Pressable>
            <Pressable
              onPress={() => void handleSubmit()}
              disabled={!canSubmit}
              style={({ pressed }) => [
                styles.modalBtn,
                {
                  backgroundColor: canSubmit ? theme.primary : theme.bgSecondary,
                  borderColor: canSubmit ? theme.primary : theme.bgSecondary,
                },
                pressed && styles.pressed,
              ]}>
              {saving ? (
                <ActivityIndicator
                  size="small"
                  color={canSubmit ? theme.textOnPrimary : theme.textSecondary}
                />
              ) : (
                <ThemedText
                  style={[
                    styles.modalBtnText,
                    { color: canSubmit ? theme.textOnPrimary : theme.textSecondary },
                  ]}>
                  {saving
                    ? isEdit
                      ? t('contribution.saving')
                      : t('contribution.creating')
                    : isEdit
                      ? t('contribution.save')
                      : t('contribution.createChallenge')}
                </ThemedText>
              )}
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

/** Danh sách người tham gia thử thách. */
function ParticipantsModal({
  communityId,
  challenge,
  onClose,
}: {
  communityId: string;
  challenge: CommunityChallenge;
  onClose: () => void;
}) {
  const { t, language } = useTranslation();
  const theme = useTheme();
  const router = useRouter();
  const shimmer = useShimmer();

  const [participants, setParticipants] = useState<ChallengeParticipant[] | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await getChallengeParticipants(communityId, challenge.id);
      setParticipants(res.data);
    } catch {
      setParticipants([]);
    }
  }, [communityId, challenge.id]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  return (
    <Modal visible transparent animationType="fade" statusBarTranslucent onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable
          style={[styles.modal, { backgroundColor: theme.card, borderColor: theme.border }]}
          onPress={(e) => e.stopPropagation()}>
          <ThemedText style={styles.modalTitle}>{t('contribution.participantsTitle')}</ThemedText>
          <View style={styles.participantHead}>
            <ThemedText style={[styles.hashtag, { color: theme.primary }]}>
              {challenge.hashtag}
            </ThemedText>
            <ThemedText themeColor="textSecondary" style={styles.metaText}>
              {t('contribution.pointsPerPost', { points: challenge.points_per_post })}
            </ThemedText>
          </View>

          <ScrollView style={styles.participantScroll} keyboardShouldPersistTaps="handled">
            {participants === null ? (
              Array.from({ length: 4 }).map((_, i) => (
                <Animated.View
                  key={i}
                  style={[styles.participantRow, { opacity: shimmer }]}>
                  <View
                    style={[
                      styles.participantAvatar,
                      { backgroundColor: theme.bgSecondary },
                    ]}
                  />
                  <View style={[styles.skelLine, { backgroundColor: theme.bgSecondary, flex: 1 }]} />
                </Animated.View>
              ))
            ) : participants.length === 0 ? (
              <View style={styles.participantEmpty}>
                <Icon name="person" size={28} color={theme.textSecondary} />
                <ThemedText themeColor="textSecondary" style={styles.stateHint}>
                  {t('contribution.participantsEmpty')}
                </ThemedText>
              </View>
            ) : (
              participants.map((participant, index) => (
                <Pressable
                  key={participant.user_id}
                  onPress={() => {
                    onClose();
                    (router as any).push(`/(drawer)/profile/${participant.user_id}`);
                  }}
                  style={({ pressed }) => [
                    styles.participantRow,
                    pressed && { backgroundColor: theme.bgHover },
                  ]}>
                  <ThemedText
                    style={[styles.participantRank, { color: theme.textSecondary }]}>
                    {index + 1}
                  </ThemedText>
                  {participant.avatar_uri ? (
                    <Image
                      source={{ uri: participant.avatar_uri }}
                      style={styles.participantAvatar}
                      contentFit="cover"
                    />
                  ) : (
                    <View
                      style={[
                        styles.participantAvatar,
                        styles.avatarFallback,
                        { backgroundColor: theme.bgSecondary },
                      ]}>
                      <Icon name="person" size={16} color={theme.textSecondary} />
                    </View>
                  )}
                  <View style={styles.participantInfo}>
                    <ThemedText numberOfLines={1} style={styles.participantName}>
                      {participant.display_name}
                    </ThemedText>
                    <ThemedText themeColor="textSecondary" style={styles.metaText}>
                      {t('contribution.postsCount', { count: participant.posts_count })}
                      {' · '}
                      {t('contribution.pointsShort', { points: participant.total_points_earned })}
                    </ThemedText>
                  </View>
                  <ThemedText themeColor="textSecondary" style={styles.metaText}>
                    {formatDate(participant.joined_at, language)}
                  </ThemedText>
                </Pressable>
              ))
            )}
          </ScrollView>

          <Pressable
            onPress={onClose}
            style={({ pressed }) => [
              styles.modalBtn,
              { borderColor: theme.border },
              pressed && styles.pressed,
            ]}>
            <ThemedText themeColor="textSecondary" style={styles.modalBtnText}>
              {t('common.close')}
            </ThemedText>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  wrap: {
    padding: Spacing.md,
    gap: Spacing.md,
    paddingBottom: Spacing.xl,
  },
  headerRow: {
    gap: Spacing.xs,
  },
  headerText: {
    gap: 4,
  },
  eyebrow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  eyebrowText: {
    ...Typography.caption,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  title: {
    ...Typography.h2,
    fontSize: 20,
  },
  subtitle: {
    ...Typography.body,
    fontSize: 13,
    lineHeight: 18,
  },
  createBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderRadius: Radius.pill,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs + 3,
    minHeight: 38,
    alignSelf: 'flex-start',
    marginTop: Spacing.xs,
  },
  createBtnText: {
    ...Typography.body,
    fontSize: 13,
    fontWeight: '600',
  },
  filters: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  filterBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderRadius: Radius.pill,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs + 1,
  },
  filterBtnText: {
    ...Typography.body,
    fontSize: 13,
    fontWeight: '600',
  },
  filterCount: {
    ...Typography.caption,
    fontWeight: '700',
  },
  cardList: {
    gap: Spacing.md,
  },
  card: {
    borderRadius: 16,
    borderWidth: 1,
    padding: Spacing.md,
    gap: Spacing.sm,
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.sm,
  },
  statePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderRadius: Radius.pill,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 3,
  },
  statePillText: {
    ...Typography.caption,
    fontWeight: '700',
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  pointsChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: Radius.pill,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 3,
  },
  pointsChipText: {
    ...Typography.caption,
    fontWeight: '600',
  },
  cardTitle: {
    ...Typography.h2,
    fontSize: 16,
  },
  cardDesc: {
    ...Typography.body,
    fontSize: 13,
    lineHeight: 18,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  hashtag: {
    ...Typography.body,
    fontSize: 13,
    fontWeight: '700',
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  metaText: {
    ...Typography.caption,
  },
  participantsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.sm,
  },
  progressTrack: {
    flex: 1,
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
    maxWidth: 140,
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
  },
  quota: {
    gap: 6,
  },
  quotaDots: {
    flexDirection: 'row',
    gap: 5,
  },
  quotaDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  quotaText: {
    ...Typography.caption,
  },
  hashtagHint: {
    ...Typography.caption,
    fontStyle: 'italic',
  },
  cardActions: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: Spacing.sm,
    marginTop: 2,
  },
  joinBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Radius.pill,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs + 2,
    minHeight: 34,
    minWidth: 76,
  },
  joinBtnText: {
    ...Typography.caption,
    fontWeight: '700',
  },
  joinedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: Radius.pill,
    paddingHorizontal: Spacing.sm + 2,
    paddingVertical: 5,
  },
  joinedBadgeText: {
    ...Typography.caption,
    fontWeight: '600',
  },
  ghostBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderWidth: 1,
    borderRadius: Radius.pill,
    paddingHorizontal: Spacing.sm + 2,
    paddingVertical: 6,
  },
  ghostBtnText: {
    ...Typography.caption,
    fontWeight: '600',
  },
  iconBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  memberHint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: Spacing.xs,
  },
  memberHintText: {
    ...Typography.caption,
    flex: 1,
  },
  stateWrap: {
    borderRadius: 16,
    borderWidth: 1,
    paddingVertical: Spacing.xl,
    paddingHorizontal: Spacing.lg,
    alignItems: 'center',
    gap: Spacing.sm,
  },
  emptyIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stateTitle: {
    ...Typography.h2,
    fontSize: 16,
    textAlign: 'center',
  },
  stateHint: {
    ...Typography.body,
    fontSize: 13,
    textAlign: 'center',
  },
  primaryBtn: {
    borderRadius: Radius.pill,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.xs + 4,
    marginTop: Spacing.xs,
  },
  primaryBtnText: {
    ...Typography.body,
    fontSize: 13,
    fontWeight: '600',
  },
  skelPill: {
    width: 90,
    height: 20,
    borderRadius: 10,
  },
  skelLine: {
    height: 14,
    borderRadius: 7,
  },
  pressed: {
    opacity: 0.75,
  },
  // --- Modal form / participants ---
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    paddingHorizontal: Spacing.md,
  },
  modal: {
    borderRadius: 16,
    borderWidth: 1,
    padding: Spacing.md,
    gap: Spacing.sm,
    maxHeight: '86%',
  },
  modalTitle: {
    ...Typography.h2,
    fontSize: 17,
  },
  formScroll: {
    flexGrow: 0,
  },
  fieldLabel: {
    ...Typography.caption,
    fontWeight: '600',
    marginTop: Spacing.xs,
  },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: Spacing.sm + 2,
    paddingVertical: Spacing.xs + 2,
    fontSize: 14,
    marginTop: 4,
  },
  inputMultiline: {
    minHeight: 72,
    textAlignVertical: 'top',
  },
  hint: {
    ...Typography.caption,
    marginTop: 3,
  },
  fieldError: {
    ...Typography.caption,
    fontWeight: '600',
    marginTop: 4,
  },
  statusRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginTop: 4,
  },
  statusBtn: {
    flex: 1,
    borderWidth: 1,
    borderRadius: Radius.pill,
    paddingVertical: Spacing.xs + 1,
    alignItems: 'center',
  },
  statusText: {
    ...Typography.caption,
    fontWeight: '600',
  },
  modalFooter: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginTop: Spacing.xs,
  },
  modalBtn: {
    flex: 1,
    borderWidth: 1,
    borderRadius: Radius.pill,
    paddingVertical: Spacing.xs + 3,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 38,
  },
  modalBtnText: {
    ...Typography.body,
    fontSize: 13,
    fontWeight: '600',
  },
  participantHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.sm,
  },
  participantScroll: {
    flexGrow: 0,
    minHeight: 120,
  },
  participantRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.xs + 2,
    borderRadius: 10,
  },
  participantRank: {
    ...Typography.caption,
    fontWeight: '700',
    width: 20,
    textAlign: 'center',
  },
  participantAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    overflow: 'hidden',
  },
  avatarFallback: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  participantInfo: {
    flex: 1,
    gap: 1,
  },
  participantName: {
    ...Typography.body,
    fontSize: 14,
    fontWeight: '600',
  },
  participantEmpty: {
    alignItems: 'center',
    gap: Spacing.xs,
    paddingVertical: Spacing.lg,
  },
});

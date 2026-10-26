import { useCallback, useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import {
  Stack,
  useFocusEffect,
  useLocalSearchParams,
  useRouter,
} from 'expo-router';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';

import { showAlert } from '@/utils/alert';
import { apiErrorMessage } from '@/api/client';
import { getMyAds, createAd, updateAd } from '@/api/partner';
import { getMySubscription, getPackages } from '@/api/package';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Icon } from '@/components/ui/icon';
import { Radius, Spacing } from '@/constants/spacing';
import { useTheme } from '@/hooks/use-theme';
import { useTranslation } from '@/hooks/useTranslation';
import type { AdMediaFile } from '@/types/partner';

const FORMATS = ['image', 'video', 'carousel'] as const;
const GENDERS = ['all', 'male', 'female'] as const;

/** 'YYYY-MM-DD' | 'YYYY-MM-DD HH:mm' → RFC3339 (server time.Parse);
 *  rỗng → undefined; không parse được → null (báo lỗi input). */
function toRfc3339(value: string): string | null | undefined {
  const s = value.trim();
  if (!s) return undefined;
  const d = new Date(s.replace(' ', 'T'));
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

function toInputDate(iso?: string): string {
  return iso ? iso.slice(0, 10) : '';
}

function FieldLabel({
  text,
  required = false,
}: {
  text: string;
  required?: boolean;
}) {
  const colors = useTheme();
  return (
    <View style={styles.labelRow}>
      <ThemedText type="small" style={styles.labelText}>
        {text}
      </ThemedText>
      {required && (
        <ThemedText type="small" style={{ color: colors.danger }}>
          *
        </ThemedText>
      )}
    </View>
  );
}

export default function AdFormScreen() {
  const colors = useTheme();
  const { t } = useTranslation();
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string }>();
  const id = typeof params.id === 'string' && params.id ? params.id : undefined;
  const isEdit = id !== undefined;

  const [loading, setLoading] = useState(isEdit);
  const [meta, setMeta] = useState<{
    status: string;
    rejection_reason?: string;
    media_uri: string;
  } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [tried, setTried] = useState(false);

  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [targetUrl, setTargetUrl] = useState('');
  const [format, setFormat] = useState('image');
  const [budget, setBudget] = useState('');
  const [dailyBudget, setDailyBudget] = useState('');
  const [cpmPrice, setCpmPrice] = useState('');
  const [cpcPrice, setCpcPrice] = useState('');
  const [maxImpressions, setMaxImpressions] = useState('');
  const [startedAt, setStartedAt] = useState('');
  const [expiresAt, setExpiresAt] = useState('');
  const [targetGender, setTargetGender] = useState('all');
  const [ageMin, setAgeMin] = useState('18');
  const [ageMax, setAgeMax] = useState('65');
  const [locations, setLocations] = useState('');
  const [media, setMedia] = useState<AdMediaFile | null>(null);
  const [caps, setCaps] = useState<{ video: boolean; carousel: boolean } | null>(
    null,
  );

  const initRef = useRef(false);

  // Khởi tạo 1 lần: edit → prefill từ list (server không có GET /:id);
  // create → đọc capabilities gói để gate format.
  const init = useCallback(async () => {
    if (isEdit && id) {
      try {
        const res = await getMyAds({ page: 1, page_size: 100 });
        const found = res.ads.find((a) => a.id === id);
        if (!found) throw new Error(t('common.error'));
        setTitle(found.title);
        setBudget(String(found.budget));
        setStartedAt(toInputDate(found.started_at));
        setExpiresAt(toInputDate(found.expires_at));
        setMeta({
          status: found.status,
          rejection_reason: found.rejection_reason,
          media_uri: found.media_uri,
        });
      } catch (e) {
        showAlert(t('common.error'), apiErrorMessage(e, t('common.error')));
        router.back();
        return;
      } finally {
        setLoading(false);
      }
    } else {
      const [pkgs, sub] = await Promise.allSettled([
        getPackages(),
        getMySubscription(),
      ]);
      if (pkgs.status === 'fulfilled' && sub.status === 'fulfilled') {
        const pkg = pkgs.value.find(
          (p) => p.name === sub.value.package_name,
        );
        if (pkg) {
          setCaps({ video: pkg.supports_video, carousel: pkg.supports_carousel });
        }
      }
      setLoading(false);
    }
  }, [id, isEdit, router, t]);

  useFocusEffect(
    useCallback(() => {
      if (initRef.current) return;
      initRef.current = true;
      void init();
    }, [init]),
  );

  const pickMedia = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      showAlert(t('common.error'), t('story.permissionNeeded'));
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images', 'videos'],
      quality: 0.8,
    });
    if (result.canceled || !result.assets[0]) return;
    const a = result.assets[0];
    const isVideo = (a.mimeType ?? '').startsWith('video');
    setMedia({
      uri: a.uri,
      name: a.fileName ?? `ad-${Date.now()}.${isVideo ? 'mp4' : 'jpg'}`,
      type: a.mimeType ?? (isVideo ? 'video/mp4' : 'image/jpeg'),
    });
  };

  const titleOk = title.trim().length > 0;
  const contentOk = content.trim().length > 0;
  const urlOk = targetUrl.trim().length > 0;
  const budgetOk = Number(budget) > 0;
  const startedRfc = toRfc3339(startedAt);
  const expiresRfc = toRfc3339(expiresAt);
  const startedInvalid = startedAt.trim().length > 0 && startedRfc === null;
  const expiresInvalid = expiresAt.trim().length > 0 && expiresRfc === null;
  const formOk =
    titleOk &&
    contentOk &&
    urlOk &&
    budgetOk &&
    !startedInvalid &&
    !expiresInvalid;

  const submit = async () => {
    setTried(true);
    if (!formOk || submitting) return;
    setSubmitting(true);
    try {
      const base = {
        title: title.trim(),
        content: content.trim(),
        target_url: targetUrl.trim(),
        budget: Number(budget),
        daily_budget: Number(dailyBudget) || 0,
        cpm_price: Number(cpmPrice) || 0,
        cpc_price: Number(cpcPrice) || 0,
        max_impressions: Number(maxImpressions) || 0,
        started_at: startedRfc ?? undefined,
        expires_at: expiresRfc ?? undefined,
        target_gender: targetGender,
        target_age_min: Number(ageMin) || 0,
        target_age_max: Number(ageMax) || 100,
        target_locations: locations
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
      };
      if (isEdit && id) {
        await updateAd(id, base);
        showAlert(t('common.success'), t('partner.form.updateSuccess'), [
          { text: t('common.ok'), onPress: () => router.back() },
        ]);
      } else {
        await createAd({ ...base, format }, media ?? undefined);
        showAlert(t('common.success'), t('partner.form.createSuccess'), [
          { text: t('common.ok'), onPress: () => router.back() },
        ]);
      }
    } catch (e) {
      showAlert(t('common.error'), apiErrorMessage(e, t('common.error')));
    } finally {
      setSubmitting(false);
    }
  };

  const statusLabel = (s: string) => {
    const map: Record<string, string> = {
      active: t('partner.ads.active'),
      paused: t('partner.ads.paused'),
      completed: t('partner.ads.completed'),
      pending: t('partner.ads.pending'),
      rejected: t('partner.ads.rejected'),
    };
    return map[s] ?? s;
  };

  const genderLabel = (g: string) => {
    const map: Record<string, string> = {
      all: t('partner.form.genderAll'),
      male: t('partner.form.genderMale'),
      female: t('partner.form.genderFemale'),
    };
    return map[g] ?? g;
  };

  const inputStyle = (invalid = false) => [
    styles.input,
    {
      backgroundColor: colors.card,
      borderColor: tried && invalid ? colors.danger : colors.border,
      color: colors.text,
    },
  ];

  const chipStyle = (active: boolean, disabled = false) => [
    styles.chip,
    {
      backgroundColor: active ? colors.primary : colors.card,
      borderColor: active ? colors.primary : colors.border,
    },
    disabled && styles.chipDisabled,
  ];

  const chipTextStyle = (active: boolean) => ({
    color: active ? colors.textOnPrimary : colors.text,
    fontWeight: active ? ('600' as const) : ('400' as const),
  });

  if (loading) {
    return (
      <ThemedView style={styles.center}>
        <ActivityIndicator size="small" color={colors.primary} />
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <Stack.Screen
        options={{
          title: isEdit ? t('partner.ads.edit') : t('partner.ads.create'),
        }}
      />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled">
          {meta && (
            <View
              style={[
                styles.banner,
                { backgroundColor: colors.card, borderColor: colors.border },
              ]}>
              <ThemedText type="small">
                {t('partner.ads.status')}: {statusLabel(meta.status)}
              </ThemedText>
              {meta.rejection_reason ? (
                <ThemedText type="small" style={{ color: colors.danger }}>
                  {t('partner.ads.rejectionReason')}: {meta.rejection_reason}
                </ThemedText>
              ) : null}
            </View>
          )}

          {!isEdit ? (
            <View style={styles.section}>
              <FieldLabel text={t('partner.form.uploadMedia')} />
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => void pickMedia()}
                style={[
                  styles.uploadBox,
                  { borderColor: colors.border, backgroundColor: colors.card },
                ]}>
                {media ? (
                  <View style={styles.previewWrap}>
                    {media.type.startsWith('video') ? (
                      <View
                        style={[
                          styles.preview,
                          styles.previewFallback,
                          { backgroundColor: colors.primaryLight },
                        ]}>
                        <Icon name="video" size={28} color={colors.primary} />
                      </View>
                    ) : (
                      <Image
                        source={{ uri: media.uri }}
                        style={styles.preview}
                        contentFit="cover"
                      />
                    )}
                    <TouchableOpacity
                      activeOpacity={0.8}
                      hitSlop={8}
                      style={[styles.removeBtn, { backgroundColor: colors.danger }]}
                      onPress={() => setMedia(null)}>
                      <Icon name="close" size={12} color={colors.textOnPrimary} />
                    </TouchableOpacity>
                  </View>
                ) : (
                  <View style={styles.uploadInner}>
                    <Icon name="images" size={26} color={colors.primary} />
                    <ThemedText
                      type="small"
                      themeColor="textSecondary"
                      style={styles.uploadText}>
                      {t('partner.form.uploadMedia')}
                    </ThemedText>
                  </View>
                )}
              </TouchableOpacity>
            </View>
          ) : meta?.media_uri ? (
            <View style={styles.section}>
              <FieldLabel text={t('partner.form.uploadMedia')} />
              <Image
                source={{ uri: meta.media_uri }}
                style={[styles.preview, styles.editPreview]}
                contentFit="cover"
              />
            </View>
          ) : null}

          {!isEdit && (
            <View style={styles.section}>
              <FieldLabel text={t('partner.form.format')} />
              <View style={styles.chipsRow}>
                {FORMATS.map((f) => {
                  const disabled =
                    f === 'video'
                      ? caps !== null && !caps.video
                      : f === 'carousel'
                        ? caps !== null && !caps.carousel
                        : false;
                  const active = format === f;
                  return (
                    <TouchableOpacity
                      key={f}
                      activeOpacity={0.75}
                      disabled={disabled}
                      onPress={() => setFormat(f)}
                      style={chipStyle(active, disabled)}>
                      <ThemedText type="small" style={chipTextStyle(active)}>
                        {f === 'image'
                          ? 'Image'
                          : f === 'video'
                            ? 'Video'
                            : 'Carousel'}
                      </ThemedText>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          )}

          <View style={styles.section}>
            <FieldLabel text={t('partner.form.title')} required />
            <TextInput
              value={title}
              onChangeText={setTitle}
              maxLength={100}
              placeholderTextColor={colors.textSecondary}
              style={inputStyle(!titleOk)}
            />
          </View>

          <View style={styles.section}>
            <FieldLabel text={t('partner.form.content')} required />
            <TextInput
              value={content}
              onChangeText={setContent}
              maxLength={2000}
              multiline
              textAlignVertical="top"
              placeholderTextColor={colors.textSecondary}
              style={[...inputStyle(!contentOk), styles.multiline]}
            />
          </View>

          <View style={styles.section}>
            <FieldLabel text={t('partner.form.targetUrl')} required />
            <TextInput
              value={targetUrl}
              onChangeText={setTargetUrl}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
              placeholder="https://"
              placeholderTextColor={colors.textSecondary}
              style={inputStyle(!urlOk)}
            />
          </View>

          <View style={styles.section}>
            <FieldLabel text={t('partner.form.budget')} required />
            <TextInput
              value={budget}
              onChangeText={setBudget}
              keyboardType="numeric"
              placeholder="0"
              placeholderTextColor={colors.textSecondary}
              style={inputStyle(!budgetOk)}
            />
          </View>

          <View style={styles.row2}>
            <View style={styles.col}>
              <FieldLabel text={t('partner.form.dailyBudget')} />
              <TextInput
                value={dailyBudget}
                onChangeText={setDailyBudget}
                keyboardType="numeric"
                placeholder="0"
                placeholderTextColor={colors.textSecondary}
                style={inputStyle()}
              />
            </View>
            <View style={styles.col}>
              <FieldLabel text={t('partner.form.maxImpressions')} />
              <TextInput
                value={maxImpressions}
                onChangeText={setMaxImpressions}
                keyboardType="numeric"
                placeholder="0"
                placeholderTextColor={colors.textSecondary}
                style={inputStyle()}
              />
            </View>
          </View>

          <View style={styles.row2}>
            <View style={styles.col}>
              <FieldLabel text={t('partner.form.cpmPrice')} />
              <TextInput
                value={cpmPrice}
                onChangeText={setCpmPrice}
                keyboardType="numeric"
                placeholder="0"
                placeholderTextColor={colors.textSecondary}
                style={inputStyle()}
              />
            </View>
            <View style={styles.col}>
              <FieldLabel text={t('partner.form.cpcPrice')} />
              <TextInput
                value={cpcPrice}
                onChangeText={setCpcPrice}
                keyboardType="numeric"
                placeholder="0"
                placeholderTextColor={colors.textSecondary}
                style={inputStyle()}
              />
            </View>
          </View>

          <View style={styles.section}>
            <FieldLabel text={t('partner.form.startDate')} />
            <TextInput
              value={startedAt}
              onChangeText={setStartedAt}
              autoCapitalize="none"
              autoCorrect={false}
              placeholder="YYYY-MM-DD"
              placeholderTextColor={colors.textSecondary}
              style={inputStyle(startedInvalid)}
            />
            {startedInvalid && (
              <ThemedText type="small" style={{ color: colors.danger }}>
                {t('partner.form.invalidDate')}
              </ThemedText>
            )}
          </View>

          <View style={styles.section}>
            <FieldLabel text={t('partner.form.endDate')} />
            <TextInput
              value={expiresAt}
              onChangeText={setExpiresAt}
              autoCapitalize="none"
              autoCorrect={false}
              placeholder="YYYY-MM-DD"
              placeholderTextColor={colors.textSecondary}
              style={inputStyle(expiresInvalid)}
            />
            {expiresInvalid && (
              <ThemedText type="small" style={{ color: colors.danger }}>
                {t('partner.form.invalidDate')}
              </ThemedText>
            )}
          </View>

          <View style={styles.section}>
            <FieldLabel text={t('partner.form.targetGender')} />
            <View style={styles.chipsRow}>
              {GENDERS.map((g) => {
                const active = targetGender === g;
                return (
                  <TouchableOpacity
                    key={g}
                    activeOpacity={0.75}
                    onPress={() => setTargetGender(g)}
                    style={chipStyle(active)}>
                    <ThemedText type="small" style={chipTextStyle(active)}>
                      {genderLabel(g)}
                    </ThemedText>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          <View style={styles.section}>
            <FieldLabel text={t('partner.form.targetAge')} />
            <View style={styles.row2}>
              <View style={styles.col}>
                <ThemedText type="small" themeColor="textSecondary">
                  {t('partner.form.ageMin')}
                </ThemedText>
                <TextInput
                  value={ageMin}
                  onChangeText={setAgeMin}
                  keyboardType="numeric"
                  placeholder="18"
                  placeholderTextColor={colors.textSecondary}
                  style={inputStyle()}
                />
              </View>
              <View style={styles.col}>
                <ThemedText type="small" themeColor="textSecondary">
                  {t('partner.form.ageMax')}
                </ThemedText>
                <TextInput
                  value={ageMax}
                  onChangeText={setAgeMax}
                  keyboardType="numeric"
                  placeholder="65"
                  placeholderTextColor={colors.textSecondary}
                  style={inputStyle()}
                />
              </View>
            </View>
          </View>

          <View style={styles.section}>
            <FieldLabel text={t('partner.form.targetLocations')} />
            <TextInput
              value={locations}
              onChangeText={setLocations}
              autoCapitalize="none"
              autoCorrect={false}
              placeholder="Ha Noi, Ho Chi Minh"
              placeholderTextColor={colors.textSecondary}
              style={inputStyle()}
            />
          </View>
        </ScrollView>

        <View
          style={[
            styles.footer,
            { borderTopColor: colors.border, backgroundColor: colors.bg },
          ]}>
          <TouchableOpacity
            activeOpacity={0.8}
            disabled={submitting}
            style={[
              styles.submitBtn,
              { backgroundColor: colors.primary },
              submitting && styles.submitDisabled,
            ]}
            onPress={() => void submit()}>
            {submitting ? (
              <ActivityIndicator size="small" color={colors.textOnPrimary} />
            ) : (
              <ThemedText style={[styles.submitText, { color: colors.textOnPrimary }]}>
                {t('partner.form.save')}
              </ThemedText>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  flex: { flex: 1 },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    padding: Spacing.md,
    gap: Spacing.sm,
    paddingBottom: Spacing.lg,
  },
  banner: {
    borderWidth: 1,
    borderRadius: Radius.md,
    padding: Spacing.sm,
    gap: 4,
  },
  section: { gap: 6 },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  labelText: { fontWeight: '600' },
  input: {
    borderWidth: 1,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 10,
    fontSize: 14,
  },
  multiline: {
    minHeight: 90,
    textAlignVertical: 'top',
  },
  row2: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  col: { flex: 1, gap: 6 },
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.xs,
  },
  chip: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  chipDisabled: { opacity: 0.4 },
  uploadBox: {
    borderWidth: 1,
    borderRadius: Radius.md,
    minHeight: 96,
    overflow: 'hidden',
  },
  uploadInner: {
    flex: 1,
    minHeight: 96,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  uploadText: { textAlign: 'center' },
  previewWrap: { alignSelf: 'flex-start' },
  preview: {
    width: 160,
    height: 96,
    borderRadius: Radius.md,
  },
  previewFallback: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  editPreview: { width: '100%', height: 160 },
  removeBtn: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  footer: {
    borderTopWidth: StyleSheet.hairlineWidth,
    padding: Spacing.md,
  },
  submitBtn: {
    height: 48,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitDisabled: { opacity: 0.5 },
  submitText: { fontSize: 16, fontWeight: '600' },
});

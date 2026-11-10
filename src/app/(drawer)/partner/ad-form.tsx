import { useCallback, useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
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
import DateTimePicker from '@react-native-community/datetimepicker';

import { showAlert } from '@/utils/alert';
import { apiErrorMessage } from '@/api/client';
import {
  createAd,
  getMyAdById,
  replaceAdMedia,
  submitAdForReview,
  updateAd,
} from '@/api/partner';
import { getMySubscription, getPackages } from '@/api/package';
import { getWallet } from '@/api/wallet';
import { getProvinces, type Place } from '@/api/locations';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Icon } from '@/components/ui/icon';
import VideoPlayer from '@/components/video-player';
import { Radius, Spacing } from '@/constants/spacing';
import { useTheme } from '@/hooks/use-theme';
import { useTranslation } from '@/hooks/useTranslation';
import type {
  AdMediaFile,
  AdMediaItem,
  SubscriptionResponse,
} from '@/types/partner';
import type { WalletResponse } from '@/types/wallet';
import { formatVnd } from '@/utils/format';

const FORMATS = ['image', 'video', 'carousel'] as const;
const GENDERS = ['all', 'male', 'female'] as const;
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const MAX_VIDEO_BYTES = 100 * 1024 * 1024;
const MAX_CAROUSEL_BYTES = 30 * 1024 * 1024;
const MAX_VIDEO_MS = 60_000;

type PickerState = {
  field: 'start' | 'end';
  step: 'date' | 'time';
  value: Date;
};

function dateToIso(value: Date): string {
  return value.toISOString();
}

function formatDateTime(value: Date | null, locale: string): string {
  if (!value) return '';
  return value.toLocaleString(locale, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
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

function isVideoUrl(url: string): boolean {
  const path = url.replace(/[?#].*$/, '').toLowerCase();
  return /\.(mp4|webm|mov|m4v|avi|mkv)$/.test(path);
}

function mediaIsVideo(item: AdMediaItem): boolean {
  if (item.media_type?.startsWith('video')) return true;
  return isVideoUrl(item.url);
}

export default function AdFormScreen() {
  const colors = useTheme();
  const { t, language } = useTranslation();
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string }>();
  const id = typeof params.id === 'string' && params.id ? params.id : undefined;
  const isEdit = id !== undefined;

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [tried, setTried] = useState(false);
  const [meta, setMeta] = useState<{
    status: string;
    rejection_reason?: string;
    suspended_reason?: string | null;
    media_uri: string;
  } | null>(null);
  const [existingMedia, setExistingMedia] = useState<AdMediaItem[]>([]);
  const [mediaFiles, setMediaFiles] = useState<AdMediaFile[]>([]);

  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [targetUrl, setTargetUrl] = useState('');
  const [format, setFormat] = useState('image');
  const [budget, setBudget] = useState('');
  const [dailyBudget, setDailyBudget] = useState('');
  const [cpmPrice, setCpmPrice] = useState('');
  const [cpcPrice, setCpcPrice] = useState('');
  const [maxImpressions, setMaxImpressions] = useState('');
  const [startedAt, setStartedAt] = useState<Date | null>(null);
  const [expiresAt, setExpiresAt] = useState<Date | null>(null);
  const [targetGender, setTargetGender] = useState('all');
  const [ageMin, setAgeMin] = useState('18');
  const [ageMax, setAgeMax] = useState('65');
  const [locations, setLocations] = useState<string[]>([]);
  const [provinces, setProvinces] = useState<Place[]>([]);
  const [provinceOpen, setProvinceOpen] = useState(false);
  const [provinceSearch, setProvinceSearch] = useState('');
  const [picker, setPicker] = useState<PickerState | null>(null);

  const [caps, setCaps] = useState<{ video: boolean; carousel: boolean } | null>(
    null,
  );
  const [subscription, setSubscription] = useState<SubscriptionResponse | null>(
    null,
  );
  const [wallet, setWallet] = useState<WalletResponse | null>(null);

  const initRef = useRef(false);

  const init = useCallback(async () => {
    const [provinceRes, pkgRes, subRes, walletRes] = await Promise.allSettled([
      getProvinces(),
      getPackages(),
      getMySubscription(),
      getWallet(),
    ]);

    if (provinceRes.status === 'fulfilled') setProvinces(provinceRes.value);
    if (walletRes.status === 'fulfilled') setWallet(walletRes.value);
    if (subRes.status === 'fulfilled') setSubscription(subRes.value);

    const packages = pkgRes.status === 'fulfilled' ? pkgRes.value : [];
    const sub = subRes.status === 'fulfilled' ? subRes.value : null;
    if (sub) {
      const pkg = packages.find(
        (p) => p.id === sub.package_id || p.name === sub.package_name,
      );
      if (pkg) {
        setCaps({ video: pkg.supports_video, carousel: pkg.supports_carousel });
      }
    }

    if (isEdit && id) {
      try {
        const found = await getMyAdById(id);
        if (!found) throw new Error(t('common.error'));
        setTitle(found.title);
        setContent(found.content);
        setTargetUrl(found.target_url);
        setFormat(found.format || 'image');
        setBudget(String(found.budget));
        setDailyBudget(
          found.daily_budget ? String(found.daily_budget) : '',
        );
        setCpmPrice(found.cpm_price ? String(found.cpm_price) : '');
        setCpcPrice(found.cpc_price ? String(found.cpc_price) : '');
        setMaxImpressions(
          found.max_impressions ? String(found.max_impressions) : '',
        );
        setStartedAt(found.started_at ? new Date(found.started_at) : null);
        setExpiresAt(found.expires_at ? new Date(found.expires_at) : null);
        setTargetGender(found.target_gender || 'all');
        setAgeMin(String(found.target_age_min ?? 0));
        setAgeMax(
          String(
            found.target_age_max && found.target_age_max <= 100
              ? found.target_age_max
              : 100,
          ),
        );
        setLocations(found.target_locations ?? []);
        setExistingMedia(found.media_list ?? []);
        setMeta({
          status: found.status,
          rejection_reason: found.rejection_reason,
          suspended_reason: found.suspended_reason,
          media_uri: found.media_uri,
        });
      } catch (e) {
        showAlert(t('common.error'), apiErrorMessage(e, t('common.error')));
        router.back();
        return;
      }
    }
    setLoading(false);
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
    const carousel = format === 'carousel';
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: format === 'video' ? ['videos'] : ['images'],
      allowsMultipleSelection: carousel,
      selectionLimit: carousel ? Math.max(1, 6 - mediaFiles.length) : 1,
      quality: 0.8,
    });
    if (result.canceled || result.assets.length === 0) return;

    const next: AdMediaFile[] = result.assets.map((asset) => {
      const isVideo = (asset.mimeType ?? '').startsWith('video');
      return {
        uri: asset.uri,
        name:
          asset.fileName ??
          `ad-${Date.now()}.${isVideo ? 'mp4' : 'jpg'}`,
        type: asset.mimeType ?? (isVideo ? 'video/mp4' : 'image/jpeg'),
        fileSize: asset.fileSize ?? undefined,
        durationMs: asset.duration ?? undefined,
      };
    });

    const combined = carousel ? [...mediaFiles, ...next] : next;
    if (carousel && combined.length > 6) {
      showAlert(t('common.error'), t('partner.form.mediaTooMany'));
      return;
    }
    const mediaError = validateMedia(combined, carousel);
    if (mediaError) {
      showAlert(t('common.error'), mediaError);
      return;
    }
    setMediaFiles(carousel ? combined : next.slice(0, 1));
  };

  const validateMedia = (
    files: AdMediaFile[],
    carousel: boolean,
  ): string | null => {
    if (carousel) {
      if (files.length === 1) return t('partner.form.mediaTooFew');
      if (files.length > 6) return t('partner.form.mediaTooMany');
      const total = files.reduce((sum, f) => sum + (f.fileSize ?? 0), 0);
      if (total > MAX_CAROUSEL_BYTES) return t('partner.form.mediaTotalTooLarge');
      for (const file of files) {
        if ((file.type ?? '').startsWith('video')) {
          return t('partner.form.mediaCarouselImagesOnly');
        }
        if ((file.fileSize ?? 0) > MAX_IMAGE_BYTES) {
          return t('partner.form.mediaTooLarge');
        }
      }
      return null;
    }
    const file = files[0];
    if (!file) return null;
    if (format === 'video') {
      if (!(file.type ?? '').startsWith('video')) {
        return t('partner.form.mediaVideoOnly');
      }
      if ((file.fileSize ?? 0) > MAX_VIDEO_BYTES) {
        return t('partner.form.mediaTooLarge');
      }
      if ((file.durationMs ?? 0) > MAX_VIDEO_MS) {
        return t('partner.form.mediaTooLong');
      }
    } else {
      if (!(file.type ?? '').startsWith('image')) {
        return t('partner.form.mediaImageOnly');
      }
      if ((file.fileSize ?? 0) > MAX_IMAGE_BYTES) {
        return t('partner.form.mediaTooLarge');
      }
    }
    return null;
  };

  const removeMedia = (index: number) => {
    setMediaFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const titleOk = title.trim().length > 0;
  const contentOk = content.trim().length > 0;
  const urlOk = /^https?:\/\/\S+$/i.test(targetUrl.trim());
  const budgetValue = Number(budget);
  const budgetOk = Number.isFinite(budgetValue) && budgetValue > 0;
  const dailyValue = Number(dailyBudget) || 0;
  const dailyOk = dailyValue <= 0 || dailyValue <= budgetValue;
  const ageMinValue = Number(ageMin) || 0;
  const ageMaxValue = Number(ageMax) || 100;
  const ageOk = ageMinValue >= 0 && ageMaxValue <= 100 && ageMinValue <= ageMaxValue;
  const datesOk =
    !startedAt || !expiresAt || expiresAt.getTime() > startedAt.getTime();
  const mediaCount = mediaFiles.length + existingMedia.length;
  const mediaOk = format === 'carousel' ? mediaCount >= 2 : true;
  const formOk =
    titleOk &&
    contentOk &&
    urlOk &&
    budgetOk &&
    dailyOk &&
    ageOk &&
    datesOk &&
    mediaOk;

  const gateMessage = (() => {
    if (isEdit) return null;
    if (!subscription) return t('partner.form.subscriptionRequired');
    if (subscription.slots_left <= 0) return t('partner.form.slotsFull');
    if (wallet && budgetOk && budgetValue > wallet.available) {
      return t('partner.form.walletShort', {
        amount: formatVnd(budgetValue - wallet.available),
      });
    }
    return null;
  })();

  const canSubmit = formOk && !gateMessage && !submitting;

  const buildPayload = () => ({
    title: title.trim(),
    content: content.trim(),
    target_url: targetUrl.trim(),
    budget: budgetValue,
    daily_budget: dailyValue,
    cpm_price: Number(cpmPrice) || 0,
    cpc_price: Number(cpcPrice) || 0,
    max_impressions: Number(maxImpressions) || 0,
    started_at: startedAt ? dateToIso(startedAt) : undefined,
    expires_at: expiresAt ? dateToIso(expiresAt) : undefined,
    target_gender: targetGender,
    target_age_min: ageMinValue,
    target_age_max: ageMaxValue,
    target_locations: locations,
  });

  const submit = async (resubmit = false) => {
    setTried(true);
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      if (isEdit && id) {
        await updateAd(id, buildPayload());
        if (mediaFiles.length > 0) {
          await replaceAdMedia(id, mediaFiles);
        }
        if (resubmit) {
          await submitAdForReview(id);
        }
        showAlert(t('common.success'), t('partner.form.updateSuccess'), [
          { text: t('common.ok'), onPress: () => router.back() },
        ]);
      } else {
        await createAd({ ...buildPayload(), format }, mediaFiles);
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
      suspended: t('partner.ads.suspended'),
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

  const provinceName = (place: Place) =>
    language.startsWith('en') ? place.name.en : place.name.vi;

  const toggleProvince = (provinceId: string) => {
    setLocations((prev) =>
      prev.includes(provinceId)
        ? prev.filter((item) => item !== provinceId)
        : prev.length >= 34
          ? prev
          : [...prev, provinceId],
    );
  };

  const openPicker = (field: 'start' | 'end') => {
    const current = field === 'start' ? startedAt : expiresAt;
    setPicker({
      field,
      step: 'date',
      value: current ? new Date(current) : new Date(),
    });
  };

  const onPickerChange = (event: { type?: string }, selected?: Date) => {
    if (!picker) return;
    if (event.type === 'dismissed') {
      setPicker(null);
      return;
    }
    if (!selected) return;
    const next = new Date(picker.value);
    if (picker.step === 'date') {
      next.setFullYear(
        selected.getFullYear(),
        selected.getMonth(),
        selected.getDate(),
      );
      setPicker({ ...picker, step: 'time', value: next });
      return;
    }
    next.setHours(selected.getHours(), selected.getMinutes(), 0, 0);
    if (picker.field === 'start') setStartedAt(next);
    else setExpiresAt(next);
    setPicker(null);
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

  const filteredProvinces = provinces.filter((place) =>
    provinceName(place).toLowerCase().includes(provinceSearch.toLowerCase()),
  );

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
              {meta.suspended_reason ? (
                <ThemedText type="small" style={{ color: colors.danger }}>
                  {t('partner.ads.suspendedReason')}: {meta.suspended_reason}
                </ThemedText>
              ) : null}
            </View>
          )}

          {gateMessage ? (
            <View
              style={[
                styles.banner,
                { backgroundColor: colors.card, borderColor: colors.danger },
              ]}>
              <ThemedText type="small" style={{ color: colors.danger }}>
                {gateMessage}
              </ThemedText>
              <TouchableOpacity
                activeOpacity={0.75}
                onPress={() => router.push('/partner/packages' as never)}>
                <ThemedText type="small" style={{ color: colors.primary }}>
                  {t('partner.nav.packages')}
                </ThemedText>
              </TouchableOpacity>
            </View>
          ) : null}

          <View style={styles.section}>
            <FieldLabel text={t('partner.form.uploadMedia')} />
            {mediaFiles.length > 0 ? (
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={styles.mediaRow}>
                  {mediaFiles.map((file, index) => (
                    <View key={`${file.uri}-${index}`} style={styles.mediaWrap}>
                      {file.type.startsWith('video') ? (
                        <VideoPlayer
                          uri={file.uri}
                          style={styles.preview}
                          muted
                          loop={false}
                          nativeControls
                        />
                      ) : (
                        <Image
                          source={{ uri: file.uri }}
                          style={styles.preview}
                          contentFit="cover"
                        />
                      )}
                      <TouchableOpacity
                        activeOpacity={0.8}
                        hitSlop={8}
                        style={[styles.removeBtn, { backgroundColor: colors.danger }]}
                        onPress={() => removeMedia(index)}>
                        <Icon name="close" size={12} color={colors.textOnPrimary} />
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>
              </ScrollView>
            ) : existingMedia.length > 0 ? (
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={styles.mediaRow}>
                  {existingMedia.map((item) => (
                    <View key={item.url} style={styles.mediaWrap}>
                      {mediaIsVideo(item) ? (
                        <VideoPlayer
                          uri={item.url}
                          style={styles.preview}
                          muted
                          loop={false}
                          nativeControls
                        />
                      ) : (
                        <Image
                          source={{ uri: item.url }}
                          style={styles.preview}
                          contentFit="cover"
                        />
                      )}
                    </View>
                  ))}
                </View>
              </ScrollView>
            ) : null}
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => void pickMedia()}
              style={[
                styles.uploadBox,
                { borderColor: colors.border, backgroundColor: colors.card },
              ]}>
              <View style={styles.uploadInner}>
                <Icon name="images" size={22} color={colors.primary} />
                <ThemedText
                  type="small"
                  themeColor="textSecondary"
                  style={styles.uploadText}>
                  {format === 'carousel'
                    ? t('partner.form.uploadCarousel')
                    : t('partner.form.uploadMedia')}
                </ThemedText>
              </View>
            </TouchableOpacity>
            {isEdit && (
              <ThemedText type="small" themeColor="textSecondary">
                {t('partner.form.replaceMediaHint')}
              </ThemedText>
            )}
          </View>

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
                      onPress={() => {
                        setFormat(f);
                        setMediaFiles([]);
                      }}
                      style={chipStyle(active, disabled)}>
                      <ThemedText type="small" style={chipTextStyle(active)}>
                        {f === 'image'
                          ? t('partner.form.formatImage')
                          : f === 'video'
                            ? t('partner.form.formatVideo')
                            : t('partner.form.formatCarousel')}
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
            {wallet ? (
              <ThemedText type="small" themeColor="textSecondary">
                {t('payment.walletBalance')}: {formatVnd(wallet.available)}
              </ThemedText>
            ) : null}
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
                style={inputStyle(!dailyOk)}
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

          <View style={styles.row2}>
            <View style={styles.col}>
              <FieldLabel text={t('partner.form.startDate')} />
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => openPicker('start')}
                style={inputStyle()}>
                <ThemedText type="small">
                  {formatDateTime(startedAt, language) ||
                    t('partner.form.pickDate')}
                </ThemedText>
              </TouchableOpacity>
            </View>
            <View style={styles.col}>
              <FieldLabel text={t('partner.form.endDate')} />
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => openPicker('end')}
                style={inputStyle()}>
                <ThemedText type="small">
                  {formatDateTime(expiresAt, language) ||
                    t('partner.form.pickDate')}
                </ThemedText>
              </TouchableOpacity>
            </View>
          </View>
          {!datesOk && (
            <ThemedText type="small" style={{ color: colors.danger }}>
              {t('partner.form.invalidDateOrder')}
            </ThemedText>
          )}

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
                  style={inputStyle(!ageOk)}
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
                  style={inputStyle(!ageOk)}
                />
              </View>
            </View>
          </View>

          <View style={styles.section}>
            <FieldLabel text={t('partner.form.targetLocations')} />
            <View style={styles.chipsRow}>
              {locations.map((provinceId) => {
                const place = provinces.find((item) => item.id === provinceId);
                return (
                  <TouchableOpacity
                    key={provinceId}
                    activeOpacity={0.75}
                    onPress={() => toggleProvince(provinceId)}
                    style={chipStyle(true)}>
                    <ThemedText type="small" style={chipTextStyle(true)}>
                      {place ? provinceName(place) : provinceId} ×
                    </ThemedText>
                  </TouchableOpacity>
                );
              })}
            </View>
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => setProvinceOpen(true)}
              style={[
                styles.uploadBox,
                { borderColor: colors.border, backgroundColor: colors.card },
              ]}>
              <ThemedText type="small" themeColor="textSecondary">
                {t('partner.form.selectLocations')}
              </ThemedText>
            </TouchableOpacity>
          </View>
        </ScrollView>

        <View
          style={[
            styles.footer,
            { borderTopColor: colors.border, backgroundColor: colors.bg },
          ]}>
          {isEdit && meta?.status === 'rejected' && (
            <TouchableOpacity
              activeOpacity={0.8}
              disabled={!canSubmit}
              style={[
                styles.submitBtn,
                { backgroundColor: colors.card, borderColor: colors.primary },
                !canSubmit && styles.submitDisabled,
              ]}
              onPress={() => void submit(true)}>
              <ThemedText style={{ color: colors.primary, fontWeight: '600' }}>
                {t('partner.form.saveAndResubmit')}
              </ThemedText>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            activeOpacity={0.8}
            disabled={!canSubmit}
            style={[
              styles.submitBtn,
              { backgroundColor: colors.primary },
              !canSubmit && styles.submitDisabled,
            ]}
            onPress={() => void submit(false)}>
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

      <Modal
        transparent
        animationType="fade"
        visible={picker !== null}
        onRequestClose={() => setPicker(null)}>
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalCard, { backgroundColor: colors.card }]}>
            <ThemedText type="smallBold">
              {picker?.field === 'start'
                ? t('partner.form.startDate')
                : t('partner.form.endDate')}
            </ThemedText>
            {picker && (
              <DateTimePicker
                value={picker.value}
                mode={picker.step}
                display="spinner"
                onChange={onPickerChange}
              />
            )}
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => setPicker(null)}
              style={[styles.modalBtn, { backgroundColor: colors.primary }]}>
              <ThemedText style={{ color: colors.textOnPrimary, fontWeight: '600' }}>
                {t('common.done')}
              </ThemedText>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal
        transparent
        animationType="slide"
        visible={provinceOpen}
        onRequestClose={() => setProvinceOpen(false)}>
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalCard, { backgroundColor: colors.card }]}>
            <ThemedText type="smallBold">
              {t('partner.form.targetLocations')}
            </ThemedText>
            <TextInput
              value={provinceSearch}
              onChangeText={setProvinceSearch}
              placeholder={t('partner.form.searchLocation')}
              placeholderTextColor={colors.textSecondary}
              style={[styles.input, { borderColor: colors.border, color: colors.text }]}
            />
            <ScrollView style={styles.modalList}>
              {filteredProvinces.map((place) => {
                const selected = locations.includes(place.id);
                return (
                  <TouchableOpacity
                    key={place.id}
                    activeOpacity={0.75}
                    onPress={() => toggleProvince(place.id)}
                    style={[
                      styles.modalItem,
                      { borderBottomColor: colors.border },
                    ]}>
                    <ThemedText type="small">{provinceName(place)}</ThemedText>
                    {selected && (
                      <Icon name="check" size={16} color={colors.primary} />
                    )}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => setProvinceOpen(false)}
              style={[styles.modalBtn, { backgroundColor: colors.primary }]}>
              <ThemedText style={{ color: colors.textOnPrimary, fontWeight: '600' }}>
                {t('common.done')}
              </ThemedText>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  flex: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: { padding: Spacing.md, gap: Spacing.md, paddingBottom: Spacing.xl },
  banner: {
    borderWidth: 1,
    borderRadius: Radius.md,
    padding: Spacing.md,
    gap: 4,
  },
  section: { gap: Spacing.xs },
  labelRow: { flexDirection: 'row', gap: 4, alignItems: 'center' },
  labelText: { fontWeight: '600' },
  input: {
    borderWidth: 1,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    minHeight: 42,
    justifyContent: 'center',
  },
  multiline: { minHeight: 110, paddingTop: Spacing.sm },
  row2: { flexDirection: 'row', gap: Spacing.sm },
  col: { flex: 1, gap: Spacing.xs },
  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.xs },
  chip: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
  },
  chipDisabled: { opacity: 0.45 },
  uploadBox: {
    borderWidth: 1,
    borderStyle: 'dashed',
    borderRadius: Radius.md,
    padding: Spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  uploadInner: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  uploadText: { marginLeft: 4 },
  mediaRow: { flexDirection: 'row', gap: Spacing.sm },
  mediaWrap: { position: 'relative' },
  preview: { width: 160, height: 110, borderRadius: Radius.md },
  removeBtn: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  footer: {
    borderTopWidth: StyleSheet.hairlineWidth,
    padding: Spacing.md,
    gap: Spacing.sm,
  },
  submitBtn: {
    height: 48,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitDisabled: { opacity: 0.5 },
  submitText: { fontSize: 16, fontWeight: '600' },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.lg,
  },
  modalCard: {
    width: '100%',
    maxHeight: '80%',
    borderRadius: Radius.lg,
    padding: Spacing.md,
    gap: Spacing.sm,
  },
  modalList: { maxHeight: 320 },
  modalItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  modalBtn: {
    height: 44,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

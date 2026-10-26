import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Animated as RNAnimated,
  KeyboardAvoidingView,
  Modal,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View
} from 'react-native';
import {
  Gesture,
  GestureDetector,
  GestureHandlerRootView,
} from 'react-native-gesture-handler';
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { showAlert } from '@/utils/alert';
import { ThemedText } from '@/components/themed-text';
import { ApiError } from '@/api/client';
import { createReport, getViolationRules } from '@/api/reports';
import { Radius, Spacing } from '@/constants/spacing';
import { Typography } from '@/constants/typography';
import { useTheme } from '@/hooks/use-theme';
import { useShimmer } from '@/hooks/use-shimmer';
import { useTranslation } from '@/hooks/useTranslation';
import type { ReportTargetType, ViolationRule } from '../types/report';

const OTHER_VALUE = '__other__';
const DETAIL_MAX = 1000;
const DISMISS_THRESHOLD = 100;
// Đóng nhanh như comment-sheet/media-viewer: ~0,22s thay vì spring nặng.
const CLOSE_TIMING = { duration: 220, easing: Easing.out(Easing.cubic) } as const;
const OPEN_TIMING = { duration: 260, easing: Easing.out(Easing.cubic) } as const;
// Tham chiếu kéo để backdrop mờ dần / sheet scale (px).
const DRAG_REFERENCE = 300;

const TITLE_KEYS: Record<ReportTargetType, string> = {
  post: 'report.postTitle',
  comment: 'report.commentTitle',
  user: 'report.userTitle',
};

interface Props {
  targetType: ReportTargetType;
  targetId: string;
  onClose: () => void;
  onSubmitted?: () => void;
}

/**
 * Bottom sheet báo cáo (mirror Web ReportModal):
 * chọn rule (radio) hoặc "Lý do khác" + mô tả ≤1000 → POST /reports.
 * Gọi parent mount/unmount để mỗi lần mở fetch lại danh sách rule.
 * Gesture drag-to-dismiss mirror comment-sheet; chặn hoàn toàn khi submitting.
 */
export default function ReportSheet({ targetType, targetId, onClose, onSubmitted }: Props) {
  const theme = useTheme();
  const shimmer = useShimmer();
  const { t } = useTranslation();
  const [rules, setRules] = useState<ViolationRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [selected, setSelected] = useState('');
  const [detail, setDetail] = useState('');
  const [fieldError, setFieldError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Khởi tạo ngoài màn hình (900) để mở vào slide-up thay vì nhảy ra.
  const translateY = useSharedValue(900);
  const backdropOpacity = useSharedValue(1);
  const scale = useSharedValue(1);
  const scrollY = useSharedValue(0);
  // 1 = đang submit → chặn hoàn toàn pan gesture (kéo + dismiss).
  const blocked = useSharedValue(0);

  useEffect(() => {
    blocked.value = submitting ? 1 : 0;
  }, [submitting, blocked]);

  useEffect(() => {
    let cancelled = false;
    getViolationRules(targetType)
      .then((res) => {
        if (cancelled) return;
        setRules(res.rules);
        setLoading(false);
        setLoadError(false);
      })
      .catch(() => {
        if (cancelled) return;
        setLoadError(true);
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [targetType, reloadKey]);

  const retry = () => {
    setLoading(true);
    setLoadError(false);
    setReloadKey((k) => k + 1);
  };

  const handleDismiss = useCallback(() => {
    onClose();
  }, [onClose]);

  const dismissWorklet = useCallback(() => {
    'worklet';
    // eslint-disable-next-line react-hooks/immutability
    translateY.value = withTiming(900, CLOSE_TIMING, (finished) => {
      if (finished) {
        runOnJS(handleDismiss)();
      }
    });
    // eslint-disable-next-line react-hooks/immutability
    backdropOpacity.value = withTiming(0, {
      duration: 180,
      easing: Easing.out(Easing.cubic),
    });
    // eslint-disable-next-line react-hooks/immutability
    scale.value = withTiming(0.96, CLOSE_TIMING);
  }, [handleDismiss, translateY, backdropOpacity, scale]);

  // Gesture cuộn native của ScrollView — pan của sheet chạy song song với nó
  // (pattern y hệt comment-sheet) để vuốt xuống không bị gesture cuộn nuốt.
  const nativeScrollGesture = useMemo(() => Gesture.Native(), []);

  const panGesture = useMemo(
    () =>
      Gesture.Pan()
        .activeOffsetY([-10, 10])
        .failOffsetX([-25, 25])
        .simultaneousWithExternalGesture(nativeScrollGesture)
        .onUpdate((e) => {
          // Đang submit: chặn hoàn toàn, sheet đứng yên.
          if (blocked.value) return;
          // Chỉ cho kéo sheet khi đang ở đầu list (scrollY ≈ 0)
          if (e.translationY > 0 && scrollY.value <= 2) {
            // eslint-disable-next-line react-hooks/immutability
            translateY.value = e.translationY;

            const progress = Math.min(e.translationY / DRAG_REFERENCE, 1);

            // eslint-disable-next-line react-hooks/immutability
            backdropOpacity.value = 1 - progress * 0.85;
            // eslint-disable-next-line react-hooks/immutability
            scale.value = 1 - progress * 0.02;
          }
        })
        .onEnd((e) => {
          const atTop = scrollY.value <= 2;

          if (
            !blocked.value &&
            e.translationY > 0 &&
            atTop &&
            (e.translationY >= DISMISS_THRESHOLD || e.velocityY >= 500)
          ) {
            dismissWorklet();
            return;
          }

          // eslint-disable-next-line react-hooks/immutability
          translateY.value = withSpring(0, { damping: 20 });
          // eslint-disable-next-line react-hooks/immutability
          backdropOpacity.value = withSpring(1, { damping: 20 });
          // eslint-disable-next-line react-hooks/immutability
          scale.value = withSpring(1, { damping: 20 });
        }),
    [nativeScrollGesture, translateY, backdropOpacity, scale, dismissWorklet, scrollY, blocked],
  );

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: translateY.value },
      { scale: scale.value },
    ],
  }));

  const backdropAnimatedStyle = useAnimatedStyle(() => ({
    opacity: backdropOpacity.value,
  }));

  const handleOpen = useCallback(() => {
    // eslint-disable-next-line react-hooks/immutability
    translateY.value = withTiming(0, OPEN_TIMING);
    // eslint-disable-next-line react-hooks/immutability
    backdropOpacity.value = 1;
    // eslint-disable-next-line react-hooks/immutability
    scale.value = 1;
  }, [translateY, backdropOpacity, scale]);

  const animateClose = useCallback(() => {
    // eslint-disable-next-line react-hooks/immutability
    translateY.value = withTiming(900, CLOSE_TIMING, (finished) => {
      if (finished) {
        runOnJS(handleDismiss)();
      }
    });
    // eslint-disable-next-line react-hooks/immutability
    backdropOpacity.value = withTiming(0, { duration: 180, easing: Easing.out(Easing.cubic) });
    // eslint-disable-next-line react-hooks/immutability
    scale.value = withTiming(0.96, CLOSE_TIMING);
  }, [handleDismiss, translateY, backdropOpacity, scale]);

  const handleClose = useCallback(() => {
    if (submitting) return;
    animateClose();
  }, [submitting, animateClose]);

  const handleScroll = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      // eslint-disable-next-line react-hooks/immutability
      scrollY.value = e.nativeEvent.contentOffset.y;
    },
    [scrollY],
  );

  // Parent mount conditional → mount = mỗi lần mở → animate slide-up.
  useEffect(() => {
    handleOpen();
  }, [handleOpen]);

  const handleSubmit = async () => {
    if (submitting) return;
    if (!selected) {
      setFieldError(t('report.selectRequired'));
      return;
    }
    // Mô tả chỉ bắt buộc khi chọn "Lý do khác"; chọn rule cụ thể thì optional.
    if (selected === OTHER_VALUE && !detail.trim()) {
      setFieldError(t('report.detailRequired'));
      return;
    }
    setFieldError('');
    setSubmitting(true);
    try {
      const rule = rules.find((r) => r.id === selected);
      await createReport({
        target_type: targetType,
        target_id: targetId,
        // report_type là trường legacy bắt buộc của server; phân loại thật
        // nằm ở violation_rule_id.
        report_type: rule ? 'violation' : 'other',
        violation_rule_id: rule ? rule.id : undefined,
        reason_detail: detail.trim(),
      });
      showAlert(t('common.success'), t('report.success'));
      // Đóng có animation (không dùng handleClose — submitting vẫn đang true).
      animateClose();
      onSubmitted?.();
    } catch (e) {
      showAlert(
        t('common.error'),
        e instanceof ApiError && e.serverMessage ? e.serverMessage : t('common.error'),
      );
    } finally {
      setSubmitting(false);
    }
  };

  const isOther = selected === OTHER_VALUE || selected === '';
  const sevColor = (severity: string) =>
    severity === 'high'
      ? { bg: theme.dangerLight, fg: theme.danger }
      : severity === 'low'
        ? { bg: theme.bgSecondary, fg: theme.textSecondary }
        : { bg: theme.warningLight, fg: theme.warning };
  const sevLabel = (severity: string) =>
    severity === 'high'
      ? t('violationRules.sevHigh')
      : severity === 'low'
        ? t('violationRules.sevLow')
        : t('violationRules.sevMedium');

  return (
    <Modal visible transparent statusBarTranslucent onRequestClose={handleClose}>
      {/* Bắt buộc có GestureHandlerRootView bên trong Modal (giống comment-sheet) */}
      <GestureHandlerRootView style={styles.flex}>
        {/* Backdrop — bấm để đóng; opacity animate theo mức vuốt */}
        <Pressable style={styles.backdropHit} onPress={handleClose}>
          <Animated.View style={[styles.backdrop, backdropAnimatedStyle]} />
        </Pressable>

        <KeyboardAvoidingView
          style={styles.sheetContainer}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <GestureDetector gesture={panGesture}>
            <Animated.View
              style={[styles.sheet, { backgroundColor: theme.card }, animatedStyle]}>
              <View style={[styles.handle, { backgroundColor: theme.border }]} />
              <ThemedText themeColor="textSecondary" style={styles.title}>
                {t(TITLE_KEYS[targetType])}
              </ThemedText>

              {/* ScrollView cuộn qua Gesture.Native riêng, pan dismiss chạy song song */}
              <GestureDetector gesture={nativeScrollGesture}>
                <ScrollView
                  contentContainerStyle={styles.body}
                  onScroll={handleScroll}
                  scrollEventThrottle={16}>
                  <ThemedText themeColor="textSecondary" style={styles.label}>
                    {t('report.selectReason')}
                  </ThemedText>

                  {loading ? (
                    [0, 1, 2, 3].map((i) => (
                      <RNAnimated.View
                        key={i}
                        style={[
                          styles.skeletonRow,
                          {
                            backgroundColor: theme.bgSecondary,
                            opacity: shimmer,
                          },
                        ]}
                      />
                    ))
                  ) : loadError ? (
                    <View style={styles.loadError}>
                      <ThemedText themeColor="textSecondary" style={styles.loadErrorText}>
                        {t('report.loadFailed')}
                      </ThemedText>
                      <Pressable
                        style={({ pressed }) => [
                          styles.retryBtn,
                          { backgroundColor: theme.primary },
                          pressed && { opacity: 0.85 },
                        ]}
                        onPress={retry}>
                        <ThemedText style={[styles.retryText, { color: theme.textOnPrimary }]}>{t('common.retry')}</ThemedText>
                      </Pressable>
                    </View>
                  ) : (
                    <View>
                      {rules.map((rule) => {
                        const isSelected = selected === rule.id;
                        const sev = sevColor(rule.severity);
                        return (
                          <Pressable
                            key={rule.id}
                            style={[
                              styles.ruleRow,
                              { borderColor: theme.border },
                              isSelected && {
                                borderColor: theme.primary,
                                backgroundColor: theme.bgHover,
                              },
                            ]}
                            onPress={() => {
                              setSelected(rule.id);
                              setFieldError('');
                            }}>
                            <View
                              style={[
                                styles.radio,
                                { borderColor: theme.border },
                                isSelected && {
                                  borderColor: theme.primary,
                                  backgroundColor: theme.primary,
                                },
                              ]}>
                              {isSelected ? <View style={[styles.radioDot, { backgroundColor: theme.textOnPrimary }]} /> : null}
                            </View>
                            <View style={styles.ruleText}>
                              <View style={styles.ruleTitleRow}>
                                <ThemedText style={styles.ruleTitle}>{rule.title}</ThemedText>
                                <View style={[styles.sevPill, { backgroundColor: sev.bg }]}>
                                  <ThemedText style={[styles.sevPillText, { color: sev.fg }]}>
                                    {sevLabel(rule.severity)}
                                  </ThemedText>
                                </View>
                              </View>
                              {rule.description ? (
                                <ThemedText
                                  themeColor="textSecondary"
                                  style={styles.ruleDesc}>
                                  {rule.description}
                                </ThemedText>
                              ) : null}
                            </View>
                          </Pressable>
                        );
                      })}

                      <Pressable
                        style={[
                          styles.ruleRow,
                          { borderColor: theme.border },
                          selected === OTHER_VALUE && {
                            borderColor: theme.primary,
                            backgroundColor: theme.bgHover,
                          },
                        ]}
                        onPress={() => {
                          setSelected(OTHER_VALUE);
                          setFieldError('');
                        }}>
                        <View
                          style={[
                            styles.radio,
                            { borderColor: theme.border },
                            selected === OTHER_VALUE && {
                              borderColor: theme.primary,
                              backgroundColor: theme.primary,
                            },
                          ]}>
                          {selected === OTHER_VALUE ? <View style={[styles.radioDot, { backgroundColor: theme.textOnPrimary }]} /> : null}
                        </View>
                        <ThemedText style={styles.ruleTitle}>{t('report.otherReason')}</ThemedText>
                      </Pressable>
                    </View>
                  )}

                  <ThemedText themeColor="textSecondary" style={styles.label}>
                    {isOther ? t('report.detailLabel') : t('report.detailOptional')}
                  </ThemedText>
                  {!isOther ? (
                    <ThemedText themeColor="textSecondary" style={styles.hint}>
                      {t('report.detailHint')}
                    </ThemedText>
                  ) : null}
                  <View style={[styles.inputWrap, { backgroundColor: theme.bgSecondary }]}>
                    <TextInput
                      style={[styles.input, { color: theme.text }]}
                      value={detail}
                      onChangeText={(v) => {
                        setDetail(v);
                        setFieldError('');
                      }}
                      placeholder={t('report.detailPlaceholder')}
                      placeholderTextColor={theme.textSecondary}
                      multiline
                      maxLength={DETAIL_MAX}
                    />
                  </View>
                  {fieldError ? (
                    <ThemedText style={[styles.fieldError, { color: theme.danger }]}>
                      {fieldError}
                    </ThemedText>
                  ) : null}
                </ScrollView>
              </GestureDetector>

              <View style={styles.actions}>
                <Pressable
                  style={({ pressed }) => [
                    styles.btn,
                    { borderColor: theme.border },
                    pressed && { backgroundColor: theme.bgHover },
                  ]}
                  onPress={handleClose}>
                  <ThemedText style={[styles.btnText, { color: theme.textSecondary }]}>
                    {t('common.cancel')}
                  </ThemedText>
                </Pressable>
                <Pressable
                  style={({ pressed }) => [
                    styles.btn,
                    { backgroundColor: theme.primary, borderColor: theme.primary },
                    (pressed || submitting) && { opacity: 0.85 },
                  ]}
                  disabled={submitting || loading || loadError}
                  onPress={handleSubmit}>
                  <ThemedText style={[styles.btnText, styles.btnPrimaryText, { color: theme.textOnPrimary }]}>
                    {submitting ? t('common.loading') : t('report.submit')}
                  </ThemedText>
                </Pressable>
              </View>
            </Animated.View>
          </GestureDetector>
        </KeyboardAvoidingView>
      </GestureHandlerRootView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  backdropHit: {
    ...StyleSheet.absoluteFill,
  },
  backdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  sheetContainer: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: Radius.lg,
    borderTopRightRadius: Radius.lg,
    paddingBottom: Spacing.xl,
    maxHeight: '85%',
    overflow: 'hidden',
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: Spacing.sm,
    marginBottom: Spacing.xs,
  },
  title: {
    ...Typography.caption,
    textAlign: 'center',
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
  },
  body: {
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.sm,
  },
  label: {
    ...Typography.caption,
    fontWeight: '600',
    marginTop: Spacing.sm,
    marginBottom: Spacing.xs,
  },
  hint: {
    fontSize: 12,
    marginBottom: Spacing.xs,
  },
  skeletonRow: {
    height: 44,
    borderRadius: Radius.md,
    marginBottom: Spacing.sm,
  },
  loadError: {
    alignItems: 'center',
    paddingVertical: Spacing.md,
    gap: Spacing.sm,
  },
  loadErrorText: {
    fontSize: 13,
    textAlign: 'center',
  },
  retryBtn: {
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
  },
  retryText: {
    ...Typography.body,
    fontSize: 14,
    fontWeight: '600',
  },
  ruleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
    borderWidth: 1,
    borderRadius: Radius.md,
    padding: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  radio: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  radioDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  ruleText: {
    flex: 1,
    gap: 2,
  },
  ruleTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    flexWrap: 'wrap',
  },
  ruleTitle: {
    ...Typography.body,
    fontSize: 14,
    fontWeight: '600',
    flexShrink: 1,
  },
  ruleDesc: {
    fontSize: 12,
    lineHeight: 16,
  },
  sevPill: {
    paddingHorizontal: 8,
    paddingVertical: 1,
    borderRadius: 9999,
  },
  sevPillText: {
    fontSize: 11,
    fontWeight: '600',
  },
  inputWrap: {
    padding: Spacing.sm,
    borderRadius: Radius.md,
  },
  input: {
    ...Typography.body,
    fontSize: 14,
    minHeight: 80,
    paddingVertical: Spacing.xs,
    textAlignVertical: 'top',
  },
  fieldError: {
    fontSize: 13,
    marginTop: Spacing.xs,
  },
  actions: {
    flexDirection: 'row',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.sm,
  },
  btn: {
    flex: 1,
    borderWidth: 1,
    borderRadius: Radius.md,
    paddingVertical: Spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnText: {
    ...Typography.body,
    fontSize: 15,
    fontWeight: 600,
  },
  btnPrimaryText: {
  },
});

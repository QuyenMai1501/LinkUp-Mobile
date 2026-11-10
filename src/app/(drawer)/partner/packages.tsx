import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View
} from 'react-native';
import { Stack, useFocusEffect, useRouter } from 'expo-router';

import { showAlert } from '@/utils/alert';
import { decodeToken } from '@/api/auth';
import { ApiError, apiErrorMessage } from '@/api/client';
import {
  createWalletPayment,
  getMySubscription,
  getPackages,
  getPaymentMethods,
  newPaymentRequestId,
} from '@/api/package';
import { getWallet } from '@/api/wallet';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Icon } from '@/components/ui/icon';
import { useAuth } from '@/contexts/auth-context';
import { Radius, Spacing } from '@/constants/spacing';
import { useTheme } from '@/hooks/use-theme';
import { useTranslation } from '@/hooks/useTranslation';
import type { AdPackage, SubscriptionResponse } from '@/types/partner';
import type { PaymentMethodsResponse, WalletResponse } from '@/types/wallet';
import { formatVnd } from '@/utils/format';

const NOT_SUBSCRIBED = 'package.NOT_SUBSCRIBED';

const isNoSubscription = (e: unknown): boolean =>
  e instanceof ApiError &&
  (e.code === NOT_SUBSCRIBED || e.message.includes(NOT_SUBSCRIBED));

export default function PartnerPackagesScreen() {
  const router = useRouter();
  const colors = useTheme();
  const { t, language } = useTranslation();
  const { isAuthenticated, user, accessToken, signIn } = useAuth();

  const [loading, setLoading] = useState(true);
  const [packages, setPackages] = useState<AdPackage[]>([]);
  const [sub, setSub] = useState<SubscriptionResponse | null>(null);
  const [methods, setMethods] = useState<PaymentMethodsResponse | null>(null);
  const [wallet, setWallet] = useState<WalletResponse | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [daysLeft, setDaysLeft] = useState(0);

  const role = accessToken ? decodeToken(accessToken)?.role : undefined;
  const isPartner = role !== undefined && role !== 'USER';

  const activePkgId = sub
    ? (sub.package_id ??
      packages.find((p) => p.name === sub.package_name)?.id ??
      null)
    : null;

  const enabledMethods = methods
    ? methods.methods.filter((m) => m.enabled)
    : [{ key: 'wallet', enabled: true }];
  const method = enabledMethods.some((m) => m.key === methods?.default)
    ? (methods?.default ?? '')
    : (enabledMethods[0]?.key ?? '');

  const load = useCallback(async () => {
    const [pkgs, subscription, methodData, walletData] = await Promise.allSettled([
      getPackages(),
      getMySubscription(),
      getPaymentMethods(),
      getWallet(),
    ]);

    if (pkgs.status === 'fulfilled') {
      setPackages(pkgs.value);
    } else {
      setLoadError(apiErrorMessage(pkgs.reason, t('common.error')));
    }

    if (subscription.status === 'fulfilled') {
      const value = subscription.value;
      setSub(value);
      setDaysLeft(
        Math.max(
          0,
          Math.ceil(
            (new Date(value.expires_at).getTime() - Date.now()) / 86_400_000,
          ),
        ),
      );
    } else if (!isNoSubscription(subscription.reason)) {
      setLoadError(apiErrorMessage(subscription.reason, t('common.error')));
    }

    setMethods(methodData.status === 'fulfilled' ? methodData.value : null);
    setWallet(walletData.status === 'fulfilled' ? walletData.value : null);
    setLoading(false);
  }, [t]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const doPay = async (pkg: AdPackage) => {
    if (!user || submitting) return;
    setSubmitting(true);
    try {
      const res = await createWalletPayment(pkg.id, newPaymentRequestId());
      if (res.tokens) {
        await signIn({ user, tokens: res.tokens });
      }
      showAlert(
        t('common.success'),
        t('packages.walletPaymentSuccess'),
        [
          {
            text: t('common.ok'),
            onPress: () => router.replace('/partner/dashboard' as never),
          },
        ],
      );
    } catch (e) {
      const insufficient =
        e instanceof ApiError && e.code === 'wallet.INSUFFICIENT_BALANCE';
      showAlert(t('common.error'), apiErrorMessage(e, t('common.error')), [
        { text: t('common.cancel'), style: 'cancel' },
        ...(insufficient
          ? [
              {
                text: t('payment.topUp'),
                onPress: () => router.push('/partner/wallet' as never),
              },
            ]
          : []),
      ]);
    } finally {
      setSubmitting(false);
    }
  };

  const onSubscribe = () => {
    if (!selectedId || submitting) return;
    if (!isAuthenticated || !user) {
      showAlert(t('common.error'), t('packages.loginRequired'));
      return;
    }
    if (selectedId === activePkgId) return;
    if (!method) {
      showAlert(t('common.error'), t('payment.noMethod'));
      return;
    }
    if (method !== 'wallet') {
      showAlert(t('payment.method'), t('payment.gatewayComingSoon'));
      return;
    }
    const pkg = packages.find((p) => p.id === selectedId);
    if (!pkg) return;
    if (wallet && pkg.price_monthly > wallet.available) {
      showAlert(
        t('common.error'),
        t('payment.insufficientWallet', {
          amount: formatVnd(pkg.price_monthly - wallet.available),
        }),
        [
          { text: t('common.cancel'), style: 'cancel' },
          {
            text: t('payment.topUp'),
            onPress: () => router.push('/partner/wallet' as never),
          },
        ],
      );
      return;
    }
    if (activePkgId && selectedId !== activePkgId) {
      showAlert(
        t('packages.upgradeConfirm'),
        t('packages.upgradeConfirmMessage'),
        [
          { text: t('common.cancel'), style: 'cancel' },
          { text: t('common.confirm'), onPress: () => void doPay(pkg) },
        ],
      );
      return;
    }
    showAlert(
      t('payment.walletConfirmTitle'),
      t('payment.walletConfirmMessage', {
        name: pkg.name,
        amount: formatVnd(pkg.price_monthly),
      }),
      [
        { text: t('common.cancel'), style: 'cancel' },
        { text: t('common.confirm'), onPress: () => void doPay(pkg) },
      ],
    );
  };

  return (
    <ThemedView style={styles.container}>
      <Stack.Screen options={{ title: t('packages.title') }} />
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="small" color={colors.primary} />
        </View>
      ) : (
        <>
          <ScrollView contentContainerStyle={styles.content}>
            <ThemedText
              type="small"
              themeColor="textSecondary"
              style={styles.subtitle}>
              {t('packages.subtitle')}
            </ThemedText>

            {loadError && (
              <ThemedText type="small" style={{ color: colors.danger }}>
                {loadError}
              </ThemedText>
            )}

            <ThemedView
              style={[
                styles.card,
                { backgroundColor: colors.card, borderColor: colors.border },
              ]}>
              <ThemedText style={styles.cardTitle}>
                {t('packages.currentPackage')}
              </ThemedText>
              {sub ? (
                <View style={styles.cardBody}>
                  <ThemedText type="smallBold">{sub.package_name}</ThemedText>
                  <ThemedText
                    type="small"
                    themeColor="textSecondary"
                    style={styles.metaText}>
                    {t('partner.packages.slotsLeft')}: {sub.slots_left}/
                    {sub.max_slots}
                  </ThemedText>
                  <ThemedText
                    type="small"
                    themeColor="textSecondary"
                    style={styles.metaText}>
                    {t('partner.packages.expiresAt')}:{' '}
                    {new Date(sub.expires_at).toLocaleDateString(language)}
                  </ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">
                    {t('packages.daysLeft', { days: daysLeft })}
                  </ThemedText>
                  {isPartner && (
                    <TouchableOpacity
                      activeOpacity={0.75}
                      style={[styles.linkBtn, { borderColor: colors.primary }]}
                      onPress={() => router.push('/partner/dashboard' as never)}>
                      <ThemedText
                        type="small"
                        style={{ color: colors.primary, fontWeight: '600' }}>
                        {t('packages.openDashboard')}
                      </ThemedText>
                    </TouchableOpacity>
                  )}
                </View>
              ) : (
                <ThemedText
                  type="small"
                  themeColor="textSecondary"
                  style={styles.metaText}>
                  {t('packages.noPackage')}
                </ThemedText>
              )}
            </ThemedView>

            <ThemedText style={styles.sectionTitle}>
              {t('partner.packages.title')}
            </ThemedText>
            {packages.length === 0 ? (
              <ThemedText type="small" themeColor="textSecondary">
                {t('partner.packages.noPackages')}
              </ThemedText>
            ) : (
              packages.map((pkg) => {
                const selected = selectedId === pkg.id;
                const isActive = pkg.id === activePkgId;
                const features: string[] = [
                  `${t('partner.packages.maxSlots')}: ${pkg.max_slots}`,
                  `${t('partner.packages.maxDuration')}: ${t('packages.days', {
                    days: pkg.max_duration_days,
                  })}`,
                  ...(pkg.supports_video
                    ? [t('partner.packages.supportsVideo')]
                    : []),
                  ...(pkg.supports_carousel
                    ? [t('partner.packages.supportsCarousel')]
                    : []),
                  ...(pkg.has_advanced_analytics
                    ? [t('partner.packages.advancedAnalytics')]
                    : []),
                ];
                return (
                  <TouchableOpacity
                    key={pkg.id}
                    activeOpacity={0.75}
                    disabled={isActive}
                    onPress={() => setSelectedId(pkg.id)}>
                    <ThemedView
                      style={[
                        styles.pkgCard,
                        {
                          backgroundColor: colors.card,
                          borderColor: selected || isActive
                            ? colors.primary
                            : colors.border,
                        },
                      ]}>
                      <View style={styles.pkgHeader}>
                        <View style={styles.pkgTitleCol}>
                          <ThemedText type="smallBold" style={styles.pkgName}>
                            {pkg.name}
                          </ThemedText>
                          <ThemedText
                            type="small"
                            themeColor="textSecondary">
                            {pkg.description}
                          </ThemedText>
                        </View>
                        <View style={styles.pkgPriceCol}>
                          <ThemedText
                            style={[styles.price, { color: colors.primary }]}>
                            {formatVnd(pkg.price_monthly)}
                          </ThemedText>
                          <ThemedText
                            type="small"
                            themeColor="textSecondary"
                            style={styles.priceUnit}>
                            {t('partner.packages.priceMonthly')}
                          </ThemedText>
                        </View>
                      </View>
                      <View style={styles.features}>
                        {features.map((f) => (
                          <View
                            key={f}
                            style={[
                              styles.chip,
                              { backgroundColor: colors.primaryLight },
                            ]}>
                            <Icon
                              name="check"
                              size={11}
                              color={colors.primary}
                            />
                            <ThemedText
                              type="small"
                              style={[styles.chipText, { color: colors.primary }]}>
                              {f}
                            </ThemedText>
                          </View>
                        ))}
                      </View>
                      <View style={styles.selectRow}>
                        <View
                          style={[
                            styles.radio,
                            {
                              borderColor: selected
                                ? colors.primary
                                : colors.border,
                            },
                          ]}>
                          {selected && (
                            <View
                              style={[
                                styles.radioDot,
                                { backgroundColor: colors.primary },
                              ]}
                            />
                          )}
                        </View>
                        <ThemedText
                          type="small"
                          style={{
                            color: selected ? colors.primary : colors.text,
                            fontWeight: selected ? '600' : '400',
                          }}>
                          {isActive
                            ? t('partner.packages.subscribed')
                            : selected
                              ? t('packages.selected')
                              : t('packages.select')}
                        </ThemedText>
                      </View>
                    </ThemedView>
                  </TouchableOpacity>
                );
              })
            )}

            <ThemedText style={styles.sectionTitle}>
              {t('payment.method')}
            </ThemedText>
            <ThemedView
              style={[
                styles.methodRow,
                {
                  backgroundColor: colors.card,
                  borderColor:
                    method === 'wallet' ? colors.primary : colors.border,
                },
              ]}>
              <View
                style={[
                  styles.radio,
                  {
                    borderColor:
                      method === 'wallet' ? colors.primary : colors.border,
                  },
                ]}>
                {method === 'wallet' && (
                  <View
                    style={[
                      styles.radioDot,
                      { backgroundColor: colors.primary },
                    ]}
                  />
                )}
              </View>
              <View style={styles.methodCol}>
                <ThemedText type="smallBold">{t('payment.wallet')}</ThemedText>
                <ThemedText
                  type="small"
                  themeColor="textSecondary"
                  style={styles.metaText}>
                  {t('payment.walletBalance')}:{' '}
                  {formatVnd(wallet?.available ?? 0)}
                </ThemedText>
              </View>
              <TouchableOpacity
                activeOpacity={0.75}
                onPress={() => router.push('/partner/wallet' as never)}>
                <ThemedText type="small" style={{ color: colors.primary }}>
                  {t('payment.topUp')}
                </ThemedText>
              </TouchableOpacity>
            </ThemedView>
            {['momo', 'vnpay'].map((key) => (
              <ThemedView
                key={key}
                style={[
                  styles.methodRow,
                  styles.methodRowDisabled,
                  { backgroundColor: colors.card, borderColor: colors.border },
                ]}>
                <View style={[styles.radio, { borderColor: colors.border }]} />
                <ThemedText
                  type="smallBold"
                  themeColor="textSecondary"
                  style={styles.methodCol}>
                  {key === 'momo' ? 'MoMo' : t('payment.vnpay')}
                </ThemedText>
                <View
                  style={[styles.badge, { backgroundColor: colors.primaryLight }]}>
                  <ThemedText
                    style={[styles.badgeText, { color: colors.primary }]}>
                    {t('payment.vnpayComingSoon')}
                  </ThemedText>
                </View>
              </ThemedView>
            ))}
            <TouchableOpacity
              activeOpacity={0.75}
              onPress={() => router.push('/partner/payments' as never)}
              style={[styles.linkBtn, { borderColor: colors.border }]}>
              <ThemedText type="small">
                {t('partner.packages.payments')}
              </ThemedText>
            </TouchableOpacity>
          </ScrollView>

          <View
            style={[
              styles.footer,
              { borderTopColor: colors.border, backgroundColor: colors.bg },
            ]}>
            <TouchableOpacity
              activeOpacity={0.8}
              disabled={!selectedId || selectedId === activePkgId || submitting}
              style={[
                styles.subscribeBtn,
                { backgroundColor: colors.primary },
                (!selectedId || selectedId === activePkgId || submitting) &&
                  styles.subscribeBtnDisabled,
              ]}
              onPress={onSubscribe}>
              {submitting ? (
                <ActivityIndicator size="small" color={colors.textOnPrimary} />
              ) : (
                <ThemedText
                  style={[styles.subscribeText, { color: colors.textOnPrimary }]}>
                  {selectedId && selectedId === activePkgId
                    ? t('partner.packages.subscribed')
                    : t('payment.payNow')}
                </ThemedText>
              )}
            </TouchableOpacity>
          </View>
        </>
      )}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
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
  subtitle: { lineHeight: 20 },
  card: {
    borderRadius: Radius.lg,
    borderWidth: 1,
    padding: Spacing.md,
    gap: Spacing.sm,
  },
  cardTitle: { fontSize: 15, fontWeight: '600' },
  cardBody: { gap: 4 },
  metaText: { lineHeight: 18 },
  linkBtn: {
    marginTop: Spacing.xs,
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
  },
  sectionTitle: {
    marginTop: Spacing.sm,
    fontSize: 15,
    fontWeight: '600',
  },
  pkgCard: {
    borderRadius: Radius.lg,
    borderWidth: 1.5,
    padding: Spacing.md,
    gap: Spacing.sm,
  },
  pkgHeader: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  pkgTitleCol: { flex: 1, gap: 2 },
  pkgName: { fontSize: 15 },
  pkgPriceCol: { alignItems: 'flex-end' },
  price: { fontSize: 17, fontWeight: '700' },
  priceUnit: { fontSize: 11 },
  features: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.xs,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
  },
  chipText: { fontSize: 12 },
  selectRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  radio: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  methodRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    borderWidth: 1,
    borderRadius: Radius.md,
    padding: Spacing.md,
  },
  methodRowDisabled: { opacity: 0.6 },
  methodCol: { flex: 1, gap: 2 },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
  },
  badgeText: { fontSize: 11, fontWeight: '600' },
  footer: {
    borderTopWidth: StyleSheet.hairlineWidth,
    padding: Spacing.md,
  },
  subscribeBtn: {
    height: 48,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  subscribeBtnDisabled: { opacity: 0.5 },
  subscribeText: { fontSize: 16, fontWeight: '600' },
});

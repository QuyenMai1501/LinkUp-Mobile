import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Image } from 'expo-image';
import * as Clipboard from 'expo-clipboard';
import * as ImagePicker from 'expo-image-picker';

import { showAlert } from '@/utils/alert';
import { apiErrorMessage } from '@/api/client';
import { uploadMedia } from '@/api/profile';
import {
  cancelTopup,
  createTopup,
  getWallet,
  listTopups,
  listWalletTransactions,
  reportTopup,
} from '@/api/wallet';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Icon } from '@/components/ui/icon';
import { Radius, Spacing } from '@/constants/spacing';
import { useTheme } from '@/hooks/use-theme';
import { useTranslation } from '@/hooks/useTranslation';
import type {
  WalletResponse,
  WalletTopup,
  WalletTopupCreated,
  WalletTransaction,
} from '@/types/wallet';
import { formatDate, formatVnd } from '@/utils/format';

const PRESETS = [50000, 100000, 200000, 500000, 1000000];
const MIN_TOPUP = 10000;
const MAX_TOPUP = 50000000;

function statusKey(status: string): string {
  const map: Record<string, string> = {
    pending: 'wallet.statusPending',
    paid: 'wallet.statusPaid',
    rejected: 'wallet.statusRejected',
    expired: 'wallet.statusExpired',
    cancelled: 'wallet.statusCancelled',
  };
  return map[status] ?? status;
}

export default function WalletScreen() {
  const colors = useTheme();
  const { t, language } = useTranslation();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [wallet, setWallet] = useState<WalletResponse | null>(null);
  const [topups, setTopups] = useState<WalletTopup[]>([]);
  const [transactions, setTransactions] = useState<WalletTransaction[]>([]);
  const [amount, setAmount] = useState('');
  const [creating, setCreating] = useState(false);
  const [active, setActive] = useState<WalletTopupCreated | null>(null);
  const [reportingId, setReportingId] = useState<string | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(0);

  const load = useCallback(async () => {
    const [walletRes, topupRes, txRes] = await Promise.allSettled([
      getWallet(),
      listTopups(1, 20),
      listWalletTransactions(1, 20),
    ]);
    if (walletRes.status === 'fulfilled') setWallet(walletRes.value);
    if (topupRes.status === 'fulfilled') setTopups(topupRes.value.data ?? []);
    if (txRes.status === 'fulfilled') setTransactions(txRes.value.data ?? []);
    setLoading(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
      const interval = setInterval(() => void load(), 20000);
      return () => clearInterval(interval);
    }, [load]),
  );

  useEffect(() => {
    if (!active) return;
    const tick = () =>
      setSecondsLeft(
        Math.max(
          0,
          Math.ceil((new Date(active.expires_at).getTime() - Date.now()) / 1000),
        ),
      );
    const timeout = setTimeout(tick, 0);
    const interval = setInterval(tick, 1000);
    return () => {
      clearTimeout(timeout);
      clearInterval(interval);
    };
  }, [active]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const copy = async (value: string) => {
    await Clipboard.setStringAsync(value);
    showAlert(t('wallet.copied'));
  };

  const onCreateTopup = async () => {
    const value = Number(amount);
    if (!Number.isFinite(value) || value < MIN_TOPUP || value > MAX_TOPUP) {
      showAlert(t('common.error'), t('wallet.amountInvalid'));
      return;
    }
    setCreating(true);
    try {
      const created = await createTopup(Math.round(value));
      setActive(created);
      setAmount('');
      await load();
    } catch (e) {
      showAlert(t('common.error'), apiErrorMessage(e, t('common.error')));
    } finally {
      setCreating(false);
    }
  };

  const pickProof = async (topupId: string) => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      showAlert(t('common.error'), t('story.permissionNeeded'));
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.8,
    });
    if (result.canceled || !result.assets[0]) return;
    const asset = result.assets[0];
    if (asset.fileSize && asset.fileSize > 10 * 1024 * 1024) {
      showAlert(t('common.error'), t('wallet.proofTooLarge'));
      return;
    }
    setReportingId(topupId);
    try {
      const uploaded = await uploadMedia(
        asset.uri,
        asset.fileName ?? `proof-${Date.now()}.jpg`,
        asset.mimeType ?? 'image/jpeg',
      );
      const proofUrl = uploaded?.data?.file_uri ?? uploaded?.file_uri;
      if (!proofUrl) throw new Error(t('common.error'));
      await reportTopup(topupId, proofUrl);
      showAlert(t('common.success'), t('wallet.reportSuccess'));
      await load();
    } catch (e) {
      showAlert(t('common.error'), apiErrorMessage(e, t('common.error')));
    } finally {
      setReportingId(null);
    }
  };

  const onCancelTopup = (topupId: string) => {
    showAlert(t('wallet.cancelTitle'), t('wallet.cancelConfirm'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.confirm'),
        style: 'destructive',
        onPress: () => {
          void (async () => {
            try {
              await cancelTopup(topupId);
              if (active?.id === topupId) setActive(null);
              await load();
            } catch (e) {
              showAlert(t('common.error'), apiErrorMessage(e, t('common.error')));
            }
          })();
        },
      },
    ]);
  };

  return (
    <ThemedView style={styles.container}>
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="small" color={colors.primary} />
        </View>
      ) : (
        <KeyboardAvoidingView
            style={styles.flex}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            <ScrollView
              contentContainerStyle={styles.content}
              refreshControl={
                <RefreshControl
                  refreshing={refreshing}
                  onRefresh={() => void onRefresh()}
                />
              }>
        <ThemedView
          style={[
            styles.balanceCard,
            { backgroundColor: colors.primary, borderColor: colors.primary },
          ]}>
          <ThemedText type="small" style={{ color: colors.textOnPrimary }}>
            {t('wallet.available')}
          </ThemedText>
          <ThemedText style={[styles.balance, { color: colors.textOnPrimary }]}>
            {formatVnd(wallet?.available ?? 0)}
          </ThemedText>
          <View style={styles.balanceRow}>
            <ThemedText type="small" style={{ color: colors.textOnPrimary }}>
              {t('wallet.reserved')}: {formatVnd(wallet?.reserved ?? 0)}
            </ThemedText>
            <ThemedText type="small" style={{ color: colors.textOnPrimary }}>
              {t('wallet.totalTopup')}: {formatVnd(wallet?.total_topup ?? 0)}
            </ThemedText>
          </View>
        </ThemedView>

        <ThemedText style={styles.sectionTitle}>{t('wallet.topup')}</ThemedText>
        <View style={styles.presets}>
          {PRESETS.map((preset) => (
            <TouchableOpacity
              key={preset}
              activeOpacity={0.75}
              onPress={() => setAmount(String(preset))}
              style={[
                styles.preset,
                {
                  borderColor:
                    Number(amount) === preset ? colors.primary : colors.border,
                  backgroundColor: colors.card,
                },
              ]}>
              <ThemedText type="small">
                {formatVnd(preset).replace(' ₫', '')}
              </ThemedText>
            </TouchableOpacity>
          ))}
        </View>
        <View style={styles.topupRow}>
          <TextInput
            value={amount}
            onChangeText={setAmount}
            keyboardType="numeric"
            placeholder={t('wallet.amountPlaceholder')}
            placeholderTextColor={colors.textSecondary}
            style={[
              styles.input,
              {
                backgroundColor: colors.card,
                borderColor: colors.border,
                color: colors.text,
              },
            ]}
          />
          <TouchableOpacity
            activeOpacity={0.8}
            disabled={creating}
            onPress={() => void onCreateTopup()}
            style={[styles.primaryBtn, { backgroundColor: colors.primary }]}>
            {creating ? (
              <ActivityIndicator size="small" color={colors.textOnPrimary} />
            ) : (
              <ThemedText style={{ color: colors.textOnPrimary, fontWeight: '600' }}>
                {t('wallet.createTopup')}
              </ThemedText>
            )}
          </TouchableOpacity>
        </View>

        {active && (
          <ThemedView
            style={[
              styles.card,
              { backgroundColor: colors.card, borderColor: colors.primary },
            ]}>
            <View style={styles.rowBetween}>
              <ThemedText type="smallBold">
                {t('wallet.topupCode')}: {active.code}
              </ThemedText>
              <ThemedText
                type="small"
                style={{ color: secondsLeft > 0 ? colors.primary : colors.danger }}>
                {t('wallet.expiresIn', {
                  time: `${Math.floor(secondsLeft / 60)}:${String(
                    secondsLeft % 60,
                  ).padStart(2, '0')}`,
                })}
              </ThemedText>
            </View>
            <ThemedText type="small" themeColor="textSecondary">
              {t('wallet.amount')}: {formatVnd(active.amount)}
            </ThemedText>
            {active.qr_url ? (
              <Image
                source={{ uri: active.qr_url }}
                style={styles.qr}
                contentFit="contain"
              />
            ) : null}
            {[
              [t('wallet.bank'), active.bank.bank_name],
              [t('wallet.accountNo'), active.bank.account_no],
              [t('wallet.accountName'), active.bank.account_name],
              [t('wallet.memo'), active.memo],
            ].map(([label, value]) => (
              <View key={label} style={styles.copyRow}>
                <ThemedText type="small" themeColor="textSecondary">
                  {label}: {value}
                </ThemedText>
                <TouchableOpacity onPress={() => void copy(value)} hitSlop={8}>
                  <Icon name="copy" size={16} color={colors.primary} />
                </TouchableOpacity>
              </View>
            ))}
            <View style={styles.actions}>
              <TouchableOpacity
                activeOpacity={0.8}
                disabled={reportingId === active.id}
                onPress={() => void pickProof(active.id)}
                style={[styles.primaryBtn, { backgroundColor: colors.primary }]}>
                {reportingId === active.id ? (
                  <ActivityIndicator size="small" color={colors.textOnPrimary} />
                ) : (
                  <ThemedText style={{ color: colors.textOnPrimary, fontWeight: '600' }}>
                    {t('wallet.reportTransfer')}
                  </ThemedText>
                )}
              </TouchableOpacity>
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => onCancelTopup(active.id)}
                style={[styles.secondaryBtn, { borderColor: colors.border }]}>
                <ThemedText type="small">{t('common.cancel')}</ThemedText>
              </TouchableOpacity>
            </View>
          </ThemedView>
        )}

        <ThemedText style={styles.sectionTitle}>{t('wallet.topupHistory')}</ThemedText>
        {topups.length === 0 ? (
          <ThemedText type="small" themeColor="textSecondary">
            {t('wallet.empty')}
          </ThemedText>
        ) : (
          topups.map((topup) => (
            <ThemedView
              key={topup.id}
              style={[
                styles.card,
                { backgroundColor: colors.card, borderColor: colors.border },
              ]}>
              <View style={styles.rowBetween}>
                <ThemedText type="smallBold">{topup.code}</ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  {t(statusKey(topup.status))}
                </ThemedText>
              </View>
              <ThemedText type="small" themeColor="textSecondary">
                {formatVnd(topup.confirmed_amount ?? topup.amount)} ·{' '}
                {formatDate(topup.created_at, language)}
              </ThemedText>
              {topup.admin_note ? (
                <ThemedText type="small" themeColor="textSecondary">
                  {topup.admin_note}
                </ThemedText>
              ) : null}
              {topup.status === 'pending' && !topup.user_reported_at && (
                <View style={styles.actions}>
                  <TouchableOpacity
                    activeOpacity={0.8}
                    disabled={reportingId === topup.id}
                    onPress={() => void pickProof(topup.id)}
                    style={[styles.primaryBtn, { backgroundColor: colors.primary }]}>
                    {reportingId === topup.id ? (
                      <ActivityIndicator size="small" color={colors.textOnPrimary} />
                    ) : (
                      <ThemedText
                        style={{ color: colors.textOnPrimary, fontWeight: '600' }}>
                        {t('wallet.reportTransfer')}
                      </ThemedText>
                    )}
                  </TouchableOpacity>
                  <TouchableOpacity
                    activeOpacity={0.8}
                    onPress={() => onCancelTopup(topup.id)}
                    style={[styles.secondaryBtn, { borderColor: colors.border }]}>
                    <ThemedText type="small">{t('common.cancel')}</ThemedText>
                  </TouchableOpacity>
                </View>
              )}
            </ThemedView>
          ))
        )}

        <ThemedText style={styles.sectionTitle}>{t('wallet.ledger')}</ThemedText>
        {transactions.length === 0 ? (
          <ThemedText type="small" themeColor="textSecondary">
            {t('wallet.empty')}
          </ThemedText>
        ) : (
          transactions.map((tx) => (
            <View
              key={tx.id}
              style={[styles.txRow, { borderBottomColor: colors.border }]}>
              <View style={styles.txCol}>
                <ThemedText type="smallBold">{tx.type}</ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  {formatDate(tx.created_at, language)}
                </ThemedText>
              </View>
              <View style={styles.txColRight}>
                <ThemedText
                  type="smallBold"
                  style={{ color: tx.amount >= 0 ? colors.success : colors.danger }}>
                  {tx.amount >= 0 ? '+' : ''}
                  {formatVnd(tx.amount)}
                </ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  {formatVnd(tx.balance_after)}
                </ThemedText>
              </View>
            </View>
          ))
        )}
            </ScrollView>
          </KeyboardAvoidingView>
        )}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  flex: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: { padding: Spacing.md, gap: Spacing.sm, paddingBottom: Spacing.xl },
  balanceCard: {
    borderRadius: Radius.lg,
    borderWidth: 1,
    padding: Spacing.lg,
    gap: Spacing.xs,
  },
  balance: { fontSize: 30, fontWeight: '700' },
  balanceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: Spacing.xs,
  },
  sectionTitle: { marginTop: Spacing.md, fontSize: 15, fontWeight: '600' },
  presets: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.xs },
  preset: {
    borderWidth: 1,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  topupRow: { flexDirection: 'row', gap: Spacing.sm },
  input: {
    flex: 1,
    borderWidth: 1,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  card: {
    borderRadius: Radius.lg,
    borderWidth: 1,
    padding: Spacing.md,
    gap: Spacing.sm,
  },
  rowBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  qr: { width: '100%', height: 220 },
  copyRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  actions: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.xs },
  primaryBtn: {
    flex: 1,
    minHeight: 42,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.md,
  },
  secondaryBtn: {
    minHeight: 42,
    borderRadius: Radius.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.md,
  },
  txRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: Spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  txCol: { gap: 2 },
  txColRight: { alignItems: 'flex-end', gap: 2 },
});

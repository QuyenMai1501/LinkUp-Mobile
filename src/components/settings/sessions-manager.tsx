import { useEffect, useState } from 'react';
import { StyleSheet, Alert, ActivityIndicator, TouchableOpacity, Modal } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { getSessions, revokeSession, revokeOtherSessions } from '@/api/settings';
import { useTheme } from '@/hooks/use-theme';
import { Spacing } from '@/constants/spacing';
import type { UserSessionDTO } from '@/types/settings';

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function SessionsManager() {
  const colors = useTheme();

  const [sessions, setSessions] = useState<UserSessionDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [revokingId, setRevokingId] = useState<string | null>(null);
  const [revokingAll, setRevokingAll] = useState(false);
  const [confirmAll, setConfirmAll] = useState(false);

  const load = async () => {
    try {
      const res = await getSessions();
      setSessions(res.data);
    } catch {
      Alert.alert('Lỗi', 'Không thể tải danh sách phiên');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      try {
        const res = await getSessions();
        if (!cancelled) setSessions(res.data);
      } catch {
        if (!cancelled) Alert.alert('Lỗi', 'Không thể tải danh sách phiên');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    run();
    return () => { cancelled = true; };
  }, []);

  const handleRevoke = async (id: string) => {
    setRevokingId(id);
    try {
      await revokeSession(id);
      Alert.alert('Thành công', 'Đã thu hồi phiên');
      await load();
    } catch {
      Alert.alert('Lỗi', 'Không thể thu hồi phiên');
    } finally {
      setRevokingId(null);
    }
  };

  const handleRevokeAll = async () => {
    setRevokingAll(true);
    try {
      await revokeOtherSessions();
      Alert.alert('Thành công', 'Đã thu hồi tất cả phiên khác');
      setConfirmAll(false);
      await load();
    } catch {
      Alert.alert('Lỗi', 'Không thể thu hồi phiên');
    } finally {
      setRevokingAll(false);
    }
  };

  if (loading) {
    return (
      <ThemedView style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
      </ThemedView>
    );
  }

  if (sessions.length === 0) {
    return (
      <ThemedView style={styles.center}>
        <ThemedText style={styles.emptyIcon}>💻</ThemedText>
        <ThemedText style={styles.emptyTitle}>Chưa có phiên nào</ThemedText>
        <ThemedText themeColor="textSecondary" style={styles.emptyDesc}>
          Các phiên đăng nhập sẽ hiển thị ở đây
        </ThemedText>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      {sessions.map((session) => (
        <ThemedView key={session.id} style={[styles.sessionRow, { backgroundColor: colors.card }]}>
          <ThemedView style={styles.sessionInfo}>
            <ThemedText style={styles.sessionIcon}>💻</ThemedText>
            <ThemedView style={styles.sessionDetails}>
              <ThemedView style={styles.sessionHeader}>
                <ThemedText style={styles.sessionDevice}>
                  {session.device_name || '—'}
                </ThemedText>
                {session.is_current && (
                  <ThemedView style={[styles.badge, { backgroundColor: colors.primaryLight }]}>
                    <ThemedText style={[styles.badgeText, { color: colors.primary }]}>
                      Hiện tại
                    </ThemedText>
                  </ThemedView>
                )}
              </ThemedView>
              <ThemedText themeColor="textSecondary" style={styles.sessionMeta}>
                Hoạt động: {formatDate(session.last_active_at)}
              </ThemedText>
              <ThemedText themeColor="textSecondary" style={styles.sessionMeta}>
                Tạo: {formatDate(session.created_at)}
              </ThemedText>
            </ThemedView>
          </ThemedView>
          {!session.is_current && (
            <TouchableOpacity
              onPress={() => handleRevoke(session.id)}
              disabled={revokingId === session.id}
              style={styles.revokeBtn}>
              {revokingId === session.id ? (
                <ActivityIndicator size="small" color={colors.danger} />
              ) : (
                <ThemedText style={[styles.revokeBtnText, { color: colors.danger }]}>
                  Thu hồi
                </ThemedText>
              )}
            </TouchableOpacity>
          )}
        </ThemedView>
      ))}

      {sessions.some((s) => !s.is_current) && (
        <TouchableOpacity
          style={[styles.revokeAllBtn, { borderColor: colors.danger }]}
          onPress={() => setConfirmAll(true)}
          disabled={revokingAll}>
          <ThemedText style={[styles.revokeAllText, { color: colors.danger }]}>
            {revokingAll ? 'Đang thu hồi...' : 'Thu hồi tất cả'}
          </ThemedText>
        </TouchableOpacity>
      )}

      <Modal visible={confirmAll} transparent animationType="fade">
        <ThemedView style={styles.overlay}>
          <ThemedView style={[styles.modal, { backgroundColor: colors.card }]}>
            <ThemedText style={styles.modalTitle}>Thu hồi tất cả phiên</ThemedText>
            <ThemedText themeColor="textSecondary" style={styles.modalDesc}>
              Bạn có chắc muốn thu hồi tất cả phiên khác? Thiết bị sẽ cần đăng nhập lại.
            </ThemedText>
            <ThemedView style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalBtn, { borderColor: colors.border }]}
                onPress={() => setConfirmAll(false)}>
                <ThemedText style={styles.modalBtnText}>Hủy</ThemedText>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalBtn, { backgroundColor: colors.danger }]}
                onPress={handleRevokeAll}>
                <ThemedText style={[styles.modalBtnText, { color: '#fff' }]}>
                  {revokingAll ? 'Đang xử lý...' : 'Xác nhận'}
                </ThemedText>
              </TouchableOpacity>
            </ThemedView>
          </ThemedView>
        </ThemedView>
      </Modal>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { gap: Spacing.md },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.sm },
  emptyIcon: { fontSize: 48 },
  emptyTitle: { fontSize: 16, fontWeight: '600' },
  emptyDesc: { fontSize: 14, textAlign: 'center' },
  sessionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: Spacing.md,
    borderRadius: 12,
  },
  sessionInfo: { flexDirection: 'row', flex: 1, gap: Spacing.md },
  sessionIcon: { fontSize: 28 },
  sessionDetails: { flex: 1, gap: 2 },
  sessionHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  sessionDevice: { fontSize: 15, fontWeight: '600' },
  badge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
  badgeText: { fontSize: 11, fontWeight: '600' },
  sessionMeta: { fontSize: 12 },
  revokeBtn: { padding: Spacing.sm },
  revokeBtnText: { fontSize: 13, fontWeight: '600' },
  revokeAllBtn: {
    borderWidth: 1,
    borderRadius: 12,
    padding: Spacing.md,
    alignItems: 'center',
  },
  revokeAllText: { fontSize: 15, fontWeight: '600' },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modal: {
    width: '85%',
    borderRadius: 16,
    padding: Spacing.lg,
    gap: Spacing.md,
  },
  modalTitle: { fontSize: 18, fontWeight: '700', textAlign: 'center' },
  modalDesc: { fontSize: 14, textAlign: 'center', lineHeight: 20 },
  modalActions: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.sm },
  modalBtn: {
    flex: 1,
    height: 44,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  modalBtnText: { fontSize: 15, fontWeight: '600' },
});

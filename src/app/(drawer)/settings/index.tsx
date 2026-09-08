import { TouchableOpacity, Pressable, StyleSheet, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useNavigation } from 'expo-router';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useTheme } from '@/hooks/use-theme';
import { Spacing } from '@/constants/spacing';

const SETTINGS_ITEMS = [
  { key: 'change-password', icon: '🔒', label: 'Đổi mật khẩu', desc: 'Thay đổi mật khẩu tài khoản' },
  { key: 'privacy', icon: '🛡️', label: 'Bảo mật', desc: 'Quản lý cài đặt bảo mật' },
  { key: 'storage', icon: '💾', label: 'Lưu trữ', desc: 'Xem dung lượng đã sử dụng' },
  { key: 'appearance', icon: '🎨', label: 'Giao diện', desc: 'Giao diện và ngôn ngữ' },
  { key: 'sessions', icon: '💻', label: 'Phiên đăng nhập', desc: 'Quản lý các thiết bị đã đăng nhập' },
  { key: 'notifications', icon: '🔔', label: 'Thông báo', desc: 'Tùy chọn thông báo' },
  { key: 'deactivate', icon: '⚠️', label: 'Vô hiệu hóa tài khoản', desc: 'Tạm thời tắt tài khoản' },
] as const;

export default function SettingsIndex() {
  const router = useRouter();
  const navigation = useNavigation();
  const colors = useTheme();

  const openDrawer = () => {
    (navigation as any).openDrawer?.();
  };

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ThemedView style={styles.headerRow}>
          <Pressable onPress={openDrawer} style={styles.menuBtn}>
            <ThemedText style={[styles.menuIcon, { color: colors.text }]}>☰</ThemedText>
          </Pressable>
          <ThemedText style={styles.header}>Cài đặt</ThemedText>
        </ThemedView>
        <ScrollView contentContainerStyle={styles.list}>
          {SETTINGS_ITEMS.map((item, index) => (
            <TouchableOpacity
              key={item.key}
              onPress={() => router.push(`/(drawer)/settings/${item.key}` as any)}
              activeOpacity={0.7}>
              <ThemedView
                style={[
                  styles.item,
                  { backgroundColor: colors.card },
                  index === SETTINGS_ITEMS.length - 1 && styles.itemLast,
                ]}>
                <ThemedText style={styles.icon}>{item.icon}</ThemedText>
                <ThemedView style={styles.itemContent}>
                  <ThemedText style={styles.label}>{item.label}</ThemedText>
                  <ThemedText themeColor="textSecondary" style={styles.desc}>
                    {item.desc}
                  </ThemedText>
                </ThemedView>
                <ThemedText style={[styles.arrow, { color: colors.textSecondary }]}>›</ThemedText>
              </ThemedView>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1 },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.lg,
    gap: Spacing.sm,
  },
  menuBtn: { padding: Spacing.xs },
  menuIcon: { fontSize: 22 },
  header: {
    fontSize: 28,
    fontWeight: '700',
  },
  list: { paddingHorizontal: Spacing.lg, gap: Spacing.sm },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    borderRadius: 12,
    gap: Spacing.md,
  },
  itemLast: {},
  icon: { fontSize: 24 },
  itemContent: { flex: 1, gap: 2 },
  label: { fontSize: 15, fontWeight: '600' },
  desc: { fontSize: 13 },
  arrow: { fontSize: 22, fontWeight: '300' },
});

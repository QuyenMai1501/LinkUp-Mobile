import type { useRouter } from 'expo-router';

/**
 * Điều hướng tới trang hồ sơ người dùng `/(drawer)/profile/[userId]`.
 * Gom集中 một chỗ để các màn hình bấm avatar không tự push rải rác.
 * Không làm gì nếu userId rỗng/undefined (tin lỗi, dữ liệu thiếu…).
 */
export function navigateToProfile(
  router: ReturnType<typeof useRouter>,
  userId?: string | null,
) {
  if (!userId) return;
  (router as any).push(`/(drawer)/profile/${userId}`);
}

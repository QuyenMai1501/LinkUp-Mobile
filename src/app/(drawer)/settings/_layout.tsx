import { Stack } from 'expo-router';
import { useThemeMode } from '@/contexts/theme-context';
import { Colors } from '@/constants/colors';

export default function SettingsLayout() {
  const { scheme } = useThemeMode();
  const colors = Colors[scheme];

  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.bg },
        headerTintColor: colors.text,
        headerTitleStyle: { fontWeight: '600' },
        headerShadowVisible: false,
      }}>
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="change-password" options={{ title: 'Đổi mật khẩu' }} />
      <Stack.Screen name="privacy" options={{ title: 'Bảo mật' }} />
      <Stack.Screen name="storage" options={{ title: 'Lưu trữ' }} />
      <Stack.Screen name="appearance" options={{ title: 'Giao diện' }} />
      <Stack.Screen name="sessions" options={{ title: 'Phiên đăng nhập' }} />
      <Stack.Screen name="notifications" options={{ title: 'Thông báo' }} />
      <Stack.Screen name="deactivate" options={{ title: 'Vô hiệu hóa' }} />
    </Stack>
  );
}

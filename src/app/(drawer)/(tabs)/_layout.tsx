import { Tabs, useRouter } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Colors } from '@/constants/colors';
import { useThemeMode } from '@/contexts/theme-context';

function HamburgerButton() {
  const router = useRouter();
  return (
    <Pressable
      onPress={() => router.navigate('/(drawer)' as any)}
      style={({ pressed }) => [styles.hamburger, pressed && { opacity: 0.7 }]}>
      <ThemedText style={styles.hamburgerIcon}>☰</ThemedText>
    </Pressable>
  );
}

export default function TabsLayout() {
  const { scheme } = useThemeMode();
  const colors = Colors[scheme];

  return (
    <Tabs
      screenOptions={{
        headerShown: true,
        headerLeft: () => <HamburgerButton />,
        headerStyle: { backgroundColor: colors.bg },
        headerTintColor: colors.text,
        headerTitleStyle: { fontWeight: '600' },
        tabBarStyle: {
          backgroundColor: colors.bg,
          borderTopColor: colors.border,
        },
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textSecondary,
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Trang chủ',
          tabBarLabel: 'Home',
          tabBarIcon: ({ color }) => (
            <ThemedText style={{ fontSize: 20, color }}>🏠</ThemedText>
          ),
        }}
      />
      <Tabs.Screen
        name="messages"
        options={{
          title: 'Tin nhắn',
          tabBarLabel: 'Messages',
          tabBarIcon: ({ color }) => (
            <ThemedText style={{ fontSize: 20, color }}>💬</ThemedText>
          ),
        }}
      />
      <Tabs.Screen
        name="notifications"
        options={{
          title: 'Thông báo',
          tabBarLabel: 'Notifications',
          tabBarIcon: ({ color }) => (
            <ThemedText style={{ fontSize: 20, color }}>🔔</ThemedText>
          ),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  hamburger: {
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  hamburgerIcon: {
    fontSize: 22,
  },
});

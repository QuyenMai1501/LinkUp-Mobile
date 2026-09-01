import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { SymbolView, type SymbolViewProps } from 'expo-symbols';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, MaxContentWidth, Radius, Spacing, Typography } from '@/constants/theme';
import { useThemeMode } from '@/contexts/theme-context';
import { useTheme } from '@/hooks/use-theme';

type FeatureIcon = Extract<SymbolViewProps['name'], { ios?: unknown }>;

type Feature = {
  title: string;
  description: string;
  icon: FeatureIcon;
};

const FEATURES: Feature[] = [
  {
    title: 'Kết bạn',
    description: 'Kết nối với bạn bè và mở rộng mối quan hệ',
    icon: { ios: 'person.2.fill', android: 'group', web: 'group' },
  },
  {
    title: 'Chia sẻ',
    description: 'Đăng bài viết, ảnh và cập nhật trạng thái',
    icon: { ios: 'photo.on.rectangle', android: 'photo_library', web: 'photo_library' },
  },
  {
    title: 'Chat & Gọi video',
    description: 'Nhắn tin riêng tư và gọi video trực tiếp',
    icon: { ios: 'video.fill', android: 'videocam', web: 'videocam' },
  },
  {
    title: 'Cộng đồng & Tin',
    description: 'Tham gia cộng đồng và theo dõi tin bạn bè',
    icon: { ios: 'person.3.fill', android: 'diversity_3', web: 'diversity_3' },
  },
];

function ThemeToggleButton() {
  const { scheme, toggleTheme } = useThemeMode();
  const theme = useTheme();
  const isDark = scheme === 'dark';

  return (
    <Pressable
      onPress={toggleTheme}
      style={({ pressed }) => [
        styles.toggleButton,
        { backgroundColor: theme.backgroundElement },
        pressed && styles.pressed,
      ]}>
      <SymbolView
        tintColor={theme.primary}
        name={{
          ios: isDark ? 'moon.fill' : 'sun.max.fill',
          android: isDark ? 'dark_mode' : 'light_mode',
          web: isDark ? 'dark_mode' : 'light_mode',
        }}
        size={16}
      />
      <ThemedText themeColor="textSecondary" type="small">
        {isDark ? 'Tối' : 'Sáng'}
      </ThemedText>
    </Pressable>
  );
}

function FeatureCard({ feature }: { feature: Feature }) {
  const theme = useTheme();

  return (
    <ThemedView type="card" style={[styles.featureCard, { borderColor: theme.border }]}>
      <SymbolView tintColor={theme.primary} name={feature.icon} size={22} />
      <ThemedText style={styles.featureTitle}>{feature.title}</ThemedText>
      <ThemedText themeColor="textSecondary" style={styles.featureDescription}>
        {feature.description}
      </ThemedText>
    </ThemedView>
  );
}

export default function HomeScreen() {
  const theme = useTheme();
  const router = useRouter();

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={styles.header}>
            <Image
              source={require('@/assets/images/S-Logo-Rmbg.png')}
              style={styles.logo}
              contentFit="contain"
            />
            <ThemedText style={styles.brandName}>LinkUp</ThemedText>
            <ThemeToggleButton />
          </View>

          <View style={styles.hero}>
            <Image
              source={require('@/assets/images/S-Logo-Rmbg.png')}
              style={styles.heroLogo}
              contentFit="contain"
            />
            <ThemedText style={styles.tagline}>Mạng xã hội kết nối cộng đồng Việt</ThemedText>
            <ThemedText themeColor="textSecondary" style={styles.subtitle}>
              Kết bạn, chia sẻ khoảnh khắc, trò chuyện và gọi video với mọi người — mọi lúc, mọi
              nơi.
            </ThemedText>
          </View>

          <View style={styles.featuresGrid}>
            {FEATURES.map((feature) => (
              <FeatureCard key={feature.title} feature={feature} />
            ))}
          </View>

          <View style={styles.ctaRow}>
            <Pressable
              onPress={() => router.push('/login')}
              style={({ pressed }) => [
                styles.ctaPrimary,
                { backgroundColor: theme.secondary },
                pressed && styles.pressed,
              ]}>
              <ThemedText style={styles.ctaPrimaryText}>Bắt đầu ngay</ThemedText>
            </Pressable>
            <Pressable
              onPress={() => router.push('/register')}
              style={({ pressed }) => [
                styles.ctaSecondary,
                { borderColor: theme.primary, backgroundColor: theme.primaryLight },
                pressed && styles.pressed,
              ]}>
              <ThemedText style={[styles.ctaSecondaryText, { color: theme.primary }]}>
                Tìm hiểu thêm
              </ThemedText>
            </Pressable>
          </View>

          <ThemedText themeColor="textSecondary" style={styles.footer}>
            LinkUp — Bản thử nghiệm
          </ThemedText>
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  scrollContent: {
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    alignItems: 'center',
    gap: Spacing.xl,
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.md,
    paddingBottom: BottomTabInset + Spacing.xl,
  },
  header: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  logo: {
    width: 40,
    height: 40,
  },
  brandName: {
    ...Typography.h2,
    fontSize: 22,
  },
  toggleButton: {
    marginLeft: 'auto',
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: Radius.pill,
  },
  hero: {
    alignItems: 'center',
    gap: Spacing.md,
  },
  heroLogo: {
    width: 84,
    height: 84,
  },
  tagline: {
    ...Typography.h2,
    textAlign: 'center',
  },
  subtitle: {
    ...Typography.body,
    textAlign: 'center',
  },
  featuresGrid: {
    width: '100%',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.md,
  },
  featureCard: {
    flexBasis: '46%',
    flexGrow: 1,
    gap: Spacing.sm,
    padding: Spacing.md,
    borderRadius: Radius.lg,
    borderWidth: 1,
  },
  featureTitle: {
    ...Typography.h2,
    fontSize: 16,
    lineHeight: 22,
  },
  featureDescription: {
    ...Typography.caption,
  },
  ctaRow: {
    width: '100%',
    flexDirection: 'row',
    gap: Spacing.md,
  },
  ctaPrimary: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: Spacing.md,
    borderRadius: Radius.md,
  },
  ctaPrimaryText: {
    ...Typography.body,
    fontWeight: 700,
    color: '#FFFFFF',
  },
  ctaSecondary: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: Spacing.md,
    borderRadius: Radius.pill,
    borderWidth: 1.5,
  },
  ctaSecondaryText: {
    ...Typography.body,
    fontWeight: 700,
  },
  footer: {
    ...Typography.caption,
  },
  pressed: {
    opacity: 0.7,
  },
});

import { ActivityIndicator, Animated, StyleSheet, View } from 'react-native';

import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useShimmer } from '@/hooks/use-shimmer';

export function ProfileSkeleton({ showCover = true }: { showCover?: boolean }) {
  const theme = useTheme();
  const shimmer = useShimmer();

  return (
    <Animated.View
      style={[styles.container, { backgroundColor: theme.background, opacity: shimmer }]}>
      {showCover && <View style={[styles.cover, { backgroundColor: theme.border }]} />}
      <View style={styles.body}>
        <View style={[styles.avatar, { backgroundColor: theme.border }]} />
        <View style={[styles.lineWide, { backgroundColor: theme.border }]} />
        <View style={[styles.lineMedium, { backgroundColor: theme.border }]} />
        <View style={[styles.lineShort, { backgroundColor: theme.border }]} />
        <View style={styles.statRow}>
          <View style={[styles.statLine, { backgroundColor: theme.border }]} />
          <View style={[styles.statLine, { backgroundColor: theme.border }]} />
        </View>
        <View style={styles.buttonRow}>
          <View style={[styles.buttonLine, { backgroundColor: theme.border }]} />
          <View style={[styles.buttonLine, { backgroundColor: theme.border }]} />
        </View>
      </View>
      <ActivityIndicator size="large" color={theme.primary} style={styles.spinner} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  cover: { height: 180, width: '100%' },
  body: { alignItems: 'center', paddingTop: Spacing.lg, gap: Spacing.sm },
  avatar: { width: 96, height: 96, borderRadius: 48 },
  lineWide: { width: 160, height: 16, borderRadius: Radius.sm },
  lineMedium: { width: 120, height: 14, borderRadius: Radius.sm },
  lineShort: { width: 80, height: 12, borderRadius: Radius.sm },
  statRow: { flexDirection: 'row', gap: Spacing.xl, marginTop: Spacing.sm },
  statLine: { width: 60, height: 12, borderRadius: Radius.sm },
  buttonRow: { flexDirection: 'row', gap: Spacing.md, marginTop: Spacing.md },
  buttonLine: { width: 100, height: 36, borderRadius: Radius.pill },
  spinner: { marginTop: Spacing.xl },
});

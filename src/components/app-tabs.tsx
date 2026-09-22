import { Ionicons } from '@expo/vector-icons';
import { NativeTabs } from 'expo-router/unstable-native-tabs';

import { Colors } from '@/constants/theme';
import { useThemeMode } from '@/contexts/theme-context';

export default function AppTabs() {
  const { scheme } = useThemeMode();
  const colors = Colors[scheme];

  return (
    <NativeTabs
      backgroundColor={colors.background}
      indicatorColor={colors.backgroundElement}
      labelStyle={{ selected: { color: colors.text } }}>
      <NativeTabs.Trigger name="index">
        <NativeTabs.Trigger.Label>Home</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon
          src={
            <NativeTabs.Trigger.VectorIcon
              family={Ionicons}
              name="home-outline"
            />
          }
        />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="explore">
        <NativeTabs.Trigger.Label>Explore</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon
          src={
            <NativeTabs.Trigger.VectorIcon
              family={Ionicons}
              name="compass-outline"
            />
          }
        />
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}

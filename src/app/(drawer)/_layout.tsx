import { Drawer } from 'expo-router/drawer';

import DrawerContent from '@/components/drawer-content';
import { Colors } from '@/constants/colors';
import { useThemeMode } from '@/contexts/theme-context';

export default function DrawerLayout() {
  const { scheme } = useThemeMode();
  const colors = Colors[scheme];

  return (
    <Drawer
      drawerContent={(props) => <DrawerContent {...props} />}
      screenOptions={{
        headerShown: false,
        drawerStyle: {
          backgroundColor: colors.bg,
          width: 280,
        },
        swipeEnabled: true,
        swipeEdgeWidth: 50,
      }}>
      <Drawer.Screen name="(tabs)" />
      <Drawer.Screen name="friends" />
      <Drawer.Screen name="communities" />
      <Drawer.Screen name="saved" />
      <Drawer.Screen name="settings" />
      <Drawer.Screen name="profile" />
    </Drawer>
  );
}

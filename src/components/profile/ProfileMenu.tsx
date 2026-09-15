import { useRef, useState } from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Radius, Spacing, Typography } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useTranslation } from '@/hooks/useTranslation';
import { blockUser } from '@/api/block';

interface ProfileMenuProps {
  userId: string;
  isSelf: boolean;
}

export function ProfileMenu({ userId, isSelf }: ProfileMenuProps) {
  const theme = useTheme();
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const [blocking, setBlocking] = useState(false);
  const menuRef = useRef<View>(null);

  if (isSelf) return null;

  const handleBlock = async () => {
    setBlocking(true);
    try {
      await blockUser(userId);
      Alert.alert(t('common.success'), '');
      setIsOpen(false);
    } catch {
      Alert.alert(t('common.error'), '');
    } finally {
      setBlocking(false);
    }
  };

  return (
    <View ref={menuRef} style={styles.container}>
      <Pressable
        onPress={() => setIsOpen(!isOpen)}
        style={styles.trigger}>
        <ThemedText style={styles.dots}>•••</ThemedText>
      </Pressable>

      {isOpen && (
        <>
          <Pressable style={styles.overlay} onPress={() => setIsOpen(false)} />
          <ThemedView style={[styles.menu, { borderColor: theme.border }]}>
            <Pressable
              onPress={handleBlock}
              disabled={blocking}
              style={styles.menuItem}>
              <ThemedText style={[styles.menuText, { color: theme.danger }]}>
                {t('friends.actions.blockUser')}
              </ThemedText>
            </Pressable>
          </ThemedView>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { position: 'relative', zIndex: 100 },
  trigger: { padding: Spacing.sm },
  dots: { fontSize: 18, fontWeight: '700', letterSpacing: 2 },
  overlay: {
    ...StyleSheet.absoluteFill,
    zIndex: 99,
  },
  menu: {
    position: 'absolute',
    top: '100%',
    right: 0,
    minWidth: 160,
    borderRadius: Radius.md,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
    zIndex: 100,
    overflow: 'hidden',
  },
  menuItem: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  menuText: { ...Typography.body, fontSize: 14 },
});

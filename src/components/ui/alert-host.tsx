import { useEffect, useSyncExternalStore } from 'react';
import { BackHandler, Modal, Pressable, StyleSheet, View, type TextStyle } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/spacing';
import { useThemeMode } from '@/contexts/theme-context';
import { useTheme } from '@/hooks/use-theme';
import { useTranslation } from '@/hooks/useTranslation';
import {
  getAlertSnapshot,
  hideAlert,
  subscribeAlert,
  type AlertButton,
} from '@/utils/alert';

/**
 * Host render showAlert() — dialog centered cùng theme app (light/dark in-app,
 * không theo system như Alert native). Mount 1 lần trong root layout.
 */
export default function AlertHost() {
  const colors = useTheme();
  const { scheme } = useThemeMode();
  const { t } = useTranslation();
  const alert = useSyncExternalStore(subscribeAlert, getAlertSnapshot, getAlertSnapshot);

  // Android back: đóng dialog, không chạy nút nào (an toàn với destructive).
  useEffect(() => {
    if (!alert) return;
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      hideAlert();
      return true;
    });
    return () => subscription.remove();
  }, [alert]);

  if (!alert) return null;

  const buttons: AlertButton[] =
    alert.buttons && alert.buttons.length > 0 ? alert.buttons : [{ text: t('common.ok') }];

  const handlePress = (button: AlertButton) => {
    hideAlert();
    button.onPress?.();
  };

  return (
    <Modal
      visible
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={() => hideAlert()}>
      <View style={styles.overlay}>
        <View
          style={[
            styles.card,
            {
              backgroundColor: colors.card,
              borderColor: colors.border,
              shadowOpacity: scheme === 'dark' ? 0.5 : 0.18,
            },
          ]}>
          <View style={styles.body}>
            <ThemedText style={styles.title}>{alert.title}</ThemedText>
            {alert.message ? (
              <ThemedText themeColor="textSecondary" style={styles.message}>
                {alert.message}
              </ThemedText>
            ) : null}
          </View>
          <View>
            {buttons.map((button, index) => {
              const color =
                button.style === 'destructive'
                  ? colors.danger
                  : button.style === 'cancel'
                    ? colors.text
                    : colors.primary;
              const fontWeight: TextStyle['fontWeight'] =
                button.style === 'cancel' ? '700' : '600';
              return (
                <Pressable
                  key={`${button.text}-${index}`}
                  onPress={() => handlePress(button)}
                  style={({ pressed }) => [
                    styles.btn,
                    { borderTopWidth: 1, borderTopColor: colors.border },
                    pressed && styles.btnPressed,
                  ]}>
                  <ThemedText style={[styles.btnText, { color, fontWeight }]}>
                    {button.text}
                  </ThemedText>
                </Pressable>
              );
            })}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.lg,
  },
  card: {
    width: '100%',
    maxWidth: 340,
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowRadius: 24,
    elevation: 8,
  },
  body: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.md,
    gap: Spacing.sm,
  },
  title: { fontSize: 17, fontWeight: '700', textAlign: 'center' },
  message: { fontSize: 14, lineHeight: 20, textAlign: 'center' },
  btn: { height: 46, alignItems: 'center', justifyContent: 'center', paddingHorizontal: Spacing.md },
  btnPressed: { opacity: 0.55 },
  btnText: { fontSize: 15 },
});

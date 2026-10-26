import SettingsScreen from '@/components/settings/settings-screen';
import NotificationsForm from '@/components/settings/notifications-form';
import { useTranslation } from '@/hooks/useTranslation';

export default function NotificationsScreen() {
  const { t } = useTranslation();

  return (
    <SettingsScreen title={t('settings.items.notifications.label')}>
      <NotificationsForm />
    </SettingsScreen>
  );
}

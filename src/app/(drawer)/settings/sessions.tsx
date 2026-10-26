import SettingsScreen from '@/components/settings/settings-screen';
import SessionsManager from '@/components/settings/sessions-manager';
import { useTranslation } from '@/hooks/useTranslation';

export default function SessionsScreen() {
  const { t } = useTranslation();

  return (
    <SettingsScreen title={t('settings.items.sessions.label')}>
      <SessionsManager />
    </SettingsScreen>
  );
}

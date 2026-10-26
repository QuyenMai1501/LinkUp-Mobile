import SettingsScreen from '@/components/settings/settings-screen';
import DeactivateAccount from '@/components/settings/deactivate-account';
import { useTranslation } from '@/hooks/useTranslation';

export default function DeactivateScreen() {
  const { t } = useTranslation();

  return (
    <SettingsScreen title={t('settings.items.deactivate.label')}>
      <DeactivateAccount />
    </SettingsScreen>
  );
}

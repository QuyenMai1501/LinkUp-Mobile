import SettingsScreen from '@/components/settings/settings-screen';
import AppearanceForm from '@/components/settings/appearance-form';
import { useTranslation } from '@/hooks/useTranslation';

export default function AppearanceScreen() {
  const { t } = useTranslation();

  return (
    <SettingsScreen title={t('settings.items.appearance.label')}>
      <AppearanceForm />
    </SettingsScreen>
  );
}

import SettingsScreen from '@/components/settings/settings-screen';
import PrivacyForm from '@/components/settings/privacy-form';
import { useTranslation } from '@/hooks/useTranslation';

export default function PrivacyScreen() {
  const { t } = useTranslation();

  return (
    <SettingsScreen title={t('settings.items.privacy.label')}>
      <PrivacyForm />
    </SettingsScreen>
  );
}

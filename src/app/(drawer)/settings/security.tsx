import SettingsScreen from '@/components/settings/settings-screen';
import E2ERecoveryForm from '@/components/settings/e2e-recovery-form';
import { useTranslation } from '@/hooks/useTranslation';

export default function SecurityScreen() {
  const { t } = useTranslation();

  return (
    <SettingsScreen title={t('settings.items.security.label')}>
      <E2ERecoveryForm />
    </SettingsScreen>
  );
}

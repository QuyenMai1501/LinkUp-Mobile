import SettingsScreen from '@/components/settings/settings-screen';
import ChangePasswordForm from '@/components/settings/change-password-form';
import { useTranslation } from '@/hooks/useTranslation';

export default function ChangePasswordScreen() {
  const { t } = useTranslation();

  return (
    <SettingsScreen title={t('settings.items.changePassword.label')}>
      <ChangePasswordForm />
    </SettingsScreen>
  );
}

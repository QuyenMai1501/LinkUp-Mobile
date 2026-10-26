import SettingsScreen from '@/components/settings/settings-screen';
import StorageInfo from '@/components/settings/storage-info';
import { useTranslation } from '@/hooks/useTranslation';

export default function StorageScreen() {
  const { t } = useTranslation();

  return (
    <SettingsScreen title={t('settings.items.storage.label')}>
      <StorageInfo />
    </SettingsScreen>
  );
}

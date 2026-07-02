import { UserSelector as SharedUserSelector } from '@rehab-trainer/ui/components/UserSelector';
import { useT } from '../i18n';
import { userStore } from '../utils/settings';

interface UserSelectorProps {
  onUserChange?: (name: string | null) => void;
}

export function UserSelector({ onUserChange }: UserSelectorProps) {
  const { t } = useT();
  return (
    <SharedUserSelector
      onActiveUserChange={onUserChange}
      showFullscreenToggle
      store={userStore}
      t={t as (key: string, params?: Record<string, string | number>) => string}
    />
  );
}

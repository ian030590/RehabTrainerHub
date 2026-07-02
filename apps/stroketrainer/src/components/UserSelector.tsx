import { UserSelector as SharedUserSelector } from '@rehab-trainer/ui/components/UserSelector';
import { useT } from '../i18n';
import { userStore } from '../utils/settings';

interface UserSelectorProps {
  onActiveUserChange?: (userName: string | null) => void;
}

export function UserSelector({ onActiveUserChange }: UserSelectorProps) {
  const { t } = useT();
  return (
    <SharedUserSelector
      groupClassName="user-selector-group"
      iconClassName="user-selector-icon"
      onActiveUserChange={onActiveUserChange}
      store={userStore}
      t={t as (key: string, params?: Record<string, string | number>) => string}
    />
  );
}

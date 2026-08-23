import { CreateUseActiveUser } from '@rehab-trainer/ui/hooks/useActiveUser';
import { activeUserChangedEvent, getActiveUser } from './settings';

export const useActiveUser = CreateUseActiveUser({
  activeUserChangedEvent: activeUserChangedEvent,
  getActiveUser,
});

import { createUseActiveUser } from '@rehab-trainer/ui/hooks/useActiveUser';
import { ACTIVE_USER_CHANGED_EVENT, getActiveUser } from './settings';

export const useActiveUser = createUseActiveUser({
  activeUserChangedEvent: ACTIVE_USER_CHANGED_EVENT,
  getActiveUser,
});

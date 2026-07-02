import { createUseActiveUser } from '@rehab-trainer/ui/hooks/useActiveUser';
import { userStore } from './settings';

export const useActiveUser = createUseActiveUser(userStore);

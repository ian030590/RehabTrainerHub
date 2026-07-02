import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { TFunction } from './types';
import { hasSelectedTrainingUser, verifySelectedTrainingUser } from './selectedUserGuard';

interface UseGameModuleGuardArgs<TModuleId extends string> {
  requestedGameId: string | null;
  requestedModule: TModuleId | null;
  basePath: string;
  t: TFunction;
}

export function useGameModuleGuard<TModuleId extends string>({
  requestedGameId,
  requestedModule,
  basePath,
  t,
}: UseGameModuleGuardArgs<TModuleId>) {
  const navigate = useNavigate();
  const blockedRequestRef = useRef<string | null>(null);
  const [activeModule, setActiveModule] = useState<TModuleId | null>(
    hasSelectedTrainingUser() ? requestedModule : null,
  );

  useEffect(() => {
    if (requestedModule && !hasSelectedTrainingUser()) {
      if (blockedRequestRef.current !== requestedGameId) {
        blockedRequestRef.current = requestedGameId;
        window.alert(t('home.pleaseSelectUser'));
      }
      setActiveModule(null);
      navigate(basePath, { replace: true });
      return;
    }

    blockedRequestRef.current = null;
    setActiveModule(requestedModule);
  }, [basePath, navigate, requestedGameId, requestedModule, t]);

  const openModule = (moduleId: TModuleId) => {
    if (!verifySelectedTrainingUser(t)) return;

    setActiveModule(moduleId);
    navigate(`${basePath}?game=${moduleId}`);
  };

  const closeModule = () => {
    setActiveModule(null);
    navigate(basePath);
  };

  return { activeModule, openModule, closeModule };
}

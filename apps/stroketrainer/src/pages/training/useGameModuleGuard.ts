import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

interface UseGameModuleGuardArgs<TModuleId extends string> {
  requestedModule: TModuleId | null;
  basePath: string;
}

export function useGameModuleGuard<TModuleId extends string>({
  requestedModule,
  basePath,
}: UseGameModuleGuardArgs<TModuleId>) {
  const navigate = useNavigate();
  const [activeModule, setActiveModule] = useState<TModuleId | null>(requestedModule);

  useEffect(() => {
    setActiveModule(requestedModule);
  }, [requestedModule]);

  const openModule = (moduleId: TModuleId) => {
    setActiveModule(moduleId);
    navigate(`${basePath}?game=${moduleId}`);
  };

  const closeModule = () => {
    setActiveModule(null);
    navigate(basePath);
  };

  return { activeModule, openModule, closeModule };
}

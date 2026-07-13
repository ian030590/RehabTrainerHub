import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

export interface UseRoutedTrainingModuleArgs<TModuleId extends string> {
  requestedModule: TModuleId | null;
  basePath: string;
  queryParam?: string;
}

export function useRoutedTrainingModule<TModuleId extends string>({
  requestedModule,
  basePath,
  queryParam = 'game',
}: UseRoutedTrainingModuleArgs<TModuleId>) {
  const navigate = useNavigate();
  const [activeModule, setActiveModule] = useState<TModuleId | null>(requestedModule);

  useEffect(() => {
    setActiveModule(requestedModule);
  }, [requestedModule]);

  const openModule = (moduleId: TModuleId) => {
    const params = new URLSearchParams({ [queryParam]: moduleId });
    setActiveModule(moduleId);
    navigate(`${basePath}?${params.toString()}`);
  };

  const closeModule = () => {
    setActiveModule(null);
    navigate(basePath);
  };

  return { activeModule, openModule, closeModule };
}

import { Suspense, lazy } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  TrainingModuleSelectionPage,
  type TrainingModuleSelectionItem,
} from '@rehab-trainer/ui/components/TrainingModuleSelectionPage';
import { AppLoading } from '@rehab-trainer/ui/components/AppLoading';
import { useRoutedTrainingModule } from '@rehab-trainer/ui/hooks/useRoutedTrainingModule';
import { GetTrainingCatalogModules } from '@rehab-trainer/ui/trainingCatalog';
import { useT } from '../../i18n';
import { GetReferenceCognitiveModules } from './cognitive/constants';
import type { ReferenceGameId } from './cognitive/types';
import './ThinkingGames.css';

const MinesweeperGame = lazy(() => import('./MinesweeperGame').then((module) => ({ default: module.MinesweeperGame })));
const ReferenceCognitiveGame = lazy(() => import('./ReferenceCognitiveGame').then((module) => ({ default: module.ReferenceCognitiveGame })));

type ThinkingGameId = 'minesweeper' | ReferenceGameId;
type ThinkingModuleId = 'main-concept' | ThinkingGameId;
const thinkingRouteModules = GetTrainingCatalogModules({
  trainer: 'brain',
  purpose: 'higher-cognition',
  kind: 'brain-route',
});
const thinkingCognitiveModules = GetReferenceCognitiveModules('thinking');

export function ThinkingTraining() {
  const { t } = useT();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const requestedGameId = searchParams.get('game');
  const requestedModule = GetRequestedModule(requestedGameId);
  const { activeModule, openModule, closeModule } = useRoutedTrainingModule<ThinkingGameId>({
    requestedModule,
    basePath: '/thinking-training',
  });
  const modules: TrainingModuleSelectionItem<ThinkingModuleId>[] = [
    ...thinkingRouteModules.map<TrainingModuleSelectionItem<ThinkingModuleId>>((module) => ({
      id: module.runtimeId as ThinkingModuleId,
      title: t(module.titleKey as Parameters<typeof t>[0]),
      description: t(module.descriptionKey as Parameters<typeof t>[0]),
    })),
    ...thinkingCognitiveModules.map<TrainingModuleSelectionItem<ThinkingModuleId>>((module) => ({
      id: module.id,
      title: t(module.titleKey),
      description: t(module.descriptionKey),
    })),
  ];

  const activeTraining = (
    <Suspense fallback={<AppLoading label={t('app.loading')} />}>
      {activeModule === 'minesweeper'
        ? <MinesweeperGame onExit={closeModule} />
        : activeModule && IsReferenceGameId(activeModule)
          ? <ReferenceCognitiveGame gameId={activeModule} onExit={closeModule} />
          : null}
    </Suspense>
  );

  return (
    <TrainingModuleSelectionPage
      title={t('module.thinking.title')}
      subtitle={t('training.thinking.subtitle')}
      modules={modules}
      selectedModuleId={activeModule}
      actionLabel={t('btn.selectModule')}
      cardClassName="training-module-button"
      onSelect={(moduleId) => {
        if (moduleId === 'main-concept') {
          navigate('/thinking-training/main-concept');
          return;
        }
        openModule(moduleId);
      }}
    >
      {activeTraining}
    </TrainingModuleSelectionPage>
  );
}

function GetRequestedModule(requestedGameId: string | null): ThinkingGameId | null {
  if (requestedGameId === 'minesweeper') return 'minesweeper';
  if (IsReferenceGameId(requestedGameId)) return requestedGameId;
  return null;
}

function IsReferenceGameId(value: string | null): value is ReferenceGameId {
  return thinkingCognitiveModules.some((module) => module.id === value);
}

import { Suspense, lazy } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  TrainingModuleSelectionPage,
  type TrainingModuleSelectionItem,
} from '@rehab-trainer/ui/components/TrainingModuleSelectionPage';
import { AppLoading } from '@rehab-trainer/ui/components/AppLoading';
import { useRoutedTrainingModule } from '@rehab-trainer/ui/hooks/useRoutedTrainingModule';
import { useT } from '../../i18n';
import { referenceCognitiveModules } from './cognitive/constants';
import type { ReferenceGameId } from './cognitive/types';

const MinesweeperGame = lazy(() => import('./MinesweeperGame').then((module) => ({ default: module.MinesweeperGame })));
const ReferenceCognitiveGame = lazy(() => import('./ReferenceCognitiveGame').then((module) => ({ default: module.ReferenceCognitiveGame })));

type CognitiveModuleId = 'minesweeper' | ReferenceGameId;

export function CognitiveTraining() {
  const { t } = useT();
  const [searchParams] = useSearchParams();
  const requestedGameId = searchParams.get('game');
  const requestedModule = GetRequestedModule(requestedGameId);
  const { activeModule, openModule, closeModule } = useRoutedTrainingModule<CognitiveModuleId>({
    requestedModule,
    basePath: '/cognitive-training',
  });
  const modules: TrainingModuleSelectionItem<CognitiveModuleId>[] = [
    {
      id: 'minesweeper',
      title: t('training.minesweeper.title'),
      description: t('training.minesweeper.desc'),
    },
    ...referenceCognitiveModules.map<TrainingModuleSelectionItem<CognitiveModuleId>>((module) => ({
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
      title={t('home.module.cognitive.title')}
      subtitle={t('training.cognitive.subtitle')}
      modules={modules}
      selectedModuleId={activeModule}
      actionLabel={t('training.startGame')}
      cardClassName="training-module-button"
      onSelect={openModule}
    >
      {activeTraining}
    </TrainingModuleSelectionPage>
  );
}

function GetRequestedModule(requestedGameId: string | null): CognitiveModuleId | null {
  if (requestedGameId === 'minesweeper') return 'minesweeper';
  if (IsReferenceGameId(requestedGameId)) return requestedGameId;
  return null;
}

function IsReferenceGameId(value: string | null): value is ReferenceGameId {
  return referenceCognitiveModules.some((module) => module.id === value);
}

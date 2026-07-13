import { useSearchParams } from 'react-router-dom';
import {
  TrainingModuleSelectionPage,
  type TrainingModuleSelectionItem,
} from '@rehab-trainer/ui/components/TrainingModuleSelectionPage';
import { useRoutedTrainingModule } from '@rehab-trainer/ui/hooks/useRoutedTrainingModule';
import { useT } from '../../i18n';
import { MinesweeperGame } from './MinesweeperGame';
import {
  ReferenceCognitiveGame,
  REFERENCE_COGNITIVE_MODULES,
  type ReferenceGameId,
  isReferenceGameId,
} from './ReferenceCognitiveGame';

type CognitiveModuleId = 'minesweeper' | ReferenceGameId;

export function CognitiveTraining() {
  const { t } = useT();
  const [searchParams] = useSearchParams();
  const requestedGameId = searchParams.get('game');
  const requestedModule = getRequestedModule(requestedGameId);
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
    ...REFERENCE_COGNITIVE_MODULES.map<TrainingModuleSelectionItem<CognitiveModuleId>>((module) => ({
      id: module.id,
      title: t(module.titleKey),
      description: t(module.descriptionKey),
    })),
  ];

  const activeTraining = activeModule === 'minesweeper'
    ? <MinesweeperGame onExit={closeModule} />
    : activeModule && isReferenceGameId(activeModule)
      ? <ReferenceCognitiveGame gameId={activeModule} onExit={closeModule} />
      : null;

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

function getRequestedModule(requestedGameId: string | null): CognitiveModuleId | null {
  if (requestedGameId === 'minesweeper') return 'minesweeper';
  if (isReferenceGameId(requestedGameId)) return requestedGameId;
  return null;
}

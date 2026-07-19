import { Suspense, lazy } from 'react';
import { useSearchParams } from 'react-router-dom';
import { AppLoading } from '@rehab-trainer/ui/components/AppLoading';
import {
  TrainingModuleSelectionPage,
  type TrainingModuleSelectionItem,
} from '@rehab-trainer/ui/components/TrainingModuleSelectionPage';
import { useRoutedTrainingModule } from '@rehab-trainer/ui/hooks/useRoutedTrainingModule';
import { useT } from '../../i18n';

const DrawingTowerDefenseGame = lazy(() => import('./DrawingTowerDefenseGame').then((module) => ({ default: module.DrawingTowerDefenseGame })));
const GestureBattlerGame = lazy(() => import('./GestureBattlerGame').then((module) => ({ default: module.GestureBattlerGame })));

type MotorModuleId = 'drawing-defense' | 'gesture-battler';

export function MotorTraining() {
  const { t } = useT();
  const [searchParams] = useSearchParams();
  const requestedGameId = searchParams.get('game');
  const requestedModule: MotorModuleId | null =
    requestedGameId === 'drawing-defense' || requestedGameId === 'gesture-battler'
      ? requestedGameId
      : null;
  const { activeModule, openModule, closeModule } = useRoutedTrainingModule<MotorModuleId>({
    requestedModule,
    basePath: '/motor-training',
  });
  const modules: readonly TrainingModuleSelectionItem<MotorModuleId>[] = [
    {
      id: 'drawing-defense',
      title: t('training.drawing.title'),
      description: t('training.drawing.desc'),
    },
    {
      id: 'gesture-battler',
      title: t('training.gesture.title'),
      description: t('training.gesture.desc'),
    },
  ];

  const activeTraining = (
    <Suspense fallback={<AppLoading label={t('app.loading')} />}>
      {activeModule === 'drawing-defense'
        ? <DrawingTowerDefenseGame onExit={closeModule} />
        : activeModule === 'gesture-battler'
          ? <GestureBattlerGame onExit={closeModule} />
          : null}
    </Suspense>
  );

  return (
    <TrainingModuleSelectionPage
      title={t('home.module.motor.title')}
      subtitle={t('training.motor.subtitle')}
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

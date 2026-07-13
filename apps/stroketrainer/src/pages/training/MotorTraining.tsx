import { useSearchParams } from 'react-router-dom';
import {
  TrainingModuleSelectionPage,
  type TrainingModuleSelectionItem,
} from '@rehab-trainer/ui/components/TrainingModuleSelectionPage';
import { useRoutedTrainingModule } from '@rehab-trainer/ui/hooks/useRoutedTrainingModule';
import { useT } from '../../i18n';
import { DrawingTowerDefenseGame } from './DrawingTowerDefenseGame';
import { GestureBattlerGame } from './GestureBattlerGame';

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
      icon: (
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 19l7-7 3 3-7 7-3-3z" />
          <path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18" />
          <path d="M2 2l7.586 7.586" />
          <circle cx="11" cy="11" r="2" />
        </svg>
      ),
    },
    {
      id: 'gesture-battler',
      title: t('training.gesture.title'),
      description: t('training.gesture.desc'),
      icon: (
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M7 11V5.5a1.5 1.5 0 0 1 3 0V10" />
          <path d="M10 9V3.5a1.5 1.5 0 0 1 3 0V9" />
          <path d="M13 9V4.5a1.5 1.5 0 0 1 3 0V10" />
          <path d="M16 10V7.5a1.5 1.5 0 0 1 3 0V14c0 4.4-2.8 7-7 7h-1c-2.2 0-3.7-.8-5-2.5L3.4 15a1.7 1.7 0 0 1 2.5-2.2L8 15" />
          <path d="M18.5 2.5l.6 1.2 1.3.2-.9.9.2 1.3-1.2-.6-1.2.6.2-1.3-.9-.9 1.3-.2.6-1.2z" />
        </svg>
      ),
    },
  ];

  if (activeModule === 'drawing-defense') {
    return <DrawingTowerDefenseGame onExit={closeModule} />;
  }

  if (activeModule === 'gesture-battler') {
    return <GestureBattlerGame onExit={closeModule} />;
  }

  return (
    <TrainingModuleSelectionPage
      title={t('home.module.motor.title')}
      subtitle={t('training.motor.subtitle')}
      modules={modules}
      actionLabel={t('training.startGame')}
      cardClassName="training-module-button"
      onSelect={openModule}
    />
  );
}

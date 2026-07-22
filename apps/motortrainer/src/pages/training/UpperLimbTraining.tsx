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
const AsteroidShieldGame = lazy(() => import('./AsteroidShieldGame').then((module) => ({ default: module.AsteroidShieldGame })));
const GestureBattlerGame = lazy(() => import('./GestureBattlerGame').then((module) => ({ default: module.GestureBattlerGame })));
const MotorCortexRehabGame = lazy(() => import('./MotorCortexRehabGame').then((module) => ({ default: module.MotorCortexRehabGame })));

type UpperLimbModuleId = 'drawing-defense' | 'asteroid-shield' | 'gesture-battler' | 'motor-cortex-rehab';

const motorCortexCopy = {
  zh: {
    title: '動作皮質復健訓練',
    description: '以攝影機追蹤手部位置，練習彈跳球追蹤、垂直/水平活動範圍與隨機觸達，並依表現調整難度。',
  },
  en: {
    title: 'Motor Cortex Rehab',
    description: 'Use camera hand tracking for bouncing-ball tracking, vertical/horizontal range, and random reach drills with adaptive difficulty.',
  },
} as const;

export function UpperLimbTraining() {
  const { lang, t } = useT();
  const [searchParams] = useSearchParams();
  const requestedGameId = searchParams.get('game');
  const requestedModule: UpperLimbModuleId | null =
    requestedGameId === 'drawing-defense' ||
    requestedGameId === 'asteroid-shield' ||
    requestedGameId === 'gesture-battler' ||
    requestedGameId === 'motor-cortex-rehab'
      ? requestedGameId
      : null;
  const motorCortexLabels = motorCortexCopy[lang];
  const { activeModule, openModule, closeModule } = useRoutedTrainingModule<UpperLimbModuleId>({
    requestedModule,
    basePath: '/upper-limb-training',
  });
  const modules: readonly TrainingModuleSelectionItem<UpperLimbModuleId>[] = [
    {
      id: 'drawing-defense',
      title: t('training.drawing.title'),
      description: t('training.drawing.desc'),
    },
    {
      id: 'asteroid-shield',
      title: t('training.asteroidShield.title'),
      description: t('training.asteroidShield.desc'),
    },
    {
      id: 'gesture-battler',
      title: t('training.gesture.title'),
      description: t('training.gesture.desc'),
    },
    {
      id: 'motor-cortex-rehab',
      title: motorCortexLabels.title,
      description: motorCortexLabels.description,
    },
  ];

  const activeTraining = (
    <Suspense fallback={<AppLoading label={t('app.loading')} />}>
      {activeModule === 'drawing-defense'
        ? <DrawingTowerDefenseGame onExit={closeModule} />
        : activeModule === 'asteroid-shield'
          ? <AsteroidShieldGame onExit={closeModule} />
        : activeModule === 'gesture-battler'
          ? <GestureBattlerGame onExit={closeModule} />
          : activeModule === 'motor-cortex-rehab'
            ? <MotorCortexRehabGame onExit={closeModule} />
            : null}
    </Suspense>
  );

  return (
    <TrainingModuleSelectionPage
      title={t('home.module.upperLimb.title')}
      subtitle={t('training.upperLimb.subtitle')}
      modules={modules}
      selectedModuleId={activeModule}
      actionLabel={t('btn.selectModule')}
      cardClassName="training-module-button"
      onSelect={openModule}
    >
      {activeTraining}
    </TrainingModuleSelectionPage>
  );
}

// Canonical Hub-owned MotorTrainer module dispatcher.
import { Suspense, lazy } from 'react';
import { useSearchParams } from 'react-router-dom';
import { AppLoading } from '@rehab-trainer/ui/components/AppLoading';
import {
  TrainingModuleSelectionPage,
  type TrainingModuleSelectionItem,
} from '@rehab-trainer/ui/components/TrainingModuleSelectionPage';
import { useRoutedTrainingModule } from '@rehab-trainer/ui/hooks/useRoutedTrainingModule';
import {
  GetTrainingCatalogModules,
  GetTrainingModuleCopy,
} from '@rehab-trainer/hub-modules/catalog';
import { useT } from '../../i18n';

const LoadDrawingTowerDefenseGame = () => import('./DrawingTowerDefenseGame');
const LoadAsteroidShieldGame = () => import('./AsteroidShieldGame');
const LoadGestureBattlerGame = () => import('./GestureBattlerGame');
const LoadMotorCortexRehabGame = () => import('./MotorCortexRehabGame');
const DrawingTowerDefenseGame = lazy(() => LoadDrawingTowerDefenseGame().then((module) => ({ default: module.DrawingTowerDefenseGame })));
const AsteroidShieldGame = lazy(() => LoadAsteroidShieldGame().then((module) => ({ default: module.AsteroidShieldGame })));
const GestureBattlerGame = lazy(() => LoadGestureBattlerGame().then((module) => ({ default: module.GestureBattlerGame })));
const MotorCortexRehabGame = lazy(() => LoadMotorCortexRehabGame().then((module) => ({ default: module.MotorCortexRehabGame })));

type UpperLimbModuleId = 'drawing-defense' | 'asteroid-shield' | 'gesture-battler' | 'motor-cortex-rehab';
const moduleLoaders: Record<UpperLimbModuleId, () => Promise<unknown>> = {
  'drawing-defense': LoadDrawingTowerDefenseGame,
  'asteroid-shield': LoadAsteroidShieldGame,
  'gesture-battler': LoadGestureBattlerGame,
  'motor-cortex-rehab': LoadMotorCortexRehabGame,
};

const upperLimbCatalogModules = GetTrainingCatalogModules({
  trainer: 'motor',
  purpose: 'upper-limb',
  kind: 'motor-upper',
});

export function UpperLimbTraining() {
  const { lang, t } = useT();
  const [searchParams] = useSearchParams();
  const requestedGameId = searchParams.get('game');
  const requestedModule = IsUpperLimbModuleId(requestedGameId) ? requestedGameId : null;
  const { activeModule, openModule, closeModule } = useRoutedTrainingModule<UpperLimbModuleId>({
    requestedModule,
    basePath: '/upper-limb-training',
  });
  const modules: readonly TrainingModuleSelectionItem<UpperLimbModuleId>[] =
    upperLimbCatalogModules.map((module) => {
      const copy = GetTrainingModuleCopy(module, lang);
      return {
        id: module.runtimeId as UpperLimbModuleId,
        title: copy.title,
        description: copy.description,
        imageSrc: module.imagePath,
      };
    });

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
      onPreload={(moduleId) => {
        void moduleLoaders[moduleId]().catch(() => undefined);
      }}
    >
      {activeTraining}
    </TrainingModuleSelectionPage>
  );
}

function IsUpperLimbModuleId(value: string | null): value is UpperLimbModuleId {
  return upperLimbCatalogModules.some((module) => module.runtimeId === value);
}

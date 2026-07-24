import { Suspense, lazy } from 'react';
import { useSearchParams } from 'react-router-dom';
import { AppLoading } from '@rehab-trainer/ui/components/AppLoading';
import { TrainingModuleSelectionPage } from '@rehab-trainer/ui/components/TrainingModuleSelectionPage';
import { useRoutedTrainingModule } from '@rehab-trainer/ui/hooks/useRoutedTrainingModule';
import {
  GetTrainingCatalogModules,
  GetTrainingModuleCopy,
} from '@rehab-trainer/ui/trainingCatalog';
import { useT } from '../../i18n';

const TongueCatchGame = lazy(() => import('./TongueCatchGame').then((module) => ({ default: module.TongueCatchGame })));
const oralCatalogModules = GetTrainingCatalogModules({
  trainer: 'mouth',
  purpose: 'oral',
  kind: 'mouth-oral',
});

export function OralTraining() {
  const { lang, t } = useT();
  const [searchParams] = useSearchParams();
  const requestedGameId = searchParams.get('game');
  const requestedModule = oralCatalogModules.some((module) => module.runtimeId === requestedGameId)
    ? 'tongue-catch'
    : null;
  const { activeModule, openModule, closeModule } = useRoutedTrainingModule<'tongue-catch'>({
    requestedModule,
    basePath: '/oral-training',
  });

  return (
    <TrainingModuleSelectionPage
      title={t('mouth.oral.title')}
      subtitle={t('mouth.oral.subtitle')}
      modules={oralCatalogModules.map((module) => {
        const copy = GetTrainingModuleCopy(module, lang);
        return { id: 'tongue-catch' as const, title: copy.title, description: copy.description };
      })}
      selectedModuleId={activeModule}
      actionLabel={t('btn.selectModule')}
      cardClassName="training-module-button"
      onSelect={openModule}
    >
      {activeModule === 'tongue-catch' && (
        <Suspense fallback={<AppLoading label={t('app.loading')} />}>
          <TongueCatchGame onExit={closeModule} />
        </Suspense>
      )}
    </TrainingModuleSelectionPage>
  );
}

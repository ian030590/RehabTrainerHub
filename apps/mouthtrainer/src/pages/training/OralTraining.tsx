import { Suspense, lazy } from 'react';
import { useSearchParams } from 'react-router-dom';
import { AppLoading } from '@rehab-trainer/ui/components/AppLoading';
import { TrainingModuleSelectionPage } from '@rehab-trainer/ui/components/TrainingModuleSelectionPage';
import { useRoutedTrainingModule } from '@rehab-trainer/ui/hooks/useRoutedTrainingModule';
import { useT } from '../../i18n';

const TongueCatchGame = lazy(() => import('./TongueCatchGame').then((module) => ({ default: module.TongueCatchGame })));

export function OralTraining() {
  const { t } = useT();
  const [searchParams] = useSearchParams();
  const requestedModule = searchParams.get('game') === 'tongue-catch' ? 'tongue-catch' : null;
  const { activeModule, openModule, closeModule } = useRoutedTrainingModule<'tongue-catch'>({ requestedModule, basePath: '/oral-training' });
  return <TrainingModuleSelectionPage title={t('mouth.oral.title')} subtitle={t('mouth.oral.subtitle')} modules={[{ id: 'tongue-catch', title: t('tongue.title'), description: t('tongue.desc') }]} selectedModuleId={activeModule} actionLabel={t('btn.selectModule')} cardClassName="training-module-button" onSelect={openModule}>{activeModule === 'tongue-catch' && <Suspense fallback={<AppLoading label={t('app.loading')} />}><TongueCatchGame onExit={closeModule} /></Suspense>}</TrainingModuleSelectionPage>;
}

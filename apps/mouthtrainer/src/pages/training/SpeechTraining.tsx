import { Suspense, lazy } from 'react';
import { useSearchParams } from 'react-router-dom';
import { AppLoading } from '@rehab-trainer/ui/components/AppLoading';
import { TrainingModuleSelectionPage } from '@rehab-trainer/ui/components/TrainingModuleSelectionPage';
import { useRoutedTrainingModule } from '@rehab-trainer/ui/hooks/useRoutedTrainingModule';
import { useT } from '../../i18n';

const VoiceDefenderGame = lazy(() => import('./VoiceDefenderGame').then((module) => ({ default: module.VoiceDefenderGame })));

export function SpeechTraining() {
  const { t } = useT();
  const [searchParams] = useSearchParams();
  const requestedModule = searchParams.get('game') === 'voice-defender' ? 'voice-defender' : null;
  const { activeModule, openModule, closeModule } = useRoutedTrainingModule<'voice-defender'>({
    requestedModule,
    basePath: '/speech-training',
  });

  return (
    <TrainingModuleSelectionPage
      title={t('mouth.speech.title')}
      subtitle={t('mouth.speech.subtitle')}
      modules={[{ id: 'voice-defender', title: t('voice.title'), description: t('voice.desc') }]}
      selectedModuleId={activeModule}
      actionLabel={t('btn.selectModule')}
      cardClassName="training-module-button"
      onSelect={openModule}
    >
      {activeModule === 'voice-defender' && (
        <Suspense fallback={<AppLoading label={t('app.loading')} />}>
          <VoiceDefenderGame onExit={closeModule} />
        </Suspense>
      )}
    </TrainingModuleSelectionPage>
  );
}

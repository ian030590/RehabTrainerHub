import { Suspense, lazy } from 'react';
import { useSearchParams } from 'react-router-dom';
import { AppLoading } from '@rehab-trainer/ui/components/AppLoading';
import {
  TrainingModuleSelectionPage,
  type TrainingModuleSelectionItem,
} from '@rehab-trainer/ui/components/TrainingModuleSelectionPage';
import { useRoutedTrainingModule } from '@rehab-trainer/ui/hooks/useRoutedTrainingModule';
import { useT } from '../../i18n';

const TongueCatchGame = lazy(() => import('./TongueCatchGame').then((module) => ({ default: module.TongueCatchGame })));
const VoiceDefenderGame = lazy(() => import('./VoiceDefenderGame').then((module) => ({ default: module.VoiceDefenderGame })));

type SpeechModuleId = 'voice-defender' | 'tongue-catch';

export function SpeechTraining() {
  const { t } = useT();
  const [searchParams] = useSearchParams();
  const requestedGameId = searchParams.get('game');
  const requestedModule = requestedGameId === 'voice-defender' || requestedGameId === 'tongue-catch'
    ? requestedGameId
    : null;
  const { activeModule, openModule, closeModule } = useRoutedTrainingModule<SpeechModuleId>({
    requestedModule,
    basePath: '/speech-training',
  });
  const modules: readonly TrainingModuleSelectionItem<SpeechModuleId>[] = [
    {
      id: 'voice-defender',
      title: t('voice.title'),
      description: t('voice.desc'),
    },
    {
      id: 'tongue-catch',
      title: t('tongue.title'),
      description: t('tongue.desc'),
    },
  ];

  const activeTraining = (
    <Suspense fallback={<AppLoading label={t('app.loading')} />}>
      {activeModule === 'voice-defender'
        ? <VoiceDefenderGame onExit={closeModule} />
        : activeModule === 'tongue-catch'
          ? <TongueCatchGame onExit={closeModule} />
          : null}
    </Suspense>
  );

  return (
    <TrainingModuleSelectionPage
      title={t('home.module.speech.title')}
      subtitle={t('training.speech.subtitle')}
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

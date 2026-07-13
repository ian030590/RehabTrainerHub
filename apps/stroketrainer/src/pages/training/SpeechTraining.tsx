import { useSearchParams } from 'react-router-dom';
import {
  TrainingModuleSelectionPage,
  type TrainingModuleSelectionItem,
} from '@rehab-trainer/ui/components/TrainingModuleSelectionPage';
import { useRoutedTrainingModule } from '@rehab-trainer/ui/hooks/useRoutedTrainingModule';
import { useT } from '../../i18n';
import { TongueCatchGame } from './TongueCatchGame';
import { VoiceDefenderGame } from './VoiceDefenderGame';

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
      icon: (
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
          <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
          <path d="M12 19v3" />
          <path d="M8 22h8" />
          <path d="M18 4h3v5" />
          <path d="m21 4-4 4" />
        </svg>
      ),
    },
    {
      id: 'tongue-catch',
      title: t('tongue.title'),
      description: t('tongue.desc'),
      icon: (
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M4 10c1.4-3 4.2-5 8-5s6.6 2 8 5c-1.4 4-4.2 6-8 6s-6.6-2-8-6Z" />
          <path d="M8 11c1.2 1.2 2.5 1.8 4 1.8s2.8-.6 4-1.8" />
          <path d="M12 13v7" />
          <path d="M9.5 18.5 12 21l2.5-2.5" />
        </svg>
      ),
    },
  ];

  const activeTraining = activeModule === 'voice-defender'
    ? <VoiceDefenderGame onExit={closeModule} />
    : activeModule === 'tongue-catch'
      ? <TongueCatchGame onExit={closeModule} />
      : null;

  return (
    <TrainingModuleSelectionPage
      title={t('home.module.speech.title')}
      subtitle={t('training.speech.subtitle')}
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

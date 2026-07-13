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
      icon: (
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="3" width="18" height="18" rx="2" />
          <path d="M9 3v18" />
          <path d="M15 3v18" />
          <path d="M3 9h18" />
          <path d="M3 15h18" />
          <circle cx="12" cy="12" r="2.2" />
        </svg>
      ),
    },
    ...REFERENCE_COGNITIVE_MODULES.map<TrainingModuleSelectionItem<CognitiveModuleId>>((module) => ({
      id: module.id,
      title: t(module.titleKey),
      description: t(module.descriptionKey),
      icon: <CognitiveModuleIcon moduleId={module.id} />,
    })),
  ];

  if (activeModule === 'minesweeper') {
    return <MinesweeperGame onExit={closeModule} />;
  }

  if (activeModule && isReferenceGameId(activeModule)) {
    return <ReferenceCognitiveGame gameId={activeModule} onExit={closeModule} />;
  }

  return (
    <TrainingModuleSelectionPage
      title={t('home.module.cognitive.title')}
      subtitle={t('training.cognitive.subtitle')}
      modules={modules}
      actionLabel={t('training.startGame')}
      cardClassName="training-module-button"
      onSelect={openModule}
    />
  );
}

function getRequestedModule(requestedGameId: string | null): CognitiveModuleId | null {
  if (requestedGameId === 'minesweeper') return 'minesweeper';
  if (isReferenceGameId(requestedGameId)) return requestedGameId;
  return null;
}

function CognitiveModuleIcon({ moduleId }: { moduleId: ReferenceGameId }) {
  if (moduleId === 'memory-match') {
    return (
      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <rect x="3" y="4" width="7" height="8" rx="1.5" />
        <rect x="14" y="4" width="7" height="8" rx="1.5" />
        <rect x="3" y="15" width="7" height="5" rx="1.5" />
        <rect x="14" y="15" width="7" height="5" rx="1.5" />
        <path d="M6.5 8h0.01" />
        <path d="M17.5 8h0.01" />
        <path d="M6 17.5h2" />
        <path d="M16 17.5h2" />
      </svg>
    );
  }

  if (moduleId === 'lights-out') {
    return (
      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <rect x="4" y="4" width="4.5" height="4.5" rx="1" />
        <rect x="9.75" y="4" width="4.5" height="4.5" rx="1" />
        <rect x="15.5" y="4" width="4.5" height="4.5" rx="1" />
        <rect x="4" y="9.75" width="4.5" height="4.5" rx="1" />
        <rect x="9.75" y="9.75" width="4.5" height="4.5" rx="1" />
        <rect x="15.5" y="9.75" width="4.5" height="4.5" rx="1" />
        <rect x="4" y="15.5" width="4.5" height="4.5" rx="1" />
        <rect x="9.75" y="15.5" width="4.5" height="4.5" rx="1" />
        <rect x="15.5" y="15.5" width="4.5" height="4.5" rx="1" />
        <path d="M12 6.25v0.01" />
        <path d="M6.25 12v0.01" />
        <path d="M17.75 12v0.01" />
        <path d="M12 17.75v0.01" />
      </svg>
    );
  }

  if (moduleId === 'reaction-time') {
    return (
      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M9 2h6" />
        <path d="M12 2v3" />
        <circle cx="12" cy="13" r="8" />
        <path d="M12 13l3-4" />
        <path d="M8 13h2" />
        <path d="M14 13h2" />
        <path d="M11 17l2-4h-3l2-4" />
      </svg>
    );
  }

  if (moduleId === 'whack-a-mole') {
    return (
      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M4 18c2.5-2 13.5-2 16 0" />
        <path d="M7 18c0-3.3 2.2-6 5-6s5 2.7 5 6" />
        <path d="M9 12.5V9.8a3 3 0 0 1 6 0v2.7" />
        <path d="M10 9l-1.5-2" />
        <path d="M14 9l1.5-2" />
        <path d="M10 15h0.01" />
        <path d="M14 15h0.01" />
        <path d="M19 5l-3 3" />
        <path d="M20.5 8.5l-2.5 0.6" />
      </svg>
    );
  }

  return (
    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <path d="M9 3v6" />
      <path d="M15 3v6" />
      <path d="M3 9h18" />
      <path d="M9 9v6" />
      <path d="M3 15h12" />
      <path d="M15 15v6" />
      <path d="M18 18h0.01" />
    </svg>
  );
}

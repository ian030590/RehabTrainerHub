'use client';

import type { HubGame } from '../gameCatalog';
import { TrainingOverlay } from './TrainingOverlay';
import { PackageGameOverlay } from './PackageGameOverlay';
import type { PracticeOverlayModes } from './R2GameOverlay';

export function GameOverlay({ game, onClose, planLaunch, captureSettings, onSaved }: { game: HubGame; onClose: () => void } & PracticeOverlayModes) {
  return game.launch.contract === 'catalog-v1'
    ? <TrainingOverlay module={game.launch.module} onClose={onClose} planLaunch={planLaunch} captureSettings={captureSettings} onSaved={onSaved} />
    : <PackageGameOverlay game={game.launch.game} onClose={onClose} />;
}

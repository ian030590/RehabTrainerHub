'use client';

import type { HubGame } from '../gameCatalog';
import { TrainingOverlay } from './TrainingOverlay';
import { PackageGameOverlay } from './PackageGameOverlay';

export function GameOverlay({ game, onClose }: { game: HubGame; onClose: () => void }) {
  return game.launch.contract === 'catalog-v1'
    ? <TrainingOverlay module={game.launch.module} onClose={onClose} />
    : <PackageGameOverlay game={game.launch.game} onClose={onClose} />;
}

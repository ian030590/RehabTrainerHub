'use client';

import { useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { HubGame } from '../gameCatalog';
import { TrainingOverlay } from './TrainingOverlay';
import { PackageGameOverlay } from './PackageGameOverlay';
import type { PracticeOverlayModes } from './R2GameOverlay';

export function GameOverlay({ game, onClose, planLaunch, captureSettings, onSaved }: { game: HubGame; onClose: () => void } & PracticeOverlayModes) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [dialog, setDialog] = useState<HTMLDialogElement | null>(null);
  useLayoutEffect(() => { setDialog(hostRef.current?.querySelector('dialog') ?? null); }, [game.id]);
  return <div className="hub-game-overlay-host" ref={hostRef}>
    {game.launch.contract === 'catalog-v1'
    ? <TrainingOverlay module={game.launch.module} onClose={onClose} planLaunch={planLaunch} captureSettings={captureSettings} onSaved={onSaved} />
    : <PackageGameOverlay game={game.launch.game} onClose={onClose} />}
    {dialog && createPortal(<div aria-hidden="true" className="hub-game-transition-surface" />, dialog)}
  </div>;
}

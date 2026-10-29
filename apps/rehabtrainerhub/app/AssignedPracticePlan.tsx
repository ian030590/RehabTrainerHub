'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { trainingCatalog } from '@rehab-trainer/hub-modules/catalog';
import releases from '@rehab-trainer/ui/officialGameReleases.json';
import { useHubAuth } from './HubNavigation';
import { BuildHubGameCatalog } from './gameCatalog';
import { GetHubUiCopy } from './i18n';
import { useHubLanguage } from './i18n/HubLanguage';
import { FetchAssignedPracticePlan, type PracticePlan, type PracticePlanItem } from './practicePlans';
import { PracticePlanDetails } from './PracticePlanDetails';
import { GameOverlay } from './train/GameOverlay';

export function AssignedPracticePlan() {
  const { user } = useHubAuth();
  const isPlayer = user?.role === 'patient';
  if (!isPlayer) return null;
  return <PlayerPracticePlan key={user.id} />;
}

function PlayerPracticePlan() {
  const { language, locale } = useHubLanguage();
  const copy = GetHubUiCopy(language).practicePlans;
  const [plan, setPlan] = useState<PracticePlan | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [refresh, setRefresh] = useState(0);
  const [activeItem, setActiveItem] = useState<PracticePlanItem | null>(null);
  const close = useCallback(() => setActiveItem(null), []);
  const games = useMemo(() => BuildHubGameCatalog(trainingCatalog.filter(module => Object.hasOwn(releases, module.runtimeId)), [], locale), [locale]);
  useEffect(() => {
    const controller = new AbortController();
    setStatus('loading');
    void FetchAssignedPracticePlan(controller.signal).then(plan => {
      if (controller.signal.aborted) return;
      setPlan(plan); setStatus('ready');
    }).catch(() => { if (!controller.signal.aborted) setStatus('error'); });
    return () => controller.abort();
  }, [refresh]);
  // Most players have no list (and the feature may be off), so the first load reserves no space.
  if (status === 'loading' && !plan) return null;
  if (status === 'error' && !plan) return <section className="practice-plan" role="alert">
    <p>{copy.loadError}</p><button className="admin-button admin-button-secondary" type="button" onClick={() => setRefresh(value => value + 1)}>{copy.retry}</button>
  </section>;
  if (!plan) return null;
  const activeGame = games.find(game => game.id === activeItem?.gameId);
  return <section className="practice-plan" aria-labelledby="assigned-practice-title">
    <h2 id="assigned-practice-title">{plan.title}</h2>
    {status === 'loading' && <p role="status">{copy.loading}</p>}
    {status === 'error' && <div role="alert"><p>{copy.loadError}</p>
      <button className="admin-button admin-button-secondary" type="button" onClick={() => setRefresh(value => value + 1)}>{copy.retry}</button></div>}
    <PracticePlanDetails plan={plan} games={games} onStart={setActiveItem} />
    {activeGame && activeItem && <GameOverlay game={activeGame} onClose={close}
      planLaunch={{ planItemId: activeItem.id, settings: activeItem.settings }}
      onSaved={() => setRefresh(value => value + 1)} />}
  </section>;
}

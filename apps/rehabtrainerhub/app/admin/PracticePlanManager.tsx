'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { trainingCatalog } from '@rehab-trainer/hub-modules/catalog';
import releases from '@rehab-trainer/ui/officialGameReleases.json';
import { BuildHubGameCatalog, type HubGame } from '../gameCatalog';
import { GetHubUiCopy } from '../i18n';
import { useHubLanguage } from '../i18n/HubLanguage';
import { PracticePlanDetails } from '../PracticePlanDetails';
import type { PracticePlan, PracticeSettings } from '../practicePlans';
import { GameOverlay } from '../train/GameOverlay';
import { AdminApiError, ArchiveAdminPracticePlan, CreateAdminPracticePlan, FetchAdminPracticePlan, IsPracticePlansDisabled, type AdminPatient } from './adminApi';

export function PracticePlanManager({ patients, patientsStatus, patientsTruncated, onRetryPatients, onUnavailable, role }: {
  patients: AdminPatient[];
  patientsStatus: string;
  patientsTruncated?: boolean;
  onRetryPatients: () => void;
  onUnavailable: () => void;
  role: string;
}) {
  const { language } = useHubLanguage();
  const copy = GetHubUiCopy(language).practicePlans;
  const [patientId, setPatientId] = useState('');
  const [busy, setBusy] = useState(false);
  if (patientsStatus === 'loading' || patientsStatus === 'idle') return <p role="status">{copy.loading}</p>;
  if (patientsStatus === 'error') return <div role="alert"><p>{copy.loadError}</p>
    <button className="admin-button admin-button-secondary" type="button" onClick={onRetryPatients}>{copy.retry}</button></div>;
  if (!patients.length) return <div className="practice-plan-manager"><p>{copy.noPlayers}</p>{role === 'therapist' && <p>{copy.assignmentHelp}</p>}</div>;
  const selectedPatientId = patients.some(patient => patient.id === patientId) ? patientId : '';
  return <div className="practice-plan-manager">
    <h2>{copy.heading}</h2>
    <label className="admin-field">
      <span>{copy.player}</span>
      <select value={selectedPatientId} disabled={busy} onChange={event => setPatientId(event.target.value)}>
        <option value="">{copy.choosePlayer}</option>
        {patients.map(patient => <option key={patient.id} value={patient.id}>{patient.displayName}{patient.email ? ` (${patient.email})` : ''}</option>)}
      </select>
    </label>
    {patientsTruncated && <p>{copy.limitedPlayers}</p>}
    {selectedPatientId && <PracticePlanEditor key={selectedPatientId} patientId={selectedPatientId} onUnavailable={onUnavailable} onBusy={setBusy} />}
  </div>;
}

type DraftItem = { gameId: string; weeklyTarget: number; settings: PracticeSettings | null };

function PracticePlanEditor({ patientId, onUnavailable, onBusy }: {
  patientId: string; onUnavailable: () => void; onBusy: (busy: boolean) => void;
}) {
  const { language, locale, t } = useHubLanguage();
  const copy = GetHubUiCopy(language).practicePlans;
  const [plan, setPlan] = useState<PracticePlan | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [refresh, setRefresh] = useState(0);
  const [title, setTitle] = useState('');
  const [note, setNote] = useState('');
  const [items, setItems] = useState<DraftItem[]>([]);
  const [gameId, setGameId] = useState('');
  const [captureGame, setCaptureGame] = useState<HubGame | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const mutation = useRef<AbortController | null>(null);
  const closeCapture = useCallback(() => setCaptureGame(null), []);
  const games = useMemo(() => BuildHubGameCatalog(trainingCatalog.filter(module => Object.hasOwn(releases, module.runtimeId)), [], locale), [locale]);
  useEffect(() => () => { mutation.current?.abort(); onBusy(false); }, [onBusy]);
  useEffect(() => {
    const controller = new AbortController();
    setStatus('loading');
    void FetchAdminPracticePlan(patientId, controller.signal).then(plan => {
      if (controller.signal.aborted) return;
      setPlan(plan); setStatus('ready');
    }).catch(error => {
      if (controller.signal.aborted) return;
      if (IsPracticePlansDisabled(error)) onUnavailable();
      else setStatus('error');
    });
    return () => controller.abort();
  }, [patientId, refresh, onUnavailable]);

  const changeItem = (gameId: string, change: Partial<DraftItem>) => setItems(items => items.map(item => item.gameId === gameId ? { ...item, ...change } : item));
  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (busy) return;
    if (!title.trim() || title.length > 60 || note.length > 300 || !items.length || items.length > 12
      || items.some(item => !Number.isInteger(item.weeklyTarget) || item.weeklyTarget < 1 || item.weeklyTarget > 14)) {
      setError(copy.invalid); return;
    }
    await mutate(async signal => {
      const created = await CreateAdminPracticePlan({ patientId, title: title.trim(), note, items }, signal);
      if (signal.aborted) return;
      setPlan(created); setTitle(''); setNote(''); setItems([]); setNotice(copy.saved);
    });
  };
  const archive = async () => {
    if (!plan || busy || !window.confirm(copy.archiveConfirm)) return;
    await mutate(async signal => {
      await ArchiveAdminPracticePlan(plan.id, signal);
      if (!signal.aborted) { setPlan(null); setNotice(copy.archived); }
    });
  };
  const mutate = async (action: (signal: AbortSignal) => Promise<void>) => {
    const controller = new AbortController();
    mutation.current = controller;
    setBusy(true); onBusy(true); setError(''); setNotice('');
    try { await action(controller.signal); }
    catch (error) {
      if (controller.signal.aborted) return;
      if (IsPracticePlansDisabled(error)) { onUnavailable(); return; }
      setError(error instanceof AdminApiError && error.status === 400 ? copy.invalid
        : error instanceof AdminApiError && [401, 403].includes(error.status) ? copy.forbidden
          : error instanceof AdminApiError && error.status === 404 ? copy.notFound : copy.saveError);
    } finally {
      if (!controller.signal.aborted) { setBusy(false); onBusy(false); }
    }
  };

  if (status === 'loading') return <p role="status">{copy.loading}</p>;
  if (status === 'error') return <div role="alert"><p>{copy.loadError}</p>
    <button className="admin-button admin-button-secondary" type="button" onClick={() => setRefresh(value => value + 1)}>{copy.retry}</button></div>;
  return <>
    <section className="practice-plan" aria-labelledby="active-practice-title">
      <h2 id="active-practice-title">{copy.activeList}</h2>
      {plan ? <>
        <h3>{plan.title}</h3>
        <PracticePlanDetails plan={plan} games={games} showSettings />
        <button className="admin-button admin-button-secondary" type="button" disabled={busy} onClick={() => void archive()}>{copy.archive}</button>
      </> : <p>{copy.noList}</p>}
    </section>
    <form onSubmit={event => void save(event)} aria-labelledby="new-practice-title" aria-busy={busy}>
      <h2 id="new-practice-title">{copy.newList}</h2>
      <fieldset disabled={busy}>
        <legend className="sr-only">{copy.newList}</legend>
        <label className="admin-field"><span>{copy.title}</span>
          <input required maxLength={60} value={title} onChange={event => setTitle(event.target.value)} /></label>
        <label className="admin-field"><span>{copy.note}</span>
          <textarea maxLength={300} value={note} onChange={event => setNote(event.target.value)} /></label>
        <div className="practice-plan-actions">
          <label className="admin-field"><span>{copy.game}</span>
            <select value={gameId} onChange={event => setGameId(event.target.value)}>
              <option value="">{copy.chooseGame}</option>
              {games.filter(game => !items.some(item => item.gameId === game.id)).map(game => <option key={game.id} value={game.id}>{game.title}</option>)}
            </select></label>
          <button className="admin-button admin-button-secondary" type="button" disabled={!gameId || items.length >= 12}
            onClick={() => {
              if (gameId && items.length < 12 && !items.some(item => item.gameId === gameId)) {
                setItems([...items, { gameId, weeklyTarget: 1, settings: null }]); setGameId('');
              }
            }}>{copy.addItem}</button>
        </div>
        <p>{copy.itemLimit}</p>
        {!items.length && <p>{copy.emptyItems}</p>}
        <ul className="practice-plan-items">
          {items.map(item => {
            const game = games.find(game => game.id === item.gameId)!;
            return <li key={item.gameId}>
              <h3>{game.title}</h3>
              <label className="admin-field"><span>{copy.target}</span>
                <input type="number" required min={1} max={14} step={1} value={Number.isNaN(item.weeklyTarget) ? '' : item.weeklyTarget}
                  onChange={event => changeItem(item.gameId, { weeklyTarget: event.target.valueAsNumber })} /></label>
              <p>{item.settings === null ? copy.defaults : t('practicePlans.customSettings', { count: Object.keys(item.settings).length })}</p>
              <div className="practice-plan-actions">
                <button className="admin-button admin-button-secondary" type="button" onClick={() => setCaptureGame(game)}>{item.settings === null ? copy.capture : copy.recapture}</button>
                {item.settings !== null && <button className="admin-button admin-button-secondary" type="button" onClick={() => changeItem(item.gameId, { settings: null })}>{copy.resetSettings}</button>}
                <button className="admin-button admin-button-secondary" type="button" onClick={() => setItems(items => items.filter(row => row.gameId !== item.gameId))}>{t('practicePlans.remove', { name: game.title })}</button>
              </div>
            </li>;
          })}
        </ul>
        <p>{copy.replacesActive}</p>
        <button className="admin-button admin-button-primary" type="submit">{busy ? copy.saving : copy.save}</button>
      </fieldset>
    </form>
    {error && <p className="admin-alert admin-alert-error" role="alert">{error}</p>}
    {notice && <p role="status">{notice}</p>}
    {captureGame && <GameOverlay game={captureGame} onClose={closeCapture}
      captureSettings={settings => changeItem(captureGame.id, { settings })} />}
  </>;
}

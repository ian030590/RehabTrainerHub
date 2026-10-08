'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import releases from '@rehab-trainer/ui/officialGameReleases.json';
import { AcceptGameMessage } from '@rehab-trainer/ui/selfContainedGame.js';
import { GetAuthToken, GetAuthUserIdFromToken, SaveRemoteTrainingRecord } from '@rehab-trainer/ui/auth/authClient';
import { GetOrCreateSubjectIdForUser } from '@rehab-trainer/ui/storage/subjectId';
import type { TrainingCatalogModule } from '@rehab-trainer/hub-modules/catalog';
import type { GameScore } from '@rehab-trainer/ui/gameScore';
import { useHubLanguage } from '../i18n/HubLanguage';

type Result = { config: Record<string, string | number | boolean>; score: GameScore };
export function R2GameOverlay({ module, onClose }: { module: TrainingCatalogModule; onClose: () => void }) {
  const release = releases[module.runtimeId as keyof typeof releases];
  const { language } = useHubLanguage();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const frameRef = useRef<HTMLIFrameElement>(null);
  const portRef = useRef<MessagePort | null>(null);
  const resultRef = useRef<Result | null>(null);
  const sessionRef = useRef<Promise<{ recordId: string; token: string }> | null>(null);
  const saving = useRef(false);
  const saved = useRef(false);
  const [nonce] = useState(() => Array.from(crypto.getRandomValues(new Uint8Array(32)), byte => byte.toString(16).padStart(2, '0')).join(''));
  const [ready, setReady] = useState(false);
  const [error, setError] = useState(false);
  const [unavailable, setUnavailable] = useState(false);
  const [generation, setGeneration] = useState(0);
  const source = `${release.origin}/games/${module.runtimeId}/${release.version}/package/index.html`;
  const [identity] = useState(() => ({ token: GetAuthToken(), subjectId: GetOrCreateSubjectIdForUser(GetAuthUserIdFromToken(GetAuthToken())) }));

  const acknowledge = useCallback((state: string) => portRef.current?.postMessage({ schema: 'trainerhub.game/v1', sessionNonce: nonce, type: 'saved', state }), [nonce]);
  const save = useCallback(async () => {
    const result = resultRef.current;
    if (!result || saving.current) return;
    if (saved.current) { acknowledge('saved'); return; }
    saving.current = true;
    acknowledge('saving');
    try {
      sessionRef.current ??= fetch('/api/official-game-sessions', {
        method: 'POST', headers: { 'Content-Type': 'application/json', ...(identity.token ? { Authorization: `Bearer ${identity.token}` } : {}) },
        body: JSON.stringify({ gameId: module.runtimeId, version: release.version, subjectId: identity.subjectId }),
      }).then(async response => {
        if (!response.ok) throw new Error('Session unavailable');
        return response.json();
      }).catch(error => { sessionRef.current = null; throw error; });
      const session = await sessionRef.current;
      if (GetAuthToken() !== identity.token) throw new Error('Account changed during game');
      await SaveRemoteTrainingRecord(window.location.origin, {
        appId: 'rehabtrainerhub', runtimeId: 'hub', officialGameVersion: release.version, runSessionToken: session.token,
        record: { id: session.recordId, savedAt: new Date().toISOString(), userName: '',
          moduleId: module.runtimeId, gameId: module.runtimeId, config: result.config, score: result.score,
          metadata: { release_version: release.version.replaceAll('.', '_') } },
      });
      saved.current = true;
      acknowledge('saved');
    } catch { acknowledge('error'); }
    finally { saving.current = false; }
  }, [acknowledge, identity, module.runtimeId, release.version]);

  useEffect(() => {
    const dialog = dialogRef.current;
    dialog?.showModal();
    return () => { portRef.current?.close(); if (dialog?.open) dialog.close(); };
  }, []);
  useEffect(() => {
    if (ready) return;
    const timeout = setTimeout(() => setError(true), 12000);
    return () => clearTimeout(timeout);
  }, [ready, generation]);
  useEffect(() => {
    const controller = new AbortController();
    let checking = false;
    const check = async () => {
      if (checking || !navigator.onLine) return;
      checking = true;
      try {
        const response = await fetch(source, { method: 'HEAD', cache: 'no-store', credentials: 'omit', signal: controller.signal });
        if (response.status === 404 || response.status === 410) {
          portRef.current?.close();
          setUnavailable(true); setReady(false); setError(true);
        }
      } catch { /* A network failure keeps the current session available. */ }
      finally { checking = false; }
    };
    const timer = setInterval(() => void check(), 60000);
    window.addEventListener('online', check);
    return () => { clearInterval(timer); window.removeEventListener('online', check); controller.abort(); };
  }, [source, generation]);

  const initialize = () => {
    if (portRef.current) { setError(true); setReady(false); setUnavailable(true); portRef.current.close(); return; }
    const channel = new MessageChannel();
    portRef.current = channel.port1;
    const state = { gameId: module.runtimeId, version: release.version, sessionNonce: nonce, sequence: -1, complete: false };
    let sampleCount = 0;
    channel.port1.onmessage = (event) => {
      if (!AcceptGameMessage(event.data, state)) return;
      const message = event.data;
      if (message.type === 'ready') { setReady(true); setError(false); }
      if (message.type === 'result') { resultRef.current = message.payload; void save(); }
      if (message.type === 'retry') void save();
      if (message.type === 'exit') onClose();
      if (message.type === 'sample' && sampleCount++ < 100) {
        const body = new FormData();
        body.append('image', message.payload.image, 'drawing.png');
        body.append('metadata', JSON.stringify(message.payload.metadata));
        void fetch('/api/drawing-samples', { method: 'POST', body }).catch(() => undefined);
      }
    };
    channel.port1.start();
    // The iframe has an opaque origin. Transfer only to its captured window;
    // the game verifies the parent's source and origin before accepting this port.
    frameRef.current?.contentWindow?.postMessage({ schema: 'trainerhub.game/v1', type: 'init',
      gameId: module.runtimeId, version: release.version, sessionNonce: nonce, language }, '*', [channel.port2]);
  };
  return <dialog className="training-overlay training-overlay-runtime" ref={dialogRef}
    aria-label={module.copy[language === 'en' ? 'en' : 'zh-TW'].title}
    onCancel={event => { event.preventDefault(); onClose(); }}>
    <div className={`embedded-training-frame ${ready ? 'is-ready' : ''}`}>
      {!ready && <div className="training-loading-stage" role={error ? 'alert' : 'status'}>
        <p>{error ? (language === 'en' ? 'Game could not be loaded' : '無法載入遊戲') : (language === 'en' ? 'Loading game…' : '正在載入遊戲…')}</p>
        {error && <><button onClick={() => { portRef.current?.close(); portRef.current = null; setUnavailable(false); setReady(false); setError(false); setGeneration(value => value + 1); }}>{language === 'en' ? 'Try again' : '重新載入'}</button><button onClick={onClose}>{language === 'en' ? 'Back to lobby' : '返回大廳'}</button></>}
      </div>}
      {!unavailable && <iframe key={generation} ref={frameRef} src={source} title={release.name} onLoad={initialize}
        sandbox="allow-scripts" allow="autoplay; fullscreen" allowFullScreen referrerPolicy="strict-origin-when-cross-origin" />}
    </div>
  </dialog>;
}

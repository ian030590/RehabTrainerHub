import { useT } from './i18n/useT';
import { defaultSettings, ValidateSettings, ChartScale, type HartSettings } from './settings';
import { BuildGameScore, type HartResult } from './score';
import { ScoreAnalysis } from './ScoreAnalysis';
import { ExitGame, IsHubGame, OnSavedSettings, RetryGameSave, SaveGameSettings, SendGameEvent, SendGameResult } from './runtime/hubBridge';
import { RestoreSettings } from './runtime/settingsMemory';
import { StartTour } from './runtime/tour';
import { GetHartTutorialSteps } from './rules/tutorialSteps';
import { PrepareAudioFeedback, PlayMidiMusic, StopMidiMusic, DisposeAudioFeedback } from './runtime/soundManager';
import { backgroundMusic, backgroundMusicOptions } from './music';
import { initJsPsych } from 'jspsych';
import QRCode from 'qrcode';
import type {
CSSProperties,
ChangeEvent,
KeyboardEvent as ReactKeyboardEvent,
PointerEvent as ReactPointerEvent,
} from 'react';
import { useCallback,useEffect,useMemo,useRef,useState } from 'react';
import type { HartCell,HartDecoderToken } from './logic/hartChart';
import {
ClampHartScale,
CreateHartChart,
CreateHartDecoder,
CreateHartSeed,
ParseHartSeed
} from './logic/hartChart';
import { JsPsychExternalLifecycle } from './runtime/jsPsychLifecycle';
import './styles/hart-chart.css';

type DecoderDock = 'left' | 'right' | 'top' | 'bottom';
type HartTrainingPhase = 'menu' | 'rules' | 'playing' | 'results';

interface DecoderDragPreview {
  x: number;
  y: number;
  width: number;
  height: number;
}

const decoderDocks: readonly DecoderDock[] = ['left', 'right', 'top', 'bottom'];

function IsDecoderDock(value: string | null): value is DecoderDock {
  return value !== null && decoderDocks.includes(value as DecoderDock);
}


interface HartChartGridProps {
  cells: HartCell[];
  scale: number;
  hintedToken?: HartDecoderToken;
  hintsEnabled?: boolean;
  chartOnly?: boolean;
}

function HartChartGrid({
  cells,
  scale,
  hintedToken,
  hintsEnabled = false,
  chartOnly = false,
}: HartChartGridProps) {
  const hint = hintsEnabled ? hintedToken?.coordinate : undefined;
  const style = chartOnly
    ? {
        '--hart-font-min': `${20 * scale}px`,
        '--hart-font-fluid': `${5.5 * scale}vmin`,
        '--hart-font-max': `${62 * scale}px`,
      } as CSSProperties
    : {
        '--hart-font-min': `${22 * scale}px`,
        '--hart-font-fluid': `${5.1 * scale}vmin`,
        '--hart-font-max': `${47 * scale}px`,
      } as CSSProperties;

  return (
    <div
      className={`hart-chart-grid ${chartOnly ? 'hart-chart-grid-only' : ''}`}
      style={style}
      aria-label="Hart chart"
    >
      {cells.map((cell) => {
        const isAxis = hint && (cell.row === hint.row || cell.col === hint.col);
        const isTarget = hint && cell.row === hint.row && cell.col === hint.col;
        const className = [
          'hart-chart-cell',
          isAxis ? 'hart-chart-cell-axis' : '',
          isTarget ? 'hart-chart-cell-target' : '',
        ].filter(Boolean).join(' ');

        return (
          <span className={className} key={`${cell.row}-${cell.col}`}>
            {cell.char}
          </span>
        );
      })}
    </div>
  );
}

export function HartChartPage() {
  return window.location.hash.startsWith('#/hart-chart/display?') ? <HartChartDisplay /> : <HartChartRuntime />;
}

function HartChartDisplay() {
  const params = new URLSearchParams(window.location.hash.split('?')[1]);
  const [seed] = useState(() => ParseHartSeed(params.get('seed')));
  const chart = useMemo(() => CreateHartChart(seed), [seed]);
  const scale = ClampHartScale(Number(params.get('scale') ?? 1));
  return <main className="hart-display"><HartChartGrid cells={chart} scale={scale} chartOnly /></main>;
}

function HartChartRuntime() {
  const { t, lang } = useT();
  const fullscreenRootRef = useRef<HTMLDivElement>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const qrDialogRef = useRef<HTMLDialogElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const confirmationRef = useRef<HTMLDivElement>(null);
  const phaseRef = useRef<HartTrainingPhase>('menu');
  const generationRef = useRef(0);
  const [phase, setPhase] = useState<HartTrainingPhase>('menu');
  phaseRef.current = phase;
  useEffect(() => {
    if (phase === 'playing' && backgroundMusic) void PlayMidiMusic(backgroundMusic, backgroundMusicOptions).catch(error => console.warn('Music unavailable.', error));
    return StopMidiMusic;
  }, [phase]);
  useEffect(() => DisposeAudioFeedback, []);
  const [settings, setSettings] = useState<HartSettings>({ ...defaultSettings });
  const [tourFinished, setTourFinished] = useState(false);
  const [saveState, setSaveState] = useState<'local' | 'saving' | 'saved' | 'error'>('local');
  const [seed, setSeed] = useState(CreateHartSeed);
  const [scale, setScale] = useState(1);
  const rounds = settings.rounds;
  const [decoderOpen, setDecoderOpen] = useState(false);
  const [decoderDock, setDecoderDock] = useState<DecoderDock>(() => window.matchMedia('(orientation: portrait)').matches ? 'bottom' : 'right');
  const [decoderDragging, setDecoderDragging] = useState(false);
  const [decoderDragTarget, setDecoderDragTarget] = useState<DecoderDock>(decoderDock);
  const [decoderDragPreview, setDecoderDragPreview] = useState<DecoderDragPreview | null>(null);
  const [showHints, setShowHints] = useState(false);
  const [activeTokenIndex, setActiveTokenIndex] = useState<number | null>(null);
  const [answers, setAnswers] = useState<string[]>([]);
  const [attempts, setAttempts] = useState(0);
  const [startedAt, setStartedAt] = useState(Date.now);
  const [result, setResult] = useState<HartResult | null>(null);
  const [qrOpen, setQrOpen] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState('');
  const [qrError, setQrError] = useState(false);
  const [displayPreview, setDisplayPreview] = useState(false);
  const inputRefs = useRef<Array<HTMLInputElement | null>>([]);
  const jsPsychHostRef = useRef<HTMLDivElement | null>(null);
  const jsPsychLifecycleRef = useRef<JsPsychExternalLifecycle | null>(null);
  const workspaceRef = useRef<HTMLDivElement>(null);
  const decoderPanelRef = useRef<HTMLElement>(null);
  const decoderDragActiveRef = useRef(false);
  const decoderDragTargetRef = useRef<DecoderDock>(decoderDock);

  const chart = useMemo(() => CreateHartChart(seed), [seed]);
  const decoder = useMemo(() => CreateHartDecoder(chart, seed, rounds), [chart, seed, rounds]);
  const shareUrl = useMemo(() => {
    const baseUrl = window.location.href.split('#')[0].split('?')[0];
    const params = new URLSearchParams({
      seed: String(seed),
      scale: String(scale),
      lang,
    });
    return `${baseUrl}#/hart-chart/display?${params.toString()}`;
  }, [lang, scale, seed]);

  const decodableIndexes = useMemo(
    () => decoder.tokens
      .map((token, index) => token.coordinate ? index : -1)
      .filter((index) => index >= 0),
    [decoder.tokens],
  );

  const complete = decodableIndexes.length > 0
    && decodableIndexes.every((index) => answers[index] === decoder.tokens[index].char);

  useEffect(() => {
    if (phase !== 'playing') return;
    const host = jsPsychHostRef.current;
    if (!host) return;

    const jsPsych = initJsPsych({ display_element: host });
    const lifecycle = new JsPsychExternalLifecycle(jsPsych);
    jsPsychLifecycleRef.current = lifecycle;
    void lifecycle.start({ moduleId: 'vision:hart-chart', onStart: () => setStartedAt(Date.now()) });

    return () => {
      lifecycle.dispose();
      if (jsPsychLifecycleRef.current === lifecycle) jsPsychLifecycleRef.current = null;
    };
  }, [phase]);

  const backToSettings = useCallback(() => { generationRef.current++; setTourFinished(false); setPhase('menu'); }, []);
  useEffect(() => OnSavedSettings(saved => {
    if (phaseRef.current !== 'menu') return;
    const restored = RestoreSettings(saved, defaultSettings, ValidateSettings);
    if (restored) { setSettings(restored); setScale(ChartScale(restored.chartSize)); }
    if (typeof saved.decoderDock === 'string' && IsDecoderDock(saved.decoderDock)) setDecoderDock(saved.decoderDock);
  }), []);
  useEffect(() => {
    if (phase !== 'menu') return;
    dialogRef.current?.showModal();
    return () => dialogRef.current?.close();
  }, [phase]);
  useEffect(() => {
    setTourFinished(false);
    if (phase !== 'rules') return;
    return StartTour(GetHartTutorialSteps(lang), { lang, onEvent: () => setTourFinished(true), onBack: backToSettings });
  }, [phase, lang, backToSettings]);
  useEffect(() => { if (tourFinished) confirmationRef.current?.querySelector<HTMLButtonElement>('button')?.focus(); }, [tourFinished]);

  useEffect(() => {
    setAnswers(Array(decoder.tokens.length).fill(''));
    setActiveTokenIndex(null);
    inputRefs.current = [];
  }, [decoder]);

  useEffect(() => {
    if (!qrOpen) return;

    let cancelled = false;
    setQrError(false);
    qrDialogRef.current?.showModal();
    void QRCode.toDataURL(shareUrl, {
      width: 320,
      margin: 2,
      color: {
        dark: '#111827',
        light: '#FFFFFF',
      },
      errorCorrectionLevel: 'M',
    }).then((dataUrl) => {
      if (!cancelled) setQrDataUrl(dataUrl);
    }).catch(() => { if (!cancelled) setQrError(true); });

    return () => {
      cancelled = true;
      qrDialogRef.current?.close();
    };
  }, [qrOpen, shareUrl]);

  useEffect(() => {
    if (!qrOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      setQrOpen(false);
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [qrOpen]);

  const exitTraining = useCallback(() => {
    generationRef.current++;
    jsPsychLifecycleRef.current?.abort({ abort_reason: 'exit-training' });
    setQrOpen(false);
    void ExitGame();
  }, []);
  useEffect(() => {
    const configure = () => { setResult(null); setQrOpen(false); backToSettings(); };
    const saved = (event: Event) => setSaveState((event as CustomEvent).detail);
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && phaseRef.current === 'playing' && !qrOpen) { event.preventDefault(); exitTraining(); }
    };
    window.addEventListener('game:configure', configure);
    window.addEventListener('game:saved', saved);
    window.addEventListener('keydown', escape);
    return () => {
      window.removeEventListener('game:configure', configure);
      window.removeEventListener('game:saved', saved);
      window.removeEventListener('keydown', escape);
    };
  }, [backToSettings, exitTraining, qrOpen]);
  useEffect(() => {
    const cleanup = () => {
      generationRef.current++;
      jsPsychLifecycleRef.current?.abort({ abort_reason: 'unload' });
      if (document.fullscreenElement) void document.exitFullscreen().catch(() => undefined);
    };
    window.addEventListener('pagehide', cleanup);
    return () => { window.removeEventListener('pagehide', cleanup); cleanup(); };
  }, []);

  const resetChart = () => {
    setSeed(CreateHartSeed());
    setQrDataUrl('');
    setAttempts(0);
    setStartedAt(Date.now());
    setResult(null);
  };

  const setDock = (dock: DecoderDock) => {
    setDecoderDock(dock);
    setDecoderDragTarget(dock);
    decoderDragTargetRef.current = dock;
    SaveGameSettings({ ...settings, decoderDock: dock });
  };

  const getDockFromPointer = (clientX: number, clientY: number): DecoderDock => {
    const rect = workspaceRef.current?.getBoundingClientRect();
    if (!rect) return decoderDock;

    const distances: Record<DecoderDock, number> = {
      left: Math.abs(clientX - rect.left),
      right: Math.abs(rect.right - clientX),
      top: Math.abs(clientY - rect.top),
      bottom: Math.abs(rect.bottom - clientY),
    };

    return decoderDocks.reduce((nearest, dock) => (
      distances[dock] < distances[nearest] ? dock : nearest
    ), 'right');
  };

  const handleDecoderDragStart = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (event.button !== 0) return;

    const panelRect = decoderPanelRef.current?.getBoundingClientRect();
    if (!panelRect) return;

    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    decoderDragActiveRef.current = true;
    decoderDragTargetRef.current = decoderDock;
    setDecoderDragTarget(decoderDock);
    setDecoderDragging(true);

    const width = Math.min(panelRect.width, 440, window.innerWidth - 16);
    const height = Math.min(panelRect.height, 500, window.innerHeight - 16);
    setDecoderDragPreview({
      x: Math.max(8, Math.min(window.innerWidth - width - 8, event.clientX - width / 2)),
      y: Math.max(8, Math.min(window.innerHeight - height - 8, event.clientY - 28)),
      width,
      height,
    });
  };

  const handleDecoderDragMove = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (!decoderDragActiveRef.current) return;

    event.preventDefault();
    const dock = getDockFromPointer(event.clientX, event.clientY);
    decoderDragTargetRef.current = dock;
    setDecoderDragTarget(dock);
    setDecoderDragPreview((current) => current ? {
      ...current,
      x: Math.max(8, Math.min(window.innerWidth - current.width - 8, event.clientX - current.width / 2)),
      y: Math.max(8, Math.min(window.innerHeight - current.height - 8, event.clientY - 28)),
    } : null);
  };

  const finishDecoderDrag = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (!decoderDragActiveRef.current) return;

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    decoderDragActiveRef.current = false;
    setDock(decoderDragTargetRef.current);
    setDecoderDragging(false);
    setDecoderDragPreview(null);
  };

  const handleDecoderDockKeyDown = (event: ReactKeyboardEvent<HTMLButtonElement>) => {
    const dockByKey: Partial<Record<string, DecoderDock>> = {
      ArrowLeft: 'left',
      ArrowRight: 'right',
      ArrowUp: 'top',
      ArrowDown: 'bottom',
    };
    const dock = dockByKey[event.key];
    if (!dock) return;

    event.preventDefault();
    setDock(dock);
  };

  const handleAnswer = (index: number, event: ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value.replace(/[^a-z]/gi, '').slice(-1).toUpperCase();
    const nextAnswers = [...answers];
    nextAnswers[index] = value;
    setAnswers(nextAnswers);
    if (value) setAttempts((current) => current + 1);

    if (value !== decoder.tokens[index].char) return;

    const nextIndex = decodableIndexes.find((candidate) => (
      candidate > index && nextAnswers[candidate] !== decoder.tokens[candidate].char
    ));

    if (nextIndex !== undefined) {
      window.requestAnimationFrame(() => inputRefs.current[nextIndex]?.focus());
    } else {
      event.target.blur();
    }
  };

  const finishTraining = () => {
    if (!complete || phaseRef.current !== 'playing') return;
    phaseRef.current = 'results';

    const completedAt = new Date();
    const targetCount = decodableIndexes.length;
    const nextResult: HartResult = {
      completedAt: completedAt.toISOString(),
      durationMs: Math.max(0, completedAt.getTime() - startedAt),
      attempts,
      targetCount,
      accuracy: attempts > 0 ? Math.round((targetCount / attempts) * 100) : 100,
      phrase: decoder.phrase,
      hintsUsed: showHints,
    };
    jsPsychLifecycleRef.current?.finish({
      duration_ms: nextResult.durationMs,
      attempts: nextResult.attempts,
      target_count: nextResult.targetCount,
      accuracy_percent: nextResult.accuracy,
      hints_used: nextResult.hintsUsed,
    });
    if (document.fullscreenElement) void document.exitFullscreen().catch(() => undefined);
    setResult(nextResult);
    setPhase('results');
    setSaveState(IsHubGame() ? 'saving' : 'local');
    const score = BuildGameScore(nextResult);
    SendGameResult({ ...settings }, score.summary, score.rounds);
  };

  const isZh = lang !== 'en';
  const en = !isZh;
  const sizeLabel = (size: HartSettings['chartSize']) => ({ small: en ? 'Small' : '小', medium: en ? 'Medium' : '中', large: en ? 'Large' : '大' })[size];
  const confirmSettings = () => {
    if (!formRef.current?.reportValidity() || !ValidateSettings(settings)) return;
    SaveGameSettings({ ...settings, decoderDock });
    setScale(ChartScale(settings.chartSize));
    setPhase('rules');
  };
  const startTraining = async () => {
    if (phaseRef.current !== 'rules' || !tourFinished || !ValidateSettings(settings)) return;
    const generation = generationRef.current;
    PrepareAudioFeedback();
    try { await fullscreenRootRef.current?.requestFullscreen?.(); } catch { /* Continue in the current window. */ }
    if (generation !== generationRef.current || phaseRef.current !== 'rules') {
      if (document.fullscreenElement) await document.exitFullscreen().catch(() => undefined);
      return;
    }
    resetChart();
    setDecoderOpen(true);
    setShowHints(false);
    SendGameEvent('active');
    setPhase('playing');
  };

  return (
    <div ref={fullscreenRootRef} className="hart-chart-game-root" style={{ width: '100%', minHeight: '100dvh' }}>
      <div ref={jsPsychHostRef} style={{ display: 'none' }} aria-hidden="true" />
      {(phase === 'menu' || phase === 'rules') && <section className="hart-tutorial" aria-label={en ? 'Game tutorial scene' : '遊戲說明場景'}>
        <header className="hart-preview-tools"><h1>{t('hart.title')}</h1><p>{t('hart.fontSize')} · {t('hart.showHints')} · QR</p></header>
        <section className="hart-preview-chart"><HartChartGrid cells={chart} scale={ChartScale(settings.chartSize)} /></section>
        <section className="hart-preview-decoder"><h2>{t('hart.decoder')}</h2><div className="hart-preview-fields">
          {decoder.tokens.filter(token => token.coordinate).slice(0, 5).map((token, index) => <span key={index}>[{token.coordinate!.row},{token.coordinate!.col}]</span>)}
        </div><p>{t('hart.decoderPrompt')}</p></section>
        {phase === 'rules' && tourFinished && <section className="training-panel hart-tutorial-ready" role="dialog" aria-modal="true" aria-label={t('hart.title')}
          onKeyDown={event => {
            if (event.key === 'Escape') { event.preventDefault(); backToSettings(); }
            if (event.key === 'Tab') {
              event.preventDefault();
              const buttons = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>('button'));
              const index = buttons.indexOf(document.activeElement as HTMLButtonElement);
              buttons[(index + (event.shiftKey ? buttons.length - 1 : 1)) % buttons.length]?.focus();
            }
          }}>
          <div ref={confirmationRef} className="training-config training-confirmation">
            <header className="training-config-header"><h2>{t('hart.title')}</h2></header>
            <div className="training-config-body"><section className="training-setting"><h3>{en ? 'Confirm settings' : '確認設定'}</h3>
              <div className="training-config-summary"><p className="training-config-summary-item">{en ? 'Requested decoder letters' : '要求解碼字母數'}：{rounds}</p>
                <p className="training-config-summary-item">{en ? 'Chart size' : '視標大小'}：{sizeLabel(settings.chartSize)}</p></div>
            </section></div>
            <footer className="config-actions"><div className="training-config-navigation-buttons">
              <button type="button" className="btn btn-primary" onClick={startTraining}>{en ? 'Start Training' : '開始訓練'}</button>
              <button type="button" className="btn btn-ghost" onClick={backToSettings}>{en ? 'Back to settings' : '返回設定'}</button>
            </div></footer>
          </div>
        </section>}
      </section>}
      {phase === 'menu' && <dialog ref={dialogRef} className="game-settings-dialog hart-chart-phase-menu" aria-labelledby="hart-settings-title"
        onCancel={event => { event.preventDefault(); exitTraining(); }}>
        <form ref={formRef} className="training-config" onSubmit={event => { event.preventDefault(); confirmSettings(); }}
          onKeyDown={event => { if (event.key === 'Enter' && (event.target as HTMLElement).tagName !== 'BUTTON') { event.preventDefault(); confirmSettings(); } }}>
          <header className="training-config-header"><h2 id="hart-settings-title">{en ? 'Hart Chart Training' : '哈特圖訓練'}</h2></header>
          <div className="training-config-body"><section className="training-setting"><h3>{en ? 'Chart settings' : '視標設定'}</h3>
            <label>{en ? 'Requested decoder letters' : '要求解碼字母數'}：<output>{settings.rounds}</output>
              <input name="rounds" type="range" min={5} max={30} step={5} value={settings.rounds}
                onChange={event => setSettings({ ...settings, rounds: Number(event.target.value) })} /></label>
            <label>{en ? 'Chart size' : '視標大小'}<select name="chartSize" value={settings.chartSize}
              onChange={event => setSettings({ ...settings, chartSize: event.target.value as HartSettings['chartSize'] })}>
              {(['large', 'medium', 'small'] as const).map(size => <option value={size} key={size}>{sizeLabel(size)}</option>)}
            </select></label>
          </section></div>
          <footer className="config-actions"><div className="training-config-navigation-buttons">
            <button type="button" className="btn btn-primary" onClick={confirmSettings}>{en ? 'Confirm settings' : '確認設定'}</button>
            <button type="button" className="btn btn-ghost" onClick={exitTraining}>{IsHubGame() ? (en ? 'Back to lobby' : '返回大廳') : (en ? 'Back to entry' : '返回入口')}</button>
          </div></footer>
        </form>
      </dialog>}

      {phase === 'results' && result && (
        <main className="experiment-container experiment-container-scrollable hart-results-container">
          <div className="experiment-results">
            <h1>{t('hart.results.title')}</h1>
            <section className="score-priority"><h2>{en ? 'Key results' : '主要成果'}</h2><div className="score-key-grid">
              <div className="score-key-metric"><p>{en ? 'Target count / entry count' : '目標數／輸入次數'}</p><strong>{result.accuracy}%</strong></div>
              <div className="score-key-metric"><p>{t('hart.results.duration')}</p><strong>{result.durationMs} ms</strong></div>
              <div className="score-key-metric"><p>{t('hart.results.attempts')}</p><strong>{result.attempts}</strong></div>
            </div></section>
            <section className="score-context"><h2>{en ? 'Session settings' : '當次設定'}</h2><dl className="score-context-list">
              <div className="score-context-item"><dt>{en ? 'Requested letters' : '要求字母數'}</dt><dd>{settings.rounds}</dd></div>
              <div className="score-context-item"><dt>{en ? 'Chart size' : '視標大小'}</dt><dd>{sizeLabel(settings.chartSize)}</dd></div>
              <div className="score-context-item"><dt>{t('hart.results.targets')}</dt><dd>{result.targetCount}</dd></div>
              <div className="score-context-item"><dt>{en ? 'Hints enabled at finish (1/0)' : '結束時提示開啟（1／0）'}</dt><dd>{Number(result.hintsUsed)}</dd></div>
            </dl></section>
            <p className="hart-results-phrase">
              <strong>{t('hart.results.phrase')}</strong>
              <span>{result.phrase}</span>
            </p>
            <ScoreAnalysis rounds={BuildGameScore(result).rounds} language={lang} />
            <p className="score-save-status" role="status">{saveState === 'local' ? (en ? 'Local play. Results are not saved to the Hub.' : '獨立練習，成果未保存至 Hub。')
              : saveState === 'saved' ? (en ? 'Saved' : '已保存') : saveState === 'error' ? (en ? 'Save failed. Please retry.' : '保存失敗，請重試。') : (en ? 'Saving…' : '保存中…')}</p>
            {saveState === 'error' && <button className="score-retry-button" type="button" onClick={() => { setSaveState('saving'); RetryGameSave(); }}>{en ? 'Retry save' : '重試保存'}</button>}
            <button className="btn btn-primary score-return-button" type="button" onClick={exitTraining}>{IsHubGame() ? (en ? 'Back to lobby' : '返回大廳') : (en ? 'Back to entry' : '返回入口')}</button>
          </div>
        </main>
      )}

      {phase === 'playing' && (
        <main className={`hart-page ${decoderOpen ? `hart-page-decoder-open hart-decoder-dock-${decoderDock}` : ''}`}>
          <header className="hart-topbar">
        <div className="hart-topbar-leading">
          <button className="btn btn-ghost hart-back-button" type="button" aria-label={en ? 'Stop training' : '停止訓練'} onClick={exitTraining}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="m15 18-6-6 6-6" />
            </svg>
            {t('common.back')}
          </button>
          <div className="hart-title-block">
            <h1>{t('hart.title')}</h1>
            <p>{t('hart.subtitle')}</p>
          </div>
        </div>

        <div className="hart-topbar-controls">
          <label className="hart-scale-control">
            <span>{t('hart.fontSize')}</span>
            <input
              type="range"
              min="0.65"
              max="1.45"
              step="0.05"
              value={scale}
              onChange={(event) => setScale(ClampHartScale(Number(event.target.value)))}
            />
            <output>{Math.round(scale * 100)}%</output>
          </label>

          <button
            className={`btn btn-secondary hart-tool-button ${decoderOpen ? 'active' : ''}`}
            type="button"
            aria-pressed={decoderOpen}
            onClick={() => {
              setDecoderOpen((open) => !open);
              setActiveTokenIndex(null);
            }}
          >
            {t('hart.decoder')}
          </button>
          <button className="btn btn-secondary hart-tool-button" type="button" onClick={() => setQrOpen(true)}>
            {t('hart.openQr')}
          </button>
          <button className="btn btn-primary hart-tool-button" type="button" onClick={resetChart}>
            {t('hart.reset')}
          </button>
        </div>
      </header>

      <div
        ref={workspaceRef}
        className={`hart-workspace ${decoderDragging ? 'hart-workspace-is-dragging' : ''}`}
      >
        <section className="hart-chart-stage">
          <HartChartGrid
            cells={chart}
            scale={scale}
            hintsEnabled={showHints}
            hintedToken={activeTokenIndex === null ? undefined : decoder.tokens[activeTokenIndex]}
          />
        </section>

        {decoderOpen && (
          <aside
            ref={decoderPanelRef}
            className={`hart-decoder-panel ${decoderDragging ? 'hart-decoder-panel-dragging' : ''}`}
            style={decoderDragPreview ? {
              left: decoderDragPreview.x,
              top: decoderDragPreview.y,
              width: decoderDragPreview.width,
              height: decoderDragPreview.height,
            } : undefined}
          >
            <div className="hart-decoder-header">
              <button
                className="hart-decoder-drag-handle"
                type="button"
                aria-label={t('hart.dragDecoderHint')}
                title={t('hart.dragDecoderHint')}
                onPointerDown={handleDecoderDragStart}
                onPointerMove={handleDecoderDragMove}
                onPointerUp={finishDecoderDrag}
                onPointerCancel={finishDecoderDrag}
                onKeyDown={handleDecoderDockKeyDown}
              >
                <span className="hart-drag-grip" aria-hidden="true">
                  <i /><i /><i /><i /><i /><i />
                </span>
                <span>
                  <strong>{t('hart.decoder')}</strong>
                  <small>{t('hart.dragDecoder')}</small>
                </span>
              </button>
              <label className="hart-hints-toggle">
                <input
                  type="checkbox"
                  checked={showHints}
                  onChange={(event) => setShowHints(event.target.checked)}
                />
                {t('hart.showHints')}
              </label>
            </div>

            <div className="hart-decoder-scroll">
              <div
                className={`hart-code-output ${complete ? 'hart-code-output-complete' : ''}`}
                aria-label={t('hart.decoder')}
              >
                {decoder.tokens.map((token, index) => {
                  if (!token.coordinate) {
                    return (
                      <span className="hart-code-static" key={`${index}-${token.char}`}>
                        {token.char === ' ' ? '\u00A0' : token.char}
                      </span>
                    );
                  }

                  const isCorrect = answers[index] === token.char;
                  return (
                    <input
                      key={`${index}-${token.char}`}
                      ref={(element) => {
                        inputRefs.current[index] = element;
                      }}
                      className={`hart-code-input ${isCorrect ? 'is-correct' : ''}`}
                      value={answers[index] ?? ''}
                      placeholder={`[${token.coordinate.row},${token.coordinate.col}]`}
                      aria-label={`${t('hart.coordinate')} ${token.coordinate.row}, ${token.coordinate.col}`}
                      maxLength={1}
                      autoComplete="off"
                      spellCheck={false}
                      onChange={(event) => handleAnswer(index, event)}
                      onFocus={() => setActiveTokenIndex(index)}
                      onBlur={() => setActiveTokenIndex((current) => current === index ? null : current)}
                      onMouseEnter={() => setActiveTokenIndex(index)}
                      onMouseLeave={() => {
                        if (document.activeElement !== inputRefs.current[index]) {
                          setActiveTokenIndex(null);
                        }
                      }}
                    />
                  );
                })}
              </div>
            </div>

            <p className="hart-decoder-status" aria-live="polite">
              {complete ? `${t('hart.decoderComplete')} ${decoder.phrase}` : t('hart.decoderPrompt')}
            </p>
            {complete && (
              <button className="btn btn-primary hart-finish-button" type="button" onClick={finishTraining}>
                {t('hart.finish')}
              </button>
            )}
          </aside>
        )}

        {decoderDragging && (
          <div className="hart-dock-zones" aria-hidden="true">
            {decoderDocks.map((dock) => (
              <div
                key={dock}
                className={`hart-dock-zone hart-dock-zone-${dock} ${decoderDragTarget === dock ? 'active' : ''}`}
              >
                <span>{t(`hart.dock.${dock}`)}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {qrOpen && (
          <dialog ref={qrDialogRef}
            className="hart-qr-dialog"
            aria-labelledby="hart-qr-title"
            onCancel={event => { event.preventDefault(); setQrOpen(false); }}
          >
            <h2 id="hart-qr-title">{t('hart.qrTitle')}</h2>
            <p>{t('hart.qrDescription')}</p>
            {qrError ? <p role="alert">{en ? 'QR code unavailable. Close and retry.' : 'QR 碼無法產生，請關閉後重試。'}</p> : qrDataUrl ? <img src={qrDataUrl} alt={t('hart.qrAlt')} /> : <p role="status">{en ? 'Loading QR code…' : '正在產生 QR 碼…'}</p>}
            <p className="hart-share-url">{shareUrl}</p>
            <button type="button" onClick={() => setDisplayPreview(open => !open)}>{en ? 'Preview chart' : '預覽字母表'}</button>
            {displayPreview && <HartChartGrid cells={chart} scale={scale} chartOnly />}
            <button className="btn btn-primary" type="button" onClick={() => setQrOpen(false)}>
              {t('hart.close')}
            </button>
          </dialog>
      )}
        </main>
      )}
    </div>
  );
}

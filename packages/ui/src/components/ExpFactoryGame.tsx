import { GetAuthUserNameFromToken } from '../auth/authClient';
import { GetHostedGameSettings } from '../embeddedTraining';
import { ExitFullscreenIfActive } from '../fullscreen';
import {
  GetExpFactoryRoundLimit,
  HasReachedExpFactoryRoundLimit,
  SummarizeExpFactoryTrials,
  type ExpFactorySummary,
} from '../expFactoryRuntime';
import { useFullscreenTrainingRoot } from '../hooks/useFullscreenTrainingRoot';
import { useTrainingAbort } from '../hooks/useTrainingAbort';
import { SaveTrainingSessionRecord } from '../storage/trainingRecords';
import { FormatTestDate } from '../trainingGameUtils';
import { TrainingResultActions } from './TrainingResultActions';
import { useCallback, useEffect, useRef, useState } from 'react';

export interface ExpFactoryGameConfig {
  gameId: string;
  moduleId: string;
  sourceCommit: string;
  title: { zh: string; en: string };
}

interface ExpFactoryRuntimeManifest {
  schemaVersion: 1;
  gameId: string;
  timelineName: string;
  styles: string[];
  scripts: string[];
}

interface ExpFactoryJsPsych {
  init(options: {
    timeline: unknown[];
    display_element: string;
    fullscreen: false;
    on_trial_finish: () => void;
    on_finish: () => void;
  }): void;
  endExperiment?(message?: string): void;
  data: { dataAsJSON(): string };
}

interface ExpFactoryRuntimeWindow extends Window {
  $?: (value: unknown) => unknown;
  addID?: (gameId: string) => void;
  getDisplayElement?: () => unknown;
  jsPsych?: ExpFactoryJsPsych;
  rehabBilingualize?: () => void;
  rehabConfigure?: (settings: Record<string, unknown> | null, timeline: unknown[]) => void;
  rehabRoundCount?: (rows: Record<string, unknown>[]) => number;
  rehabResearchRows?: (rows: Record<string, unknown>[]) => Record<string, unknown>[];
}

interface PreparedRuntime {
  host: HTMLDivElement;
  manifest: ExpFactoryRuntimeManifest;
  runtime: ExpFactoryRuntimeWindow & Record<string, unknown>;
}

export function ExpFactoryGame({ config, onExit }: {
  config: ExpFactoryGameConfig;
  onExit: () => void;
}) {
  const runtimeHostRef = useRef<HTMLDivElement>(null);
  const preparedRuntimeRef = useRef<PreparedRuntime | null>(null);
  const runtimeAssetsRef = useRef<HTMLElement[]>([]);
  const runtimeBaseRef = useRef<HTMLBaseElement | null>(null);
  const mountedRef = useRef(true);
  const startedRef = useRef(false);
  const abortedRef = useRef(false);
  const savedRef = useRef(false);
  const { fullscreenRootRef, enterTrainingFullscreen } = useFullscreenTrainingRoot();
  const [phase, setPhase] = useState<'loading' | 'ready' | 'playing' | 'results'>('loading');
  const [summary, setSummary] = useState<ExpFactorySummary | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const disposeRuntimeAssets = useCallback(() => {
    for (const asset of runtimeAssetsRef.current) asset.remove();
    runtimeAssetsRef.current = [];
    runtimeBaseRef.current?.remove();
    runtimeBaseRef.current = null;
    preparedRuntimeRef.current?.host.replaceChildren();
    preparedRuntimeRef.current = null;
  }, []);

  const finishExperiment = useCallback((rows: Record<string, unknown>[]) => {
    if (!mountedRef.current || abortedRef.current) return;
    const projectedRows = preparedRuntimeRef.current?.runtime.rehabResearchRows
      ? preparedRuntimeRef.current.runtime.rehabResearchRows(rows)
      : rows;
    const safeTrials = projectedRows.slice(0, 4_000).map(SanitizeTrialRow);
    const result = SummarizeExpFactoryTrials(safeTrials);
    setSummary(result);
    setPhase('results');
    void ExitFullscreenIfActive();
    disposeRuntimeAssets();

    if (savedRef.current) return;
    savedRef.current = true;
    void SaveTrainingSessionRecord({
      userName: GetAuthUserNameFromToken() || 'Guest',
      moduleId: config.moduleId,
      gameId: config.gameId,
      gameTitle: `${config.title.zh} (${config.title.en})`,
      difficulty: 'expfactory-configured',
      trainingDate: FormatTestDate(new Date()),
      details: {
        Source_Commit: config.sourceCommit,
        Total_Trials: result.totalTrials,
        Scored_Trials: result.scoredTrials,
        Correct_Trials: result.correctTrials,
        Accuracy_Percent: result.accuracyPercent,
        Mean_RT_Ms: result.meanRtMs,
      },
      detailRows: safeTrials,
    });
  }, [config, disposeRuntimeAssets]);

  const startPreparedRuntime = useCallback(() => {
    const prepared = preparedRuntimeRef.current;
    if (!prepared || startedRef.current || abortedRef.current) return;
    const { host, manifest, runtime } = prepared;
    try {
      const jsPsych = runtime.jsPsych;
      const jquery = runtime.$;
      const originalTimeline = runtime[manifest.timelineName];
      if (!jsPsych || typeof jsPsych.init !== 'function') throw new Error('jsPsych runtime was not loaded.');
      if (typeof jquery !== 'function') throw new Error('The jsPsych DOM adapter was not loaded.');
      if (!Array.isArray(originalTimeline)) throw new Error('The original jsPsych timeline was not found.');

      runtime.rehabBilingualize?.();
      const timeline = originalTimeline.slice();
      const settings = GetHostedGameSettings();
      const roundLimit = GetExpFactoryRoundLimit(settings);
      runtime.rehabConfigure?.(settings, timeline);
      runtime.getDisplayElement = () => {
        host.replaceChildren();
        const background = document.createElement('div');
        background.className = 'display_stage_background';
        const stage = document.createElement('div');
        stage.className = 'display_stage';
        host.append(background, stage);
        return jquery(stage);
      };

      startedRef.current = true;
      setPhase('playing');
      jsPsych.init({
        timeline,
        display_element: 'getDisplayElement',
        fullscreen: false,
        on_trial_finish: () => {
          runtime.addID?.(config.gameId);
          if (roundLimit === null || typeof jsPsych.endExperiment !== 'function') return;
          const rows = JSON.parse(jsPsych.data.dataAsJSON()) as Record<string, unknown>[];
          const completedRounds = runtime.rehabRoundCount?.(rows)
            ?? runtime.rehabResearchRows?.(rows).length
            ?? 0;
          if (HasReachedExpFactoryRoundLimit(roundLimit, completedRounds)) jsPsych.endExperiment();
        },
        on_finish: () => {
          if (abortedRef.current) return;
          try {
            const rows = JSON.parse(jsPsych.data.dataAsJSON()) as Record<string, unknown>[];
            finishExperiment(rows);
          } catch (error) {
            setErrorMessage(GetErrorMessage(error));
            setPhase('results');
            disposeRuntimeAssets();
          }
        },
      });
    } catch (error) {
      setErrorMessage(GetErrorMessage(error));
      setPhase('results');
      disposeRuntimeAssets();
    }
  }, [config.gameId, disposeRuntimeAssets, finishExperiment]);

  const startFromGesture = useCallback(async () => {
    await enterTrainingFullscreen();
    if (mountedRef.current) startPreparedRuntime();
  }, [enterTrainingFullscreen, startPreparedRuntime]);

  const handleAbort = useCallback(() => {
    abortedRef.current = true;
    try {
      preparedRuntimeRef.current?.runtime.jsPsych?.endExperiment?.();
    } catch {
      // The original runtime may already have completed.
    }
    disposeRuntimeAssets();
    void ExitFullscreenIfActive();
    onExit();
  }, [disposeRuntimeAssets, onExit]);

  useTrainingAbort({ active: phase !== 'results', onAbort: handleAbort });

  useEffect(() => {
    mountedRef.current = true;
    abortedRef.current = false;
    const controller = new AbortController();

    void (async () => {
      try {
        const host = runtimeHostRef.current;
        if (!host) throw new Error('The jsPsych display container is missing.');
        const runtimeBase = new URL('./runtime/', window.location.href);
        const manifest = await LoadRuntimeManifest(new URL('manifest.json', runtimeBase), config.gameId, controller.signal);
        if (controller.signal.aborted) return;

        const base = document.createElement('base');
        base.href = runtimeBase.href;
        document.head.append(base);
        runtimeBaseRef.current = base;

        const styles = await Promise.all(manifest.styles.map((path) => (
          LoadRuntimeStyle(new URL(path, runtimeBase).href, controller.signal)
        )));
        runtimeAssetsRef.current.push(...styles);
        for (const path of manifest.scripts) {
          const script = await LoadRuntimeScript(new URL(path, runtimeBase).href, controller.signal);
          runtimeAssetsRef.current.push(script);
        }
        if (controller.signal.aborted || !mountedRef.current) return;

        preparedRuntimeRef.current = {
          host,
          manifest,
          runtime: window as unknown as ExpFactoryRuntimeWindow & Record<string, unknown>,
        };
        const hostFrame = window.frameElement;
        const parentFullscreen = hostFrame?.ownerDocument.fullscreenElement;
        if (document.fullscreenElement || parentFullscreen?.contains(hostFrame)) {
          startPreparedRuntime();
          return;
        }
        const entered = await enterTrainingFullscreen();
        if (!mountedRef.current) return;
        if (entered) startPreparedRuntime();
        else setPhase('ready');
      } catch (error) {
        if (controller.signal.aborted) return;
        setErrorMessage(GetErrorMessage(error));
        setPhase('results');
        disposeRuntimeAssets();
      }
    })();

    return () => {
      mountedRef.current = false;
      abortedRef.current = true;
      controller.abort();
      try {
        preparedRuntimeRef.current?.runtime.jsPsych?.endExperiment?.();
      } catch {
        // The original runtime may already have completed.
      }
      disposeRuntimeAssets();
    };
  }, [config.gameId, disposeRuntimeAssets, enterTrainingFullscreen, startPreparedRuntime]);

  return (
    <div
      ref={fullscreenRootRef}
      className="cognitive-reference-game"
      style={{
        background: 'var(--background)',
        color: 'var(--text)',
        minHeight: '100dvh',
        position: 'relative',
        width: '100%',
      }}
    >
      {phase !== 'results' && (
        <>
          <div ref={runtimeHostRef} style={{ minHeight: '100dvh', width: '100%' }} />
          {phase === 'loading' && (
            <p role="status" style={{ inset: '50% auto auto 50%', margin: 0, position: 'fixed', transform: 'translate(-50%, -50%)' }}>
              正在準備遊戲… / Preparing game…
            </p>
          )}
          {phase === 'ready' && (
            <section style={{ position: 'fixed', inset: 0, display: 'grid', placeContent: 'center', background: 'var(--background)', textAlign: 'center', padding: '2rem', zIndex: 99 }}>
              <h2>{config.title.zh} / {config.title.en}</h2>
              <p>點擊開始，以全螢幕閱讀說明並進行遊戲。</p>
              <p>Click start to enter fullscreen and read the instructions.</p>
              <button className="btn btn-primary btn-lg" type="button" onClick={() => { void startFromGesture(); }}>
                開始 / Start
              </button>
            </section>
          )}
          <button
            type="button"
            onClick={handleAbort}
            style={{
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius)',
              color: 'var(--text)',
              cursor: 'pointer',
              font: 'inherit',
              fontWeight: 700,
              insetInlineEnd: '1rem',
              padding: '0.65rem 1rem',
              position: 'fixed',
              top: '1rem',
              zIndex: 100,
            }}
          >
            離開 / Exit
          </button>
        </>
      )}

      {phase === 'results' && summary && (
        <section style={{ margin: '0 auto', maxWidth: '42rem', padding: 'clamp(2rem, 8vw, 6rem) 1.25rem', textAlign: 'center' }}>
          <p style={{ color: 'var(--primary)', fontWeight: 800, margin: 0 }}>當次紀錄 / Session record</p>
          <h1 style={{ color: 'var(--heading)', marginBlock: '0.5rem 2rem' }}>
            {config.title.zh} / {config.title.en}
          </h1>
          <dl style={{ display: 'grid', gap: '1rem', gridTemplateColumns: 'repeat(auto-fit, minmax(9rem, 1fr))', marginBottom: '2rem' }}>
            <ResultMetric label="分析單位 / Trials" value={summary.totalTrials} />
            <ResultMetric label="正確率 / Accuracy" value={summary.accuracyPercent === null ? '—' : `${summary.accuracyPercent}%`} />
            <ResultMetric label="平均作答時間 / Mean RT" value={summary.meanRtMs === null ? '—' : `${summary.meanRtMs} ms`} />
          </dl>
          <TrainingResultActions
            backLabel="返回入口 / Back to entry"
            hubLabel="返回大廳 / Back to lobby"
            onBackHome={onExit}
          />
        </section>
      )}

      {phase === 'results' && errorMessage && (
        <section role="alert" style={{ margin: '0 auto', maxWidth: '36rem', padding: '6rem 1.25rem', textAlign: 'center' }}>
          <h1>無法啟動遊戲 / Unable to start the game</h1>
          <p>{errorMessage}</p>
          <button className="btn btn-primary btn-lg" type="button" onClick={handleAbort}>
            返回 / Back
          </button>
        </section>
      )}
    </div>
  );
}

function ResultMetric({ label, value }: { label: string; value: string | number }) {
  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '1rem' }}>
      <dt style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>{label}</dt>
      <dd style={{ color: 'var(--heading)', fontSize: '1.75rem', fontWeight: 900, margin: '0.35rem 0 0' }}>{value}</dd>
    </div>
  );
}

async function LoadRuntimeManifest(url: URL, gameId: string, signal: AbortSignal): Promise<ExpFactoryRuntimeManifest> {
  const response = await fetch(url, { signal });
  if (!response.ok) throw new Error(`Runtime manifest could not be loaded (${response.status}).`);
  const value = await response.json() as Partial<ExpFactoryRuntimeManifest>;
  if (value.schemaVersion !== 1 || value.gameId !== gameId || !IsRuntimeName(value.timelineName)
    || !IsRuntimePathList(value.styles) || !IsRuntimePathList(value.scripts)) {
    throw new Error('Runtime manifest is invalid.');
  }
  return value as ExpFactoryRuntimeManifest;
}

function LoadRuntimeStyle(href: string, signal: AbortSignal): Promise<HTMLLinkElement> {
  return new Promise((resolve, reject) => {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = href;
    link.onload = () => resolve(link);
    link.onerror = () => reject(new Error(`Runtime style could not be loaded: ${href}`));
    signal.addEventListener('abort', () => {
      link.remove();
      reject(new DOMException('Runtime loading was aborted.', 'AbortError'));
    }, { once: true });
    document.head.append(link);
  });
}

function LoadRuntimeScript(src: string, signal: AbortSignal): Promise<HTMLScriptElement> {
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.async = false;
    script.src = src;
    script.onload = () => resolve(script);
    script.onerror = () => reject(new Error(`Runtime script could not be loaded: ${src}`));
    signal.addEventListener('abort', () => {
      script.remove();
      reject(new DOMException('Runtime loading was aborted.', 'AbortError'));
    }, { once: true });
    document.body.append(script);
  });
}

function IsRuntimeName(value: unknown): value is string {
  return typeof value === 'string' && /^[A-Za-z_$][\w$]*$/.test(value);
}

function IsRuntimePathList(value: unknown): value is string[] {
  return Array.isArray(value) && value.length > 0 && value.length <= 64
    && value.every((path) => typeof path === 'string'
      && path.length <= 200
      && !path.startsWith('/')
      && !path.includes('..')
      && /^[A-Za-z0-9_./-]+$/.test(path));
}

function SanitizeTrialRow(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return Object.fromEntries(Object.entries(value as Record<string, unknown>)
    .filter(([key, entry]) => (
      !/(auth|email|jwt|name|password|token|user)/i.test(key)
      && (entry === null || ['boolean', 'number', 'string'].includes(typeof entry))
    ))
    .slice(0, 48)
    .map(([key, entry]) => [key, typeof entry === 'string' ? entry.slice(0, 500) : entry]));
}

function GetErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'The original jsPsych runtime could not be started.';
}

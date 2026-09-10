import { GetAuthUserNameFromToken } from '../auth/authClient';
import { FormatTestDate } from '../trainingGameUtils';
import { useFullscreenTrainingRoot } from '../hooks/useFullscreenTrainingRoot';
import { useTrainingAbort } from '../hooks/useTrainingAbort';
import { SaveTrainingSessionRecord } from '../storage/trainingRecords';
import { TrainingResultActions } from './TrainingResultActions';
import { useCallback, useEffect, useRef, useState } from 'react';

const legacyStartMessageType = 'rehab-expfactory:start';
const legacyAbortMessageType = 'rehab-expfactory:abort';
const legacyCompleteMessageType = 'rehab-expfactory:complete';

export interface ExpFactoryGameConfig {
  gameId: string;
  moduleId: string;
  sourceCommit: string;
  title: { zh: string; en: string };
  tour: {
    goal: { zh: string; en: string };
    stimulus: { zh: string; en: string };
    response: { zh: string; en: string };
  };
}

interface LegacySummary {
  totalTrials: number;
  scoredTrials: number;
  correctTrials: number;
  accuracyPercent: number | null;
  meanRtMs: number | null;
}

interface LegacyCompleteMessage {
  type: typeof legacyCompleteMessageType;
  gameId: string;
  summary: LegacySummary;
  trials: Record<string, unknown>[];
}

export function ExpFactoryGame({ config, onExit }: {
  config: ExpFactoryGameConfig;
  onExit: () => void;
}) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const mountedRef = useRef(true);
  const startedRef = useRef(false);
  const tourCompleteRef = useRef(false);
  const legacyLoadedRef = useRef(false);
  const savedRef = useRef(false);
  const { fullscreenRootRef, enterTrainingFullscreen } = useFullscreenTrainingRoot();
  const [phase, setPhase] = useState<'playing' | 'results'>('playing');
  const [summary, setSummary] = useState<LegacySummary | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const postToLegacy = useCallback((type: string) => {
    iframeRef.current?.contentWindow?.postMessage({ type }, window.location.origin);
  }, []);

  const handleAbort = useCallback(() => {
    postToLegacy(legacyAbortMessageType);
    onExit();
  }, [onExit, postToLegacy]);

  useTrainingAbort({ active: phase === 'playing', onAbort: handleAbort });

  const beginExperiment = useCallback(async () => {
    if (startedRef.current || !mountedRef.current) return;
    startedRef.current = true;
    await enterTrainingFullscreen();
    if (!mountedRef.current) return;
    setPhase('playing');
    postToLegacy(legacyStartMessageType);
  }, [enterTrainingFullscreen, postToLegacy]);

  const tryBeginExperiment = useCallback(() => {
    if (!tourCompleteRef.current || !legacyLoadedRef.current) return;
    void beginExperiment();
  }, [beginExperiment]);

  const handleLegacyLoad = useCallback(() => {
    legacyLoadedRef.current = true;
    tryBeginExperiment();
  }, [tryBeginExperiment]);

  useEffect(() => {
    mountedRef.current = true;
    const tourEventName = `rehab-trainer:game-tour-complete:${config.gameId}`;
    const handleTourComplete = () => {
      tourCompleteRef.current = true;
      tryBeginExperiment();
    };
    const handleMessage = (event: MessageEvent<unknown>) => {
      if (event.origin !== window.location.origin || event.source !== iframeRef.current?.contentWindow) return;
      if (IsLegacyErrorMessage(event.data, config.gameId)) {
        setErrorMessage(event.data.message);
        setPhase('results');
        return;
      }
      if (!IsLegacyCompleteMessage(event.data, config.gameId)) return;
      const safeTrials = event.data.trials.slice(0, 2_000).map(SanitizeTrialRow);
      setSummary(event.data.summary);
      setPhase('results');
      if (savedRef.current) return;
      savedRef.current = true;
      const result = event.data.summary;
      void SaveTrainingSessionRecord({
        userName: GetAuthUserNameFromToken() || 'Guest',
        moduleId: config.moduleId,
        gameId: config.gameId,
        gameTitle: `${config.title.zh} (${config.title.en})`,
        difficulty: 'expfactory-original',
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
    };
    window.addEventListener('message', handleMessage);
    window.addEventListener(tourEventName, handleTourComplete);
    return () => {
      mountedRef.current = false;
      window.removeEventListener('message', handleMessage);
      window.removeEventListener(tourEventName, handleTourComplete);
    };
  }, [config, tryBeginExperiment]);

  return (
    <div
      ref={fullscreenRootRef}
      className="cognitive-reference-game"
      style={{
        background: 'var(--background)',
        color: 'var(--text)',
        minHeight: '100dvh',
        position: 'relative',
      }}
    >
      {phase !== 'results' && (
        <>
          <iframe
            allow="fullscreen"
            onLoad={handleLegacyLoad}
            ref={iframeRef}
            sandbox="allow-forms allow-same-origin allow-scripts"
            src="./legacy/index.html"
            style={{ border: 0, display: 'block', height: '100dvh', width: '100%' }}
            title={`${config.title.zh} / ${config.title.en}`}
          />
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
            結束 / Exit
          </button>
        </>
      )}

      {phase === 'results' && summary && (
        <section
          style={{
            margin: '0 auto',
            maxWidth: '42rem',
            padding: 'clamp(2rem, 8vw, 6rem) 1.25rem',
            textAlign: 'center',
          }}
        >
          <p style={{ color: 'var(--primary)', fontWeight: 800, margin: 0 }}>
            當次紀錄 / Session record
          </p>
          <h1 style={{ color: 'var(--heading)', marginBlock: '0.5rem 2rem' }}>
            {config.title.zh} / {config.title.en}
          </h1>
          <dl style={{
            display: 'grid',
            gap: '1rem',
            gridTemplateColumns: 'repeat(auto-fit, minmax(9rem, 1fr))',
            marginBottom: '2rem',
          }}>
            <ResultMetric label="完成試次 / Trials" value={summary.totalTrials} />
            <ResultMetric
              label="正確率 / Accuracy"
              value={summary.accuracyPercent === null ? '—' : `${summary.accuracyPercent}%`}
            />
            <ResultMetric
              label="平均反應時間 / Mean RT"
              value={summary.meanRtMs === null ? '—' : `${summary.meanRtMs} ms`}
            />
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
          <h1>無法啟動原始實驗 / Unable to start the original experiment</h1>
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
    <div style={{
      background: 'var(--surface)',
      border: '1px solid var(--border)',
      borderRadius: 'var(--radius)',
      padding: '1rem',
    }}>
      <dt style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>{label}</dt>
      <dd style={{ color: 'var(--heading)', fontSize: '1.75rem', fontWeight: 900, margin: '0.35rem 0 0' }}>
        {value}
      </dd>
    </div>
  );
}

function IsLegacyCompleteMessage(value: unknown, gameId: string): value is LegacyCompleteMessage {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const message = value as Partial<LegacyCompleteMessage>;
  const summary = message.summary as Partial<LegacySummary> | undefined;
  return message.type === legacyCompleteMessageType
    && message.gameId === gameId
    && Array.isArray(message.trials)
    && message.trials.length <= 5_000
    && Boolean(summary)
    && Number.isInteger(summary?.totalTrials)
    && Number.isInteger(summary?.scoredTrials)
    && Number.isInteger(summary?.correctTrials)
    && (summary?.accuracyPercent === null || Number.isFinite(summary?.accuracyPercent))
    && (summary?.meanRtMs === null || Number.isFinite(summary?.meanRtMs));
}

function IsLegacyErrorMessage(value: unknown, gameId: string): value is {
  type: 'rehab-expfactory:error'; gameId: string; message: string;
} {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const message = value as Record<string, unknown>;
  return message.type === 'rehab-expfactory:error'
    && message.gameId === gameId
    && typeof message.message === 'string'
    && message.message.length <= 500;
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

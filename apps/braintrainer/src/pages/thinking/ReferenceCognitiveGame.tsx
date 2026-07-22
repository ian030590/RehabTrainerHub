import { type CSSProperties, useCallback, useEffect, useRef, useState } from 'react';
import { Application, type Ticker } from 'pixi.js';
import { initJsPsych } from 'jspsych';
import { GetAuthUserNameFromToken } from '@rehab-trainer/ui/auth/authClient';
import { useT } from '../../i18n';
import { DownloadCsvFile } from '@rehab-trainer/ui/downloadFile';
import { PlayFailureSound, PlayGameEndSound, PlaySuccessSound, PrepareAudioFeedback } from '../../utils/soundManager';
import { SaveTrainingSessionRecord } from '../../utils/trainingRecords';
import { csvCell, FormatTestDate, WriteJsPsychData } from '@rehab-trainer/ui/trainingGameUtils';
import {
  difficulties,
  reactionTrialOptions,
  referenceCognitiveModules,
  sessionLimitOptions,
  whackDurationOptions,
} from './cognitive/constants';
import {
  CreateLightsState,
  DrawLightsOut,
  HandleLightsTap,
  IsLightsAutoSuccess,
} from './cognitive/lightsOut';
import {
  CreateLanguageNeutralGameState,
  DrawLanguageNeutralGame,
  GetLanguageNeutralFeedbackCounts,
  HandleLanguageNeutralGameKey,
  HandleLanguageNeutralGameTap,
  IsLanguageNeutralAutoSuccess,
  IsLanguageNeutralGameState,
  UpdateLanguageNeutralTimedState,
} from './cognitive/languageNeutralGames';
import {
  CreateMemoryState,
  DrawMemory,
  HandleMemoryTap,
  IsMemoryAutoSuccess,
  UpdateMemoryTimedState,
} from './cognitive/memoryMatch';
import {
  CreateReactionState,
  BuildReactionResultStats,
  DrawReaction,
  HandleReactionStateTap,
  IsReactionAutoSuccess,
  ShowReactionGo,
  UpdateReactionTimedState,
} from './cognitive/reactionTime';
import {
  CreateSlidingState,
  DrawSliding,
  HandleSlidingTap,
  IsSlidingAutoSuccess,
} from './cognitive/slidingPuzzle';
import {
  CreateWhackState,
  BuildWhackResultStats,
  DrawWhack,
  ExpireWhackTarget,
  HandleWhackTap,
  IsWhackAutoSuccess,
  ShowWhackTarget,
  UpdateWhackTimedState,
} from './cognitive/targetClick';
import type {
  CognitiveGameState,
  Difficulty,
  GamePhase,
  GameResult,
  ReferenceGameId,
  RuntimeMetrics,
  SessionLimitSeconds,
  SessionRecord,
} from './cognitive/types';
import type { TFunction } from './types';
import { cognitiveAccentCss, ClearStage, DrawBackground } from './cognitive/utils';
import { StartTrainingButton } from '@rehab-trainer/ui/components/StartTrainingButton';
import { TrainingConfigPanel } from '@rehab-trainer/ui/components/TrainingConfigPanel';
import { TrainingResultActions } from '@rehab-trainer/ui/components/TrainingResultActions';
import { useFullscreenTrainingRoot } from '@rehab-trainer/ui/hooks/useFullscreenTrainingRoot';
import { useTrainingAbort } from '@rehab-trainer/ui/hooks/useTrainingAbort';
import { BrainTrainingRulesPanel } from './BrainTrainingRulesPanel';

export type { ReferenceGameId } from './cognitive/types';
export { referenceCognitiveModules } from './cognitive/constants';

interface ReferenceCognitiveGameProps {
  gameId: ReferenceGameId;
  onExit: () => void;
}

export function IsReferenceGameId(value: string | null): value is ReferenceGameId {
  return referenceCognitiveModules.some((module) => module.id === value);
}

export function ReferenceCognitiveGame({ gameId, onExit }: ReferenceCognitiveGameProps) {
  const { t } = useT();
  const { fullscreenRootRef, enterTrainingFullscreen } = useFullscreenTrainingRoot<HTMLDivElement>();
  const pixiHostRef = useRef<HTMLDivElement | null>(null);
  const appRef = useRef<Application | null>(null);
  const phaseRef = useRef<GamePhase>('menu');
  const stateRef = useRef<CognitiveGameState | null>(null);
  const metricsRef = useRef<RuntimeMetrics>({ elapsed: 0 });
  const jsPsychRef = useRef<ReturnType<typeof initJsPsych> | null>(null);
  const renderRef = useRef<() => void>(() => undefined);
  const finishGameRef = useRef<(result: GameResult) => void>(() => undefined);
  const lastRenderSecondRef = useRef(-1);

  const [phase, setPhaseState] = useState<GamePhase>('menu');
  const [difficulty, setDifficulty] = useState<Difficulty>('Beginner');
  const [sessionLimitSec, setSessionLimitSec] = useState<SessionLimitSeconds>(null);
  const [reactionTrials, setReactionTrials] = useState<number>(8);
  const [whackDurationSec, setWhackDurationSec] = useState<number>(30);
  const [result, setResult] = useState<SessionRecord | null>(null);

  const meta = GetModuleMeta(gameId);
  const metaTitle = t(meta.titleKey);
  const metaDescription = t(meta.descriptionKey);
  const metaFocus = t(meta.focusKey);
  const activeConfig = difficulties[difficulty];
  const activeDifficultyLabel = t(activeConfig.labelKey);
  const activeDifficultyDescription = t(activeConfig.descriptionKey);

  const setPhase = useCallback((next: GamePhase) => {
    phaseRef.current = next;
    setPhaseState(next);
  }, []);

  const renderCurrent = useCallback(() => {
    const app = appRef.current;
    const state = stateRef.current;
    if (!app || !state) return;
    ClearStage(app);
    DrawBackground(app);
    switch (state.kind) {
      case 'memory-match':
        DrawMemory(app, state, HandleCellTap);
        break;
      case 'lights-out':
        DrawLightsOut(app, state, HandleCellTap);
        break;
      case 'reaction-time':
        DrawReaction(app, state, HandleReactionTap, t);
        break;
      case 'whack-a-mole':
        DrawWhack(app, state, HandleWhackCellTap);
        break;
      case 'sliding-puzzle':
        DrawSliding(app, state, HandleCellTap);
        break;
      default:
        if (IsLanguageNeutralGameState(state)) {
          DrawLanguageNeutralGame(app, state, metricsRef.current.elapsed, HandleCellTap, t);
        }
        break;
    }
  }, [t]);

  renderRef.current = renderCurrent;

  const finishGame = useCallback((gameResult: GameResult) => {
    if (phaseRef.current === 'results') return;
    const state = stateRef.current;
    if (!state) return;
    jsPsychRef.current?.pluginAPI.clearAllTimeouts();
    PlayGameEndSound(gameResult, jsPsychRef);
    const trainingDate = FormatTestDate(new Date());
    const participantId = GetAuthUserNameFromToken() || 'Unknown';
    const timingData = GetTimingResultData(state);
    const record: SessionRecord = {
      Game_Result: gameResult,
      Total_Duration_Seconds: Number(metricsRef.current.elapsed.toFixed(1)),
      ...timingData.details,
    };
    setResult(record);
    setPhase('results');
    void SaveTrainingSessionRecord({
      userName: participantId,
      moduleId: 'thinking-training',
      gameId,
      gameTitle: metaTitle,
      difficulty,
      trainingDate,
      details: {
        Game_Result: record.Game_Result,
        Total_Duration_Seconds: record.Total_Duration_Seconds,
        ...timingData.details,
      },
      detailRows: timingData.detailRows,
    });
    WriteJsPsychData(jsPsychRef, record as unknown as Record<string, unknown>, 'Unable to write reference cognitive result to jsPsych data.');
  }, [difficulty, gameId, metaTitle, setPhase]);

  finishGameRef.current = finishGame;

  const startGame = useCallback(async () => {
    jsPsychRef.current?.pluginAPI.clearAllTimeouts();
    PrepareAudioFeedback(jsPsychRef);
    await enterTrainingFullscreen();

    const app = appRef.current;
    if (!app || !(await ResizePixiAppToElement(app, pixiHostRef.current))) return;
    metricsRef.current = { elapsed: 0 };
    lastRenderSecondRef.current = -1;
    stateRef.current = CreateInitialState(gameId, difficulty, reactionTrials);
    setResult(null);
    setPhase('playing');
    renderRef.current();
    FlushPixiRender();
    if (stateRef.current?.kind === 'whack-a-mole') ScheduleNextWhackTarget(stateRef.current);
  }, [difficulty, enterTrainingFullscreen, gameId, reactionTrials, setPhase]);

  const returnToMenu = useCallback(() => {
    jsPsychRef.current?.pluginAPI.clearAllTimeouts();
    setPhase('menu');
    setResult(null);
    stateRef.current = null;
    metricsRef.current = { elapsed: 0 };
    const app = appRef.current;
    if (app) {
      ClearStage(app);
      DrawBackground(app);
    }
  }, [setPhase]);

  const downloadResult = useCallback(() => {
    if (!result) return;
    DownloadCsvFile(ToCsv([result]), `thinking_${gameId}_${Date.now()}.csv`);
  }, [gameId, result]);

  function HandleCellTap(index: number) {
    if (phaseRef.current !== 'playing') return;
    const state = stateRef.current;
    if (!state) return;
    const feedbackBefore = GetFeedbackCounts(state);
    if (state.kind === 'memory-match') HandleMemoryTap(state, index, metricsRef.current.elapsed, finishGameRef.current);
    if (state.kind === 'lights-out') HandleLightsTap(state, index, finishGameRef.current);
    if (state.kind === 'sliding-puzzle') HandleSlidingTap(state, index, finishGameRef.current);
    if (IsLanguageNeutralGameState(state)) {
      HandleLanguageNeutralGameTap(state, index, metricsRef.current.elapsed, finishGameRef.current);
    }
    PlayFeedbackForCountChange(feedbackBefore, GetFeedbackCounts(state), jsPsychRef);
    renderRef.current();
  }

  function HandleWhackCellTap(index: number, tapMs: number) {
    if (phaseRef.current !== 'playing') return;
    const state = stateRef.current;
    if (!state || state.kind !== 'whack-a-mole') return;
    const feedbackBefore = GetFeedbackCounts(state);
    const hit = HandleWhackTap(state, index, tapMs);
    if (hit) ScheduleNextWhackTarget(state);
    PlayFeedbackForCountChange(feedbackBefore, GetFeedbackCounts(state), jsPsychRef);
    renderRef.current();
  }

  function HandleReactionTap(tapMs: number) {
    if (phaseRef.current !== 'playing') return;
    const state = stateRef.current;
    if (!state || state.kind !== 'reaction-time') return;
    const feedbackBefore = GetFeedbackCounts(state);
    HandleReactionStateTap(state, tapMs, difficulty, finishGameRef.current, (delayMs, goAtMs) => {
      jsPsychRef.current?.pluginAPI.setTimeout(() => {
        if (phaseRef.current !== 'playing' || stateRef.current !== state || state.goAt !== goAtMs) return;
        if (!ShowReactionGo(state, performance.now())) return;
        renderRef.current();
        FlushPixiRender();
        state.goStartedAt = performance.now();
      }, delayMs);
    });
    PlayFeedbackForCountChange(feedbackBefore, GetFeedbackCounts(state), jsPsychRef);
    renderRef.current();
  }

  function ScheduleNextWhackTarget(state: Extract<CognitiveGameState, { kind: 'whack-a-mole' }>) {
    const delayMs = Math.max(0, state.nextTargetAt - performance.now());
    jsPsychRef.current?.pluginAPI.setTimeout(() => {
      if (phaseRef.current !== 'playing' || stateRef.current !== state || state.activeIndex !== null) return;
      if (!ShowWhackTarget(state, performance.now())) return;
      renderRef.current();
      FlushPixiRender();
      const onsetMs = performance.now();
      state.targetStartedAt = onsetMs;
      state.targetExpiresAt = onsetMs + state.targetMs;
      jsPsychRef.current?.pluginAPI.setTimeout(() => {
        if (phaseRef.current !== 'playing' || stateRef.current !== state || state.targetStartedAt !== onsetMs) return;
        const feedbackBefore = GetFeedbackCounts(state);
        if (!ExpireWhackTarget(state, performance.now())) return;
        PlayFeedbackForCountChange(feedbackBefore, GetFeedbackCounts(state), jsPsychRef);
        renderRef.current();
        ScheduleNextWhackTarget(state);
      }, state.targetMs);
    }, delayMs);
  }

  function FlushPixiRender() {
    const app = appRef.current;
    if (!app) return;
    app.renderer.render(app.stage);
  }

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (phaseRef.current !== 'playing') return;
      const state = stateRef.current;
      if (!state || !IsLanguageNeutralGameState(state)) return;
      const feedbackBefore = GetFeedbackCounts(state);
      const handled = HandleLanguageNeutralGameKey(state, event.key, finishGameRef.current);
      if (!handled) return;
      event.preventDefault();
      PlayFeedbackForCountChange(feedbackBefore, GetFeedbackCounts(state), jsPsychRef);
      renderRef.current();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    jsPsychRef.current = initJsPsych();
  }, []);

  useEffect(() => {
    let cancelled = false;
    let initialized = false;
    const app = new Application();

    const init = async () => {
      const host = pixiHostRef.current;
      if (!host) return;
      try {
        await app.init({
          backgroundAlpha: 0,
          antialias: true,
          autoDensity: true,
          resolution: window.devicePixelRatio || 1,
          resizeTo: host,
        });
        initialized = true;
        if (cancelled) {
          app.destroy(true, { children: true, texture: true });
          return;
        }
        appRef.current = app;
        host.appendChild(app.canvas);
        app.canvas.className = 'cognitive-pixi-canvas';
        DrawBackground(app);
        app.ticker.add((ticker: Ticker) => {
          if (phaseRef.current !== 'playing') return;
          const dt = Math.min(ticker.deltaMS / 1000, 0.05);
          metricsRef.current.elapsed += dt;
          const feedbackBefore = stateRef.current?.kind === 'whack-a-mole' ? GetFeedbackCounts(stateRef.current) : null;
          UpdateTimedState(stateRef.current, metricsRef.current.elapsed, renderRef.current);
          if (feedbackBefore && stateRef.current?.kind === 'whack-a-mole') {
            PlayFeedbackForCountChange(feedbackBefore, GetFeedbackCounts(stateRef.current), jsPsychRef);
          }
          const limit = gameId === 'whack-a-mole' ? whackDurationSec : sessionLimitSec;
          if (limit !== null && metricsRef.current.elapsed >= limit) {
            finishGameRef.current(IsAutoSuccess(stateRef.current) ? 'Victory' : 'Defeat');
            return;
          }
          if (stateRef.current?.kind === 'whack-a-mole') {
            const nextSecond = Math.floor(metricsRef.current.elapsed);
            if (lastRenderSecondRef.current !== nextSecond) {
              lastRenderSecondRef.current = nextSecond;
              renderRef.current();
            }
          }
        });
        if (phaseRef.current === 'playing') renderRef.current();
      } catch (error) {
        if (!cancelled) console.error('PixiJS init failed for cognitive game:', error);
      }
    };

    void init();
    const handleResize = () => renderRef.current();
    window.addEventListener('resize', handleResize);
    return () => {
      cancelled = true;
      window.removeEventListener('resize', handleResize);
      if (appRef.current === app) appRef.current = null;
      if (initialized) app.destroy(true, { children: true, texture: true });
    };
  }, [gameId, sessionLimitSec, whackDurationSec]);

  useEffect(() => {
    if (phase === 'menu') {
      const app = appRef.current;
      if (app) {
        ClearStage(app);
        DrawBackground(app);
      }
    }
  }, [phase]);

  useTrainingAbort({
    active: phase === 'playing' || phase === 'rules',
    onAbort: returnToMenu,
  });

  return (
    <div ref={fullscreenRootRef} className={`cognitive-reference-game cognitive-reference-phase-${phase}`} style={{ '--cognitive-game-accent': cognitiveAccentCss } as CSSProperties}>
      <div ref={pixiHostRef} className="cognitive-pixi-stage" />

      {phase === 'menu' && (
        <div className="training-panel">
          <TrainingConfigPanel
            className="cognitive-config"
            label={t('training.thinking.configLabel')}
            title={metaTitle}
            summaryTitle={metaTitle}
            summaryItems={[
              { label: t('cognitive.config.difficulty'), value: activeDifficultyLabel },
              gameId === 'reaction-time'
                ? {
                    label: t('cognitive.config.reactionTrials'),
                    value: t('training.count', { value: reactionTrials }),
                  }
                : gameId === 'whack-a-mole'
                  ? {
                      label: t('cognitive.config.trainingDuration'),
                      value: FormatSeconds(whackDurationSec, t),
                    }
                  : {
                      label: t('cognitive.config.timeLimit'),
                      value: FormatLimit(sessionLimitSec, t),
                    },
            ]}
            actions={(
              <>
                <StartTrainingButton onClick={() => setPhase('rules')}>{t('training.rules')}</StartTrainingButton>
                <button className="btn btn-ghost btn-lg" onClick={onExit}>{t('training.cancel')}</button>
              </>
            )}
          >
              <section className="training-setting">
                <div className="training-setting-header">
                  <div>
                    <h2>{t('cognitive.config.difficulty')}</h2>
                    <p>{activeDifficultyDescription}</p>
                  </div>
                  <span>{activeDifficultyLabel}</span>
                </div>
                <div className="training-option-grid training-option-grid-three">
                  {Object.entries(difficulties).map(([key, value]) => (
                    <button
                      key={key}
                      type="button"
                      className={`training-option ${difficulty === key ? 'active' : ''}`}
                      onClick={() => setDifficulty(key as Difficulty)}
                    >
                      <span className="training-option-title">{t(value.labelKey)}</span>
                      <span className="training-option-meta">{t(value.descriptionKey)}</span>
                    </button>
                  ))}
                </div>
              </section>

              {gameId === 'reaction-time' ? (
                <section className="training-setting">
                  <div className="training-setting-header">
                    <div>
                      <h2>{t('cognitive.config.reactionTrials')}</h2>
                      <p>{t('cognitive.config.reactionTrialsDesc')}</p>
                    </div>
                    <span>{t('training.count', { value: reactionTrials })}</span>
                  </div>
                  <div className="training-option-grid training-option-grid-three">
                    {reactionTrialOptions.map((value) => (
                      <button
                        key={value}
                        type="button"
                        className={`training-option ${reactionTrials === value ? 'active' : ''}`}
                        onClick={() => setReactionTrials(value)}
                      >
                        <span className="training-option-title">{t('training.count', { value })}</span>
                      </button>
                    ))}
                  </div>
                </section>
              ) : gameId === 'whack-a-mole' ? (
                <section className="training-setting">
                  <div className="training-setting-header">
                    <div>
                      <h2>{t('cognitive.config.trainingDuration')}</h2>
                      <p>{t('cognitive.config.trainingDurationDesc')}</p>
                    </div>
                    <span>{FormatSeconds(whackDurationSec, t)}</span>
                  </div>
                  <div className="training-option-grid training-option-grid-three">
                    {whackDurationOptions.map((value) => (
                      <button
                        key={value}
                        type="button"
                        className={`training-option ${whackDurationSec === value ? 'active' : ''}`}
                        onClick={() => setWhackDurationSec(value)}
                      >
                        <span className="training-option-title">{FormatSeconds(value, t)}</span>
                      </button>
                    ))}
                  </div>
                </section>
              ) : (
                <section className="training-setting">
                  <div className="training-setting-header">
                    <div>
                      <h2>{t('cognitive.config.timeLimit')}</h2>
                      <p>{sessionLimitSec === null ? t('cognitive.config.noTimeLimit') : t('cognitive.config.finishWithin', { seconds: sessionLimitSec })}</p>
                    </div>
                    <span>{FormatLimit(sessionLimitSec, t)}</span>
                  </div>
                  <div className="training-option-grid training-duration-grid">
                    {sessionLimitOptions.map((value) => (
                      <button
                        key={String(value)}
                        type="button"
                        className={`training-option ${sessionLimitSec === value ? 'active' : ''}`}
                        onClick={() => setSessionLimitSec(value)}
                      >
                        <span className="training-option-title">{FormatLimit(value, t)}</span>
                      </button>
                    ))}
                  </div>
                </section>
              )}

              <section className="training-setting training-setting-wide">
                <div className="training-setting-header">
                  <div>
                    <h2>{t('cognitive.config.focusTitle')}</h2>
                    <p>{metaDescription}</p>
                  </div>
                  <span>{metaFocus}</span>
                </div>
              </section>
          </TrainingConfigPanel>
        </div>
      )}

      {phase === 'rules' && (
        <div className="training-panel">
          <BrainTrainingRulesPanel
            gameId={gameId}
            title={metaTitle}
            summaryTitle={metaTitle}
            summaryItems={[
              { label: t('cognitive.config.difficulty'), value: activeDifficultyLabel },
              gameId === 'reaction-time'
                ? {
                    label: t('cognitive.config.reactionTrials'),
                    value: t('training.count', { value: reactionTrials }),
                  }
                : gameId === 'whack-a-mole'
                  ? {
                      label: t('cognitive.config.trainingDuration'),
                      value: FormatSeconds(whackDurationSec, t),
                    }
                  : {
                      label: t('cognitive.config.timeLimit'),
                      value: FormatLimit(sessionLimitSec, t),
                    },
            ]}
            onStart={() => void startGame()}
            onBack={() => setPhase('menu')}
          />
        </div>
      )}

      {phase === 'results' && result && (
        <div className="experiment-container experiment-container-scrollable cognitive-results-container">
          <div className="experiment-results">
            <h1>{result.Game_Result === 'Victory' ? t('cognitive.results.complete') : t('cognitive.results.ended')}</h1>
            <div className="training-result-summary">
              <span>
                <small>{t('cognitive.results.result')}</small>
                <strong>{FormatGameResult(result.Game_Result, t)}</strong>
              </span>
              <span>
                <small>{t('cognitive.results.elapsed')}</small>
                <strong>{FormatSeconds(result.Total_Duration_Seconds, t)}</strong>
              </span>
            </div>

            <TrainingResultActions
              downloadLabel={t('training.downloadCsvRecord')}
              restartLabel={t('training.restart')}
              backLabel={t('training.returnHome')}
              onDownloadCsv={downloadResult}
              onRestart={() => setPhase('rules')}
              onBackHome={returnToMenu}
            />
          </div>
        </div>
      )}
    </div>
  );
}

function GetModuleMeta(gameId: ReferenceGameId) {
  return referenceCognitiveModules.find((module) => module.id === gameId) ?? referenceCognitiveModules[0];
}

function CreateInitialState(gameId: ReferenceGameId, difficulty: Difficulty, reactionTrials: number): CognitiveGameState {
  if (gameId === 'memory-match') return CreateMemoryState(difficulty);
  if (gameId === 'lights-out') return CreateLightsState(difficulty);
  if (gameId === 'reaction-time') return CreateReactionState(reactionTrials);
  if (gameId === 'whack-a-mole') return CreateWhackState(difficulty);
  const languageNeutralState = CreateLanguageNeutralGameState(gameId, difficulty);
  if (languageNeutralState) return languageNeutralState;
  return CreateSlidingState(difficulty);
}

function UpdateTimedState(
  state: CognitiveGameState | null,
  elapsed: number,
  render: () => void,
) {
  if (!state) return;
  if (state.kind === 'memory-match') UpdateMemoryTimedState(state, elapsed, render);
  if (state.kind === 'reaction-time') UpdateReactionTimedState(state, elapsed, render);
  if (state.kind === 'whack-a-mole') UpdateWhackTimedState(state, elapsed, render);
  if (IsLanguageNeutralGameState(state)) UpdateLanguageNeutralTimedState(state, elapsed, render);
}

function IsAutoSuccess(state: CognitiveGameState | null) {
  if (!state) return false;
  if (state.kind === 'memory-match') return IsMemoryAutoSuccess(state);
  if (state.kind === 'lights-out') return IsLightsAutoSuccess(state);
  if (state.kind === 'reaction-time') return IsReactionAutoSuccess(state);
  if (state.kind === 'whack-a-mole') return IsWhackAutoSuccess(state);
  if (IsLanguageNeutralGameState(state)) return IsLanguageNeutralAutoSuccess(state);
  return IsSlidingAutoSuccess(state);
}

function GetFeedbackCounts(state: CognitiveGameState): { success: number; errors: number } {
  if (state.kind === 'memory-match') return { success: state.matchedPairs, errors: state.errors };
  if (state.kind === 'lights-out') return { success: IsLightsAutoSuccess(state) ? 1 : 0, errors: 0 };
  if (state.kind === 'reaction-time') return { success: state.attempts.length, errors: state.falseStarts };
  if (state.kind === 'whack-a-mole') return { success: state.hits, errors: state.misses };
  if (IsLanguageNeutralGameState(state)) return GetLanguageNeutralFeedbackCounts(state);
  return { success: state.moves, errors: state.errors };
}

function GetTimingResultData(state: CognitiveGameState): { details: Record<string, unknown>; detailRows?: Record<string, unknown>[] } {
  if (state.kind === 'reaction-time') {
    const stats = BuildReactionResultStats(state);
    return {
      details: {
        Reaction_Trials: state.targetTrials,
        Reaction_Successes: state.attempts.length,
        False_Starts: state.falseStarts,
        Reaction_Times_ms: state.attempts.join('|'),
        Average_Reaction_Time_ms: stats.details.averageMs,
        Best_Reaction_Time_ms: stats.details.bestMs,
      },
      detailRows: state.attempts.map((reactionMs, index) => ({
        Trial: index + 1,
        Reaction_Time_ms: reactionMs,
      })),
    };
  }

  if (state.kind === 'whack-a-mole') {
    const stats = BuildWhackResultStats(state);
    return {
      details: {
        Target_Click_Hits: state.hits,
        Target_Click_Misses: state.misses,
        Target_Click_Taps: state.taps,
        Target_Click_Reaction_Times_ms: state.hitReactionMs.join('|'),
        Average_Target_Click_Reaction_Time_ms: stats.details.averageMs,
        Best_Target_Click_Reaction_Time_ms: stats.details.bestMs,
      },
      detailRows: state.hitReactionMs.map((reactionMs, index) => ({
        Hit: index + 1,
        Target_Click_Reaction_Time_ms: reactionMs,
      })),
    };
  }

  return { details: {} };
}

function PlayFeedbackForCountChange(
  before: { success: number; errors: number },
  after: { success: number; errors: number },
  jsPsychRef: { current: unknown },
): void {
  if (after.success > before.success) {
    PlaySuccessSound(jsPsychRef);
    return;
  }
  if (after.errors > before.errors) {
    PlayFailureSound(jsPsychRef);
  }
}

function FormatLimit(value: SessionLimitSeconds, t: TFunction) {
  return value === null ? t('training.unlimited') : FormatSeconds(value, t);
}

function FormatSeconds(value: number, t: TFunction) {
  return t('training.secondsShort', { value });
}

function FormatGameResult(result: GameResult, t: TFunction) {
  if (result === 'Victory') return t('cognitive.results.victory');
  if (result === 'Draw') return t('cognitive.results.draw');
  return t('cognitive.results.defeat');
}

function ToCsv(records: SessionRecord[]): string {
  const columns = Array.from(new Set(records.flatMap((record) => Object.keys(record))));
  return [
    columns.join(','),
    ...records.map((record) => columns.map((column) => csvCell(record[column])).join(',')),
  ].join('\n');
}

async function ResizePixiAppToElement(app: Application, element: HTMLElement | null): Promise<boolean> {
  const size = await MeasureElementSize(element);
  if (!size) return false;
  const { width, height } = size;
  app.renderer.resize(width, height);
  return true;
}

async function MeasureElementSize(element: HTMLElement | null) {
  for (let frame = 0; frame < 8; frame += 1) {
    const rect = element?.getBoundingClientRect();
    const width = Math.round(rect?.width ?? 0);
    const height = Math.round(rect?.height ?? 0);
    if (width > 0 && height > 0) return { width, height };
    await NextFrame();
  }
  return null;
}

function NextFrame() {
  return new Promise<void>((resolve) => window.requestAnimationFrame(() => resolve()));
}

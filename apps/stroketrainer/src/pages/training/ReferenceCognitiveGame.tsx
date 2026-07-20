import { type CSSProperties, useCallback, useEffect, useRef, useState } from 'react';
import { Application, type Ticker } from 'pixi.js';
import { initJsPsych } from 'jspsych';
import { useT } from '../../i18n';
import { downloadCsvFile } from '../../utils/downloadFile';
import { getActiveUser } from '../../utils/settings';
import { playFailureSound, playGameEndSound, playSuccessSound, prepareAudioFeedback } from '../../utils/soundManager';
import { saveTrainingSessionRecord } from '../../utils/trainingRecords';
import { csvCell, formatTestDate, writeJsPsychData } from './gameUtils';
import {
  DIFFICULTIES,
  REACTION_TRIAL_OPTIONS,
  REFERENCE_COGNITIVE_MODULES,
  SESSION_LIMIT_OPTIONS,
  WHACK_DURATION_OPTIONS,
} from './cognitive/constants';
import {
  createLightsState,
  drawLightsOut,
  handleLightsTap,
  isLightsAutoSuccess,
} from './cognitive/lightsOut';
import {
  createLanguageNeutralGameState,
  drawLanguageNeutralGame,
  getLanguageNeutralFeedbackCounts,
  handleLanguageNeutralGameKey,
  handleLanguageNeutralGameTap,
  isLanguageNeutralAutoSuccess,
  isLanguageNeutralGameState,
  updateLanguageNeutralTimedState,
} from './cognitive/languageNeutralGames';
import {
  createMemoryState,
  drawMemory,
  handleMemoryTap,
  isMemoryAutoSuccess,
  updateMemoryTimedState,
} from './cognitive/memoryMatch';
import {
  createReactionState,
  buildReactionResultStats,
  drawReaction,
  handleReactionStateTap,
  isReactionAutoSuccess,
  showReactionGo,
  updateReactionTimedState,
} from './cognitive/reactionTime';
import {
  createSlidingState,
  drawSliding,
  handleSlidingTap,
  isSlidingAutoSuccess,
} from './cognitive/slidingPuzzle';
import {
  createWhackState,
  buildWhackResultStats,
  drawWhack,
  expireWhackTarget,
  handleWhackTap,
  isWhackAutoSuccess,
  showWhackTarget,
  updateWhackTimedState,
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
import { COGNITIVE_ACCENT_CSS, clearStage, drawBackground } from './cognitive/utils';
import { verifySelectedTrainingUser } from './selectedUserGuard';
import { StartTrainingButton } from '@rehab-trainer/ui/components/StartTrainingButton';
import { TrainingConfigPanel } from '@rehab-trainer/ui/components/TrainingConfigPanel';
import { TrainingResultActions } from '@rehab-trainer/ui/components/TrainingResultActions';
import { useFullscreenTrainingRoot } from '@rehab-trainer/ui/hooks/useFullscreenTrainingRoot';
import { useTrainingAbort } from '@rehab-trainer/ui/hooks/useTrainingAbort';
import { StrokeTrainingRulesPanel } from './StrokeTrainingRulesPanel';

export type { ReferenceGameId } from './cognitive/types';
export { REFERENCE_COGNITIVE_MODULES } from './cognitive/constants';

interface ReferenceCognitiveGameProps {
  gameId: ReferenceGameId;
  onExit: () => void;
}

export function isReferenceGameId(value: string | null): value is ReferenceGameId {
  return REFERENCE_COGNITIVE_MODULES.some((module) => module.id === value);
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

  const meta = getModuleMeta(gameId);
  const metaTitle = t(meta.titleKey);
  const metaDescription = t(meta.descriptionKey);
  const metaFocus = t(meta.focusKey);
  const activeConfig = DIFFICULTIES[difficulty];
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
    clearStage(app);
    drawBackground(app);
    switch (state.kind) {
      case 'memory-match':
        drawMemory(app, state, handleCellTap);
        break;
      case 'lights-out':
        drawLightsOut(app, state, handleCellTap);
        break;
      case 'reaction-time':
        drawReaction(app, state, handleReactionTap, t);
        break;
      case 'whack-a-mole':
        drawWhack(app, state, handleWhackCellTap);
        break;
      case 'sliding-puzzle':
        drawSliding(app, state, handleCellTap);
        break;
      default:
        if (isLanguageNeutralGameState(state)) {
          drawLanguageNeutralGame(app, state, metricsRef.current.elapsed, handleCellTap, t);
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
    playGameEndSound(gameResult, jsPsychRef);
    const trainingDate = formatTestDate(new Date());
    const participantId = getActiveUser() || 'Unknown';
    const timingData = getTimingResultData(state);
    const record: SessionRecord = {
      Game_Result: gameResult,
      Total_Duration_Seconds: Number(metricsRef.current.elapsed.toFixed(1)),
      ...timingData.details,
    };
    setResult(record);
    setPhase('results');
    void saveTrainingSessionRecord({
      userName: participantId,
      moduleId: 'cognitive-training',
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
    writeJsPsychData(jsPsychRef, record as unknown as Record<string, unknown>, 'Unable to write reference cognitive result to jsPsych data.');
  }, [difficulty, gameId, metaTitle, setPhase]);

  finishGameRef.current = finishGame;

  const startGame = useCallback(async () => {
    if (!verifySelectedTrainingUser()) return;
    jsPsychRef.current?.pluginAPI.clearAllTimeouts();
    prepareAudioFeedback(jsPsychRef);
    await enterTrainingFullscreen();

    if (appRef.current) resizePixiAppToElement(appRef.current, pixiHostRef.current);
    metricsRef.current = { elapsed: 0 };
    lastRenderSecondRef.current = -1;
    stateRef.current = createInitialState(gameId, difficulty, reactionTrials);
    setResult(null);
    setPhase('playing');
    window.setTimeout(() => {
      renderRef.current();
      if (stateRef.current?.kind === 'whack-a-mole') scheduleNextWhackTarget(stateRef.current);
    }, 0);
  }, [difficulty, enterTrainingFullscreen, gameId, reactionTrials, setPhase]);

  const returnToMenu = useCallback(() => {
    jsPsychRef.current?.pluginAPI.clearAllTimeouts();
    setPhase('menu');
    setResult(null);
    stateRef.current = null;
    metricsRef.current = { elapsed: 0 };
    const app = appRef.current;
    if (app) {
      clearStage(app);
      drawBackground(app);
    }
  }, [setPhase]);

  const downloadResult = useCallback(() => {
    if (!result) return;
    downloadCsvFile(toCsv([result]), `cognitive_${gameId}_${Date.now()}.csv`);
  }, [gameId, result]);

  function handleCellTap(index: number) {
    if (phaseRef.current !== 'playing') return;
    const state = stateRef.current;
    if (!state) return;
    const feedbackBefore = getFeedbackCounts(state);
    if (state.kind === 'memory-match') handleMemoryTap(state, index, metricsRef.current.elapsed, finishGameRef.current);
    if (state.kind === 'lights-out') handleLightsTap(state, index, finishGameRef.current);
    if (state.kind === 'sliding-puzzle') handleSlidingTap(state, index, finishGameRef.current);
    if (isLanguageNeutralGameState(state)) {
      handleLanguageNeutralGameTap(state, index, metricsRef.current.elapsed, finishGameRef.current);
    }
    playFeedbackForCountChange(feedbackBefore, getFeedbackCounts(state), jsPsychRef);
    renderRef.current();
  }

  function handleWhackCellTap(index: number, tapMs: number) {
    if (phaseRef.current !== 'playing') return;
    const state = stateRef.current;
    if (!state || state.kind !== 'whack-a-mole') return;
    const feedbackBefore = getFeedbackCounts(state);
    const hit = handleWhackTap(state, index, tapMs);
    if (hit) scheduleNextWhackTarget(state);
    playFeedbackForCountChange(feedbackBefore, getFeedbackCounts(state), jsPsychRef);
    renderRef.current();
  }

  function handleReactionTap(tapMs: number) {
    if (phaseRef.current !== 'playing') return;
    const state = stateRef.current;
    if (!state || state.kind !== 'reaction-time') return;
    const feedbackBefore = getFeedbackCounts(state);
    handleReactionStateTap(state, tapMs, difficulty, finishGameRef.current, (delayMs, goAtMs) => {
      jsPsychRef.current?.pluginAPI.setTimeout(() => {
        if (phaseRef.current !== 'playing' || stateRef.current !== state || state.goAt !== goAtMs) return;
        if (!showReactionGo(state, performance.now())) return;
        renderRef.current();
        flushPixiRender();
        state.goStartedAt = performance.now();
      }, delayMs);
    });
    playFeedbackForCountChange(feedbackBefore, getFeedbackCounts(state), jsPsychRef);
    renderRef.current();
  }

  function scheduleNextWhackTarget(state: Extract<CognitiveGameState, { kind: 'whack-a-mole' }>) {
    const delayMs = Math.max(0, state.nextTargetAt - performance.now());
    jsPsychRef.current?.pluginAPI.setTimeout(() => {
      if (phaseRef.current !== 'playing' || stateRef.current !== state || state.activeIndex !== null) return;
      if (!showWhackTarget(state, performance.now())) return;
      renderRef.current();
      flushPixiRender();
      const onsetMs = performance.now();
      state.targetStartedAt = onsetMs;
      state.targetExpiresAt = onsetMs + state.targetMs;
      jsPsychRef.current?.pluginAPI.setTimeout(() => {
        if (phaseRef.current !== 'playing' || stateRef.current !== state || state.targetStartedAt !== onsetMs) return;
        const feedbackBefore = getFeedbackCounts(state);
        if (!expireWhackTarget(state, performance.now())) return;
        playFeedbackForCountChange(feedbackBefore, getFeedbackCounts(state), jsPsychRef);
        renderRef.current();
        scheduleNextWhackTarget(state);
      }, state.targetMs);
    }, delayMs);
  }

  function flushPixiRender() {
    const app = appRef.current;
    if (!app) return;
    app.renderer.render(app.stage);
  }

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (phaseRef.current !== 'playing') return;
      const state = stateRef.current;
      if (!state || !isLanguageNeutralGameState(state)) return;
      const feedbackBefore = getFeedbackCounts(state);
      const handled = handleLanguageNeutralGameKey(state, event.key, finishGameRef.current);
      if (!handled) return;
      event.preventDefault();
      playFeedbackForCountChange(feedbackBefore, getFeedbackCounts(state), jsPsychRef);
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
        drawBackground(app);
        app.ticker.add((ticker: Ticker) => {
          if (phaseRef.current !== 'playing') return;
          const dt = Math.min(ticker.deltaMS / 1000, 0.05);
          metricsRef.current.elapsed += dt;
          const feedbackBefore = stateRef.current?.kind === 'whack-a-mole' ? getFeedbackCounts(stateRef.current) : null;
          updateTimedState(stateRef.current, metricsRef.current.elapsed, renderRef.current);
          if (feedbackBefore && stateRef.current?.kind === 'whack-a-mole') {
            playFeedbackForCountChange(feedbackBefore, getFeedbackCounts(stateRef.current), jsPsychRef);
          }
          const limit = gameId === 'whack-a-mole' ? whackDurationSec : sessionLimitSec;
          if (limit !== null && metricsRef.current.elapsed >= limit) {
            finishGameRef.current(isAutoSuccess(stateRef.current) ? 'Victory' : 'Defeat');
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
        clearStage(app);
        drawBackground(app);
      }
    }
  }, [phase]);

  useTrainingAbort({
    active: phase === 'playing' || phase === 'rules',
    onAbort: returnToMenu,
  });

  return (
    <div ref={fullscreenRootRef} className={`cognitive-reference-game cognitive-reference-phase-${phase}`} style={{ '--cognitive-game-accent': COGNITIVE_ACCENT_CSS } as CSSProperties}>
      <div ref={pixiHostRef} className="cognitive-pixi-stage" />

      {phase === 'menu' && (
        <div className="training-panel">
          <TrainingConfigPanel
            className="cognitive-config"
            label={t('training.cognitive.configLabel')}
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
                      value: formatSeconds(whackDurationSec, t),
                    }
                  : {
                      label: t('cognitive.config.timeLimit'),
                      value: formatLimit(sessionLimitSec, t),
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
                  {Object.entries(DIFFICULTIES).map(([key, value]) => (
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
                    {REACTION_TRIAL_OPTIONS.map((value) => (
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
                    <span>{formatSeconds(whackDurationSec, t)}</span>
                  </div>
                  <div className="training-option-grid training-option-grid-three">
                    {WHACK_DURATION_OPTIONS.map((value) => (
                      <button
                        key={value}
                        type="button"
                        className={`training-option ${whackDurationSec === value ? 'active' : ''}`}
                        onClick={() => setWhackDurationSec(value)}
                      >
                        <span className="training-option-title">{formatSeconds(value, t)}</span>
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
                    <span>{formatLimit(sessionLimitSec, t)}</span>
                  </div>
                  <div className="training-option-grid training-duration-grid">
                    {SESSION_LIMIT_OPTIONS.map((value) => (
                      <button
                        key={String(value)}
                        type="button"
                        className={`training-option ${sessionLimitSec === value ? 'active' : ''}`}
                        onClick={() => setSessionLimitSec(value)}
                      >
                        <span className="training-option-title">{formatLimit(value, t)}</span>
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
          <StrokeTrainingRulesPanel
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
                      value: formatSeconds(whackDurationSec, t),
                    }
                  : {
                      label: t('cognitive.config.timeLimit'),
                      value: formatLimit(sessionLimitSec, t),
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
                <strong>{result.Game_Result === 'Victory' ? t('cognitive.results.victory') : t('cognitive.results.defeat')}</strong>
              </span>
              <span>
                <small>{t('cognitive.results.elapsed')}</small>
                <strong>{formatSeconds(result.Total_Duration_Seconds, t)}</strong>
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

function getModuleMeta(gameId: ReferenceGameId) {
  return REFERENCE_COGNITIVE_MODULES.find((module) => module.id === gameId) ?? REFERENCE_COGNITIVE_MODULES[0];
}

function createInitialState(gameId: ReferenceGameId, difficulty: Difficulty, reactionTrials: number): CognitiveGameState {
  if (gameId === 'memory-match') return createMemoryState(difficulty);
  if (gameId === 'lights-out') return createLightsState(difficulty);
  if (gameId === 'reaction-time') return createReactionState(reactionTrials);
  if (gameId === 'whack-a-mole') return createWhackState(difficulty);
  const languageNeutralState = createLanguageNeutralGameState(gameId, difficulty);
  if (languageNeutralState) return languageNeutralState;
  return createSlidingState(difficulty);
}

function updateTimedState(
  state: CognitiveGameState | null,
  elapsed: number,
  render: () => void,
) {
  if (!state) return;
  if (state.kind === 'memory-match') updateMemoryTimedState(state, elapsed, render);
  if (state.kind === 'reaction-time') updateReactionTimedState(state, elapsed, render);
  if (state.kind === 'whack-a-mole') updateWhackTimedState(state, elapsed, render);
  if (isLanguageNeutralGameState(state)) updateLanguageNeutralTimedState(state, elapsed, render);
}

function isAutoSuccess(state: CognitiveGameState | null) {
  if (!state) return false;
  if (state.kind === 'memory-match') return isMemoryAutoSuccess(state);
  if (state.kind === 'lights-out') return isLightsAutoSuccess(state);
  if (state.kind === 'reaction-time') return isReactionAutoSuccess(state);
  if (state.kind === 'whack-a-mole') return isWhackAutoSuccess(state);
  if (isLanguageNeutralGameState(state)) return isLanguageNeutralAutoSuccess(state);
  return isSlidingAutoSuccess(state);
}

function getFeedbackCounts(state: CognitiveGameState): { success: number; errors: number } {
  if (state.kind === 'memory-match') return { success: state.matchedPairs, errors: state.errors };
  if (state.kind === 'lights-out') return { success: isLightsAutoSuccess(state) ? 1 : 0, errors: 0 };
  if (state.kind === 'reaction-time') return { success: state.attempts.length, errors: state.falseStarts };
  if (state.kind === 'whack-a-mole') return { success: state.hits, errors: state.misses };
  if (isLanguageNeutralGameState(state)) return getLanguageNeutralFeedbackCounts(state);
  return { success: state.moves, errors: state.errors };
}

function getTimingResultData(state: CognitiveGameState): { details: Record<string, unknown>; detailRows?: Record<string, unknown>[] } {
  if (state.kind === 'reaction-time') {
    const stats = buildReactionResultStats(state);
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
    const stats = buildWhackResultStats(state);
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

function playFeedbackForCountChange(
  before: { success: number; errors: number },
  after: { success: number; errors: number },
  jsPsychRef: { current: unknown },
): void {
  if (after.success > before.success) {
    playSuccessSound(jsPsychRef);
    return;
  }
  if (after.errors > before.errors) {
    playFailureSound(jsPsychRef);
  }
}

function formatLimit(value: SessionLimitSeconds, t: TFunction) {
  return value === null ? t('training.unlimited') : formatSeconds(value, t);
}

function formatSeconds(value: number, t: TFunction) {
  return t('training.secondsShort', { value });
}

function toCsv(records: SessionRecord[]): string {
  const columns = Array.from(new Set(records.flatMap((record) => Object.keys(record))));
  return [
    columns.join(','),
    ...records.map((record) => columns.map((column) => csvCell(record[column])).join(',')),
  ].join('\n');
}

function resizePixiAppToElement(app: Application, element: HTMLElement | null): void {
  const rect = element?.getBoundingClientRect();
  const width = Math.max(1, Math.round(rect?.width || window.innerWidth));
  const height = Math.max(1, Math.round(rect?.height || window.innerHeight));
  app.renderer.resize(width, height);
}

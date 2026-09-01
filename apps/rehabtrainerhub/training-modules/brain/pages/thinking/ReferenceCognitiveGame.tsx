// Canonical Hub-owned brain cognitive runtime.
import { type CSSProperties, useCallback, useEffect, useRef, useState } from 'react';
import { Application, type Ticker } from 'pixi.js';
import { initJsPsych } from 'jspsych';
import { GetAuthUserNameFromToken } from '@rehab-trainer/ui/auth/authClient';
import { useT } from '../../i18n';
import { PlayFailureSound, PlayGameEndSound, PlaySuccessSound, PrepareAudioFeedback } from '../../utils/soundManager';
import { SaveTrainingSessionRecord } from '../../utils/trainingRecords';
import { FormatTestDate } from '@rehab-trainer/ui/trainingGameUtils';
import { JsPsychExternalLifecycle } from '@rehab-trainer/ui/jsPsychLifecycle';
import {
  difficulties,
  referenceCognitiveModules,
  sessionLimitOptions,
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
  ReactionTrialRecord,
  ReferenceGameId,
  RuntimeMetrics,
  SessionLimitSeconds,
  SessionRecord,
  SimonTrialRecord,
  TargetTrialRecord,
} from './cognitive/types';
import type { TFunction } from './types';
import { cognitiveAccentCss, ClearStage, DrawBackground } from './cognitive/utils';
import { CompleteTimedOutSimonAttempt } from './cognitive/trialRecords';
import { TrainingConfigNavigationActions } from '@rehab-trainer/ui/components/TrainingConfigNavigationActions';
import {
  TrainingConfigOptionGroup,
  TrainingConfigPanel,
  TrainingConfigSection,
} from '@rehab-trainer/ui/components/TrainingConfigPanel';
import { MobileDirectionPad, type MobileDirection } from '@rehab-trainer/ui/components/MobileTouchControls';
import { TrainingResultActions } from '@rehab-trainer/ui/components/TrainingResultActions';
import { useFullscreenTrainingRoot } from '@rehab-trainer/ui/hooks/useFullscreenTrainingRoot';
import { useTrainingConfigReady } from '@rehab-trainer/ui/hooks/useTrainingConfigReady';
import { useHostedGameSettings } from '@rehab-trainer/ui/hooks/useHostedGameSettings';
import { useTrainingAbort } from '@rehab-trainer/ui/hooks/useTrainingAbort';
import { BrainTrainingRulesPanel } from './BrainTrainingRulesPanel';
import './ThinkingGames.css';

export type { ReferenceGameId } from './cognitive/types';
export { referenceCognitiveModules } from './cognitive/constants';

interface ReferenceCognitiveGameProps {
  gameId: ReferenceGameId;
  onExit: () => void;
  trainingModuleId?: string;
  trainingConfigLabel?: string;
}

type CognitiveTrialKind = 'reaction' | 'target' | 'simon';

interface ActiveCognitiveTrial {
  kind: CognitiveTrialKind;
  startPromise: Promise<boolean>;
}

export function IsReferenceGameId(value: string | null): value is ReferenceGameId {
  return referenceCognitiveModules.some((module) => module.id === value);
}

export function ReferenceCognitiveGame({
  gameId,
  onExit,
  trainingModuleId = 'thinking-training',
  trainingConfigLabel,
}: ReferenceCognitiveGameProps) {
  const { t } = useT();
  const { fullscreenRootRef, enterTrainingFullscreen } = useFullscreenTrainingRoot<HTMLDivElement>();
  const pixiHostRef = useRef<HTMLDivElement | null>(null);
  const jsPsychHostRef = useRef<HTMLDivElement | null>(null);
  const trialJsPsychHostRef = useRef<HTMLDivElement | null>(null);
  const appRef = useRef<Application | null>(null);
  const phaseRef = useRef<GamePhase>('menu');
  const stateRef = useRef<CognitiveGameState | null>(null);
  const metricsRef = useRef<RuntimeMetrics>({ elapsed: 0 });
  const jsPsychRef = useRef<ReturnType<typeof initJsPsych> | null>(null);
  const jsPsychLifecycleRef = useRef<JsPsychExternalLifecycle | null>(null);
  const cognitiveTrialLifecycleRef = useRef<JsPsychExternalLifecycle | null>(null);
  const activeCognitiveTrialRef = useRef<ActiveCognitiveTrial | null>(null);
  const renderRef = useRef<() => void>(() => undefined);
  const finishGameRef = useRef<(result: GameResult) => void>(() => undefined);
  const lastRenderSecondRef = useRef(-1);
  const simonShakeTimeoutRef = useRef<number | null>(null);

  const [phase, setPhaseState] = useState<GamePhase>('menu');
  const hostedSettings = useHostedGameSettings();
  const hostedSettingsAppliedRef = useRef(false);
  useTrainingConfigReady(phase === 'menu');
  const [difficulty, setDifficulty] = useState<Difficulty>('Beginner');
  const [sessionLimitSec, setSessionLimitSec] = useState<SessionLimitSeconds>(null);
  const [reactionTrials, setReactionTrials] = useState<number>(8);
  const [whackDurationSec, setWhackDurationSec] = useState<number>(30);
  const [simonLives, setSimonLives] = useState<number>(3);
  const [simonLivesRemaining, setSimonLivesRemaining] = useState<number | null>(null);
  const [simonShaking, setSimonShaking] = useState(false);
  const [result, setResult] = useState<SessionRecord | null>(null);

  const meta = GetModuleMeta(gameId);
  const metaTitle = t(meta.titleKey);
  const metaDescription = t(meta.descriptionKey);
  const metaFocus = t(meta.focusKey);
  const activeConfig = difficulties[difficulty];
  const activeDifficultyLabel = t(activeConfig.labelKey);
  const activeDifficultyDescription = t(activeConfig.descriptionKey);
  const configSummaryItems = [
    { label: t('cognitive.config.difficulty'), value: activeDifficultyLabel },
    ...(gameId === 'simon-says'
      ? [{ label: t('cognitive.config.lives'), value: <HeartIcons count={simonLives} /> }]
      : []),
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
  ];

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
    if (activeCognitiveTrialRef.current) {
      cognitiveTrialLifecycleRef.current?.abort({ abort_reason: 'session-ended' });
      activeCognitiveTrialRef.current = null;
    }
    PlayGameEndSound(gameResult, jsPsychRef);
    const trainingDate = FormatTestDate(new Date());
    const participantId = GetAuthUserNameFromToken() || 'Unknown';
    const timingData = GetTimingResultData(state);
    const record: SessionRecord = {
      Game_Result: gameResult,
      Total_Duration_Seconds: Number(metricsRef.current.elapsed.toFixed(1)),
      ...timingData.details,
    };
    jsPsychLifecycleRef.current?.finish(record as unknown as Record<string, unknown>);
    setResult(record);
    setPhase('results');
    void SaveTrainingSessionRecord({
      userName: participantId,
      moduleId: trainingModuleId,
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
  }, [difficulty, gameId, metaTitle, setPhase, trainingModuleId]);

  finishGameRef.current = finishGame;

  const startGame = useCallback(async () => {
    jsPsychRef.current?.pluginAPI.clearAllTimeouts();
    cognitiveTrialLifecycleRef.current?.abort({ abort_reason: 'new-session' });
    activeCognitiveTrialRef.current = null;
    PrepareAudioFeedback(jsPsychRef);
    await enterTrainingFullscreen();

    const app = appRef.current;
    if (!app || !(await ResizePixiAppToElement(app, pixiHostRef.current))) return;
    await jsPsychLifecycleRef.current?.start({
      moduleId: `brain:${gameId}`,
      onStart: () => {
        metricsRef.current = { elapsed: 0 };
        lastRenderSecondRef.current = -1;
        stateRef.current = CreateInitialState(gameId, difficulty, reactionTrials, simonLives);
        setSimonLivesRemaining(stateRef.current.kind === 'simon-says' ? stateRef.current.lives : null);
        setSimonShaking(false);
        setResult(null);
        setPhase('playing');
        renderRef.current();
        FlushPixiRender();
        if (stateRef.current?.kind === 'whack-a-mole') ScheduleNextWhackTarget(stateRef.current);
      },
    });
  }, [difficulty, enterTrainingFullscreen, gameId, reactionTrials, setPhase, simonLives]);

  const returnToMenu = useCallback(() => {
    jsPsychLifecycleRef.current?.abort({ abort_reason: 'return-to-menu' });
    cognitiveTrialLifecycleRef.current?.abort({ abort_reason: 'return-to-menu' });
    activeCognitiveTrialRef.current = null;
    jsPsychRef.current?.pluginAPI.clearAllTimeouts();
    if (simonShakeTimeoutRef.current !== null) window.clearTimeout(simonShakeTimeoutRef.current);
    setPhase('menu');
    setResult(null);
    setSimonLivesRemaining(null);
    setSimonShaking(false);
    stateRef.current = null;
    metricsRef.current = { elapsed: 0 };
    const app = appRef.current;
    if (app) {
      ClearStage(app);
      DrawBackground(app);
    }
  }, [setPhase]);

  function TriggerSimonShake() {
    if (simonShakeTimeoutRef.current !== null) window.clearTimeout(simonShakeTimeoutRef.current);
    setSimonShaking(false);
    window.requestAnimationFrame(() => setSimonShaking(true));
    simonShakeTimeoutRef.current = window.setTimeout(() => {
      setSimonShaking(false);
      simonShakeTimeoutRef.current = null;
    }, 420);
  }

  function StartCognitiveTrial(kind: CognitiveTrialKind) {
    const lifecycle = cognitiveTrialLifecycleRef.current;
    if (!lifecycle || activeCognitiveTrialRef.current) return;
    const activeTrial: ActiveCognitiveTrial = {
      kind,
      startPromise: lifecycle.start({
        moduleId: `brain:${gameId}:${kind}-trial`,
        onStart: () => undefined,
      }),
    };
    activeCognitiveTrialRef.current = activeTrial;
    void activeTrial.startPromise.then((started) => {
      if (!started && activeCognitiveTrialRef.current === activeTrial) {
        activeCognitiveTrialRef.current = null;
      }
    });
  }

  function FinishCognitiveTrial(
    kind: CognitiveTrialKind,
    trial: ReactionTrialRecord | TargetTrialRecord | SimonTrialRecord,
  ) {
    const lifecycle = cognitiveTrialLifecycleRef.current;
    const activeTrial = activeCognitiveTrialRef.current;
    if (!lifecycle || !activeTrial || activeTrial.kind !== kind) return false;
    activeCognitiveTrialRef.current = null;
    const data = BuildCognitiveTrialLifecycleData(trial);
    if (lifecycle.finish(data)) return true;
    void activeTrial.startPromise.then((started) => {
      if (started) lifecycle.finish(data);
    });
    return true;
  }

  function HandleCellTap(index: number) {
    if (phaseRef.current !== 'playing') return;
    const state = stateRef.current;
    if (!state) return;
    const feedbackBefore = GetFeedbackCounts(state);
    let simonGameResult: GameResult | null = null;
    if (state.kind === 'memory-match') HandleMemoryTap(state, index, metricsRef.current.elapsed, finishGameRef.current);
    if (state.kind === 'lights-out') HandleLightsTap(state, index, finishGameRef.current);
    if (state.kind === 'sliding-puzzle') HandleSlidingTap(state, index, finishGameRef.current);
    if (IsLanguageNeutralGameState(state)) {
      const tapResult = HandleLanguageNeutralGameTap(
        state,
        index,
        metricsRef.current.elapsed,
        finishGameRef.current,
        (trial) => {
          FinishCognitiveTrial('simon', trial);
          setSimonLivesRemaining(state.kind === 'simon-says' ? state.lives : null);
          if (!trial.correct) TriggerSimonShake();
        },
      );
      simonGameResult = tapResult?.gameResult ?? null;
    }
    PlayFeedbackForCountChange(feedbackBefore, GetFeedbackCounts(state), jsPsychRef);
    renderRef.current();
    if (simonGameResult === 'Defeat') {
      jsPsychRef.current?.pluginAPI.setTimeout(() => finishGameRef.current('Defeat'), 420);
    } else if (simonGameResult) {
      finishGameRef.current(simonGameResult);
    }
  }

  function HandleWhackCellTap(index: number, tapMs: number) {
    if (phaseRef.current !== 'playing') return;
    const state = stateRef.current;
    if (!state || state.kind !== 'whack-a-mole') return;
    const feedbackBefore = GetFeedbackCounts(state);
    const tapResult = HandleWhackTap(state, index, tapMs);
    if (!tapResult) return;
    FinishCognitiveTrial('target', tapResult.trial);
    if (tapResult.targetCompleted) ScheduleNextWhackTarget(state);
    PlayFeedbackForCountChange(feedbackBefore, GetFeedbackCounts(state), jsPsychRef);
    renderRef.current();
  }

  function HandleReactionTap(tapMs: number) {
    if (phaseRef.current !== 'playing') return;
    const state = stateRef.current;
    if (!state || state.kind !== 'reaction-time') return;
    const feedbackBefore = GetFeedbackCounts(state);
    const startsAttempt = state.status === 'waiting' || state.status === 'result' || state.status === 'too-early';
    const trial = HandleReactionStateTap(state, tapMs, difficulty, (delayMs, goAtMs) => {
      jsPsychRef.current?.pluginAPI.setTimeout(() => {
        if (phaseRef.current !== 'playing' || stateRef.current !== state || state.goAt !== goAtMs) return;
        if (!ShowReactionGo(state, performance.now())) return;
        renderRef.current();
        FlushPixiRender();
        state.goStartedAt = performance.now();
      }, delayMs);
    });
    if (startsAttempt && state.status === 'ready') StartCognitiveTrial('reaction');
    if (trial) FinishCognitiveTrial('reaction', trial);
    PlayFeedbackForCountChange(feedbackBefore, GetFeedbackCounts(state), jsPsychRef);
    renderRef.current();
    if (trial?.outcome === 'success' && state.attempts.length >= state.targetTrials) {
      finishGameRef.current('Victory');
    }
  }

  function HandleMobileDirection(direction: MobileDirection) {
    if (phaseRef.current !== 'playing') return;
    const state = stateRef.current;
    if (!state || state.kind !== 'maze') return;
    const keyByDirection: Record<MobileDirection, string> = {
      up: 'ArrowUp',
      down: 'ArrowDown',
      left: 'ArrowLeft',
      right: 'ArrowRight',
    };
    const feedbackBefore = GetFeedbackCounts(state);
    const handled = HandleLanguageNeutralGameKey(state, keyByDirection[direction], finishGameRef.current);
    if (!handled) return;
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
      StartCognitiveTrial('target');
      jsPsychRef.current?.pluginAPI.setTimeout(() => {
        if (phaseRef.current !== 'playing' || stateRef.current !== state || state.targetStartedAt !== onsetMs) return;
        const feedbackBefore = GetFeedbackCounts(state);
        const trial = ExpireWhackTarget(state, performance.now());
        if (!trial) return;
        FinishCognitiveTrial('target', trial);
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
    const host = jsPsychHostRef.current;
    const trialHost = trialJsPsychHostRef.current;
    if (!host || !trialHost) return;

    const jsPsych = initJsPsych({ display_element: host });
    const lifecycle = new JsPsychExternalLifecycle(jsPsych);
    const trialJsPsych = initJsPsych({ display_element: trialHost });
    const trialLifecycle = new JsPsychExternalLifecycle(trialJsPsych);
    jsPsychRef.current = jsPsych;
    jsPsychLifecycleRef.current = lifecycle;
    cognitiveTrialLifecycleRef.current = trialLifecycle;

    return () => {
      lifecycle.dispose();
      trialLifecycle.dispose();
      activeCognitiveTrialRef.current = null;
      if (jsPsychRef.current === jsPsych) jsPsychRef.current = null;
      if (jsPsychLifecycleRef.current === lifecycle) jsPsychLifecycleRef.current = null;
      if (cognitiveTrialLifecycleRef.current === trialLifecycle) cognitiveTrialLifecycleRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!hostedSettings || hostedSettingsAppliedRef.current) return;
    hostedSettingsAppliedRef.current = true;
    setDifficulty(hostedSettings.difficulty === 'hard'
      ? 'Advanced'
      : hostedSettings.difficulty === 'medium'
        ? 'Intermediate'
        : 'Beginner');
    if (typeof hostedSettings.timeLimitSec === 'number') {
      setSessionLimitSec(hostedSettings.timeLimitSec === 0 ? null : hostedSettings.timeLimitSec);
    }
    if (gameId === 'reaction-time' && typeof hostedSettings.rounds === 'number') {
      setReactionTrials(hostedSettings.rounds);
    }
    if (gameId === 'whack-a-mole' && typeof hostedSettings.durationSec === 'number') {
      setWhackDurationSec(hostedSettings.durationSec);
    }
    if (gameId === 'simon-says' && typeof hostedSettings.lives === 'number') {
      setSimonLives(hostedSettings.lives);
    }
    setPhase('rules');
  }, [gameId, hostedSettings, setPhase]);

  useEffect(() => () => {
    if (simonShakeTimeoutRef.current !== null) window.clearTimeout(simonShakeTimeoutRef.current);
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
          app.destroy(true, { children: true, texture: false });
          return;
        }
        appRef.current = app;
        host.appendChild(app.canvas);
        app.canvas.className = 'cognitive-pixi-canvas';
        app.renderer.on('resize', handleResize);
        DrawBackground(app);
        app.ticker.add((ticker: Ticker) => {
          if (phaseRef.current !== 'playing') return;
          const dt = Math.min(ticker.deltaMS / 1000, 0.05);
          metricsRef.current.elapsed += dt;
          const feedbackBefore = stateRef.current?.kind === 'whack-a-mole' ? GetFeedbackCounts(stateRef.current) : null;
          UpdateTimedState(
            stateRef.current,
            metricsRef.current.elapsed,
            renderRef.current,
            finishGameRef.current,
            () => StartCognitiveTrial('simon'),
          );
          if (feedbackBefore && stateRef.current?.kind === 'whack-a-mole') {
            PlayFeedbackForCountChange(feedbackBefore, GetFeedbackCounts(stateRef.current), jsPsychRef);
          }
          const limit = gameId === 'whack-a-mole' ? whackDurationSec : sessionLimitSec;
          if (limit !== null && metricsRef.current.elapsed >= limit) {
            if (stateRef.current?.kind === 'whack-a-mole' && stateRef.current.activeIndex !== null) {
              const finalTrial = ExpireWhackTarget(stateRef.current, performance.now());
              if (finalTrial) FinishCognitiveTrial('target', finalTrial);
            }
            if (stateRef.current?.kind === 'simon-says') {
              const finalTrial = CompleteTimedOutSimonAttempt(stateRef.current, metricsRef.current.elapsed);
              if (finalTrial) FinishCognitiveTrial('simon', finalTrial);
            }
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
    return () => {
      cancelled = true;
      if (appRef.current === app) appRef.current = null;
      if (initialized) {
        app.renderer.off('resize', handleResize);
        app.destroy(true, { children: true, texture: false });
      }
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
    active: phase === 'playing',
    onAbort: returnToMenu,
  });

  return (
    <div
      ref={fullscreenRootRef}
      className={`cognitive-reference-game cognitive-reference-phase-${phase}${simonShaking ? ' cognitive-simon-shaking' : ''}`}
      style={{ '--cognitive-game-accent': cognitiveAccentCss } as CSSProperties}
    >
      <div ref={jsPsychHostRef} style={{ display: 'none' }} aria-hidden="true" />
      <div ref={trialJsPsychHostRef} style={{ display: 'none' }} aria-hidden="true" />
      <div ref={pixiHostRef} className="cognitive-pixi-stage" />
      {phase === 'playing' && stateRef.current?.kind === 'simon-says' && simonLivesRemaining !== null && (
        <div
          className="cognitive-simon-lives"
          aria-label={t('cognitive.play.livesRemaining', { count: simonLivesRemaining })}
        >
          <HeartIcons count={simonLivesRemaining} total={stateRef.current.maxLives} />
        </div>
      )}
      {phase === 'playing' && stateRef.current?.kind === 'maze' && (
        <MobileDirectionPad
          className="cognitive-mobile-dpad"
          onDirectionEnd={() => undefined}
          onDirectionStart={HandleMobileDirection}
        />
      )}

      {phase === 'menu' && (
        <div className="training-panel">
          <TrainingConfigPanel
            className="cognitive-config"
            label={trainingConfigLabel ?? t('training.thinking.configLabel')}
            title={metaTitle}
            summaryTitle={metaTitle}
            summaryItems={configSummaryItems}
            actions={(
              <TrainingConfigNavigationActions
                cancelLabel={t('training.cancel')}
                nextLabel={t('training.rules')}
                onCancel={onExit}
                onNext={() => setPhase('rules')}
              />
            )}
          >
              <TrainingConfigSection
                title={t('cognitive.config.difficulty')}
                description={activeDifficultyDescription}
                value={activeDifficultyLabel}
              >
                <TrainingConfigOptionGroup columns={3}>
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
                </TrainingConfigOptionGroup>
              </TrainingConfigSection>

              {gameId === 'simon-says' && (
                <TrainingConfigSection
                  title={t('cognitive.config.lives')}
                  description={t('cognitive.config.livesDesc')}
                  value={<HeartIcons count={simonLives} />}
                >
                  <input
                    className="training-slider"
                    type="range"
                    min="1"
                    max="5"
                    step="2"
                    value={simonLives}
                    aria-label={t('cognitive.config.livesOption', { count: simonLives })}
                    onChange={(event) => setSimonLives(Number(event.target.value))}
                  />
                </TrainingConfigSection>
              )}

              {gameId === 'reaction-time' ? (
                <TrainingConfigSection
                  title={t('cognitive.config.reactionTrials')}
                  description={t('cognitive.config.reactionTrialsDesc')}
                  value={t('training.count', { value: reactionTrials })}
                >
                  <input
                    className="training-slider"
                    type="range"
                    min="5"
                    max="12"
                    step="1"
                    value={reactionTrials}
                    aria-label={t('cognitive.config.reactionTrials')}
                    onChange={(event) => setReactionTrials(Number(event.target.value))}
                  />
                </TrainingConfigSection>
              ) : gameId === 'whack-a-mole' ? (
                <TrainingConfigSection
                  title={t('cognitive.config.trainingDuration')}
                  description={t('cognitive.config.trainingDurationDesc')}
                  value={FormatSeconds(whackDurationSec, t)}
                >
                  <input
                    className="training-slider"
                    type="range"
                    min="30"
                    max="60"
                    step="1"
                    value={whackDurationSec}
                    aria-label={t('cognitive.config.trainingDuration')}
                    onChange={(event) => setWhackDurationSec(Number(event.target.value))}
                  />
                </TrainingConfigSection>
              ) : (
                <TrainingConfigSection
                  title={t('cognitive.config.timeLimit')}
                  description={sessionLimitSec === null ? t('cognitive.config.noTimeLimit') : t('cognitive.config.finishWithin', { seconds: sessionLimitSec })}
                  value={FormatLimit(sessionLimitSec, t)}
                >
                  <select
                    className="input training-config-select"
                    value={sessionLimitSec === null ? 'none' : String(sessionLimitSec)}
                    aria-label={t('cognitive.config.timeLimit')}
                    onChange={(event) => setSessionLimitSec(event.target.value === 'none' ? null : Number(event.target.value))}
                  >
                    {sessionLimitOptions.map((value) => (
                      <option key={String(value)} value={value === null ? 'none' : String(value)}>
                        {FormatLimit(value, t)}
                      </option>
                    ))}
                  </select>
                </TrainingConfigSection>
              )}

              <TrainingConfigSection
                title={t('cognitive.config.focusTitle')}
                description={metaDescription}
                value={metaFocus}
                wide
              />
          </TrainingConfigPanel>
        </div>
      )}

      {phase === 'rules' && (
        <div className="training-panel">
          <BrainTrainingRulesPanel
            gameId={gameId}
            title={metaTitle}
            summaryTitle={metaTitle}
            summaryItems={configSummaryItems}
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

            <CognitiveTrialResultsTable state={stateRef.current} t={t} />

            <TrainingResultActions
              backLabel={t('training.returnHome')}
              onBackHome={onExit}
              hubLabel={t('training.returnLobby')}
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

function CreateInitialState(
  gameId: ReferenceGameId,
  difficulty: Difficulty,
  reactionTrials: number,
  simonLives: number,
): CognitiveGameState {
  if (gameId === 'memory-match') return CreateMemoryState(difficulty);
  if (gameId === 'lights-out') return CreateLightsState(difficulty);
  if (gameId === 'reaction-time') return CreateReactionState(reactionTrials);
  if (gameId === 'whack-a-mole') return CreateWhackState(difficulty);
  const languageNeutralState = CreateLanguageNeutralGameState(gameId, difficulty, simonLives);
  if (languageNeutralState) return languageNeutralState;
  return CreateSlidingState(difficulty);
}

function UpdateTimedState(
  state: CognitiveGameState | null,
  elapsed: number,
  render: () => void,
  finishGame: (result: GameResult) => void,
  onSimonInputStart: () => void,
) {
  if (!state) return;
  if (state.kind === 'memory-match') UpdateMemoryTimedState(state, elapsed, render);
  if (state.kind === 'reaction-time') UpdateReactionTimedState(state, elapsed, render);
  if (state.kind === 'whack-a-mole') UpdateWhackTimedState(state, elapsed, render);
  if (IsLanguageNeutralGameState(state)) {
    UpdateLanguageNeutralTimedState(state, elapsed, render, finishGame, onSimonInputStart);
  }
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
        Reaction_Attempts: state.trials.length,
        Reaction_Successes: state.attempts.length,
        False_Starts: state.falseStarts,
        Reaction_Times_ms: state.attempts.join('|'),
        Average_Reaction_Time_ms: stats.details.averageMs,
        Best_Reaction_Time_ms: stats.details.bestMs,
      },
      detailRows: state.trials.map((trial) => ({
        trialNumber: trial.trialNumber,
        outcome: trial.outcome,
        reactionTimeMs: trial.reactionTimeMs,
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
      detailRows: state.trials.map((trial) => ({
        trialNumber: trial.trialNumber,
        outcome: trial.outcome,
        reactionTimeMs: trial.reactionTimeMs,
        targetIndex: trial.targetIndex,
        tappedIndex: trial.tappedIndex,
      })),
    };
  }

  if (state.kind === 'simon-says') {
    return {
      details: {
        Simon_Max_Lives: state.maxLives,
        Simon_Lives_Remaining: state.lives,
        Simon_Trials: state.trials.length,
        Simon_Correct_Trials: state.trials.filter((trial) => trial.correct).length,
      },
      detailRows: state.trials.map((trial) => ({
        trialNumber: trial.trialNumber,
        memoryLength: trial.memoryLength,
        correct: trial.correct,
        durationMs: trial.durationMs,
      })),
    };
  }

  return { details: {} };
}

function BuildCognitiveTrialLifecycleData(
  trial: ReactionTrialRecord | TargetTrialRecord | SimonTrialRecord,
): Record<string, unknown> {
  const commonData = {
    trialNumber: trial.trialNumber,
  };
  if ('correct' in trial) {
    return {
      ...commonData,
      memoryLength: trial.memoryLength,
      correct: trial.correct,
      durationMs: trial.durationMs,
    };
  }
  if ('targetIndex' in trial) {
    return {
      ...commonData,
      outcome: trial.outcome,
      reactionTimeMs: trial.reactionTimeMs,
      targetIndex: trial.targetIndex,
      tappedIndex: trial.tappedIndex,
    };
  }
  return {
    ...commonData,
    outcome: trial.outcome,
    reactionTimeMs: trial.reactionTimeMs,
  };
}

function CognitiveTrialResultsTable({ state, t }: { state: CognitiveGameState | null; t: TFunction }) {
  if (!state) return null;
  if (state.kind === 'reaction-time') {
    return (
      <div className="cognitive-trial-results">
        <h2>{t('cognitive.results.trialDetails')}</h2>
        <div className="cognitive-trial-table-scroll">
          <table className="results-table cognitive-trial-results-table">
            <thead>
              <tr>
                <th>{t('cognitive.results.trial')}</th>
                <th>{t('cognitive.results.outcome')}</th>
                <th>{t('cognitive.results.reactionMs')}</th>
              </tr>
            </thead>
            <tbody>
              {state.trials.map((trial) => (
                <tr key={trial.trialNumber}>
                  <td>{trial.trialNumber}</td>
                  <td>{FormatTrialOutcome(trial.outcome, t)}</td>
                  <td>{trial.reactionTimeMs}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }
  if (state.kind === 'whack-a-mole') {
    return (
      <div className="cognitive-trial-results">
        <h2>{t('cognitive.results.trialDetails')}</h2>
        <div className="cognitive-trial-table-scroll">
          <table className="results-table cognitive-trial-results-table">
            <thead>
              <tr>
                <th>{t('cognitive.results.trial')}</th>
                <th>{t('cognitive.results.outcome')}</th>
                <th>{t('cognitive.results.reactionMs')}</th>
              </tr>
            </thead>
            <tbody>
              {state.trials.map((trial) => (
                <tr key={trial.trialNumber}>
                  <td>{trial.trialNumber}</td>
                  <td>{FormatTrialOutcome(trial.outcome, t)}</td>
                  <td>{trial.reactionTimeMs}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }
  if (state.kind === 'simon-says') {
    return (
      <div className="cognitive-trial-results">
        <h2>{t('cognitive.results.trialDetails')}</h2>
        <div className="cognitive-trial-table-scroll">
          <table className="results-table cognitive-trial-results-table">
            <thead>
              <tr>
                <th>{t('cognitive.results.trial')}</th>
                <th>{t('cognitive.results.memoryLength')}</th>
                <th>{t('cognitive.results.correct')}</th>
                <th>{t('cognitive.results.durationMs')}</th>
              </tr>
            </thead>
            <tbody>
              {state.trials.map((trial) => (
                <tr key={trial.trialNumber}>
                  <td>{trial.trialNumber}</td>
                  <td>{trial.memoryLength}</td>
                  <td>{trial.correct ? t('cognitive.results.yes') : t('cognitive.results.no')}</td>
                  <td>{trial.durationMs}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }
  return null;
}

function FormatTrialOutcome(
  outcome: ReactionTrialRecord['outcome'] | TargetTrialRecord['outcome'],
  t: TFunction,
) {
  if (outcome === 'success') return t('cognitive.results.outcome.success');
  if (outcome === 'false-start') return t('cognitive.results.outcome.falseStart');
  if (outcome === 'hit') return t('cognitive.results.outcome.hit');
  if (outcome === 'expired') return t('cognitive.results.outcome.expired');
  return t('cognitive.results.outcome.wrongTap');
}

function HeartIcons({ count, total = count }: { count: number; total?: number }) {
  return (
    <span className="cognitive-heart-icons" aria-hidden="true">
      {Array.from({ length: total }, (_, index) => (
        <svg
          key={index}
          className={index < count ? 'cognitive-heart-icon' : 'cognitive-heart-icon cognitive-heart-icon-empty'}
          viewBox="0 0 24 24"
          focusable="false"
        >
          <path d="M12 21C10.5 19.6 4 15.3 2.3 10.8C0.9 7.1 3.1 3.5 6.8 3.2C9 3 10.8 4.1 12 5.8C13.2 4.1 15 3 17.2 3.2C20.9 3.5 23.1 7.1 21.7 10.8C20 15.3 13.5 19.6 12 21Z" />
        </svg>
      ))}
    </span>
  );
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

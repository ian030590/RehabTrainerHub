import { GetHostedGameSetting } from '@rehab-trainer/ui/embeddedTraining';
// Canonical Hub-owned brain cognitive runtime.
import { GetAuthUserNameFromToken } from '@rehab-trainer/ui/auth/authClient';
import { type MobileDirection } from '@rehab-trainer/ui/components/MobileTouchControls';
import { TrainingResultActions } from '@rehab-trainer/ui/components/TrainingResultActions';
import { RequestHubTrainingConfiguration } from '@rehab-trainer/ui/embeddedTraining';
import { useFullscreenTrainingRoot } from '@rehab-trainer/ui/hooks/useFullscreenTrainingRoot';
import { useHostedGameSettings } from '@rehab-trainer/ui/hooks/useHostedGameSettings';
import { useTrainingAbort } from '@rehab-trainer/ui/hooks/useTrainingAbort';
import { useT } from '@rehab-trainer/ui/i18n/games';
import { PlayFailureSound,PlayGameEndSound,PlaySuccessSound,PrepareAudioFeedback } from '../soundManager';
import { SaveTrainingSessionRecord } from '@rehab-trainer/ui/storage/trainingRecords';
import { FormatTestDate } from '@rehab-trainer/ui/trainingGameUtils';
import { initJsPsych } from 'jspsych';
import { Application,type Ticker } from 'pixi.js';
import { useCallback,useEffect,useRef,useState,type CSSProperties } from 'react';
import { BuildReactionResultStats,CreateReactionState,DrawReaction,HandleReactionStateTap,IsReactionAutoSuccess,ShowReactionGo,UpdateReactionTimedState,} from '../../ReactionTimeGame';
import { BrainTrainingRulesPanel } from '../components/rules/BrainTrainingRulesPanel';
import { JsPsychExternalLifecycle } from '../jsPsychLifecycle';
import { difficulties,referenceCognitiveModules } from './constants';
import { ExpireWhackTarget,ShowWhackTarget } from './targetClick';
import './ThinkingGames.css';
import type { CognitiveGameState,Difficulty,GamePhase,GameResult,ReactionTrialRecord,ReferenceGameId,RuntimeMetrics,SessionLimitSeconds,SessionRecord,SimonTrialRecord,TargetTrialRecord,TFunction,} from './types';
import { ClearStage,cognitiveAccentCss,DrawBackground } from './utils';
export { referenceCognitiveModules } from './constants';
export type { ReferenceGameId } from './types';
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
export function ReferenceCognitiveGame({ gameId, onExit, trainingModuleId = 'thinking-training', trainingConfigLabel, }: ReferenceCognitiveGameProps) {
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
    const [phase, setPhaseState] = useState<GamePhase>('rules');
    const hostedSettings = useHostedGameSettings();
    const hostedSettingsAppliedRef = useRef(false);

    const [difficulty, setDifficulty] = useState<Difficulty>(({ easy: 'Beginner', medium: 'Intermediate', hard: 'Advanced' } as const)[GetHostedGameSetting<'easy' | 'medium' | 'hard'>('difficulty')]);
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
        ...([]),
        {
            label: t('cognitive.config.reactionTrials'),
            value: t('training.count', { value: reactionTrials }),
        },
    ];
    const setPhase = useCallback((next: GamePhase) => {
        phaseRef.current = next;
        setPhaseState(next);
    }, []);
    const renderCurrent = useCallback(() => {
        const app = appRef.current;
        const state = stateRef.current;
        if (!app || !state)
            return;
        ClearStage(app);
        DrawBackground(app);
        switch (state.kind) {
            case 'reaction-time':
                DrawReaction(app, state, HandleReactionTap, t);
                break;
        }
    }, [t]);
    renderRef.current = renderCurrent;
    const finishGame = useCallback((gameResult: GameResult) => {
        if (phaseRef.current === 'results')
            return;
        const state = stateRef.current;
        if (!state)
            return;
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
        void SaveTrainingSessionRecord({ userName: participantId, moduleId: trainingModuleId, gameId: 'reaction-time', gameTitle: metaTitle, difficulty: 'configured', trainingDate, details: {
                Game_Result: record.Game_Result,
                Total_Duration_Seconds: record.Total_Duration_Seconds,
                ...timingData.details,
            },
detailRows: timingData.detailRows });
    }, [difficulty, gameId, metaTitle, setPhase, trainingModuleId]);
    finishGameRef.current = finishGame;
    const startGame = useCallback(async () => {
        jsPsychRef.current?.pluginAPI.clearAllTimeouts();
        cognitiveTrialLifecycleRef.current?.abort({ abort_reason: 'new-session' });
        activeCognitiveTrialRef.current = null;
        PrepareAudioFeedback(jsPsychRef);
        await enterTrainingFullscreen();
        const app = appRef.current;
        if (!app || !(await ResizePixiAppToElement(app, pixiHostRef.current)))
            return;
        await jsPsychLifecycleRef.current?.start({ moduleId: `brain:${gameId}`, onStart: () => {
                metricsRef.current = { elapsed: 0 };
                lastRenderSecondRef.current = -1;
                stateRef.current = CreateInitialState(gameId, difficulty, reactionTrials, simonLives);
                setSimonLivesRemaining(null);
                setSimonShaking(false);
                setResult(null);
                setPhase('playing');
                renderRef.current();
                FlushPixiRender();
            } });
    }, [difficulty, enterTrainingFullscreen, gameId, reactionTrials, setPhase, simonLives]);
    const returnToMenu = useCallback(() => {
        jsPsychLifecycleRef.current?.abort({ abort_reason: 'return-to-menu' });
        cognitiveTrialLifecycleRef.current?.abort({ abort_reason: 'return-to-menu' });
        activeCognitiveTrialRef.current = null;
        jsPsychRef.current?.pluginAPI.clearAllTimeouts();
        if (simonShakeTimeoutRef.current !== null)
            window.clearTimeout(simonShakeTimeoutRef.current);
        RequestHubTrainingConfiguration();
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
    function StartCognitiveTrial(kind: CognitiveTrialKind) {
        const lifecycle = cognitiveTrialLifecycleRef.current;
        if (!lifecycle || activeCognitiveTrialRef.current)
            return;
        const activeTrial: ActiveCognitiveTrial = {
            kind,
            startPromise: lifecycle.start({ moduleId: `brain:${gameId}:${kind}-trial`, onStart: () => undefined }),
        };
        activeCognitiveTrialRef.current = activeTrial;
        void activeTrial.startPromise.then((started) => {
            if (!started && activeCognitiveTrialRef.current === activeTrial) {
                activeCognitiveTrialRef.current = null;
            }
        });
    }
    function FinishCognitiveTrial(kind: CognitiveTrialKind, trial: ReactionTrialRecord | TargetTrialRecord | SimonTrialRecord) {
        const lifecycle = cognitiveTrialLifecycleRef.current;
        const activeTrial = activeCognitiveTrialRef.current;
        if (!lifecycle || !activeTrial || activeTrial.kind !== kind)
            return false;
        activeCognitiveTrialRef.current = null;
        const data = BuildCognitiveTrialLifecycleData(trial);
        if (lifecycle.finish(data))
            return true;
        void activeTrial.startPromise.then((started) => {
            if (started)
                lifecycle.finish(data);
        });
        return true;
    }
    function HandleReactionTap(tapMs: number) {
        if (phaseRef.current !== 'playing')
            return;
        const state = stateRef.current;
        if (!state || state.kind !== 'reaction-time')
            return;
        const feedbackBefore = GetFeedbackCounts(state);
        const startsAttempt = state.status === 'waiting' || state.status === 'result' || state.status === 'too-early';
        const trial = HandleReactionStateTap(state, tapMs, difficulty, (delayMs, goAtMs) => {
            jsPsychRef.current?.pluginAPI.setTimeout(() => {
                if (phaseRef.current !== 'playing' || stateRef.current !== state || state.goAt !== goAtMs)
                    return;
                if (!ShowReactionGo(state, performance.now()))
                    return;
                renderRef.current();
                FlushPixiRender();
                state.goStartedAt = performance.now();
            }, delayMs);
        });
        if (startsAttempt && state.status === 'ready')
            StartCognitiveTrial('reaction');
        if (trial)
            FinishCognitiveTrial('reaction', trial);
        PlayFeedbackForCountChange(feedbackBefore, GetFeedbackCounts(state), jsPsychRef);
        renderRef.current();
        if (trial?.outcome === 'success' && state.attempts.length >= state.targetTrials) {
            finishGameRef.current('Victory');
        }
    }
    function FlushPixiRender() {
        const app = appRef.current;
        if (!app)
            return;
        app.renderer.render(app.stage);
    }
    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            if (phaseRef.current !== 'playing')
                return;
            const state = stateRef.current;
            return;
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, []);
    useEffect(() => {
        const host = jsPsychHostRef.current;
        const trialHost = trialJsPsychHostRef.current;
        if (!host || !trialHost)
            return;
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
            if (jsPsychRef.current === jsPsych)
                jsPsychRef.current = null;
            if (jsPsychLifecycleRef.current === lifecycle)
                jsPsychLifecycleRef.current = null;
            if (cognitiveTrialLifecycleRef.current === trialLifecycle)
                cognitiveTrialLifecycleRef.current = null;
        };
    }, []);
    useEffect(() => {
        if (!hostedSettings || hostedSettingsAppliedRef.current)
            return;
        hostedSettingsAppliedRef.current = true;
        setDifficulty(hostedSettings.difficulty === 'hard'
            ? 'Advanced'
            : hostedSettings.difficulty === 'medium'
                ? 'Intermediate'
                : 'Beginner');
        if (typeof hostedSettings.timeLimitSec === 'number') {
            setSessionLimitSec(hostedSettings.timeLimitSec === 0 ? null : hostedSettings.timeLimitSec);
        }
        if (typeof hostedSettings.rounds === 'number') {
            setReactionTrials(hostedSettings.rounds);
        }
        setPhase('rules');
    }, [gameId, hostedSettings, setPhase]);
    useEffect(() => () => {
        if (simonShakeTimeoutRef.current !== null)
            window.clearTimeout(simonShakeTimeoutRef.current);
    }, []);
    useEffect(() => {
        let cancelled = false;
        let initialized = false;
        const app = new Application();
        const init = async () => {
            const host = pixiHostRef.current;
            if (!host)
                return;
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
                    if (phaseRef.current !== 'playing')
                        return;
                    const dt = Math.min(ticker.deltaMS / 1000, 0.05);
                    metricsRef.current.elapsed += dt;
                    const feedbackBefore = null;
                    UpdateTimedState(stateRef.current, metricsRef.current.elapsed, renderRef.current, finishGameRef.current, () => StartCognitiveTrial('simon'));
                    const limit = sessionLimitSec;
                    if (limit !== null && metricsRef.current.elapsed >= limit) {
                        finishGameRef.current(IsAutoSuccess(stateRef.current) ? 'Victory' : 'Defeat');
                        return;
                    }
                });
                if (phaseRef.current === 'playing')
                    renderRef.current();
            }
            catch (error) {
                if (!cancelled)
                    console.error('PixiJS init failed for cognitive game:', error);
            }
        };
        void init();
        const handleResize = () => renderRef.current();
        return () => {
            cancelled = true;
            if (appRef.current === app)
                appRef.current = null;
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
    return (<div ref={fullscreenRootRef} className={`cognitive-reference-game cognitive-reference-phase-${phase}${simonShaking ? ' cognitive-simon-shaking' : ''}`} style={{ '--cognitive-game-accent': cognitiveAccentCss } as CSSProperties}>
      <div ref={jsPsychHostRef} style={{ display: 'none' }} aria-hidden="true"/>
      <div ref={trialJsPsychHostRef} style={{ display: 'none' }} aria-hidden="true"/>
      <div ref={pixiHostRef} className="cognitive-pixi-stage"/>
      {false}
      {false}

      {null}

      {phase === 'rules' && (<div className="training-panel">
          <BrainTrainingRulesPanel gameId={gameId} title={metaTitle} summaryTitle={metaTitle} summaryItems={configSummaryItems} onStart={() => void startGame()} onBack={() => {
                if (!RequestHubTrainingConfiguration())
                    RequestHubTrainingConfiguration();
            }}/>
        </div>)}

      {phase === 'results' && result && (<div className="experiment-container experiment-container-scrollable cognitive-results-container">
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

            <CognitiveTrialResultsTable state={stateRef.current} t={t}/>

            <TrainingResultActions backLabel={t('training.returnHome')} onBackHome={onExit} hubLabel={t('training.returnLobby')}/>
          </div>
        </div>)}
    </div>);
}
function GetModuleMeta(gameId: ReferenceGameId) {
    return referenceCognitiveModules.find((module) => module.id === gameId) ?? referenceCognitiveModules[0];
}
function CreateInitialState(gameId: ReferenceGameId, difficulty: Difficulty, reactionTrials: number, simonLives: number): CognitiveGameState { return CreateReactionState(reactionTrials); }
function UpdateTimedState(state: CognitiveGameState | null, elapsed: number, render: () => void, finishGame: (result: GameResult) => void, onSimonInputStart: () => void) {
    if (!state)
        return;
    if (state.kind === 'reaction-time')
        UpdateReactionTimedState(state, elapsed, render);
    ;
}
function IsAutoSuccess(state: CognitiveGameState | null) { if (!state)
    return false; return IsReactionAutoSuccess(state); }
function GetFeedbackCounts(state: CognitiveGameState): {
    success: number;
    errors: number;
} { return { success: state.attempts.length, errors: state.falseStarts }; }
function GetTimingResultData(state: CognitiveGameState): {
    details: Record<string, unknown>;
    detailRows?: Record<string, unknown>[];
} {
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
                falseStart: trial.outcome === 'false-start',
                responseMs: trial.outcome === 'success' ? trial.reactionTimeMs : null,
                earlyMs: trial.outcome === 'false-start' ? trial.reactionTimeMs : null,
            })),
        };
    }
    return { details: {} };
}
function BuildCognitiveTrialLifecycleData(trial: ReactionTrialRecord | TargetTrialRecord | SimonTrialRecord): Record<string, unknown> {
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
function CognitiveTrialResultsTable({ state, t }: {
    state: CognitiveGameState | null;
    t: TFunction;
}) {
    if (!state)
        return null;
    if (state.kind === 'reaction-time') {
        return (<div className="cognitive-trial-results">
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
              {state.trials.map((trial) => (<tr key={trial.trialNumber}>
                  <td>{trial.trialNumber}</td>
                  <td>{FormatTrialOutcome(trial.outcome, t)}</td>
                  <td>{trial.reactionTimeMs}</td>
                </tr>))}
            </tbody>
          </table>
        </div>
      </div>);
    }
    return null;
}
function FormatTrialOutcome(outcome: ReactionTrialRecord['outcome'] | TargetTrialRecord['outcome'], t: TFunction) {
    if (outcome === 'success')
        return t('cognitive.results.outcome.success');
    if (outcome === 'false-start')
        return t('cognitive.results.outcome.falseStart');
    if (outcome === 'hit')
        return t('cognitive.results.outcome.hit');
    if (outcome === 'expired')
        return t('cognitive.results.outcome.expired');
    return t('cognitive.results.outcome.wrongTap');
}
function PlayFeedbackForCountChange(before: {
    success: number;
    errors: number;
}, after: {
    success: number;
    errors: number;
}, jsPsychRef: {
    current: unknown;
}): void {
    if (after.success > before.success) {
        PlaySuccessSound(jsPsychRef);
        return;
    }
    if (after.errors > before.errors) {
        PlayFailureSound(jsPsychRef);
    }
}
function FormatSeconds(value: number, t: TFunction) {
    return t('training.secondsShort', { value });
}
function FormatGameResult(result: GameResult, t: TFunction) {
    if (result === 'Victory')
        return t('cognitive.results.victory');
    if (result === 'Draw')
        return t('cognitive.results.draw');
    return t('cognitive.results.defeat');
}
async function ResizePixiAppToElement(app: Application, element: HTMLElement | null): Promise<boolean> {
    const size = await MeasureElementSize(element);
    if (!size)
        return false;
    const { width, height } = size;
    app.renderer.resize(width, height);
    return true;
}
async function MeasureElementSize(element: HTMLElement | null) {
    for (let frame = 0; frame < 8; frame += 1) {
        const rect = element?.getBoundingClientRect();
        const width = Math.round(rect?.width ?? 0);
        const height = Math.round(rect?.height ?? 0);
        if (width > 0 && height > 0)
            return { width, height };
        await NextFrame();
    }
    return null;
}
function NextFrame() {
    return new Promise<void>((resolve) => window.requestAnimationFrame(() => resolve()));
}

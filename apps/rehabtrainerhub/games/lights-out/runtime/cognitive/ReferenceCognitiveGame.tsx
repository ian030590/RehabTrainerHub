import { GetAuthUserNameFromToken } from '@rehab-trainer/ui/auth/authClient';
import { TrainingResultActions } from '@rehab-trainer/ui/components/TrainingResultActions';
import { GetHostedGameSetting, RequestHubTrainingConfiguration } from '@rehab-trainer/ui/embeddedTraining';
import { useFullscreenTrainingRoot } from '@rehab-trainer/ui/hooks/useFullscreenTrainingRoot';
import { useTrainingAbort } from '@rehab-trainer/ui/hooks/useTrainingAbort';
import { useT } from '@rehab-trainer/ui/i18n/games';
import { SaveTrainingSessionRecord } from '@rehab-trainer/ui/storage/trainingRecords';
import { FormatTestDate } from '@rehab-trainer/ui/trainingGameUtils';
import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { BrainTrainingRulesPanel } from '../components/rules/BrainTrainingRulesPanel';
import { PlayGameEndSound, PlaySuccessSound, PrepareAudioFeedback } from '../soundManager';
import {
  BuildLightsResultData, CreateLightsState, GetLightsTimedOutcome, HandleLightsTap,
  type Difficulty, type GameResult, type LightsOutState,
} from './lightsLogic';
import './LightsOut.css';

type Phase = 'rules' | 'playing' | 'results';
type ResultData = ReturnType<typeof BuildLightsResultData> & { Game_Result: GameResult };
const difficultyNames: Record<'easy' | 'medium' | 'hard', Difficulty> = {
  easy: 'Beginner', medium: 'Intermediate', hard: 'Advanced',
};

export function ReferenceCognitiveGame({ onExit, trainingModuleId = 'thinking-training' }: {
  gameId: 'lights-out';
  onExit: () => void;
  trainingModuleId?: string;
}) {
  const { t } = useT();
  const { fullscreenRootRef, enterTrainingFullscreen } = useFullscreenTrainingRoot<HTMLDivElement>();
  const difficulty = difficultyNames[GetHostedGameSetting<'easy' | 'medium' | 'hard'>('difficulty')];
  const timeLimitSec = GetHostedGameSetting<number>('timeLimitSec') ?? 0;
  const [phase, setPhase] = useState<Phase>('rules');
  const phaseRef = useRef<Phase>('rules');
  const stateRef = useRef<LightsOutState | null>(null);
  const [, setRevision] = useState(0);
  const [result, setResult] = useState<ResultData | null>(null);
  const startedAtRef = useRef(0);
  const clockTimerRef = useRef<number | null>(null);
  const state = stateRef.current;
  const title = t('cognitive.lights.title');

  function ChangePhase(next: Phase) {
    phaseRef.current = next;
    setPhase(next);
  }

  function ClearClock() {
    if (clockTimerRef.current !== null) window.clearInterval(clockTimerRef.current);
    clockTimerRef.current = null;
  }

  function FinishGame(outcome: GameResult) {
    if (phaseRef.current !== 'playing' || !stateRef.current) return;
    ChangePhase('results');
    ClearClock();
    PlayGameEndSound(outcome);
    const elapsedMs = performance.now() - startedAtRef.current;
    const durationSec = Number((Math.max(0, Math.min(elapsedMs, timeLimitSec ? timeLimitSec * 1000 : Infinity)) / 1000).toFixed(1));
    const completed = { Game_Result: outcome, ...BuildLightsResultData(stateRef.current, durationSec, outcome) };
    setResult(completed);
    void SaveTrainingSessionRecord({
      userName: GetAuthUserNameFromToken() || 'Unknown',
      moduleId: trainingModuleId,
      gameId: 'lights-out',
      gameTitle: title,
      difficulty: 'configured',
      trainingDate: FormatTestDate(new Date()),
      details: completed,
    });
  }

  function CheckTime() {
    if (phaseRef.current !== 'playing' || !stateRef.current) return;
    const outcome = GetLightsTimedOutcome(stateRef.current, startedAtRef.current, performance.now(), timeLimitSec);
    if (outcome) FinishGame(outcome);
    else setRevision(value => value + 1);
  }

  function StartGame() {
    ClearClock();
    PrepareAudioFeedback();
    void enterTrainingFullscreen();
    stateRef.current = CreateLightsState(difficulty);
    startedAtRef.current = performance.now();
    setResult(null);
    ChangePhase('playing');
    if (timeLimitSec > 0) clockTimerRef.current = window.setInterval(CheckTime, 250);
  }

  function HandleCellClick(index: number) {
    if (phaseRef.current !== 'playing' || !stateRef.current) return;
    const current = stateRef.current;
    const timeout = GetLightsTimedOutcome(current, startedAtRef.current, performance.now(), timeLimitSec);
    if (timeout) return FinishGame(timeout);
    HandleLightsTap(current, index, outcome => {
      PlaySuccessSound();
      FinishGame(outcome);
    });
    setRevision(value => value + 1);
  }

  useEffect(() => {
    const onVisible = () => { if (!document.hidden) CheckTime(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      ClearClock();
    };
  }, []);
  useTrainingAbort({
    active: phase === 'playing',
    abortOnFullscreenExit: false,
    onAbort: () => {
      ClearClock();
      RequestHubTrainingConfiguration();
    },
  });

  const remainingSec = timeLimitSec > 0
    ? Math.max(0, Math.ceil((startedAtRef.current + timeLimitSec * 1000 - performance.now()) / 1000))
    : null;
  return <div ref={fullscreenRootRef} className={`lights-game lights-phase-${phase}`}>
    {phase === 'rules' && <div className="training-panel">
      <BrainTrainingRulesPanel
        gameId="lights-out"
        title={title}
        summaryTitle={title}
        summaryItems={[
          { label: t('cognitive.config.difficulty'), value: t(`cognitive.diff.${difficulty.toLowerCase()}`) },
          { label: t('cognitive.config.timeLimit'), value: timeLimitSec > 0
            ? t('training.secondsShort', { value: timeLimitSec }) : t('training.unlimited') },
        ]}
        onStart={StartGame}
        onBack={() => RequestHubTrainingConfiguration()}
      />
    </div>}

    {phase === 'playing' && state && <main className="lights-play">
      <h1>{title}</h1>
      <p className="lights-progress">
        <span aria-live="polite">{t('cognitive.lights.moves', { value: state.moves })} · {t('cognitive.lights.lit', { value: state.lights.flat().filter(Boolean).length })}</span>
        {remainingSec !== null && <span aria-live="off"> · {t('cognitive.config.timeLimit')}: {t('training.secondsShort', { value: remainingSec })}</span>}
      </p>
      <div className="lights-board" style={{ '--lights-size': state.size } as CSSProperties}>
        {state.lights.flatMap((row, rowIndex) => row.map((light, colIndex) => {
          const index = rowIndex * state.size + colIndex;
          return <button
            key={index}
            type="button"
            className="lights-cell"
            data-lights-cell={index}
            data-lights-on={light}
            aria-pressed={light}
            aria-label={t(light ? 'cognitive.lights.cellOn' : 'cognitive.lights.cellOff', {
              row: rowIndex + 1, col: colIndex + 1,
            })}
            onClick={() => HandleCellClick(index)}
          >{light ? '●' : '○'}</button>;
        }))}
      </div>
      <button type="button" className="btn btn-ghost" onClick={() => {
        ClearClock();
        RequestHubTrainingConfiguration();
      }}>{t('training.returnHome')}</button>
    </main>}

    {phase === 'results' && result && <div className="experiment-container experiment-container-scrollable lights-results">
      <div className="experiment-results">
        <h1>{t(result.Completed ? 'cognitive.results.complete' : 'cognitive.results.ended')}</h1>
        <div className="training-result-summary">
          <span><small>{t('cognitive.results.elapsed')}</small><strong>{t('training.secondsShort', { value: result.Total_Duration_Seconds })}</strong></span>
          <span><small>{t('cognitive.results.result')}</small><strong>{t(result.Completed ? 'cognitive.results.victory' : 'cognitive.results.defeat')}</strong></span>
          <span><small>{t('cognitive.lights.movesLabel')}</small><strong>{result.Moves}</strong></span>
          <span><small>{t('cognitive.lights.litLabel')}</small><strong>{state?.lights.flat().filter(Boolean).length ?? 0}</strong></span>
          <span><small>{t('cognitive.lights.boardSize')}</small><strong>{result.Board_Size} × {result.Board_Size}</strong></span>
        </div>
        <TrainingResultActions backLabel={t('training.returnHome')} onBackHome={onExit} hubLabel={t('training.returnLobby')} />
      </div>
    </div>}
  </div>;
}

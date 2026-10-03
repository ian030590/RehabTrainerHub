import { GetAuthUserNameFromToken } from '@rehab-trainer/ui/auth/authClient';
import { MobileDirectionPad, type MobileDirection } from '@rehab-trainer/ui/components/MobileTouchControls';
import { TrainingResultActions } from '@rehab-trainer/ui/components/TrainingResultActions';
import { GetHostedGameSetting, RequestHubTrainingConfiguration } from '@rehab-trainer/ui/embeddedTraining';
import { useFullscreenTrainingRoot } from '@rehab-trainer/ui/hooks/useFullscreenTrainingRoot';
import { useTrainingAbort } from '@rehab-trainer/ui/hooks/useTrainingAbort';
import { useT } from '@rehab-trainer/ui/i18n/games';
import { SaveTrainingSessionRecord } from '@rehab-trainer/ui/storage/trainingRecords';
import { FormatTestDate } from '@rehab-trainer/ui/trainingGameUtils';
import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { BrainTrainingRulesPanel } from '../components/rules/BrainTrainingRulesPanel';
import { PlayFailureSound, PlayGameEndSound, PlaySuccessSound, PrepareAudioFeedback } from '../soundManager';
import {
  BuildMazeResultData, CreateMazeState, HandleMazeTap, MoveMazeDirection, UpdateMazeTimedState,
  type Difficulty, type GameResult, type MazeState,
} from './mazeLogic';
import './MazeGame.css';

type Phase = 'rules' | 'playing' | 'results';
type ResultData = ReturnType<typeof BuildMazeResultData> & { Game_Result: GameResult };
const difficultyKeys = {
  easy: 'cognitive.diff.beginner', medium: 'cognitive.diff.intermediate', hard: 'cognitive.diff.advanced',
} as const;

export function ReferenceCognitiveGame({ onExit, trainingModuleId = 'thinking-training' }: {
  gameId: 'maze'; onExit: () => void; trainingModuleId?: string;
}) {
  const { t } = useT();
  const { fullscreenRootRef, enterTrainingFullscreen } = useFullscreenTrainingRoot<HTMLDivElement>();
  const difficulty = GetHostedGameSetting<Difficulty>('difficulty');
  const timeLimitSec = GetHostedGameSetting<number>('timeLimitSec');
  const [phase, setPhase] = useState<Phase>('rules');
  const phaseRef = useRef<Phase>('rules');
  const stateRef = useRef<MazeState | null>(null);
  const [revision, setRevision] = useState(0);
  const [result, setResult] = useState<ResultData | null>(null);
  const startedAtRef = useRef(0);
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const currentCellRef = useRef<HTMLButtonElement | null>(null);
  const state = stateRef.current;
  const title = t('cognitive.maze.title');
  const elapsed = phase === 'playing' ? (performance.now() - startedAtRef.current) / 1000 : 0;

  function ChangePhase(next: Phase) {
    phaseRef.current = next;
    setPhase(next);
  }

  function FinishGame(outcome: GameResult) {
    if (phaseRef.current !== 'playing' || !stateRef.current) return;
    ChangePhase('results');
    PlayGameEndSound(outcome);
    const actual = Math.max(0, (performance.now() - startedAtRef.current) / 1000);
    const duration = Number((outcome === 'Defeat' && timeLimitSec > 0
      ? Math.min(actual, timeLimitSec) : actual).toFixed(1));
    const completed = { Game_Result: outcome, ...BuildMazeResultData(stateRef.current, duration, outcome) };
    setResult(completed);
    void SaveTrainingSessionRecord({
      userName: GetAuthUserNameFromToken() || 'Unknown', moduleId: trainingModuleId,
      gameId: 'maze', gameTitle: title, difficulty: 'configured',
      trainingDate: FormatTestDate(new Date()), details: completed,
    });
  }

  function CheckDeadline() {
    if (phaseRef.current !== 'playing' || !stateRef.current) return false;
    UpdateMazeTimedState(stateRef.current,
      (performance.now() - startedAtRef.current) / 1000, timeLimitSec, FinishGame);
    return phaseRef.current === 'playing';
  }

  function StartGame() {
    PrepareAudioFeedback();
    void enterTrainingFullscreen();
    stateRef.current = CreateMazeState(difficulty);
    startedAtRef.current = performance.now();
    setResult(null);
    ChangePhase('playing');
  }

  function HandleMove(move: (state: MazeState) => void) {
    if (!CheckDeadline() || !stateRef.current) return;
    const before = { moves: stateRef.current.moves, errors: stateRef.current.errors };
    move(stateRef.current);
    if (stateRef.current.moves > before.moves) PlaySuccessSound();
    else if (stateRef.current.errors > before.errors) PlayFailureSound();
    setRevision(value => value + 1);
  }

  function HandleCellClick(index: number) {
    HandleMove(current => HandleMazeTap(current, index, FinishGame));
  }

  function HandleDirection(direction: MobileDirection) {
    HandleMove(current => { MoveMazeDirection(current, direction, FinishGame); });
  }

  function CancelGame() {
    ChangePhase('rules');
    stateRef.current = null;
    RequestHubTrainingConfiguration();
  }

  useEffect(() => {
    if (phase !== 'playing') return;
    const timer = window.setInterval(() => {
      if (CheckDeadline()) setRevision(value => value + 1);
    }, 1000);
    const onVisible = () => {
      if (!document.hidden && CheckDeadline()) setRevision(value => value + 1);
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [phase, timeLimitSec]);

  useEffect(() => {
    if (phase !== 'playing') return;
    const onKeyDown = (event: KeyboardEvent) => {
      const directionByKey: Record<string, MobileDirection> = {
        ArrowUp: 'up', ArrowRight: 'right', ArrowDown: 'down', ArrowLeft: 'left',
      };
      const direction = directionByKey[event.key];
      if (!direction) return;
      event.preventDefault();
      HandleDirection(direction);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [phase, timeLimitSec]);

  useEffect(() => {
    if (phase !== 'playing' || !scrollerRef.current || !currentCellRef.current) return;
    const scroller = scrollerRef.current;
    const cell = currentCellRef.current;
    scroller.scrollLeft = cell.offsetLeft - scroller.clientWidth / 2 + cell.clientWidth / 2;
  }, [phase, revision]);
  useTrainingAbort({ active: phase === 'playing', abortOnFullscreenExit: false, onAbort: CancelGame });

  return <div ref={fullscreenRootRef} className={'maze-game maze-phase-' + phase}>
    {phase === 'rules' && <div className="training-panel">
      <BrainTrainingRulesPanel gameId="maze" title={title} summaryTitle={title}
        summaryItems={[
          { label: t('cognitive.config.difficulty'), value: t(difficultyKeys[difficulty]) },
          { label: t('cognitive.config.timeLimit'), value: timeLimitSec > 0
            ? t('training.secondsShort', { value: timeLimitSec }) : t('training.unlimited') },
        ]} onStart={StartGame} onBack={CancelGame} />
    </div>}

    {phase === 'playing' && state && <main className="maze-play">
      <h1>{title}</h1>
      <p className="maze-status" role="status" aria-live="polite">{t('cognitive.maze.findGoal')}</p>
      {timeLimitSec > 0 && <p className="maze-time">{t('cognitive.maze.timeLeft', {
        value: Math.max(0, Math.ceil(timeLimitSec - elapsed)),
      })}</p>}
      <div className="maze-board-scroll" data-maze-board-scroll ref={scrollerRef}>
        <div className="maze-board" role="group" aria-label={t('cognitive.maze.board')}
          style={{ gridTemplateColumns: `repeat(${state.size}, 44px)` }}>
          {state.cells.map((cell, index) => {
            const current = index === state.current;
            const goal = index === state.end;
            const style: CSSProperties = {
              borderTopColor: cell.top ? 'var(--text-primary)' : 'transparent',
              borderRightColor: cell.right ? 'var(--text-primary)' : 'transparent',
              borderBottomColor: cell.bottom ? 'var(--text-primary)' : 'transparent',
              borderLeftColor: cell.left ? 'var(--text-primary)' : 'transparent',
            };
            return <button type="button" className="maze-cell" data-maze-cell={index}
              data-maze-current={current} data-maze-goal={goal} style={style}
              ref={current ? currentCellRef : undefined}
              aria-label={t('cognitive.maze.cell', {
                row: Math.floor(index / state.size) + 1, col: index % state.size + 1,
                marker: t(current ? 'cognitive.maze.you' : goal ? 'cognitive.maze.goal' : 'cognitive.maze.passage'),
              })} onClick={() => HandleCellClick(index)} key={index}>
              {current ? t('cognitive.maze.youShort') : goal ? t('cognitive.maze.goalShort') : ''}
            </button>;
          })}
        </div>
      </div>
      <MobileDirectionPad className="maze-dpad" label={t('cognitive.maze.controls')}
        onDirectionStart={HandleDirection} onDirectionEnd={() => undefined} />
      <button type="button" className="btn btn-ghost" onClick={CancelGame}>{t('training.returnHome')}</button>
    </main>}

    {phase === 'results' && result && <div className="experiment-container experiment-container-scrollable maze-results">
      <div className="experiment-results">
        <h1>{t(result.Game_Result === 'Victory' ? 'cognitive.results.complete' : 'cognitive.results.ended')}</h1>
        <div className="training-result-summary">
          <span><small>{t('cognitive.results.result')}</small><strong>{t(result.Game_Result === 'Victory' ? 'cognitive.results.victory' : 'cognitive.results.defeat')}</strong></span>
          <span><small>{t('cognitive.results.elapsed')}</small><strong>{t('training.secondsShort', { value: result.Total_Duration_Seconds })}</strong></span>
          <span><small>{t('cognitive.maze.moves')}</small><strong>{result.Moves}</strong></span>
          <span><small>{t('cognitive.maze.errors')}</small><strong>{result.Errors}</strong></span>
          <span><small>{t('cognitive.maze.boardSize')}</small><strong>{result.Board_Size}</strong></span>
        </div>
        <TrainingResultActions backLabel={t('training.returnHome')} onBackHome={onExit}
          hubLabel={t('training.returnLobby')} />
      </div>
    </div>}
  </div>;
}

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
import { PlayGameEndSound, PrepareAudioFeedback } from '../soundManager';
import {
  BuildTicTacToeResultData, CreateTicTacToeState, HandleTicTacToeTap,
  UpdateTicTacToeTimedState, type Difficulty, type GameResult, type TicTacToeState,
} from './ticTacToeLogic';
import './TicTacToe.css';

type Phase = 'rules' | 'playing' | 'results';
type ResultData = ReturnType<typeof BuildTicTacToeResultData> & { Game_Result: GameResult };
const difficultyNames: Record<'easy' | 'medium' | 'hard', Difficulty> = {
  easy: 'Beginner', medium: 'Intermediate', hard: 'Advanced',
};
const difficultyKeys = {
  Beginner: 'cognitive.diff.beginner',
  Intermediate: 'cognitive.diff.intermediate',
  Advanced: 'cognitive.diff.advanced',
} as const;

export function ReferenceCognitiveGame({ onExit, trainingModuleId = 'thinking-training' }: {
  gameId: 'tic-tac-toe';
  onExit: () => void;
  trainingModuleId?: string;
}) {
  const { t } = useT();
  const { fullscreenRootRef, enterTrainingFullscreen } = useFullscreenTrainingRoot<HTMLDivElement>();
  const difficulty = difficultyNames[GetHostedGameSetting<'easy' | 'medium' | 'hard'>('difficulty')];
  const [phase, setPhase] = useState<Phase>('rules');
  const phaseRef = useRef<Phase>('rules');
  const stateRef = useRef<TicTacToeState | null>(null);
  const [, setRevision] = useState(0);
  const [result, setResult] = useState<ResultData | null>(null);
  const startedAtRef = useRef(0);
  const aiTimerRef = useRef<number | null>(null);
  const state = stateRef.current;
  const title = t('cognitive.tictactoe.title');

  function ChangePhase(next: Phase) {
    phaseRef.current = next;
    setPhase(next);
  }

  function ClearAiTimer() {
    if (aiTimerRef.current !== null) window.clearTimeout(aiTimerRef.current);
    aiTimerRef.current = null;
  }

  function FinishGame(outcome: GameResult) {
    if (phaseRef.current !== 'playing' || !stateRef.current) return;
    ChangePhase('results');
    ClearAiTimer();
    PlayGameEndSound(outcome);
    const duration = Number((Math.max(0, performance.now() - startedAtRef.current) / 1000).toFixed(1));
    const completed = { Game_Result: outcome, ...BuildTicTacToeResultData(stateRef.current, duration, outcome) };
    setResult(completed);
    void SaveTrainingSessionRecord({
      userName: GetAuthUserNameFromToken() || 'Unknown',
      moduleId: trainingModuleId,
      gameId: 'tic-tac-toe',
      gameTitle: title,
      difficulty: 'configured',
      trainingDate: FormatTestDate(new Date()),
      details: completed,
    });
  }

  function RunAiTurn() {
    if (phaseRef.current !== 'playing' || !stateRef.current) return;
    UpdateTicTacToeTimedState(stateRef.current, (performance.now() - startedAtRef.current) / 1000, FinishGame);
    setRevision(value => value + 1);
    if (stateRef.current.aiMoveAt !== null) ScheduleAiTurn();
  }

  function ScheduleAiTurn() {
    ClearAiTimer();
    if (!stateRef.current || stateRef.current.aiMoveAt === null) return;
    const remaining = stateRef.current.aiMoveAt * 1000 - (performance.now() - startedAtRef.current);
    aiTimerRef.current = window.setTimeout(RunAiTurn, Math.max(0, remaining));
  }

  function StartGame() {
    ClearAiTimer();
    PrepareAudioFeedback();
    void enterTrainingFullscreen();
    stateRef.current = CreateTicTacToeState(difficulty);
    startedAtRef.current = performance.now();
    setResult(null);
    ChangePhase('playing');
  }

  function HandleCellClick(index: number) {
    if (phaseRef.current !== 'playing' || !stateRef.current) return;
    HandleTicTacToeTap(stateRef.current, index, (performance.now() - startedAtRef.current) / 1000, FinishGame);
    setRevision(value => value + 1);
    if (stateRef.current.aiMoveAt !== null) ScheduleAiTurn();
  }

  function CancelGame() {
    ClearAiTimer();
    ChangePhase('rules');
    stateRef.current = null;
    RequestHubTrainingConfiguration();
  }

  useEffect(() => {
    const onVisible = () => { if (!document.hidden) RunAiTurn(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      ClearAiTimer();
    };
  }, []);
  useTrainingAbort({
    active: phase === 'playing',
    abortOnFullscreenExit: false,
    onAbort: CancelGame,
  });

  return <div ref={fullscreenRootRef} className={'tic-game tic-phase-' + phase}>
    {phase === 'rules' && <div className="training-panel">
      <BrainTrainingRulesPanel gameId="tic-tac-toe" title={title} summaryTitle={title}
        summaryItems={[{ label: t('cognitive.config.difficulty'), value: t(difficultyKeys[difficulty]) }]}
        onStart={StartGame} onBack={CancelGame} />
    </div>}

    {phase === 'playing' && state && <main className="tic-play">
      <h1>{title}</h1>
      <p className="tic-status" role="status" aria-live="polite">
        {t(state.aiMoveAt === null ? 'cognitive.tic.yourTurn' : 'cognitive.tic.thinking')}
      </p>
      <p className="tic-progress">{t('cognitive.tic.moves', { value: state.moves })} · {t('cognitive.tic.errors', { value: state.errors })}</p>
      <div className="tic-board" style={{ '--tic-size': state.size } as CSSProperties}>
        {state.board.map((mark, index) => {
          const row = Math.floor(index / state.size) + 1;
          const col = index % state.size + 1;
          return <button key={index} type="button" className="tic-cell"
            data-tic-cell={index} data-tic-mark={mark ?? ''}
            disabled={state.aiMoveAt !== null}
            aria-label={t('cognitive.tic.cell', { row, col, mark: mark ?? t('cognitive.tic.empty') })}
            onClick={() => HandleCellClick(index)}>{mark}</button>;
        })}
      </div>
      <button type="button" className="btn btn-ghost" onClick={CancelGame}>{t('training.returnHome')}</button>
    </main>}

    {phase === 'results' && result && <div className="experiment-container experiment-container-scrollable tic-results">
      <div className="experiment-results">
        <h1>{t('cognitive.results.complete')}</h1>
        <div className="training-result-summary">
          <span><small>{t('cognitive.results.result')}</small><strong>{t('cognitive.results.' + result.Game_Result.toLowerCase() as 'cognitive.results.victory' | 'cognitive.results.defeat' | 'cognitive.results.draw')}</strong></span>
          <span><small>{t('cognitive.results.elapsed')}</small><strong>{t('training.secondsShort', { value: result.Total_Duration_Seconds })}</strong></span>
          <span><small>{t('cognitive.tic.movesLabel')}</small><strong>{result.Moves}</strong></span>
          <span><small>{t('cognitive.tic.opponentMoves')}</small><strong>{result.Opponent_Moves}</strong></span>
          <span><small>{t('cognitive.tic.errorsLabel')}</small><strong>{result.Errors}</strong></span>
          <span><small>{t('cognitive.tic.boardSize')}</small><strong>{result.Board_Size} × {result.Board_Size}</strong></span>
        </div>
        <TrainingResultActions backLabel={t('training.returnHome')} onBackHome={onExit} hubLabel={t('training.returnLobby')} />
      </div>
    </div>}
  </div>;
}

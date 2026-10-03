import { GetAuthUserNameFromToken } from '@rehab-trainer/ui/auth/authClient';
import { TrainingResultActions } from '@rehab-trainer/ui/components/TrainingResultActions';
import { GetHostedGameSetting, RequestHubTrainingConfiguration } from '@rehab-trainer/ui/embeddedTraining';
import { useFullscreenTrainingRoot } from '@rehab-trainer/ui/hooks/useFullscreenTrainingRoot';
import { useTrainingAbort } from '@rehab-trainer/ui/hooks/useTrainingAbort';
import { useT } from '@rehab-trainer/ui/i18n/games';
import { SaveTrainingSessionRecord } from '@rehab-trainer/ui/storage/trainingRecords';
import { FormatTestDate } from '@rehab-trainer/ui/trainingGameUtils';
import { useEffect, useRef, useState } from 'react';
import { BrainTrainingRulesPanel } from '../components/rules/BrainTrainingRulesPanel';
import { PlayGameEndSound, PrepareAudioFeedback } from '../soundManager';
import {
  BuildConnect4ResultData, CreateConnect4State, HandleConnect4Tap,
  UpdateConnect4TimedState, type Connect4State, type Difficulty, type GameResult,
} from './connect4Logic';
import './Connect4.css';

type Phase = 'rules' | 'playing' | 'results';
type ResultData = ReturnType<typeof BuildConnect4ResultData> & { Game_Result: GameResult };
const difficultyKeys = {
  easy: 'cognitive.diff.beginner',
  medium: 'cognitive.diff.intermediate',
  hard: 'cognitive.diff.advanced',
} as const;

export function ReferenceCognitiveGame({ onExit, trainingModuleId = 'thinking-training' }: {
  gameId: 'connect4';
  onExit: () => void;
  trainingModuleId?: string;
}) {
  const { t } = useT();
  const { fullscreenRootRef, enterTrainingFullscreen } = useFullscreenTrainingRoot<HTMLDivElement>();
  const difficulty = GetHostedGameSetting<Difficulty>('difficulty');
  const [phase, setPhase] = useState<Phase>('rules');
  const phaseRef = useRef<Phase>('rules');
  const stateRef = useRef<Connect4State | null>(null);
  const [, setRevision] = useState(0);
  const [result, setResult] = useState<ResultData | null>(null);
  const startedAtRef = useRef(0);
  const timerRef = useRef<number | null>(null);
  const state = stateRef.current;
  const title = t('cognitive.connect4.title');

  function ChangePhase(next: Phase) {
    phaseRef.current = next;
    setPhase(next);
  }

  function ClearTimer() {
    if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    timerRef.current = null;
  }

  function FinishGame(outcome: GameResult) {
    if (phaseRef.current !== 'playing' || !stateRef.current) return;
    ChangePhase('results');
    ClearTimer();
    PlayGameEndSound(outcome);
    const duration = Number((Math.max(0, performance.now() - startedAtRef.current) / 1000).toFixed(1));
    const completed = { Game_Result: outcome, ...BuildConnect4ResultData(stateRef.current, duration, outcome) };
    setResult(completed);
    void SaveTrainingSessionRecord({
      userName: GetAuthUserNameFromToken() || 'Unknown',
      moduleId: trainingModuleId,
      gameId: 'connect4',
      gameTitle: title,
      difficulty: 'configured',
      trainingDate: FormatTestDate(new Date()),
      details: completed,
    });
  }

  function ScheduleNext() {
    ClearTimer();
    const current = stateRef.current;
    if (phaseRef.current !== 'playing' || !current) return;
    const deadlines = [
      ...current.drops.map(drop => drop.startedAt + 0.45),
      current.aiMoveAt,
      current.pendingResult?.finishAt,
    ].filter((value): value is number => value !== null && value !== undefined);
    if (!deadlines.length) return;
    const remaining = Math.min(...deadlines) * 1000 - (performance.now() - startedAtRef.current);
    timerRef.current = window.setTimeout(RunTick, Math.max(1, remaining));
  }

  function RunTick() {
    if (phaseRef.current !== 'playing' || !stateRef.current) return;
    UpdateConnect4TimedState(stateRef.current, (performance.now() - startedAtRef.current) / 1000, difficulty, FinishGame);
    setRevision(value => value + 1);
    ScheduleNext();
  }

  function StartGame() {
    ClearTimer();
    PrepareAudioFeedback();
    void enterTrainingFullscreen();
    stateRef.current = CreateConnect4State();
    startedAtRef.current = performance.now();
    setResult(null);
    ChangePhase('playing');
  }

  function HandleColumnClick(col: number) {
    if (phaseRef.current !== 'playing' || !stateRef.current) return;
    HandleConnect4Tap(stateRef.current, col, (performance.now() - startedAtRef.current) / 1000, FinishGame);
    setRevision(value => value + 1);
    ScheduleNext();
  }

  function CancelGame() {
    ClearTimer();
    ChangePhase('rules');
    stateRef.current = null;
    RequestHubTrainingConfiguration();
  }

  useEffect(() => {
    const onVisible = () => { if (!document.hidden) RunTick(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      ClearTimer();
    };
  }, []);
  useTrainingAbort({ active: phase === 'playing', abortOnFullscreenExit: false, onAbort: CancelGame });

  const busy = Boolean(state?.drops.length || state?.aiMoveAt !== null || state?.pendingResult);
  const statusKey = state?.pendingResult
    ? 'cognitive.connect4.line'
    : state?.aiMoveAt !== null
      ? 'cognitive.connect4.thinking'
      : state?.drops.length
        ? 'cognitive.connect4.dropping'
        : 'cognitive.connect4.yourTurn';

  return <div ref={fullscreenRootRef} className={'connect-game connect-phase-' + phase}>
    {phase === 'rules' && <div className="training-panel">
      <BrainTrainingRulesPanel gameId="connect4" title={title} summaryTitle={title}
        summaryItems={[{ label: t('cognitive.config.difficulty'), value: t(difficultyKeys[difficulty]) }]}
        onStart={StartGame} onBack={CancelGame} />
    </div>}

    {phase === 'playing' && state && <main className="connect-play">
      <h1>{title}</h1>
      <p className="connect-status" role="status" aria-live="polite">{t(statusKey)}</p>
      <p className="connect-progress">
        {t('cognitive.connect4.moves', { value: state.moves })} · {t('cognitive.connect4.errors', { value: state.errors })}
      </p>
      <div className="connect-scroll" data-connect-board-scroll>
        <div className="connect-board">
          {Array.from({ length: 7 }, (_, col) => <button key={'column-' + col} type="button"
            className="connect-column" data-connect-column={col} disabled={busy}
            aria-label={t('cognitive.connect4.column', { value: col + 1 })}
            onClick={() => HandleColumnClick(col)}>{col + 1}</button>)}
          {state.board.map((mark, index) => <div key={'cell-' + index}
            className={'connect-cell' + (state.winningLine.includes(index) ? ' is-winning' : '')}
            data-connect-cell={index} data-connect-mark={mark ?? ''}
            aria-label={t('cognitive.connect4.cell', {
              row: Math.floor(index / 7) + 1, col: index % 7 + 1,
              mark: mark === 'P' ? t('cognitive.connect4.player') : mark === 'A' ? t('cognitive.connect4.computer') : t('cognitive.connect4.empty'),
            })}>
            {mark && <span className={'connect-disc connect-disc-' + mark}>{mark}</span>}
          </div>)}
        </div>
      </div>
      <button type="button" className="btn btn-ghost" onClick={CancelGame}>{t('training.returnHome')}</button>
    </main>}

    {phase === 'results' && result && <div className="experiment-container experiment-container-scrollable connect-results">
      <div className="experiment-results">
        <h1>{t('cognitive.results.complete')}</h1>
        <div className="training-result-summary">
          <span><small>{t('cognitive.results.result')}</small><strong>{t('cognitive.results.' + result.Game_Result.toLowerCase() as 'cognitive.results.victory' | 'cognitive.results.defeat' | 'cognitive.results.draw')}</strong></span>
          <span><small>{t('cognitive.results.elapsed')}</small><strong>{t('training.secondsShort', { value: result.Total_Duration_Seconds })}</strong></span>
          <span><small>{t('cognitive.connect4.movesLabel')}</small><strong>{result.Moves}</strong></span>
          <span><small>{t('cognitive.connect4.opponentMoves')}</small><strong>{result.Opponent_Moves}</strong></span>
          <span><small>{t('cognitive.connect4.errorsLabel')}</small><strong>{result.Errors}</strong></span>
        </div>
        <TrainingResultActions backLabel={t('training.returnHome')} onBackHome={onExit} hubLabel={t('training.returnLobby')} />
      </div>
    </div>}
  </div>;
}
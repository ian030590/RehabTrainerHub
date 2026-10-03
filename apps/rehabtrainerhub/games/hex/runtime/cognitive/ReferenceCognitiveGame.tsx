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
import { PlayFailureSound, PlayGameEndSound, PlaySuccessSound, PrepareAudioFeedback } from '../soundManager';
import {
  BuildHexResultData, CreateHexState, HandleHexTap, UpdateHexTimedState,
  type Difficulty, type GameResult, type HexState,
} from './hexLogic';
import './HexGame.css';

type Phase = 'rules' | 'playing' | 'results';
type ResultData = ReturnType<typeof BuildHexResultData> & { Game_Result: GameResult };
const difficultyKeys = {
  easy: 'cognitive.diff.beginner',
  medium: 'cognitive.diff.intermediate',
  hard: 'cognitive.diff.advanced',
} as const;

export function ReferenceCognitiveGame({ onExit, trainingModuleId = 'thinking-training' }: {
  gameId: 'hex';
  onExit: () => void;
  trainingModuleId?: string;
}) {
  const { t } = useT();
  const { fullscreenRootRef, enterTrainingFullscreen } = useFullscreenTrainingRoot<HTMLDivElement>();
  const difficulty = GetHostedGameSetting<Difficulty>('difficulty');
  const [phase, setPhase] = useState<Phase>('rules');
  const phaseRef = useRef<Phase>('rules');
  const stateRef = useRef<HexState | null>(null);
  const [, setRevision] = useState(0);
  const [result, setResult] = useState<ResultData | null>(null);
  const startedAtRef = useRef(0);
  const timerRef = useRef<number | null>(null);
  const state = stateRef.current;
  const title = t('cognitive.hex.title');

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
    const completed = { Game_Result: outcome, ...BuildHexResultData(stateRef.current, duration, outcome) };
    setResult(completed);
    void SaveTrainingSessionRecord({
      userName: GetAuthUserNameFromToken() || 'Unknown',
      moduleId: trainingModuleId, gameId: 'hex', gameTitle: title, difficulty: 'configured',
      trainingDate: FormatTestDate(new Date()), details: completed,
    });
  }

  function ScheduleNext() {
    ClearTimer();
    const current = stateRef.current;
    if (phaseRef.current !== 'playing' || !current || current.aiMoveAt === null) return;
    const remaining = current.aiMoveAt * 1000 - (performance.now() - startedAtRef.current);
    timerRef.current = window.setTimeout(RunTick, Math.max(1, remaining));
  }

  function RunTick() {
    if (phaseRef.current !== 'playing' || !stateRef.current) return;
    UpdateHexTimedState(stateRef.current,
      (performance.now() - startedAtRef.current) / 1000, FinishGame);
    setRevision(value => value + 1);
    ScheduleNext();
  }

  function StartGame() {
    ClearTimer();
    PrepareAudioFeedback();
    void enterTrainingFullscreen();
    stateRef.current = CreateHexState(difficulty);
    startedAtRef.current = performance.now();
    setResult(null);
    ChangePhase('playing');
  }

  function HandleCellClick(index: number) {
    if (phaseRef.current !== 'playing' || !stateRef.current) return;
    const before = { moves: stateRef.current.moves, errors: stateRef.current.errors };
    HandleHexTap(stateRef.current, index,
      (performance.now() - startedAtRef.current) / 1000, FinishGame);
    if (stateRef.current.moves > before.moves) PlaySuccessSound();
    else if (stateRef.current.errors > before.errors) PlayFailureSound();
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

  return <div ref={fullscreenRootRef} className={'hex-game hex-phase-' + phase}>
    {phase === 'rules' && <div className="training-panel">
      <BrainTrainingRulesPanel gameId="hex" title={title} summaryTitle={title}
        summaryItems={[{ label: t('cognitive.config.difficulty'), value: t(difficultyKeys[difficulty]) }]}
        onStart={StartGame} onBack={CancelGame} />
    </div>}

    {phase === 'playing' && state && <main className="hex-play">
      <h1>{title}</h1>
      <p className="hex-status" role="status" aria-live="polite">
        {t(state.aiMoveAt === null ? 'cognitive.hex.yourTurn' : 'cognitive.hex.thinking')}
      </p>
      <p className="hex-instructions">{t('cognitive.hex.orientation')}</p>
      <div className="hex-board-scroll" data-hex-board-scroll>
        <div className="hex-board" role="group" aria-label={t('cognitive.hex.board')}>
          <p className="hex-edge hex-edge-player">{t('cognitive.hex.top')}</p>
          {Array.from({ length: state.size }, (_, row) => <div className="hex-row"
            style={{ marginInlineStart: `${row * 24}px` }} key={row}>
            {Array.from({ length: state.size }, (_, col) => {
              const index = row * state.size + col;
              const owner = state.board[index];
              return <button type="button" className="hex-cell" data-hex-cell={index}
                data-hex-owner={owner} disabled={state.aiMoveAt !== null}
                aria-label={t('cognitive.hex.cell', {
                  row: row + 1, col: col + 1,
                  owner: t(owner === 1 ? 'cognitive.hex.player' : owner === 2
                    ? 'cognitive.hex.computer' : 'cognitive.hex.empty'),
                })}
                onClick={() => HandleCellClick(index)} key={index}>
                {owner === 1 ? '●' : owner === 2 ? '◆' : ''}
              </button>;
            })}
          </div>)}
          <p className="hex-edge hex-edge-player">{t('cognitive.hex.bottom')}</p>
        </div>
      </div>
      <button type="button" className="btn btn-ghost" onClick={CancelGame}>{t('training.returnHome')}</button>
    </main>}

    {phase === 'results' && result && <div className="experiment-container experiment-container-scrollable hex-results">
      <div className="experiment-results">
        <h1>{t(result.Game_Result === 'Victory' ? 'cognitive.results.complete' : 'cognitive.results.ended')}</h1>
        <div className="training-result-summary">
          <span><small>{t('cognitive.results.result')}</small><strong>{t(('cognitive.results.' + result.Game_Result.toLowerCase()) as 'cognitive.results.victory' | 'cognitive.results.defeat' | 'cognitive.results.draw')}</strong></span>
          <span><small>{t('cognitive.results.elapsed')}</small><strong>{t('training.secondsShort', { value: result.Total_Duration_Seconds })}</strong></span>
          <span><small>{t('cognitive.hex.moves')}</small><strong>{result.Moves}</strong></span>
          <span><small>{t('cognitive.hex.opponentMoves')}</small><strong>{result.Opponent_Moves}</strong></span>
          <span><small>{t('cognitive.hex.errors')}</small><strong>{result.Errors}</strong></span>
          <span><small>{t('cognitive.hex.boardSize')}</small><strong>{result.Board_Size}</strong></span>
        </div>
        <TrainingResultActions backLabel={t('training.returnHome')} onBackHome={onExit}
          hubLabel={t('training.returnLobby')} />
      </div>
    </div>}
  </div>;
}

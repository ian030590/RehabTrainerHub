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
import { PlayFailureSound, PlayGameEndSound, PrepareAudioFeedback } from '../soundManager';
import {
  BuildNumberGridResultData, CreateNumberGridState, GetNumberGridTimedOutcome,
  HandleNumberGridTap, type Difficulty, type GameResult, type NumberGridState,
} from './numberGridLogic';
import './NumberGrid.css';

type Phase = 'rules' | 'playing' | 'results';
type ResultData = ReturnType<typeof BuildNumberGridResultData> & { Game_Result: GameResult };
const difficultyNames: Record<'easy' | 'medium' | 'hard', Difficulty> = {
  easy: 'Beginner', medium: 'Intermediate', hard: 'Advanced',
};

export function ReferenceCognitiveGame({ onExit, trainingModuleId = 'thinking-training' }: {
  gameId: 'sudoku';
  onExit: () => void;
  trainingModuleId?: string;
}) {
  const { t } = useT();
  const { fullscreenRootRef, enterTrainingFullscreen } = useFullscreenTrainingRoot<HTMLDivElement>();
  const difficulty = difficultyNames[GetHostedGameSetting<'easy' | 'medium' | 'hard'>('difficulty')];
  const timeLimitSec = GetHostedGameSetting<number>('timeLimitSec') ?? 0;
  const [phase, setPhase] = useState<Phase>('rules');
  const phaseRef = useRef<Phase>('rules');
  const stateRef = useRef<NumberGridState | null>(null);
  const [, setRevision] = useState(0);
  const [result, setResult] = useState<ResultData | null>(null);
  const startedAtRef = useRef(0);
  const clockTimerRef = useRef<number | null>(null);
  const state = stateRef.current;
  const title = t('cognitive.sudoku.title');

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
    const completed = { Game_Result: outcome, ...BuildNumberGridResultData(stateRef.current, durationSec, outcome) };
    setResult(completed);
    void SaveTrainingSessionRecord({
      userName: GetAuthUserNameFromToken() || 'Unknown',
      moduleId: trainingModuleId,
      gameId: 'sudoku',
      gameTitle: title,
      difficulty: 'configured',
      trainingDate: FormatTestDate(new Date()),
      details: completed,
    });
  }

  function CheckTime() {
    if (phaseRef.current !== 'playing' || !stateRef.current) return;
    const outcome = GetNumberGridTimedOutcome(stateRef.current, startedAtRef.current, performance.now(), timeLimitSec);
    if (outcome) FinishGame(outcome);
    else setRevision(value => value + 1);
  }

  function StartGame() {
    ClearClock();
    PrepareAudioFeedback();
    void enterTrainingFullscreen();
    stateRef.current = CreateNumberGridState(difficulty);
    startedAtRef.current = performance.now();
    setResult(null);
    ChangePhase('playing');
    if (timeLimitSec > 0) clockTimerRef.current = window.setInterval(CheckTime, 250);
  }

  function HandleCellClick(index: number) {
    if (phaseRef.current !== 'playing' || !stateRef.current) return;
    const current = stateRef.current;
    const timeout = GetNumberGridTimedOutcome(current, startedAtRef.current, performance.now(), timeLimitSec);
    if (timeout) return FinishGame(timeout);
    const errorsBefore = current.errors;
    HandleNumberGridTap(current, index, FinishGame);
    if (current.errors > errorsBefore) PlayFailureSound();
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
  const kindLabel = state?.kind === 'latin-square' ? t('cognitive.number.latin')
    : state?.kind === 'magic-square' ? t('cognitive.number.magic') : t('cognitive.number.sudoku');

  return <div ref={fullscreenRootRef} className={'number-grid-game number-grid-phase-' + phase}>
    {phase === 'rules' && <div className="training-panel">
      <BrainTrainingRulesPanel gameId="sudoku" title={title} summaryTitle={title}
        summaryItems={[
          { label: t('cognitive.config.difficulty'), value: t('cognitive.diff.' + difficulty.toLowerCase() as 'cognitive.diff.beginner' | 'cognitive.diff.intermediate' | 'cognitive.diff.advanced') },
          { label: t('cognitive.config.timeLimit'), value: timeLimitSec > 0
            ? t('training.secondsShort', { value: timeLimitSec }) : t('training.unlimited') },
        ]}
        onStart={StartGame} onBack={() => RequestHubTrainingConfiguration()} />
    </div>}

    {phase === 'playing' && state && <main className="number-grid-play">
      <h1>{title}</h1>
      <h2>{kindLabel}</h2>
      <p className="number-grid-progress">
        <span aria-live="polite">
          {t('cognitive.number.moves', { value: state.moves })} | {t('cognitive.number.errors', { value: state.errors })}
        </span>
        {remainingSec !== null && <span aria-live="off">
          {' | '}{t('cognitive.config.timeLimit')}: {t('training.secondsShort', { value: remainingSec })}
        </span>}
      </p>
      <div className="number-grid-scroll" data-number-board-scroll>
        <div className="number-grid-board" style={{ '--number-size': state.size } as CSSProperties}>
          {state.values.map((value, index) => {
            const row = Math.floor(index / state.size);
            const col = index % state.size;
            const given = state.givens[index];
            const boxColumnEnd = state.kind === 'sudoku' && col % 3 === 2;
            const boxRowEnd = state.kind === 'sudoku' && row % 3 === 2;
            return <button key={index} type="button"
              className={'number-grid-cell' + (boxColumnEnd ? ' is-box-column-end' : '') + (boxRowEnd ? ' is-box-row-end' : '')}
              data-number-cell={index} data-number-value={value} data-number-given={given}
              disabled={given}
              aria-label={t(given ? 'cognitive.number.givenCell' : 'cognitive.number.editCell', {
                row: row + 1, col: col + 1, value: value || t('cognitive.number.empty'),
              })}
              onClick={() => HandleCellClick(index)}>{value || ''}</button>;
          })}
        </div>
      </div>
      <button type="button" className="btn btn-ghost" onClick={() => {
        ClearClock();
        RequestHubTrainingConfiguration();
      }}>{t('training.returnHome')}</button>
    </main>}

    {phase === 'results' && result && <div className="experiment-container experiment-container-scrollable number-grid-results">
      <div className="experiment-results">
        <h1>{t(result.Completed ? 'cognitive.results.complete' : 'cognitive.results.ended')}</h1>
        <div className="training-result-summary">
          <span><small>{t('cognitive.results.elapsed')}</small><strong>{t('training.secondsShort', { value: result.Total_Duration_Seconds })}</strong></span>
          <span><small>{t('cognitive.results.result')}</small><strong>{t(result.Completed ? 'cognitive.results.victory' : 'cognitive.results.defeat')}</strong></span>
          <span><small>{t('cognitive.number.rule')}</small><strong>{kindLabel}</strong></span>
          <span><small>{t('cognitive.number.movesLabel')}</small><strong>{result.Moves}</strong></span>
          <span><small>{t('cognitive.number.errorsLabel')}</small><strong>{result.Errors}</strong></span>
          <span><small>{t('cognitive.number.boardSize')}</small><strong>{result.Board_Size} x {result.Board_Size}</strong></span>
          <span><small>{t('cognitive.number.initialBlanks')}</small><strong>{result.Initial_Blanks}</strong></span>
        </div>
        <TrainingResultActions backLabel={t('training.returnHome')} onBackHome={onExit} hubLabel={t('training.returnLobby')} />
      </div>
    </div>}
  </div>;
}
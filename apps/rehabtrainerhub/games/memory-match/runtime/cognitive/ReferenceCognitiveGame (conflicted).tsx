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
import { PlayFailureSound, PlayGameEndSound, PlaySuccessSound, PrepareAudioFeedback } from '../soundManager';
import {
  BuildMemoryResultData,
  CreateMemoryState,
  GetMemoryTimedOutcome,
  HandleMemoryTap,
  UpdateMemoryTimedState,
} from './memoryLogic';
import type { Difficulty, GameResult, MemoryState } from './types';
import './MemoryMatch.css';

type GamePhase = 'rules' | 'playing' | 'results';
type ResultData = ReturnType<typeof BuildMemoryResultData> & { Game_Result: GameResult };
const difficultyNames: Record<'easy' | 'medium' | 'hard', Difficulty> = {
  easy: 'Beginner', medium: 'Intermediate', hard: 'Advanced',
};

export function ReferenceCognitiveGame({ onExit, trainingModuleId = 'thinking-training' }: {
  gameId: 'memory-match';
  onExit: () => void;
  trainingModuleId?: string;
}) {
  const { t } = useT();
  const { fullscreenRootRef, enterTrainingFullscreen } = useFullscreenTrainingRoot<HTMLDivElement>();
  const difficulty = difficultyNames[GetHostedGameSetting<'easy' | 'medium' | 'hard'>('difficulty')];
  const timeLimitSec = GetHostedGameSetting<number>('timeLimitSec');
  const [phase, setPhase] = useState<GamePhase>('rules');
  const phaseRef = useRef<GamePhase>('rules');
  const stateRef = useRef<MemoryState | null>(null);
  const [, setRevision] = useState(0);
  const [result, setResult] = useState<ResultData | null>(null);
  const startedAtRef = useRef(0);
  const mismatchTimerRef = useRef<number | null>(null);
  const clockTimerRef = useRef<number | null>(null);
  const state = stateRef.current;
  const title = t('cognitive.memory.title');

  function ClearTimers() {
    if (mismatchTimerRef.current !== null) window.clearTimeout(mismatchTimerRef.current);
    if (clockTimerRef.current !== null) window.clearInterval(clockTimerRef.current);
    mismatchTimerRef.current = null;
    clockTimerRef.current = null;
  }

  function ChangePhase(next: GamePhase) {
    phaseRef.current = next;
    setPhase(next);
  }

  function FinishGame(outcome: GameResult) {
    if (phaseRef.current !== 'playing' || !stateRef.current) return;
    ChangePhase('results');
    ClearTimers();
    PlayGameEndSound(outcome);
    const elapsedMs = performance.now() - startedAtRef.current;
    const durationSec = Number((Math.max(0, Math.min(elapsedMs, timeLimitSec ? timeLimitSec * 1000 : Infinity)) / 1000).toFixed(1));
    const completed = { Game_Result: outcome, ...BuildMemoryResultData(stateRef.current, durationSec, outcome) };
    setResult(completed);
    void SaveTrainingSessionRecord({
      userName: GetAuthUserNameFromToken() || 'Unknown',
      moduleId: trainingModuleId,
      gameId: 'memory-match',
      gameTitle: title,
      difficulty: 'configured',
      trainingDate: FormatTestDate(new Date()),
      details: completed,
    });
  }

  function CheckTimedState() {
    if (phaseRef.current !== 'playing' || !stateRef.current) return;
    const now = performance.now();
    const outcome = GetMemoryTimedOutcome(stateRef.current, startedAtRef.current, now, timeLimitSec);
    if (outcome) return FinishGame(outcome);
    UpdateMemoryTimedState(stateRef.current, (now - startedAtRef.current) / 1000, () => {
      setRevision((value) => value + 1);
    });
    setRevision((value) => value + 1);
  }

  function StartGame() {
    ClearTimers();
    PrepareAudioFeedback();
    void enterTrainingFullscreen();
    stateRef.current = CreateMemoryState(difficulty);
    startedAtRef.current = performance.now();
    setResult(null);
    ChangePhase('playing');
    if (timeLimitSec > 0) clockTimerRef.current = window.setInterval(CheckTimedState, 250);
  }

  function HandleCardClick(index: number) {
    if (phaseRef.current !== 'playing' || !stateRef.current) return;
    const current = stateRef.current;
    const now = performance.now();
    const outcome = GetMemoryTimedOutcome(current, startedAtRef.current, now, timeLimitSec);
    if (outcome) return FinishGame(outcome);
    UpdateMemoryTimedState(current, (now - startedAtRef.current) / 1000, () => {
      setRevision((value) => value + 1);
    });
    const matchedBefore = current.matchedPairs;
    const errorsBefore = current.errors;
    HandleMemoryTap(current, index, (now - startedAtRef.current) / 1000, FinishGame);
    if (current.matchedPairs > matchedBefore) PlaySuccessSound();
    else if (current.errors > errorsBefore) PlayFailureSound();
    setRevision((value) => value + 1);
    if (current.mismatchClearAt !== null) {
      if (mismatchTimerRef.current !== null) window.clearTimeout(mismatchTimerRef.current);
      mismatchTimerRef.current = window.setTimeout(CheckTimedState,
        Math.max(0, Math.ceil(startedAtRef.current + current.mismatchClearAt * 1000 - performance.now())) + 1);
    }
  }

  useEffect(() => {
    const onVisible = () => { if (!document.hidden) CheckTimedState(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      ClearTimers();
    };
  }, []);
  useTrainingAbort({
    active: phase === 'playing',
    onAbort: () => {
      ClearTimers();
      RequestHubTrainingConfiguration();
    },
  });

  const remainingSec = timeLimitSec > 0
    ? Math.max(0, Math.ceil((startedAtRef.current + timeLimitSec * 1000 - performance.now()) / 1000))
    : null;
  return <div ref={fullscreenRootRef} className={`memory-game memory-phase-${phase}`}>
    {phase === 'rules' && <div className="training-panel">
      <BrainTrainingRulesPanel
        gameId="memory-match"
        title={title}
        summaryTitle={title}
        summaryItems={[
          { label: t('cognitive.config.difficulty'), value: t(`cognitive.diff.${difficulty.toLowerCase()}`) },
          { label: t('cognitive.config.timeLimit'), value: remainingSec === null
            ? t('training.unlimited') : t('training.secondsShort', { value: timeLimitSec }) },
        ]}
        onStart={StartGame}
        onBack={() => RequestHubTrainingConfiguration()}
      />
    </div>}

    {phase === 'playing' && state && <main className="memory-play">
      <h1>{title}</h1>
      <p className="memory-progress">
        <span aria-live="polite">
          {t('cognitive.memory.pairsProgress', { matched: state.matchedPairs, total: state.pairs })}
          {' · '}{t('cognitive.memory.moves', { value: state.moves })}
          {' · '}{t('cognitive.memory.errors', { value: state.errors })}
        </span>
        {remainingSec !== null && <span aria-live="off"> {' · '}{t('cognitive.config.timeLimit')}: {t('training.secondsShort', { value: remainingSec })}</span>}
      </p>
      <div className="memory-board" style={{ '--memory-cols': state.cols } as CSSProperties}>
        {state.cards.map((card, index) => {
          const cardState = card.matched ? 'matched' : card.revealed ? 'revealed' : 'hidden';
          return <button
            key={index}
            type="button"
            className="memory-card"
            data-memory-card={index}
            data-memory-state={cardState}
            disabled={card.matched || state.mismatchClearAt !== null}
            aria-label={t(card.matched ? 'cognitive.memory.matchedCard'
              : card.revealed ? 'cognitive.memory.revealedCard' : 'cognitive.memory.hiddenCard', {
              number: index + 1, value: card.value,
            })}
            onClick={() => HandleCardClick(index)}
          >{card.revealed || card.matched ? card.value : '?'}</button>;
        })}
      </div>
      <button type="button" className="btn btn-ghost" onClick={() => {
        ClearTimers();
        RequestHubTrainingConfiguration();
      }}>{t('training.returnHome')}</button>
    </main>}

    {phase === 'results' && result && <div className="experiment-container experiment-container-scrollable memory-results">
      <div className="experiment-results">
        <h1>{t(result.Game_Result === 'Victory' ? 'cognitive.results.complete' : 'cognitive.results.ended')}</h1>
        <div className="training-result-summary">
          <span><small>{t('cognitive.results.elapsed')}</small><strong>{result.Total_Duration_Seconds} s</strong></span>
          <span><small>{t('cognitive.results.result')}</small><strong>{t(result.Game_Result === 'Victory' ? 'cognitive.results.victory' : 'cognitive.results.defeat')}</strong></span>
          <span><small>{t('cognitive.memory.pairs')}</small><strong>{result.Matched_Pairs} / {result.Target_Pairs}</strong></span>
          <span><small>{t('cognitive.memory.movesLabel')}</small><strong>{result.Moves}</strong></span>
          <span><small>{t('cognitive.memory.errorsLabel')}</small><strong>{result.Errors}</strong></span>
        </div>
        <TrainingResultActions backLabel={t('training.returnHome')} onBackHome={onExit} hubLabel={t('training.returnLobby')} />
      </div>
    </div>}
  </div>;
}

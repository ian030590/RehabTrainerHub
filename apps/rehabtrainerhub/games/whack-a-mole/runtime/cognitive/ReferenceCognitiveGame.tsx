import { GetAuthUserNameFromToken } from '@rehab-trainer/ui/auth/authClient';
import { TrainingResultActions } from '@rehab-trainer/ui/components/TrainingResultActions';
import { GetHostedGameSetting, RequestHubTrainingConfiguration } from '@rehab-trainer/ui/embeddedTraining';
import { useFullscreenTrainingRoot } from '@rehab-trainer/ui/hooks/useFullscreenTrainingRoot';
import { useTrainingAbort } from '@rehab-trainer/ui/hooks/useTrainingAbort';
import { useT } from '@rehab-trainer/ui/i18n/games';
import { SaveTrainingSessionRecord } from '@rehab-trainer/ui/storage/trainingRecords';
import { FormatTestDate } from '@rehab-trainer/ui/trainingGameUtils';
import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { flushSync } from 'react-dom';
import {
  BuildWhackResultData,
  CreateWhackState,
  ExpireWhackTarget,
  HandleWhackTap,
  IsWhackAutoSuccess,
  ShowWhackTarget,
} from '../../TargetClickGame';
import { BrainTrainingRulesPanel } from '../components/rules/BrainTrainingRulesPanel';
import { PlayFailureSound, PlayGameEndSound, PlaySuccessSound, PrepareAudioFeedback } from '../soundManager';
import type { Difficulty, WhackState } from './types';
import './WhackAMole.css';

type GamePhase = 'rules' | 'playing' | 'results';
type ResultData = ReturnType<typeof BuildWhackResultData>;
type FeedbackKey = 'cognitive.whack.waiting' | 'cognitive.whack.hitFeedback'
  | 'cognitive.whack.wrongFeedback' | 'cognitive.whack.expiredFeedback';
const difficultyNames: Record<'easy' | 'medium' | 'hard', Difficulty> = {
  easy: 'Beginner', medium: 'Intermediate', hard: 'Advanced',
};

export function ReferenceCognitiveGame({ onExit, trainingModuleId = 'thinking-training' }: {
  gameId: 'whack-a-mole';
  onExit: () => void;
  trainingModuleId?: string;
}) {
  const { t } = useT();
  const { fullscreenRootRef, enterTrainingFullscreen } = useFullscreenTrainingRoot<HTMLDivElement>();
  const difficulty = difficultyNames[GetHostedGameSetting<'easy' | 'medium' | 'hard'>('difficulty')];
  const durationSec = GetHostedGameSetting<number>('durationSec');
  const [phase, setPhase] = useState<GamePhase>('rules');
  const phaseRef = useRef<GamePhase>('rules');
  const stateRef = useRef<WhackState>(CreateWhackState(difficulty));
  const [, setRevision] = useState(0);
  const [result, setResult] = useState<ResultData | null>(null);
  const [feedback, setFeedback] = useState<FeedbackKey>('cognitive.whack.waiting');
  const startedAtRef = useRef(0);
  const deadlineRef = useRef(0);
  const targetTimerRef = useRef<number | null>(null);
  const durationTimerRef = useRef<number | null>(null);
  const clockTimerRef = useRef<number | null>(null);
  const state = stateRef.current;
  const title = t('cognitive.whack.title');

  function ClearTimers() {
    for (const timer of [targetTimerRef.current, durationTimerRef.current]) {
      if (timer !== null) window.clearTimeout(timer);
    }
    if (clockTimerRef.current !== null) window.clearInterval(clockTimerRef.current);
    targetTimerRef.current = null;
    durationTimerRef.current = null;
    clockTimerRef.current = null;
  }

  function ChangePhase(next: GamePhase) {
    phaseRef.current = next;
    setPhase(next);
  }

  function FinishGame() {
    if (phaseRef.current !== 'playing') return;
    ChangePhase('results');
    ClearTimers();
    if (stateRef.current.activeIndex !== null) ExpireWhackTarget(stateRef.current, deadlineRef.current);
    const outcome = IsWhackAutoSuccess(stateRef.current) ? 'Victory' : 'Defeat';
    PlayGameEndSound(outcome);
    const elapsedSec = Number(((Math.min(performance.now(), deadlineRef.current) - startedAtRef.current) / 1000).toFixed(1));
    const completed = BuildWhackResultData(stateRef.current, elapsedSec, outcome);
    setResult(completed);
    void SaveTrainingSessionRecord({
      userName: GetAuthUserNameFromToken() || 'Unknown',
      moduleId: trainingModuleId,
      gameId: 'whack-a-mole',
      gameTitle: title,
      difficulty: 'configured',
      trainingDate: FormatTestDate(new Date()),
      details: completed.details,
      detailRows: completed.detailRows,
    });
  }

  function ScheduleNextTarget(current: WhackState) {
    if (phaseRef.current !== 'playing') return;
    const delayMs = Math.max(0, current.nextTargetAt - performance.now());
    targetTimerRef.current = window.setTimeout(() => {
      if (phaseRef.current !== 'playing' || stateRef.current !== current) return;
      if (performance.now() >= deadlineRef.current) return FinishGame();
      if (!ShowWhackTarget(current, performance.now())) return;
      setFeedback('cognitive.whack.waiting');
      flushSync(() => setRevision((value) => value + 1));
      const onsetMs = performance.now();
      current.targetStartedAt = onsetMs;
      current.targetExpiresAt = onsetMs + current.targetMs;
      targetTimerRef.current = window.setTimeout(() => {
        if (phaseRef.current !== 'playing' || stateRef.current !== current) return;
        if (performance.now() >= deadlineRef.current) return FinishGame();
        if (ExpireWhackTarget(current, performance.now())) {
          PlayFailureSound();
          setFeedback('cognitive.whack.expiredFeedback');
          setRevision((value) => value + 1);
          ScheduleNextTarget(current);
        }
      }, current.targetMs);
    }, delayMs);
  }

  function StartGame() {
    ClearTimers();
    PrepareAudioFeedback();
    void enterTrainingFullscreen();
    const current = CreateWhackState(difficulty);
    stateRef.current = current;
    startedAtRef.current = performance.now();
    deadlineRef.current = startedAtRef.current + durationSec * 1000;
    setResult(null);
    setFeedback('cognitive.whack.waiting');
    ChangePhase('playing');
    durationTimerRef.current = window.setTimeout(FinishGame, durationSec * 1000);
    clockTimerRef.current = window.setInterval(() => setRevision((value) => value + 1), 1000);
    ScheduleNextTarget(current);
  }

  function HandleCellTap(index: number) {
    if (phaseRef.current !== 'playing') return;
    const nowMs = performance.now();
    if (nowMs >= deadlineRef.current) return FinishGame();
    const current = stateRef.current;
    const tap = HandleWhackTap(current, index, nowMs);
    if (!tap) return;
    if (targetTimerRef.current !== null) window.clearTimeout(targetTimerRef.current);
    if (tap.trial.outcome === 'hit') PlaySuccessSound();
    else PlayFailureSound();
    setFeedback(tap.trial.outcome === 'hit'
      ? 'cognitive.whack.hitFeedback'
      : tap.trial.outcome === 'expired'
        ? 'cognitive.whack.expiredFeedback'
        : 'cognitive.whack.wrongFeedback');
    setRevision((value) => value + 1);
    ScheduleNextTarget(current);
  }

  useEffect(() => () => ClearTimers(), []);
  useTrainingAbort({
    active: phase === 'playing',
    onAbort: () => {
      ClearTimers();
      RequestHubTrainingConfiguration();
    },
  });

  const remainingSec = Math.max(0, Math.ceil((deadlineRef.current - performance.now()) / 1000));
  return <div ref={fullscreenRootRef} className={`cognitive-reference-game whack-game whack-phase-${phase}`}>
    {phase === 'rules' && <div className="training-panel">
      <BrainTrainingRulesPanel
        gameId="whack-a-mole"
        title={title}
        summaryTitle={title}
        summaryItems={[
          { label: t('cognitive.config.difficulty'), value: t(`cognitive.diff.${difficulty.toLowerCase()}`) },
          { label: t('cognitive.config.trainingDuration'), value: t('training.secondsShort', { value: durationSec }) },
        ]}
        onStart={StartGame}
        onBack={() => RequestHubTrainingConfiguration()}
      />
    </div>}

    {phase === 'playing' && <main className="whack-play">
      <h1>{title}</h1>
      <p className="whack-status">
        {t('cognitive.config.trainingDuration')}: {t('training.secondsShort', { value: remainingSec })}
        {' · '}{t('cognitive.results.outcome.hit')}: {state.hits}
        {' · '}{t('cognitive.whack.misses')}: {state.misses}
      </p>
      <div className="whack-board" style={{ '--whack-grid-size': state.gridSize } as CSSProperties}>
        {Array.from({ length: state.gridSize * state.gridSize }, (_, index) => <button
          key={index}
          type="button"
          className="whack-cell"
          data-whack-cell={index}
          data-whack-active={state.activeIndex === index}
          aria-label={t(state.activeIndex === index ? 'cognitive.whack.activeCell' : 'cognitive.whack.cell', {
            row: Math.floor(index / state.gridSize) + 1,
            column: index % state.gridSize + 1,
          })}
          onClick={() => HandleCellTap(index)}
        ><span aria-hidden="true">{state.activeIndex === index ? '●' : ''}</span></button>)}
      </div>
      <p className="whack-feedback" aria-live="polite">{t(feedback)}</p>
      <button type="button" className="btn btn-ghost" onClick={() => {
        ClearTimers();
        RequestHubTrainingConfiguration();
      }}>{t('training.returnHome')}</button>
    </main>}

    {phase === 'results' && result && <div className="experiment-container experiment-container-scrollable cognitive-results-container">
      <div className="experiment-results">
        <h1>{t(result.details.Game_Result === 'Victory' ? 'cognitive.results.complete' : 'cognitive.results.ended')}</h1>
        <div className="training-result-summary">
          <span><small>{t('cognitive.results.elapsed')}</small><strong>{result.details.Total_Duration_Seconds} s</strong></span>
          <span><small>{t('cognitive.results.result')}</small><strong>{t(result.details.Game_Result === 'Victory' ? 'cognitive.results.victory' : 'cognitive.results.defeat')}</strong></span>
        </div>
        <div className="cognitive-trial-results">
          <h2>{t('cognitive.results.trialDetails')}</h2>
          <div className="cognitive-trial-table-scroll">
            <table className="results-table cognitive-trial-results-table">
              <thead><tr><th>{t('cognitive.results.trial')}</th><th>{t('cognitive.results.outcome')}</th><th>{t('cognitive.results.reactionMs')}</th></tr></thead>
              <tbody>{result.detailRows.map((trial) => <tr key={trial.trialNumber}>
                <td>{trial.trialNumber}</td>
                <td>{t(`cognitive.results.outcome.${trial.outcome === 'wrong-tap' ? 'wrongTap' : trial.outcome}`)}</td>
                <td>{trial.responseMs ?? '—'}</td>
              </tr>)}</tbody>
            </table>
          </div>
        </div>
        <TrainingResultActions backLabel={t('training.returnHome')} onBackHome={onExit} hubLabel={t('training.returnLobby')} />
      </div>
    </div>}
  </div>;
}

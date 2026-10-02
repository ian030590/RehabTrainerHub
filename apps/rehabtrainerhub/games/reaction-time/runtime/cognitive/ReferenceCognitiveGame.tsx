import { GetAuthUserNameFromToken } from '@rehab-trainer/ui/auth/authClient';
import { TrainingResultActions } from '@rehab-trainer/ui/components/TrainingResultActions';
import { GetHostedGameSetting, RequestHubTrainingConfiguration } from '@rehab-trainer/ui/embeddedTraining';
import { useFullscreenTrainingRoot } from '@rehab-trainer/ui/hooks/useFullscreenTrainingRoot';
import { useTrainingAbort } from '@rehab-trainer/ui/hooks/useTrainingAbort';
import { useT } from '@rehab-trainer/ui/i18n/games';
import { SaveTrainingSessionRecord } from '@rehab-trainer/ui/storage/trainingRecords';
import { FormatTestDate } from '@rehab-trainer/ui/trainingGameUtils';
import { useEffect, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import {
  BuildReactionResultData,
  CreateReactionState,
  HandleReactionTap,
  IsReactionAutoSuccess,
  MarkReactionGoVisible,
  ShowReactionGo,
  StartReactionAttempt,
  type ReactionDifficulty,
  type ReactionState,
} from '../../ReactionTimeGame';
import { BrainTrainingRulesPanel } from '../components/rules/BrainTrainingRulesPanel';
import { PlayFailureSound, PlayGameEndSound, PlaySuccessSound, PrepareAudioFeedback } from '../soundManager';
import './ReactionTime.css';

type GamePhase = 'rules' | 'playing' | 'results';
type ResultData = ReturnType<typeof BuildReactionResultData>;

export function ReferenceCognitiveGame({ onExit, trainingModuleId = 'thinking-training' }: {
  gameId: 'reaction-time';
  onExit: () => void;
  trainingModuleId?: string;
}) {
  const { t } = useT();
  const { fullscreenRootRef, enterTrainingFullscreen } = useFullscreenTrainingRoot<HTMLDivElement>();
  const difficulty = GetHostedGameSetting<ReactionDifficulty>('difficulty');
  const rounds = GetHostedGameSetting<number>('rounds');
  const timeLimitSec = GetHostedGameSetting<number>('timeLimitSec');
  const [phase, setPhase] = useState<GamePhase>('rules');
  const phaseRef = useRef<GamePhase>('rules');
  const stateRef = useRef<ReactionState>(CreateReactionState(rounds));
  const [, setRevision] = useState(0);
  const [result, setResult] = useState<ResultData | null>(null);
  const startedAtRef = useRef(0);
  const goTimerRef = useRef<number | null>(null);
  const limitTimerRef = useRef<number | null>(null);
  const state = stateRef.current;
  const title = t('cognitive.reaction.title');

  function ClearTimers() {
    if (goTimerRef.current !== null) window.clearTimeout(goTimerRef.current);
    if (limitTimerRef.current !== null) window.clearTimeout(limitTimerRef.current);
    goTimerRef.current = null;
    limitTimerRef.current = null;
  }

  function ChangePhase(next: GamePhase) {
    phaseRef.current = next;
    setPhase(next);
  }

  function FinishGame(outcome: 'Victory' | 'Defeat') {
    if (phaseRef.current !== 'playing') return;
    ChangePhase('results');
    ClearTimers();
    PlayGameEndSound(outcome);
    const durationSec = Number(((performance.now() - startedAtRef.current) / 1000).toFixed(1));
    const completed = BuildReactionResultData(stateRef.current, durationSec, outcome);
    setResult(completed);
    void SaveTrainingSessionRecord({
      userName: GetAuthUserNameFromToken() || 'Unknown',
      moduleId: trainingModuleId,
      gameId: 'reaction-time',
      gameTitle: title,
      difficulty: 'configured',
      trainingDate: FormatTestDate(new Date()),
      details: completed.details,
      detailRows: completed.detailRows,
    });
  }

  function StartGame() {
    ClearTimers();
    PrepareAudioFeedback();
    void enterTrainingFullscreen();
    stateRef.current = CreateReactionState(rounds);
    startedAtRef.current = performance.now();
    setResult(null);
    ChangePhase('playing');
    if (timeLimitSec > 0) {
      limitTimerRef.current = window.setTimeout(() => FinishGame('Defeat'), timeLimitSec * 1000);
    }
  }

  function HandleTargetClick() {
    if (phaseRef.current !== 'playing') return;
    const current = stateRef.current;
    if (current.status === 'waiting' || current.status === 'result' || current.status === 'too-early') {
      const delay = StartReactionAttempt(current, difficulty, performance.now());
      if (delay === null) return;
      goTimerRef.current = window.setTimeout(() => {
        if (phaseRef.current === 'playing' && stateRef.current === current
          && ShowReactionGo(current)) {
          flushSync(() => setRevision((value) => value + 1));
          MarkReactionGoVisible(current, performance.now());
        }
      }, delay);
      setRevision((value) => value + 1);
      return;
    }
    if (current.status === 'ready' && goTimerRef.current !== null) {
      window.clearTimeout(goTimerRef.current);
      goTimerRef.current = null;
    }
    const trial = HandleReactionTap(current, performance.now());
    if (!trial) return;
    if (trial.outcome === 'success') PlaySuccessSound();
    else PlayFailureSound();
    setRevision((value) => value + 1);
    if (IsReactionAutoSuccess(current)) FinishGame('Victory');
  }

  useEffect(() => () => ClearTimers(), []);
  useTrainingAbort({
    active: phase === 'playing',
    onAbort: () => {
      ClearTimers();
      RequestHubTrainingConfiguration();
    },
  });

  const targetLabel = state.status === 'result' && state.lastReactionMs !== null
    ? `${state.lastReactionMs} ms`
    : t(`cognitive.reaction.${state.status === 'too-early' ? 'tooEarly' : state.status}`);
  return <div ref={fullscreenRootRef} className={`cognitive-reference-game reaction-game reaction-phase-${phase}`}>
    {phase === 'rules' && <div className="training-panel">
      <BrainTrainingRulesPanel
        gameId="reaction-time"
        title={title}
        summaryTitle={title}
        summaryItems={[
          { label: t('cognitive.config.difficulty'), value: t(difficulty === 'easy' ? 'cognitive.diff.beginner' : difficulty === 'medium' ? 'cognitive.diff.intermediate' : 'cognitive.diff.advanced') },
          { label: t('cognitive.reaction.targetRounds'), value: `${rounds}` },
          ...(timeLimitSec > 0 ? [{ label: t('cognitive.config.trainingDuration'), value: t('training.secondsShort', { value: timeLimitSec }) }] : []),
        ]}
        onStart={StartGame}
        onBack={() => RequestHubTrainingConfiguration()}
      />
    </div>}

    {phase === 'playing' && <main className="reaction-play">
      <h1>{title}</h1>
      <p>{t('cognitive.reaction.desc')}</p>
      <p className="reaction-progress" aria-live="polite">{state.attempts.length} / {state.targetTrials}</p>
      <button
        type="button"
        className="reaction-target"
        data-reaction-target
        data-reaction-state={state.status}
        onClick={HandleTargetClick}
      >
        {targetLabel}
      </button>
      <button type="button" className="btn btn-ghost" onClick={() => RequestHubTrainingConfiguration()}>
        {t('training.returnHome')}
      </button>
    </main>}

    {phase === 'results' && result && <div className="experiment-container experiment-container-scrollable cognitive-results-container">
      <div className="experiment-results">
        <h1>{result.details.Game_Result === 'Victory' ? t('cognitive.results.complete') : t('cognitive.results.ended')}</h1>
        <div className="training-result-summary">
          <span><small>{t('cognitive.results.elapsed')}</small><strong>{result.details.Total_Duration_Seconds} s</strong></span>
          <span><small>{t('cognitive.results.result')}</small><strong>{result.details.Game_Result === 'Victory' ? t('cognitive.results.victory') : t('cognitive.results.defeat')}</strong></span>
        </div>
        <div className="cognitive-trial-results">
          <h2>{t('cognitive.results.trialDetails')}</h2>
          <div className="cognitive-trial-table-scroll">
            <table className="results-table cognitive-trial-results-table">
              <thead><tr>
                <th>{t('cognitive.results.trial')}</th>
                <th>{t('cognitive.results.outcome')}</th>
                <th>{t('cognitive.reaction.successMs')}</th>
                <th>{t('cognitive.reaction.earlyMs')}</th>
              </tr></thead>
              <tbody>{result.detailRows.map((trial) => <tr key={trial.trialNumber}>
                <td>{trial.trialNumber}</td>
                <td>{trial.outcome === 'success' ? t('cognitive.results.outcome.success') : t('cognitive.results.outcome.falseStart')}</td>
                <td>{trial.responseMs ?? '—'}</td>
                <td>{trial.earlyMs ?? '—'}</td>
              </tr>)}</tbody>
            </table>
          </div>
        </div>
        <TrainingResultActions backLabel={t('training.returnHome')} onBackHome={onExit} hubLabel={t('training.returnLobby')} />
      </div>
    </div>}
  </div>;
}

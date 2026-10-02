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
import { BuildSimonResultData, CreateSimonState, HandleSimonTap } from './trialRecords';
import type { Difficulty, SimonState } from './types';
import './SimonSays.css';

type GamePhase = 'rules' | 'playing' | 'results';
type ResultData = ReturnType<typeof BuildSimonResultData>;
type FeedbackKey = 'cognitive.simon.watch' | 'cognitive.simon.repeat'
  | 'cognitive.simon.correctFeedback' | 'cognitive.simon.wrongFeedback';
const difficultyNames: Record<'easy' | 'medium' | 'hard', Difficulty> = {
  easy: 'Beginner', medium: 'Intermediate', hard: 'Advanced',
};

export function ReferenceCognitiveGame({ onExit, trainingModuleId = 'thinking-training' }: {
  gameId: 'simon-says';
  onExit: () => void;
  trainingModuleId?: string;
}) {
  const { t } = useT();
  const { fullscreenRootRef, enterTrainingFullscreen } = useFullscreenTrainingRoot<HTMLDivElement>();
  const difficulty = difficultyNames[GetHostedGameSetting<'easy' | 'medium' | 'hard'>('difficulty')];
  const lives = GetHostedGameSetting<number>('lives');
  const [phase, setPhase] = useState<GamePhase>('rules');
  const phaseRef = useRef<GamePhase>('rules');
  const stateRef = useRef<SimonState>(CreateSimonState(difficulty, lives));
  const [, setRevision] = useState(0);
  const [feedback, setFeedback] = useState<FeedbackKey>('cognitive.simon.watch');
  const [result, setResult] = useState<ResultData | null>(null);
  const startedAtRef = useRef(0);
  const playbackTimerRef = useRef<number | null>(null);
  const pressTimerRef = useRef<number | null>(null);
  const state = stateRef.current;
  const title = t('cognitive.simon.title');

  function ClearTimers() {
    if (playbackTimerRef.current !== null) window.clearTimeout(playbackTimerRef.current);
    if (pressTimerRef.current !== null) window.clearTimeout(pressTimerRef.current);
    playbackTimerRef.current = null;
    pressTimerRef.current = null;
  }

  function ChangePhase(next: GamePhase) {
    phaseRef.current = next;
    setPhase(next);
  }

  function FinishGame(outcome: 'Victory' | 'Defeat') {
    if (phaseRef.current !== 'playing') return;
    ClearTimers();
    stateRef.current.status = 'ended';
    ChangePhase('results');
    PlayGameEndSound(outcome);
    const durationSec = Number(((performance.now() - startedAtRef.current) / 1000).toFixed(1));
    const completed = BuildSimonResultData(stateRef.current, durationSec, outcome);
    setResult(completed);
    void SaveTrainingSessionRecord({
      userName: GetAuthUserNameFromToken() || 'Unknown',
      moduleId: trainingModuleId,
      gameId: 'simon-says',
      gameTitle: title,
      difficulty: 'configured',
      trainingDate: FormatTestDate(new Date()),
      details: completed.details,
      detailRows: completed.detailRows,
    });
  }

  function PlaySequence(current: SimonState) {
    if (phaseRef.current !== 'playing') return;
    current.status = 'showing';
    current.showIndex = 0;
    current.litIndex = null;
    current.pressedIndex = null;
    setRevision((value) => value + 1);

    function ShowNext() {
      if (phaseRef.current !== 'playing' || stateRef.current !== current) return;
      if (current.showIndex >= current.sequence.length) {
        current.status = 'input';
        current.inputIndex = 0;
        current.attemptStartedAt = performance.now() / 1000;
        current.litIndex = null;
        setFeedback('cognitive.simon.repeat');
        setRevision((value) => value + 1);
        return;
      }
      current.litIndex = current.sequence[current.showIndex];
      current.showIndex += 1;
      setFeedback('cognitive.simon.watch');
      setRevision((value) => value + 1);
      playbackTimerRef.current = window.setTimeout(() => {
        if (phaseRef.current !== 'playing' || stateRef.current !== current) return;
        current.litIndex = null;
        setRevision((value) => value + 1);
        playbackTimerRef.current = window.setTimeout(ShowNext, 140);
      }, 360);
    }

    playbackTimerRef.current = window.setTimeout(ShowNext, 350);
  }

  function StartGame() {
    ClearTimers();
    PrepareAudioFeedback();
    void enterTrainingFullscreen();
    const current = CreateSimonState(difficulty, lives);
    stateRef.current = current;
    startedAtRef.current = performance.now();
    setResult(null);
    setFeedback('cognitive.simon.watch');
    ChangePhase('playing');
    PlaySequence(current);
  }

  function HandlePadClick(index: number) {
    if (phaseRef.current !== 'playing') return;
    const current = stateRef.current;
    const response = HandleSimonTap(current, index, performance.now() / 1000);
    if (!response.accepted) return;
    if (pressTimerRef.current !== null) window.clearTimeout(pressTimerRef.current);
    if (response.trial?.correct === false) {
      PlayFailureSound();
      setFeedback('cognitive.simon.wrongFeedback');
    } else {
      PlaySuccessSound();
      setFeedback(response.trial ? 'cognitive.simon.correctFeedback' : 'cognitive.simon.repeat');
    }
    setRevision((value) => value + 1);
    if (response.gameResult) return FinishGame(response.gameResult);
    if (response.trial) return PlaySequence(current);
    pressTimerRef.current = window.setTimeout(() => {
      if (phaseRef.current !== 'playing' || stateRef.current !== current) return;
      current.pressedIndex = null;
      setRevision((value) => value + 1);
    }, 180);
  }

  useEffect(() => () => ClearTimers(), []);
  useTrainingAbort({
    active: phase === 'playing',
    onAbort: () => {
      ClearTimers();
      RequestHubTrainingConfiguration();
    },
  });

  return <div ref={fullscreenRootRef} className={`cognitive-reference-game simon-game simon-phase-${phase}`}>
    {phase === 'rules' && <div className="training-panel">
      <BrainTrainingRulesPanel
        gameId="simon-says"
        title={title}
        summaryTitle={title}
        summaryItems={[
          { label: t('cognitive.config.difficulty'), value: t(`cognitive.diff.${difficulty.toLowerCase()}`) },
          { label: t('cognitive.config.lives'), value: String(lives) },
        ]}
        onStart={StartGame}
        onBack={() => RequestHubTrainingConfiguration()}
      />
    </div>}

    {phase === 'playing' && <main className="simon-play" data-simon-phase={state.status}>
      <h1>{title}</h1>
      <p>{t('cognitive.simon.desc')}</p>
      <p className="simon-progress">
        {t('cognitive.simon.sequenceLength', { value: state.sequence.length })}
        {' · '}{t('cognitive.play.livesRemaining', { count: state.lives })}
      </p>
      <div className="simon-board">
        {Array.from({ length: 4 }, (_, index) => <button
          key={index}
          type="button"
          className="simon-pad"
          data-simon-button={index}
          data-simon-lit={state.litIndex === index}
          data-simon-pressed={state.pressedIndex === index}
          disabled={state.status !== 'input'}
          aria-label={t('cognitive.simon.pad', { value: index + 1 })}
          onClick={() => HandlePadClick(index)}
        >{index + 1}</button>)}
      </div>
      <p className="simon-feedback" aria-live="polite">{t(feedback)}</p>
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
              <thead><tr>
                <th>{t('cognitive.results.trial')}</th>
                <th>{t('cognitive.results.memoryLength')}</th>
                <th>{t('cognitive.results.correct')}</th>
                <th>{t('cognitive.results.durationMs')}</th>
              </tr></thead>
              <tbody>{result.detailRows.map((trial) => <tr key={trial.trialNumber}>
                <td>{trial.trialNumber}</td>
                <td>{trial.memoryLength}</td>
                <td>{t(trial.correct === 1 ? 'cognitive.results.yes' : 'cognitive.results.no')}</td>
                <td>{trial.durationMs}</td>
              </tr>)}</tbody>
            </table>
          </div>
        </div>
        <TrainingResultActions backLabel={t('training.returnHome')} onBackHome={onExit} hubLabel={t('training.returnLobby')} />
      </div>
    </div>}
  </div>;
}

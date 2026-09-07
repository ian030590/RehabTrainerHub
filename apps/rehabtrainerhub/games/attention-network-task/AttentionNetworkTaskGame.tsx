// Canonical Hub-owned brain Attention Network Task (ANT) runtime.
import {
  type CSSProperties,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { initJsPsych } from 'jspsych';
import { GetAuthUserNameFromToken } from '@rehab-trainer/ui/auth/authClient';
import { useT } from '@rehab-trainer/ui/i18n/games';
import { PlayFailureSound, PlayGameEndSound, PlaySuccessSound, PrepareAudioFeedback } from '@rehab-trainer/ui/soundManager';
import { SaveTrainingSessionRecord } from '@rehab-trainer/ui/storage/trainingRecords';
import { FormatTestDate } from '@rehab-trainer/ui/trainingGameUtils';
import { JsPsychExternalLifecycle } from '@rehab-trainer/ui/jsPsychLifecycle';
import { TrainingConfigNavigationActions } from '@rehab-trainer/ui/components/TrainingConfigNavigationActions';
import {
  TrainingConfigOptionGroup,
  TrainingConfigPanel,
  TrainingConfigSection,
} from '@rehab-trainer/ui/components/TrainingConfigPanel';
import { TrainingResultActions } from '@rehab-trainer/ui/components/TrainingResultActions';
import { useFullscreenTrainingRoot } from '@rehab-trainer/ui/hooks/useFullscreenTrainingRoot';
import { useTrainingConfigReady } from '@rehab-trainer/ui/hooks/useTrainingConfigReady';
import { useHostedGameSettings } from '@rehab-trainer/ui/hooks/useHostedGameSettings';
import { useTrainingAbort } from '@rehab-trainer/ui/hooks/useTrainingAbort';
import { BrainTrainingRulesPanel } from '@rehab-trainer/ui/components/rules/BrainTrainingRulesPanel';
import '@rehab-trainer/ui/cognitive/ThinkingGames.css';

export type AntCueCondition = 'no-cue' | 'center-cue' | 'double-cue' | 'spatial-cue';
export type AntFlankerCondition = 'congruent' | 'incongruent' | 'neutral';
export type ArrowDirection = 'left' | 'right';
type AntPhase = 'menu' | 'rules' | 'playing' | 'results';

interface AttentionNetworkTaskGameProps {
  onExit: () => void;
}

interface AntTrial {
  trialNumber: number;
  cueType: AntCueCondition;
  flankerType: AntFlankerCondition;
  targetDirection: ArrowDirection;
  targetLocation: 'top' | 'bottom';
  responded: boolean;
  correct: boolean;
  reactionTimeMs: number | null;
}

interface AntSessionRecord {
  totalRounds: number;
  correctCount: number;
  accuracyPercent: number;
  meanRtMs: number;
  alertingEffectMs: number;
  orientingEffectMs: number;
  conflictCostMs: number;
  trials: AntTrial[];
}

export function AttentionNetworkTaskGame({ onExit }: AttentionNetworkTaskGameProps) {
  const { lang, t } = useT();
  const isZh = lang !== 'en';
  const { fullscreenRootRef, enterTrainingFullscreen } = useFullscreenTrainingRoot();

  const handleExitTraining = useCallback(() => {
    jsPsychLifecycleRef.current?.abort({ abort_reason: 'return-to-menu' });
    onExit();
  }, [onExit]);
  useTrainingAbort(handleExitTraining);

  const jsPsychHostRef = useRef<HTMLDivElement | null>(null);
  const jsPsychRef = useRef<ReturnType<typeof initJsPsych> | null>(null);
  const jsPsychLifecycleRef = useRef<JsPsychExternalLifecycle | null>(null);

  const [phase, setPhase] = useState<AntPhase>('menu');
  const [difficulty, setDifficulty] = useState<'standard' | 'spatial' | 'double'>('standard');
  const [rounds, setRounds] = useState(24);
  const [stimulusDurationMs, setStimulusDurationMs] = useState(1800);
  const [soundEnabled, setSoundEnabled] = useState(true);

  const hostedSettings = useHostedGameSettings();
  const hostedSettingsAppliedRef = useRef(false);
  useTrainingConfigReady(phase === 'menu');

  const [currentTrialIndex, setCurrentTrialIndex] = useState(0);
  const [trials, setTrials] = useState<AntTrial[]>([]);
  const [trialStage, setTrialStage] = useState<'fixation' | 'cue' | 'post-cue' | 'target'>('fixation');
  const [trialFeedback, setTrialFeedback] = useState<'correct' | 'incorrect' | null>(null);
  const [results, setResults] = useState<AntSessionRecord | null>(null);

  const trialStartTimeRef = useRef<number>(0);
  const trialTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cueTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const currentTrialAnsweredRef = useRef(false);

  useEffect(() => {
    if (!hostedSettings || hostedSettingsAppliedRef.current) return;
    hostedSettingsAppliedRef.current = true;
    if (hostedSettings.difficulty === 'standard' || hostedSettings.difficulty === 'spatial' || hostedSettings.difficulty === 'double') {
      setDifficulty(hostedSettings.difficulty);
    }
    if (typeof hostedSettings.rounds === 'number' && hostedSettings.rounds >= 12 && hostedSettings.rounds <= 48) {
      setRounds(hostedSettings.rounds);
    }
    if (typeof hostedSettings.stimulusDurationMs === 'number') {
      setStimulusDurationMs(hostedSettings.stimulusDurationMs);
    }
    if (typeof hostedSettings.soundEnabled === 'boolean') {
      setSoundEnabled(hostedSettings.soundEnabled);
    }
    setPhase('rules');
  }, [hostedSettings]);

  useEffect(() => {
    const host = jsPsychHostRef.current;
    if (!host) return;
    const jsPsych = initJsPsych({ display_element: host });
    const lifecycle = new JsPsychExternalLifecycle(jsPsych);
    jsPsychRef.current = jsPsych;
    jsPsychLifecycleRef.current = lifecycle;
    return () => {
      lifecycle.dispose();
      if (jsPsychRef.current === jsPsych) jsPsychRef.current = null;
      if (jsPsychLifecycleRef.current === lifecycle) jsPsychLifecycleRef.current = null;
    };
  }, []);

  const activeTrial = trials[currentTrialIndex] ?? null;

  const clearAllTimers = useCallback(() => {
    if (trialTimeoutRef.current) {
      clearTimeout(trialTimeoutRef.current);
      trialTimeoutRef.current = null;
    }
    if (cueTimerRef.current) {
      clearTimeout(cueTimerRef.current);
      cueTimerRef.current = null;
    }
  }, []);

  const completeSession = useCallback((finalTrials: AntTrial[]) => {
    const totalRounds = finalTrials.length;
    const correctTrials = finalTrials.filter((t) => t.correct);
    const correctCount = correctTrials.length;
    const accuracyPercent = Math.round((correctCount / Math.max(1, totalRounds)) * 100);

    const validRts = correctTrials.filter((t) => t.reactionTimeMs !== null).map((t) => t.reactionTimeMs as number);
    const meanRtMs = validRts.length > 0 ? Math.round(validRts.reduce((a, b) => a + b, 0) / validRts.length) : 0;

    // Attention Network metrics
    const getMeanRtFor = (filterFn: (t: AntTrial) => boolean) => {
      const subset = correctTrials.filter(filterFn).map((t) => t.reactionTimeMs as number);
      return subset.length > 0 ? subset.reduce((a, b) => a + b, 0) / subset.length : meanRtMs;
    };

    const noCueRt = getMeanRtFor((t) => t.cueType === 'no-cue');
    const doubleCueRt = getMeanRtFor((t) => t.cueType === 'double-cue');
    const centerCueRt = getMeanRtFor((t) => t.cueType === 'center-cue');
    const spatialCueRt = getMeanRtFor((t) => t.cueType === 'spatial-cue');
    const incongRt = getMeanRtFor((t) => t.flankerType === 'incongruent');
    const congRt = getMeanRtFor((t) => t.flankerType === 'congruent');

    const alertingEffectMs = Math.round(Math.max(0, noCueRt - doubleCueRt));
    const orientingEffectMs = Math.round(Math.max(0, centerCueRt - spatialCueRt));
    const conflictCostMs = Math.round(Math.max(0, incongRt - congRt));

    const record: AntSessionRecord = {
      totalRounds,
      correctCount,
      accuracyPercent,
      meanRtMs,
      alertingEffectMs,
      orientingEffectMs,
      conflictCostMs,
      trials: finalTrials,
    };

    jsPsychLifecycleRef.current?.finish(record as unknown as Record<string, unknown>);
    PlayGameEndSound('Victory', jsPsychRef);
    setResults(record);
    setPhase('results');

    const participantId = GetAuthUserNameFromToken() || 'Unknown';
    void SaveTrainingSessionRecord({
      gameId: 'attention-network-task',
      gameTitle: isZh ? '注意網絡測驗 (ANT)' : 'Attention Network Task',
      category: 'attention',
      score: accuracyPercent,
      metrics: {
        totalRounds,
        accuracyPercent,
        meanRtMs,
        alertingEffectMs,
        orientingEffectMs,
        conflictCostMs,
      },
      participantId,
      notes: isZh
        ? `正確率: ${accuracyPercent}%, 平均RT: ${meanRtMs}ms, 警覺效應: ${alertingEffectMs}ms, 定向效應: ${orientingEffectMs}ms, 衝突干擾耗時: ${conflictCostMs}ms`
        : `Acc: ${accuracyPercent}%, RT: ${meanRtMs}ms, Alerting: ${alertingEffectMs}ms, Orienting: ${orientingEffectMs}ms, Conflict: ${conflictCostMs}ms`,
    });
  }, [isZh]);

  const advanceTrial = useCallback((updatedTrial: AntTrial) => {
    const nextIndex = currentTrialIndex + 1;
    if (nextIndex >= trials.length) {
      completeSession([...trials.slice(0, currentTrialIndex), updatedTrial]);
    } else {
      setCurrentTrialIndex(nextIndex);
      startTrialTimeline(trials, nextIndex);
    }
  }, [completeSession, currentTrialIndex, trials]);

  const handleResponse = useCallback((chosenDirection: ArrowDirection) => {
    if (phase !== 'playing' || trialStage !== 'target' || !activeTrial || currentTrialAnsweredRef.current) return;
    currentTrialAnsweredRef.current = true;
    clearAllTimers();

    const rt = Math.max(1, Math.round(performance.now() - trialStartTimeRef.current));
    const isCorrect = chosenDirection === activeTrial.targetDirection;

    if (soundEnabled) {
      if (isCorrect) PlaySuccessSound(jsPsychRef);
      else PlayFailureSound(jsPsychRef);
    }

    setTrialFeedback(isCorrect ? 'correct' : 'incorrect');

    const updatedTrial: AntTrial = {
      ...activeTrial,
      responded: true,
      correct: isCorrect,
      reactionTimeMs: rt,
    };

    setTrials((prev) => {
      const copy = [...prev];
      copy[currentTrialIndex] = updatedTrial;
      return copy;
    });

    setTimeout(() => {
      setTrialFeedback(null);
      advanceTrial(updatedTrial);
    }, 280);
  }, [activeTrial, advanceTrial, clearAllTimers, currentTrialIndex, phase, soundEnabled, trialStage]);

  const handleTimeout = useCallback(() => {
    if (phase !== 'playing' || trialStage !== 'target' || !activeTrial || currentTrialAnsweredRef.current) return;
    currentTrialAnsweredRef.current = true;
    clearAllTimers();

    if (soundEnabled) {
      PlayFailureSound(jsPsychRef);
    }

    setTrialFeedback('incorrect');

    const updatedTrial: AntTrial = {
      ...activeTrial,
      responded: false,
      correct: false,
      reactionTimeMs: null,
    };

    setTrials((prev) => {
      const copy = [...prev];
      copy[currentTrialIndex] = updatedTrial;
      return copy;
    });

    setTimeout(() => {
      setTrialFeedback(null);
      advanceTrial(updatedTrial);
    }, 280);
  }, [activeTrial, advanceTrial, clearAllTimers, currentTrialIndex, phase, soundEnabled, trialStage]);

  const startTrialTimeline = useCallback((trialList: AntTrial[], index: number) => {
    const trial = trialList[index];
    if (!trial) return;

    currentTrialAnsweredRef.current = true;
    setTrialStage('fixation');

    // Fixation (400ms) -> Cue (150ms) -> Post-cue fixation (400ms) -> Target
    setTimeout(() => {
      setTrialStage('cue');

      setTimeout(() => {
        setTrialStage('post-cue');

        setTimeout(() => {
          setTrialStage('target');
          currentTrialAnsweredRef.current = false;
          trialStartTimeRef.current = performance.now();

          trialTimeoutRef.current = setTimeout(() => {
            handleTimeout();
          }, stimulusDurationMs);
        }, 400);
      }, 150);
    }, 400);
  }, [handleTimeout, stimulusDurationMs]);

  useEffect(() => {
    if (phase !== 'playing') return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        handleResponse('left');
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        handleResponse('right');
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleResponse, phase]);

  const startGame = useCallback(() => {
    PrepareAudioFeedback();
    const generatedTrials = GenerateAntTrials(rounds, difficulty);
    setTrials(generatedTrials);
    setCurrentTrialIndex(0);
    setResults(null);
    setTrialFeedback(null);
    setPhase('playing');

    jsPsychLifecycleRef.current?.start({
      difficulty,
      rounds,
      stimulusDurationMs,
    });

    startTrialTimeline(generatedTrials, 0);
  }, [difficulty, rounds, startTrialTimeline, stimulusDurationMs]);

  const configOptions = useMemo(() => {
    const diffOptions = [
      { id: 'standard', label: isZh ? '標準模式（綜合提示）' : 'Standard (Mixed Cues)' },
      { id: 'spatial', label: isZh ? '空間聚焦（上下空間提示）' : 'Spatial Focus' },
      { id: 'double', label: isZh ? '警覺加強（雙重警示）' : 'Alerting Focus' },
    ];
    const durOptions = [
      { id: '1400', label: isZh ? '1.4 秒（緊湊）' : '1.4 seconds (Fast)' },
      { id: '1800', label: isZh ? '1.8 秒（標準）' : '1.8 seconds (Standard)' },
      { id: '2400', label: isZh ? '2.4 秒（從容）' : '2.4 seconds (Relaxed)' },
    ];
    return { diffOptions, durOptions };
  }, [isZh]);

  return (
    <div
      ref={fullscreenRootRef}
      className="cognitive-reference-game"
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100dvh',
        width: '100vw',
        background: 'var(--bg)',
        color: 'var(--text-primary)',
        fontFamily: 'var(--font-family)',
        userSelect: 'none',
      }}
    >
      <div ref={jsPsychHostRef} style={{ display: 'none' }} />

      {phase === 'menu' && (
        <TrainingConfigPanel
          title={isZh ? '注意網絡測驗 (ANT)' : 'Attention Network Task'}
          subtitle={isZh ? '居家警覺、空間定向與衝突干擾控制練習' : 'Alerting, orienting, and executive control activity'}
        >
          <TrainingConfigSection title={isZh ? '提示模式' : 'Cue Condition'}>
            <TrainingConfigOptionGroup
              options={configOptions.diffOptions}
              value={difficulty}
              onChange={(val) => setDifficulty(val as 'standard' | 'spatial' | 'double')}
            />
          </TrainingConfigSection>

          <TrainingConfigSection title={isZh ? '回合題數' : 'Trial Count'}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '8px 0' }}>
              <input
                type="range"
                min={12}
                max={48}
                step={6}
                value={rounds}
                onChange={(e) => setRounds(Number(e.target.value))}
                style={{ flex: 1, accentColor: 'var(--accent)', cursor: 'pointer' }}
              />
              <span style={{ minWidth: '60px', fontWeight: 700, fontSize: '18px' }}>
                {rounds} {isZh ? '題' : 'trials'}
              </span>
            </div>
          </TrainingConfigSection>

          <TrainingConfigSection title={isZh ? '反應時限' : 'Response Window'}>
            <TrainingConfigOptionGroup
              options={configOptions.durOptions}
              value={String(stimulusDurationMs)}
              onChange={(val) => setStimulusDurationMs(Number(val))}
            />
          </TrainingConfigSection>

          <TrainingConfigSection title={isZh ? '聲音設定' : 'Sound Settings'}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer', fontSize: '16px' }}>
              <input
                type="checkbox"
                checked={soundEnabled}
                onChange={(e) => setSoundEnabled(e.target.checked)}
                style={{ width: '20px', height: '20px', accentColor: 'var(--accent)' }}
              />
              <span>{isZh ? '啟用音效提示' : 'Enable audio feedback'}</span>
            </label>
          </TrainingConfigSection>

          <TrainingConfigNavigationActions
            onPrimaryAction={() => {
              void enterTrainingFullscreen();
              setPhase('rules');
            }}
            primaryLabel={isZh ? '閱讀規則' : 'Read Rules'}
            onSecondaryAction={handleExitTraining}
            secondaryLabel={isZh ? '返回大廳' : 'Return to Lobby'}
          />
        </TrainingConfigPanel>
      )}

      {phase === 'rules' && (
        <BrainTrainingRulesPanel
          gameId="attention-network-task"
          onStart={() => void startGame()}
          onBack={() => setPhase('menu')}
        />
      )}

      {phase === 'playing' && (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'space-between',
            width: '100%',
            maxWidth: '680px',
            height: '92dvh',
            padding: '20px 16px',
            boxSizing: 'border-box',
          }}
        >
          {/* Top Status */}
          <div
            style={{
              width: '100%',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '12px 20px',
              background: 'var(--card-bg)',
              borderRadius: '16px',
              fontSize: '18px',
              fontWeight: 700,
            }}
          >
            <span>
              {isZh ? '進度' : 'Trial'}: {currentTrialIndex + 1} / {trials.length}
            </span>
            <span style={{ color: 'var(--accent)' }}>
              {isZh ? '專注正中央箭頭' : 'Focus on Center Arrow'}
            </span>
          </div>

          {/* Center Spatial Stage (Top location, Center fixation, Bottom location) */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'space-around',
              width: '100%',
              maxWidth: '520px',
              height: '340px',
              borderRadius: '28px',
              background: trialFeedback === 'correct'
                ? 'rgba(34, 197, 94, 0.12)'
                : trialFeedback === 'incorrect'
                ? 'rgba(239, 68, 68, 0.15)'
                : 'var(--card-bg)',
              border: trialFeedback === 'correct'
                ? '4px solid #22c55e'
                : trialFeedback === 'incorrect'
                ? '4px solid #ef4444'
                : '3px solid var(--border)',
              transition: 'all 0.15s ease',
              padding: '20px 0',
              boxSizing: 'border-box',
              position: 'relative',
            }}
          >
            {/* Top Location Slot */}
            <div style={{ height: '70px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {trialStage === 'cue' && activeTrial && (
                (activeTrial.cueType === 'double-cue') ||
                (activeTrial.cueType === 'spatial-cue' && activeTrial.targetLocation === 'top')
              ) && <AntAsterisk />}

              {trialStage === 'target' && activeTrial && activeTrial.targetLocation === 'top' && (
                <AntStimulusRow
                  direction={activeTrial.targetDirection}
                  flanker={activeTrial.flankerType}
                />
              )}
            </div>

            {/* Center Fixation Slot */}
            <div style={{ height: '60px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {trialStage === 'cue' && activeTrial?.cueType === 'center-cue' ? (
                <AntAsterisk />
              ) : (
                <span style={{ fontSize: '48px', fontWeight: 900, color: 'var(--text-secondary)' }}>+</span>
              )}
            </div>

            {/* Bottom Location Slot */}
            <div style={{ height: '70px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {trialStage === 'cue' && activeTrial && (
                (activeTrial.cueType === 'double-cue') ||
                (activeTrial.cueType === 'spatial-cue' && activeTrial.targetLocation === 'bottom')
              ) && <AntAsterisk />}

              {trialStage === 'target' && activeTrial && activeTrial.targetLocation === 'bottom' && (
                <AntStimulusRow
                  direction={activeTrial.targetDirection}
                  flanker={activeTrial.flankerType}
                />
              )}
            </div>
          </div>

          {/* Bottom Action Direction Buttons */}
          <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ textAlign: 'center', fontSize: '15px', color: 'var(--text-secondary)' }}>
              {isZh ? '判斷「最中間箭頭」的方向（忽略兩旁箭頭或破折號）' : 'Identify the CENTER arrow direction'}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <button
                type="button"
                onClick={() => handleResponse('left')}
                disabled={trialStage !== 'target' || currentTrialAnsweredRef.current}
                style={{
                  minHeight: '76px',
                  fontSize: '24px',
                  fontWeight: 900,
                  borderRadius: '18px',
                  border: '3px solid var(--accent)',
                  background: 'var(--card-bg)',
                  color: 'var(--text-primary)',
                  cursor: trialStage !== 'target' || currentTrialAnsweredRef.current ? 'not-allowed' : 'pointer',
                  opacity: trialStage !== 'target' || currentTrialAnsweredRef.current ? 0.6 : 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '12px',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                }}
              >
                <span style={{ fontSize: '32px' }}>←</span>
                <span>{isZh ? '向左' : 'Left'}</span>
              </button>

              <button
                type="button"
                onClick={() => handleResponse('right')}
                disabled={trialStage !== 'target' || currentTrialAnsweredRef.current}
                style={{
                  minHeight: '76px',
                  fontSize: '24px',
                  fontWeight: 900,
                  borderRadius: '18px',
                  border: '3px solid var(--accent)',
                  background: 'var(--card-bg)',
                  color: 'var(--text-primary)',
                  cursor: trialStage !== 'target' || currentTrialAnsweredRef.current ? 'not-allowed' : 'pointer',
                  opacity: trialStage !== 'target' || currentTrialAnsweredRef.current ? 0.6 : 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '12px',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                }}
              >
                <span>{isZh ? '向右' : 'Right'}</span>
                <span style={{ fontSize: '32px' }}>→</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {phase === 'results' && results && (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            width: '100%',
            maxWidth: '640px',
            padding: '24px 16px',
            boxSizing: 'border-box',
          }}
        >
          <div
            style={{
              width: '100%',
              background: 'var(--card-bg)',
              borderRadius: '24px',
              padding: '28px 24px',
              boxSizing: 'border-box',
              display: 'flex',
              flexDirection: 'column',
              gap: '20px',
              boxShadow: '0 8px 32px rgba(0,0,0,0.15)',
            }}
          >
            <div style={{ textAlign: 'center' }}>
              <h2 style={{ fontSize: '26px', fontWeight: 900, margin: '0 0 8px 0' }}>
                {isZh ? '練習完成：成果回饋' : 'Session Complete: Results'}
              </h2>
              <p style={{ color: 'var(--text-secondary)', fontSize: '15px', margin: 0 }}>
                {isZh ? '注意網絡測驗 (ANT) 當次紀錄換算參考值' : 'Attention Network Task performance metrics'}
              </p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div style={{ padding: '16px', background: 'var(--bg)', borderRadius: '16px', textAlign: 'center' }}>
                <div style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>
                  {isZh ? '反應正確率' : 'Accuracy'}
                </div>
                <div style={{ fontSize: '36px', fontWeight: 900, color: 'var(--accent)', marginTop: '4px' }}>
                  {results.accuracyPercent}%
                </div>
                <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                  {results.correctCount} / {results.totalRounds} {isZh ? '題答對' : 'correct'}
                </div>
              </div>

              <div style={{ padding: '16px', background: 'var(--bg)', borderRadius: '16px', textAlign: 'center' }}>
                <div style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>
                  {isZh ? '平均反應時間' : 'Mean RT'}
                </div>
                <div style={{ fontSize: '36px', fontWeight: 900, marginTop: '4px' }}>
                  {results.meanRtMs} <span style={{ fontSize: '18px' }}>ms</span>
                </div>
                <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>{isZh ? '毫秒' : 'milliseconds'}</div>
              </div>

              <div style={{ padding: '16px', background: 'var(--bg)', borderRadius: '16px', textAlign: 'center' }}>
                <div style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>
                  {isZh ? '警覺網絡效益 (Alerting)' : 'Alerting Effect'}
                </div>
                <div style={{ fontSize: '32px', fontWeight: 900, color: '#38bdf8', marginTop: '4px' }}>
                  {results.alertingEffectMs} <span style={{ fontSize: '16px' }}>ms</span>
                </div>
                <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                  {isZh ? '無提示 vs 雙提示' : 'No cue vs Double cue'}
                </div>
              </div>

              <div style={{ padding: '16px', background: 'var(--bg)', borderRadius: '16px', textAlign: 'center' }}>
                <div style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>
                  {isZh ? '定向網絡效益 (Orienting)' : 'Orienting Effect'}
                </div>
                <div style={{ fontSize: '32px', fontWeight: 900, color: '#10b981', marginTop: '4px' }}>
                  {results.orientingEffectMs} <span style={{ fontSize: '16px' }}>ms</span>
                </div>
                <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                  {isZh ? '中央提示 vs 空間提示' : 'Center cue vs Spatial cue'}
                </div>
              </div>
            </div>

            <TrainingResultActions
              onPrimaryAction={() => void startGame()}
              primaryLabel={isZh ? '再練一次' : 'Train Again'}
              onSecondaryAction={handleExitTraining}
              secondaryLabel={isZh ? '返回大廳' : 'Return to Lobby'}
            />
          </div>
        </div>
      )}
    </div>
  );
}

function AntAsterisk() {
  return (
    <span style={{ fontSize: '42px', fontWeight: 900, color: '#fbbf24', lineHeight: 1 }}>*</span>
  );
}

function AntArrow({ direction }: { direction: ArrowDirection }) {
  return (
    <span style={{ fontSize: '38px', fontWeight: 900, color: 'var(--accent)', margin: '0 4px', lineHeight: 1 }}>
      {direction === 'left' ? '←' : '→'}
    </span>
  );
}

function AntDash() {
  return (
    <span style={{ fontSize: '38px', fontWeight: 900, color: 'var(--text-secondary)', margin: '0 6px', lineHeight: 1 }}>
      —
    </span>
  );
}

function AntStimulusRow({
  direction,
  flanker,
}: {
  direction: ArrowDirection;
  flanker: AntFlankerCondition;
}) {
  const oppositeDir: ArrowDirection = direction === 'left' ? 'right' : 'left';

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      {flanker === 'neutral' ? (
        <>
          <AntDash />
          <AntDash />
          <AntArrow direction={direction} />
          <AntDash />
          <AntDash />
        </>
      ) : flanker === 'congruent' ? (
        <>
          <AntArrow direction={direction} />
          <AntArrow direction={direction} />
          <AntArrow direction={direction} />
          <AntArrow direction={direction} />
          <AntArrow direction={direction} />
        </>
      ) : (
        <>
          <AntArrow direction={oppositeDir} />
          <AntArrow direction={oppositeDir} />
          <AntArrow direction={direction} />
          <AntArrow direction={oppositeDir} />
          <AntArrow direction={oppositeDir} />
        </>
      )}
    </div>
  );
}

function GenerateAntTrials(rounds: number, difficulty: 'standard' | 'spatial' | 'double'): AntTrial[] {
  const trials: AntTrial[] = [];
  const cuePool: AntCueCondition[] =
    difficulty === 'spatial'
      ? ['spatial-cue', 'spatial-cue', 'center-cue', 'no-cue']
      : difficulty === 'double'
      ? ['double-cue', 'double-cue', 'no-cue', 'center-cue']
      : ['no-cue', 'center-cue', 'double-cue', 'spatial-cue'];

  const flankerPool: AntFlankerCondition[] = ['congruent', 'incongruent', 'neutral'];

  for (let i = 0; i < rounds; i++) {
    const cueType = cuePool[i % cuePool.length];
    const flankerType = flankerPool[Math.floor(Math.random() * flankerPool.length)];
    const targetDirection: ArrowDirection = Math.random() < 0.5 ? 'left' : 'right';
    const targetLocation: 'top' | 'bottom' = Math.random() < 0.5 ? 'top' : 'bottom';

    trials.push({
      trialNumber: i + 1,
      cueType,
      flankerType,
      targetDirection,
      targetLocation,
      responded: false,
      correct: false,
      reactionTimeMs: null,
    });
  }

  return trials.sort(() => Math.random() - 0.5);
}

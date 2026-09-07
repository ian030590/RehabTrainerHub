// Canonical Hub-owned brain Stop-Signal Task (SST) response inhibition runtime.
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

export type StopSignalDifficulty = 'easy' | 'medium' | 'hard';
type StopSignalPhase = 'menu' | 'rules' | 'playing' | 'results';
type ArrowDirection = 'left' | 'right';
type TrialType = 'go' | 'stop';

interface StopSignalGameProps {
  onExit: () => void;
}

interface StopSignalTrial {
  trialNumber: number;
  trialType: TrialType;
  direction: ArrowDirection;
  ssdMs: number;
  responded: boolean;
  responseDirection: ArrowDirection | null;
  correct: boolean;
  reactionTimeMs: number | null;
}

interface StopSignalSessionRecord {
  totalRounds: number;
  difficulty: StopSignalDifficulty;
  ssdMs: number;
  goCount: number;
  stopCount: number;
  goHitCount: number;
  goAccuracyPercent: number;
  stopInhibitionCount: number;
  stopInhibitionRatePercent: number;
  meanGoRtMs: number;
  estimatedSsrtMs: number;
  trials: StopSignalTrial[];
}

export function StopSignalGame({ onExit }: StopSignalGameProps) {
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

  const [phase, setPhase] = useState<StopSignalPhase>('menu');
  const [difficulty, setDifficulty] = useState<StopSignalDifficulty>('medium');
  const [rounds, setRounds] = useState(30);
  const [stimulusDurationMs, setStimulusDurationMs] = useState(2000);
  const [soundEnabled, setSoundEnabled] = useState(true);

  const hostedSettings = useHostedGameSettings();
  const hostedSettingsAppliedRef = useRef(false);
  useTrainingConfigReady(phase === 'menu');

  const [currentTrialIndex, setCurrentTrialIndex] = useState(0);
  const [trials, setTrials] = useState<StopSignalTrial[]>([]);
  const [isFixation, setIsFixation] = useState(false);
  const [isStopCued, setIsStopCued] = useState(false);
  const [trialFeedback, setTrialFeedback] = useState<'correct' | 'incorrect' | null>(null);
  const [results, setResults] = useState<StopSignalSessionRecord | null>(null);

  const trialStartTimeRef = useRef<number>(0);
  const trialTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stopSignalTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const currentTrialAnsweredRef = useRef(false);

  const getSsdMs = useCallback((diff: StopSignalDifficulty): number => {
    switch (diff) {
      case 'easy': return 150;
      case 'medium': return 250;
      case 'hard': return 350;
    }
  }, []);

  useEffect(() => {
    if (!hostedSettings || hostedSettingsAppliedRef.current) return;
    hostedSettingsAppliedRef.current = true;
    if (hostedSettings.difficulty === 'easy' || hostedSettings.difficulty === 'medium' || hostedSettings.difficulty === 'hard') {
      setDifficulty(hostedSettings.difficulty);
    }
    if (typeof hostedSettings.rounds === 'number' && hostedSettings.rounds >= 15 && hostedSettings.rounds <= 60) {
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

  const clearTrialTimers = useCallback(() => {
    if (trialTimeoutRef.current) {
      clearTimeout(trialTimeoutRef.current);
      trialTimeoutRef.current = null;
    }
    if (stopSignalTimeoutRef.current) {
      clearTimeout(stopSignalTimeoutRef.current);
      stopSignalTimeoutRef.current = null;
    }
  }, []);

  const completeSession = useCallback((finalTrials: StopSignalTrial[]) => {
    const totalRounds = finalTrials.length;
    const goTrials = finalTrials.filter((t) => t.trialType === 'go');
    const stopTrials = finalTrials.filter((t) => t.trialType === 'stop');

    const goCount = goTrials.length;
    const stopCount = stopTrials.length;

    const goHitCount = goTrials.filter((t) => t.responded && t.correct).length;
    const goAccuracyPercent = goCount > 0 ? Math.round((goHitCount / goCount) * 100) : 0;

    const stopInhibitionCount = stopTrials.filter((t) => !t.responded && t.correct).length;
    const stopInhibitionRatePercent = stopCount > 0 ? Math.round((stopInhibitionCount / stopCount) * 100) : 0;

    const goCorrectRts = goTrials
      .filter((t) => t.responded && t.correct && t.reactionTimeMs !== null)
      .map((t) => t.reactionTimeMs as number);
    const meanGoRtMs = goCorrectRts.length > 0 ? Math.round(goCorrectRts.reduce((a, b) => a + b, 0) / goCorrectRts.length) : 0;

    const ssdMs = getSsdMs(difficulty);
    const estimatedSsrtMs = Math.max(0, meanGoRtMs - ssdMs);

    const record: StopSignalSessionRecord = {
      totalRounds,
      difficulty,
      ssdMs,
      goCount,
      stopCount,
      goHitCount,
      goAccuracyPercent,
      stopInhibitionCount,
      stopInhibitionRatePercent,
      meanGoRtMs,
      estimatedSsrtMs,
      trials: finalTrials,
    };

    jsPsychLifecycleRef.current?.finish(record as unknown as Record<string, unknown>);
    PlayGameEndSound('Victory', jsPsychRef);
    setResults(record);
    setPhase('results');

    const participantId = GetAuthUserNameFromToken() || 'Unknown';
    void SaveTrainingSessionRecord({
      gameId: 'stop-signal',
      gameTitle: isZh ? '煞車抑制反應 (Stop-Signal)' : 'Stop-Signal Response Inhibition',
      category: 'attention',
      score: stopInhibitionRatePercent,
      metrics: {
        totalRounds,
        difficulty,
        ssdMs,
        goAccuracyPercent,
        stopInhibitionRatePercent,
        meanGoRtMs,
        estimatedSsrtMs,
      },
      participantId,
      notes: isZh
        ? `煞車難度: ${difficulty} (SSD ${ssdMs}ms), 煞車成功率: ${stopInhibitionRatePercent}%, Go正確率: ${goAccuracyPercent}%, 平均RT: ${meanGoRtMs}ms, 預估SSRT: ${estimatedSsrtMs}ms`
        : `Brake: ${difficulty} (SSD ${ssdMs}ms), Stop Rate: ${stopInhibitionRatePercent}%, Go Acc: ${goAccuracyPercent}%, Mean RT: ${meanGoRtMs}ms, SSRT: ${estimatedSsrtMs}ms`,
    });
  }, [difficulty, getSsdMs, isZh]);

  const handleUserDirection = useCallback((chosenDirection: ArrowDirection) => {
    if (phase !== 'playing' || isFixation || !activeTrial || currentTrialAnsweredRef.current) return;
    currentTrialAnsweredRef.current = true;
    clearTrialTimers();

    const rt = Math.max(1, Math.round(performance.now() - trialStartTimeRef.current));
    let isCorrect = false;

    if (activeTrial.trialType === 'go') {
      isCorrect = chosenDirection === activeTrial.direction;
    } else {
      isCorrect = false;
    }

    if (soundEnabled) {
      if (isCorrect) PlaySuccessSound(jsPsychRef);
      else PlayFailureSound(jsPsychRef);
    }

    setTrialFeedback(isCorrect ? 'correct' : 'incorrect');

    const updatedTrial: StopSignalTrial = {
      ...activeTrial,
      responded: true,
      responseDirection: chosenDirection,
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
      setIsStopCued(false);
      const nextIndex = currentTrialIndex + 1;
      if (nextIndex >= trials.length) {
        completeSession([...trials.slice(0, currentTrialIndex), updatedTrial]);
      } else {
        setCurrentTrialIndex(nextIndex);
        startTrialFixation(trials, nextIndex);
      }
    }, 280);
  }, [activeTrial, clearTrialTimers, completeSession, currentTrialIndex, isFixation, phase, soundEnabled, trials]);

  const handleTrialTimeout = useCallback(() => {
    if (phase !== 'playing' || isFixation || !activeTrial || currentTrialAnsweredRef.current) return;
    currentTrialAnsweredRef.current = true;
    clearTrialTimers();

    const isCorrect = activeTrial.trialType === 'stop';

    if (soundEnabled) {
      if (isCorrect) PlaySuccessSound(jsPsychRef);
      else PlayFailureSound(jsPsychRef);
    }

    setTrialFeedback(isCorrect ? 'correct' : 'incorrect');

    const updatedTrial: StopSignalTrial = {
      ...activeTrial,
      responded: false,
      responseDirection: null,
      correct: isCorrect,
      reactionTimeMs: null,
    };

    setTrials((prev) => {
      const copy = [...prev];
      copy[currentTrialIndex] = updatedTrial;
      return copy;
    });

    setTimeout(() => {
      setTrialFeedback(null);
      setIsStopCued(false);
      const nextIndex = currentTrialIndex + 1;
      if (nextIndex >= trials.length) {
        completeSession([...trials.slice(0, currentTrialIndex), updatedTrial]);
      } else {
        setCurrentTrialIndex(nextIndex);
        startTrialFixation(trials, nextIndex);
      }
    }, 280);
  }, [activeTrial, clearTrialTimers, completeSession, currentTrialIndex, isFixation, phase, soundEnabled, trials]);

  const startTrialFixation = useCallback((trialList: StopSignalTrial[], index: number) => {
    setIsFixation(true);
    setIsStopCued(false);
    currentTrialAnsweredRef.current = true;

    setTimeout(() => {
      setIsFixation(false);
      currentTrialAnsweredRef.current = false;
      trialStartTimeRef.current = performance.now();

      const currentItem = trialList[index];
      if (currentItem && currentItem.trialType === 'stop') {
        stopSignalTimeoutRef.current = setTimeout(() => {
          setIsStopCued(true);
          if (soundEnabled) {
            PlayFailureSound(jsPsychRef);
          }
        }, currentItem.ssdMs);
      }

      trialTimeoutRef.current = setTimeout(() => {
        handleTrialTimeout();
      }, stimulusDurationMs);
    }, 450);
  }, [handleTrialTimeout, soundEnabled, stimulusDurationMs]);

  useEffect(() => {
    if (phase !== 'playing') return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        handleUserDirection('left');
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        handleUserDirection('right');
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleUserDirection, phase]);

  const startGame = useCallback(() => {
    PrepareAudioFeedback();
    const ssdMs = getSsdMs(difficulty);
    const generatedTrials = GenerateStopSignalTrials(rounds, ssdMs);
    setTrials(generatedTrials);
    setCurrentTrialIndex(0);
    setResults(null);
    setTrialFeedback(null);
    setIsStopCued(false);
    setPhase('playing');

    jsPsychLifecycleRef.current?.start({
      difficulty,
      rounds,
      ssdMs,
      stimulusDurationMs,
    });

    startTrialFixation(generatedTrials, 0);
  }, [difficulty, getSsdMs, rounds, startTrialFixation, stimulusDurationMs]);

  const configOptions = useMemo(() => {
    const diffOptions = [
      { id: 'easy', label: isZh ? '入門（早煞車，SSD 150ms）' : 'Easy (Early cue, SSD 150ms)' },
      { id: 'medium', label: isZh ? '標準（標準煞車，SSD 250ms）' : 'Medium (Standard, SSD 250ms)' },
      { id: 'hard', label: isZh ? '進階（急煞車，SSD 350ms）' : 'Hard (Late cue, SSD 350ms)' },
    ];
    const durOptions = [
      { id: '1500', label: isZh ? '1.5 秒（緊湊）' : '1.5 seconds (Brisk)' },
      { id: '2000', label: isZh ? '2.0 秒（標準）' : '2.0 seconds (Standard)' },
      { id: '2500', label: isZh ? '2.5 秒（從容）' : '2.5 seconds (Relaxed)' },
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
          title={isZh ? '煞車抑制反應 (Stop-Signal)' : 'Stop-Signal Task'}
          subtitle={isZh ? '居家專注與動作衝動抑制練習' : 'Inhibitory control & action-stopping home activity'}
        >
          <TrainingConfigSection title={isZh ? '煞車難度 (Stop Signal Delay)' : 'Brake Difficulty (SSD)'}>
            <TrainingConfigOptionGroup
              options={configOptions.diffOptions}
              value={difficulty}
              onChange={(val) => setDifficulty(val as StopSignalDifficulty)}
            />
          </TrainingConfigSection>

          <TrainingConfigSection title={isZh ? '回合題數' : 'Trial Count'}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '8px 0' }}>
              <input
                type="range"
                min={15}
                max={60}
                step={5}
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
          gameId="stop-signal"
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
            maxWidth: '640px',
            height: '92dvh',
            padding: '24px 16px',
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
              SSD: {activeTrial?.ssdMs ?? getSsdMs(difficulty)} ms
            </span>
          </div>

          {/* Center Stimulus Display */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              width: '320px',
              height: '320px',
              borderRadius: '28px',
              background: isStopCued
                ? 'rgba(239, 68, 68, 0.12)'
                : trialFeedback === 'correct'
                ? 'rgba(34, 197, 94, 0.12)'
                : trialFeedback === 'incorrect'
                ? 'rgba(239, 68, 68, 0.15)'
                : 'var(--card-bg)',
              border: isStopCued
                ? '4px solid #ef4444'
                : trialFeedback === 'correct'
                ? '4px solid #22c55e'
                : trialFeedback === 'incorrect'
                ? '4px solid #ef4444'
                : '3px solid var(--border)',
              transition: 'all 0.15s ease',
              position: 'relative',
            }}
          >
            {isFixation ? (
              <span style={{ fontSize: '64px', fontWeight: 900, color: 'var(--text-secondary)' }}>+</span>
            ) : activeTrial ? (
              <>
                {/* Direction Arrow */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {activeTrial.direction === 'left' ? (
                    <svg viewBox="0 0 100 100" width="140" height="140">
                      <polygon
                        points="65,18 25,50 65,82 65,62 85,62 85,38 65,38"
                        fill={isStopCued ? '#94a3b8' : 'var(--accent)'}
                        stroke={isStopCued ? '#64748b' : 'var(--accent-hover)'}
                        strokeWidth="3"
                      />
                    </svg>
                  ) : (
                    <svg viewBox="0 0 100 100" width="140" height="140">
                      <polygon
                        points="35,18 75,50 35,82 35,62 15,62 15,38 35,38"
                        fill={isStopCued ? '#94a3b8' : 'var(--accent)'}
                        stroke={isStopCued ? '#64748b' : 'var(--accent-hover)'}
                        strokeWidth="3"
                      />
                    </svg>
                  )}
                </div>

                {/* Stop Signal Overlay */}
                {isStopCued && (
                  <div
                    style={{
                      position: 'absolute',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: '8px',
                      background: 'rgba(239, 68, 68, 0.95)',
                      padding: '12px 24px',
                      borderRadius: '16px',
                      boxShadow: '0 8px 24px rgba(239, 68, 68, 0.4)',
                    }}
                  >
                    <svg viewBox="0 0 100 100" width="48" height="48">
                      <circle cx="50" cy="50" r="44" fill="#ffffff" stroke="#b91c1c" strokeWidth="5" />
                      <rect x="44" y="22" width="12" height="36" rx="4" fill="#ef4444" />
                      <circle cx="50" cy="72" r="6" fill="#ef4444" />
                    </svg>
                    <span style={{ fontSize: '20px', fontWeight: 900, color: '#ffffff', letterSpacing: '1px' }}>
                      {isZh ? '煞車！請勿按鍵！' : 'STOP! DO NOT PRESS!'}
                    </span>
                  </div>
                )}
              </>
            ) : null}
          </div>

          {/* Bottom Action Direction Buttons */}
          <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ textAlign: 'center', fontSize: '15px', color: 'var(--text-secondary)' }}>
              {isZh ? '看到箭頭請按對應方向；出現紅色煞車標誌時請立刻收手制動！' : 'Press matching direction arrow; withhold response when red STOP appears!'}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <button
                type="button"
                onClick={() => handleUserDirection('left')}
                disabled={isFixation || currentTrialAnsweredRef.current}
                style={{
                  minHeight: '76px',
                  fontSize: '24px',
                  fontWeight: 900,
                  borderRadius: '18px',
                  border: '3px solid var(--accent)',
                  background: 'var(--card-bg)',
                  color: 'var(--text-primary)',
                  cursor: isFixation || currentTrialAnsweredRef.current ? 'not-allowed' : 'pointer',
                  opacity: isFixation || currentTrialAnsweredRef.current ? 0.6 : 1,
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
                onClick={() => handleUserDirection('right')}
                disabled={isFixation || currentTrialAnsweredRef.current}
                style={{
                  minHeight: '76px',
                  fontSize: '24px',
                  fontWeight: 900,
                  borderRadius: '18px',
                  border: '3px solid var(--accent)',
                  background: 'var(--card-bg)',
                  color: 'var(--text-primary)',
                  cursor: isFixation || currentTrialAnsweredRef.current ? 'not-allowed' : 'pointer',
                  opacity: isFixation || currentTrialAnsweredRef.current ? 0.6 : 1,
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
                {isZh ? '煞車抑制反應 (Stop-Signal) 當次紀錄換算參考值' : 'Stop-Signal Task performance metrics'}
              </p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div style={{ padding: '16px', background: 'var(--bg)', borderRadius: '16px', textAlign: 'center' }}>
                <div style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>
                  {isZh ? '煞車抑制成功率' : 'Stop Inhibition Rate'}
                </div>
                <div style={{ fontSize: '36px', fontWeight: 900, color: 'var(--accent)', marginTop: '4px' }}>
                  {results.stopInhibitionRatePercent}%
                </div>
                <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                  {results.stopInhibitionCount} / {results.stopCount} {isZh ? '次成功收手' : 'stopped'}
                </div>
              </div>

              <div style={{ padding: '16px', background: 'var(--bg)', borderRadius: '16px', textAlign: 'center' }}>
                <div style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>
                  {isZh ? '方向辨識正確率' : 'Go Task Accuracy'}
                </div>
                <div style={{ fontSize: '36px', fontWeight: 900, marginTop: '4px' }}>
                  {results.goAccuracyPercent}%
                </div>
                <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                  {results.goHitCount} / {results.goCount} {isZh ? '題正確' : 'correct'}
                </div>
              </div>

              <div style={{ padding: '16px', background: 'var(--bg)', borderRadius: '16px', textAlign: 'center' }}>
                <div style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>
                  {isZh ? '平均反應時間' : 'Mean Go RT'}
                </div>
                <div style={{ fontSize: '36px', fontWeight: 900, marginTop: '4px' }}>
                  {results.meanGoRtMs} <span style={{ fontSize: '18px' }}>ms</span>
                </div>
                <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>{isZh ? '毫秒' : 'milliseconds'}</div>
              </div>

              <div style={{ padding: '16px', background: 'var(--bg)', borderRadius: '16px', textAlign: 'center' }}>
                <div style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>
                  {isZh ? '預估煞車反應時 (SSRT)' : 'Estimated SSRT'}
                </div>
                <div style={{ fontSize: '36px', fontWeight: 900, color: '#38bdf8', marginTop: '4px' }}>
                  {results.estimatedSsrtMs} <span style={{ fontSize: '18px' }}>ms</span>
                </div>
                <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                  {isZh ? '換算參考值 (Logan 1994)' : 'Reference value'}
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

function GenerateStopSignalTrials(rounds: number, ssdMs: number): StopSignalTrial[] {
  const trials: StopSignalTrial[] = [];
  const stopProportion = 0.25;
  const stopCount = Math.max(2, Math.round(rounds * stopProportion));
  const goCount = rounds - stopCount;

  const trialTypes: TrialType[] = [
    ...Array(stopCount).fill('stop' as TrialType),
    ...Array(goCount).fill('go' as TrialType),
  ];

  let shuffledTypes: TrialType[] = [];
  let validShuffle = false;
  let attempts = 0;

  while (!validShuffle && attempts < 100) {
    attempts++;
    shuffledTypes = [...trialTypes].sort(() => Math.random() - 0.5);
    validShuffle = true;
    for (let i = 0; i < shuffledTypes.length - 1; i++) {
      if (shuffledTypes[i] === 'stop' && shuffledTypes[i + 1] === 'stop') {
        validShuffle = false;
        break;
      }
    }
  }

  for (let i = 0; i < rounds; i++) {
    const trialType = shuffledTypes[i] ?? (Math.random() < 0.25 ? 'stop' : 'go');
    const direction: ArrowDirection = Math.random() < 0.5 ? 'left' : 'right';
    trials.push({
      trialNumber: i + 1,
      trialType,
      direction,
      ssdMs,
      responded: false,
      responseDirection: null,
      correct: false,
      reactionTimeMs: null,
    });
  }

  return trials;
}

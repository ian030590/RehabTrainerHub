// Canonical Hub-owned brain Number-Letter task switching runtime.
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

type NlPhase = 'menu' | 'rules' | 'playing' | 'results';
type QuadrantLocation = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
type CurrentTask = 'number' | 'letter';

interface NumberLetterGameProps {
  onExit: () => void;
}

interface NumberLetterTrial {
  trialNumber: number;
  quadrant: QuadrantLocation;
  task: CurrentTask;
  isSwitch: boolean;
  stimulusString: string;
  numberChar: string;
  letterChar: string;
  correctAnswer: 'odd' | 'even' | 'vowel' | 'consonant';
  responded: boolean;
  correct: boolean;
  reactionTimeMs: number | null;
}

interface NumberLetterSessionRecord {
  totalRounds: number;
  correctCount: number;
  accuracyPercent: number;
  meanRtMs: number;
  repeatRtMs: number;
  switchRtMs: number;
  switchCostMs: number;
  trials: NumberLetterTrial[];
}

const oddNumbers = ['3', '5', '7', '9'];
const evenNumbers = ['2', '4', '6', '8'];
const vowels = ['A', 'E', 'I', 'U'];
const consonants = ['G', 'K', 'M', 'R'];

export function NumberLetterGame({ onExit }: NumberLetterGameProps) {
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

  const [phase, setPhase] = useState<NlPhase>('menu');
  const [difficulty, setDifficulty] = useState<'alternating' | 'number-only' | 'letter-only'>('alternating');
  const [rounds, setRounds] = useState(24);
  const [stimulusDurationMs, setStimulusDurationMs] = useState(3000);
  const [soundEnabled, setSoundEnabled] = useState(true);

  const hostedSettings = useHostedGameSettings();
  const hostedSettingsAppliedRef = useRef(false);
  useTrainingConfigReady(phase === 'menu');

  const [currentTrialIndex, setCurrentTrialIndex] = useState(0);
  const [trials, setTrials] = useState<NumberLetterTrial[]>([]);
  const [isFixation, setIsFixation] = useState(false);
  const [trialFeedback, setTrialFeedback] = useState<'correct' | 'incorrect' | null>(null);
  const [results, setResults] = useState<NumberLetterSessionRecord | null>(null);

  const trialStartTimeRef = useRef<number>(0);
  const trialTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const currentTrialAnsweredRef = useRef(false);

  useEffect(() => {
    if (!hostedSettings || hostedSettingsAppliedRef.current) return;
    hostedSettingsAppliedRef.current = true;
    if (hostedSettings.difficulty === 'alternating' || hostedSettings.difficulty === 'number-only' || hostedSettings.difficulty === 'letter-only') {
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

  const clearTrialTimer = useCallback(() => {
    if (trialTimeoutRef.current) {
      clearTimeout(trialTimeoutRef.current);
      trialTimeoutRef.current = null;
    }
  }, []);

  const completeSession = useCallback((finalTrials: NumberLetterTrial[]) => {
    const totalRounds = finalTrials.length;
    const correctTrials = finalTrials.filter((t) => t.correct);
    const correctCount = correctTrials.length;
    const accuracyPercent = Math.round((correctCount / Math.max(1, totalRounds)) * 100);

    const validRts = correctTrials.filter((t) => t.reactionTimeMs !== null).map((t) => t.reactionTimeMs as number);
    const meanRtMs = validRts.length > 0 ? Math.round(validRts.reduce((a, b) => a + b, 0) / validRts.length) : 0;

    const repeatRts = correctTrials.filter((t) => !t.isSwitch && t.reactionTimeMs !== null).map((t) => t.reactionTimeMs as number);
    const switchRts = correctTrials.filter((t) => t.isSwitch && t.reactionTimeMs !== null).map((t) => t.reactionTimeMs as number);

    const repeatRtMs = repeatRts.length > 0 ? Math.round(repeatRts.reduce((a, b) => a + b, 0) / repeatRts.length) : meanRtMs;
    const switchRtMs = switchRts.length > 0 ? Math.round(switchRts.reduce((a, b) => a + b, 0) / switchRts.length) : meanRtMs;
    const switchCostMs = Math.max(0, switchRtMs - repeatRtMs);

    const record: NumberLetterSessionRecord = {
      totalRounds,
      correctCount,
      accuracyPercent,
      meanRtMs,
      repeatRtMs,
      switchRtMs,
      switchCostMs,
      trials: finalTrials,
    };

    jsPsychLifecycleRef.current?.finish(record as unknown as Record<string, unknown>);
    PlayGameEndSound('Victory', jsPsychRef);
    setResults(record);
    setPhase('results');

    const participantId = GetAuthUserNameFromToken() || 'Unknown';
    void SaveTrainingSessionRecord({
      gameId: 'number-letter',
      gameTitle: isZh ? '數字字母切換 (Number-Letter)' : 'Number-Letter Task Switching',
      category: 'higher-cognition',
      score: accuracyPercent,
      metrics: {
        totalRounds,
        accuracyPercent,
        meanRtMs,
        repeatRtMs,
        switchRtMs,
        switchCostMs,
      },
      participantId,
      notes: isZh
        ? `正確率: ${accuracyPercent}%, 平均RT: ${meanRtMs}ms, 切換耗時 (Switch Cost): ${switchCostMs}ms (重複: ${repeatRtMs}ms, 切換: ${switchRtMs}ms)`
        : `Acc: ${accuracyPercent}%, RT: ${meanRtMs}ms, Switch Cost: ${switchCostMs}ms (Repeat: ${repeatRtMs}ms, Switch: ${switchRtMs}ms)`,
    });
  }, [isZh]);

  const advanceTrial = useCallback((updatedTrial: NumberLetterTrial) => {
    const nextIndex = currentTrialIndex + 1;
    if (nextIndex >= trials.length) {
      completeSession([...trials.slice(0, currentTrialIndex), updatedTrial]);
    } else {
      setCurrentTrialIndex(nextIndex);
      startTrialFixation();
    }
  }, [completeSession, currentTrialIndex, trials]);

  const handleUserAnswer = useCallback((answer: 'odd' | 'even' | 'vowel' | 'consonant') => {
    if (phase !== 'playing' || isFixation || !activeTrial || currentTrialAnsweredRef.current) return;
    currentTrialAnsweredRef.current = true;
    clearTrialTimer();

    const rt = Math.max(1, Math.round(performance.now() - trialStartTimeRef.current));
    const isCorrect = answer === activeTrial.correctAnswer;

    if (soundEnabled) {
      if (isCorrect) PlaySuccessSound(jsPsychRef);
      else PlayFailureSound(jsPsychRef);
    }

    setTrialFeedback(isCorrect ? 'correct' : 'incorrect');

    const updatedTrial: NumberLetterTrial = {
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
  }, [activeTrial, advanceTrial, clearTrialTimer, currentTrialIndex, isFixation, phase, soundEnabled]);

  const handleTimeout = useCallback(() => {
    if (phase !== 'playing' || isFixation || !activeTrial || currentTrialAnsweredRef.current) return;
    currentTrialAnsweredRef.current = true;
    clearTrialTimer();

    if (soundEnabled) {
      PlayFailureSound(jsPsychRef);
    }

    setTrialFeedback('incorrect');

    const updatedTrial: NumberLetterTrial = {
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
  }, [activeTrial, advanceTrial, clearTrialTimer, currentTrialIndex, isFixation, phase, soundEnabled]);

  const startTrialFixation = useCallback(() => {
    setIsFixation(true);
    currentTrialAnsweredRef.current = true;

    setTimeout(() => {
      setIsFixation(false);
      currentTrialAnsweredRef.current = false;
      trialStartTimeRef.current = performance.now();

      trialTimeoutRef.current = setTimeout(() => {
        handleTimeout();
      }, stimulusDurationMs);
    }, 400);
  }, [handleTimeout, stimulusDurationMs]);

  const startGame = useCallback(() => {
    PrepareAudioFeedback();
    const generated = GenerateNumberLetterTrials(rounds, difficulty);
    setTrials(generated);
    setCurrentTrialIndex(0);
    setResults(null);
    setTrialFeedback(null);
    setPhase('playing');

    jsPsychLifecycleRef.current?.start({
      difficulty,
      rounds,
      stimulusDurationMs,
    });

    startTrialFixation();
  }, [difficulty, rounds, startTrialFixation, stimulusDurationMs]);

  const configOptions = useMemo(() => {
    const diffOptions = [
      { id: 'alternating', label: isZh ? '交替切換（經典象限轉換）' : 'Alternating Switching' },
      { id: 'number-only', label: isZh ? '數字判斷（單純奇偶數）' : 'Number Pure Task' },
      { id: 'letter-only', label: isZh ? '字母判斷（單純母子音）' : 'Letter Pure Task' },
    ];
    const durOptions = [
      { id: '2000', label: isZh ? '2.0 秒（緊湊）' : '2.0 seconds' },
      { id: '3000', label: isZh ? '3.0 秒（標準）' : '3.0 seconds' },
      { id: '4000', label: isZh ? '4.0 秒（從容）' : '4.0 seconds' },
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
          title={isZh ? '數字字母切換 (Number-Letter)' : 'Number-Letter Task'}
          subtitle={isZh ? '居家認知彈性與任務規則靈活切換練習' : 'Cognitive flexibility & task-switching activity'}
        >
          <TrainingConfigSection title={isZh ? '切換模式' : 'Switching Mode'}>
            <TrainingConfigOptionGroup
              options={configOptions.diffOptions}
              value={difficulty}
              onChange={(val) => setDifficulty(val as 'alternating' | 'number-only' | 'letter-only')}
            />
          </TrainingConfigSection>

          <TrainingConfigSection title={isZh ? '回合題數' : 'Trial Count'}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '8px 0' }}>
              <input
                type="range"
                min={12}
                max={48}
                step={4}
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
          gameId="number-letter"
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
            padding: '20px 16px',
            boxSizing: 'border-box',
          }}
        >
          {/* Top Status & Rule Cue */}
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
              {activeTrial?.task === 'number'
                ? (isZh ? '上方區：判斷數字（奇數 / 偶數）' : 'Top: Classify NUMBER (Odd / Even)')
                : (isZh ? '下方區：判斷字母（母音 / 子音）' : 'Bottom: Classify LETTER (Vowel / Consonant)')}
            </span>
          </div>

          {/* Center 2x2 Quadrant Grid */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gridTemplateRows: '1fr 1fr',
              width: '320px',
              height: '320px',
              background: 'var(--card-bg)',
              borderRadius: '24px',
              border: trialFeedback === 'correct'
                ? '4px solid #22c55e'
                : trialFeedback === 'incorrect'
                ? '4px solid #ef4444'
                : '3px solid var(--border)',
              overflow: 'hidden',
              boxShadow: '0 8px 32px rgba(0,0,0,0.1)',
              position: 'relative',
              transition: 'all 0.15s ease',
            }}
          >
            {/* Quadrant Cells */}
            {(['top-left', 'top-right', 'bottom-left', 'bottom-right'] as QuadrantLocation[]).map((loc) => {
              const isActive = !isFixation && activeTrial?.quadrant === loc;
              const isTop = loc === 'top-left' || loc === 'top-right';

              return (
                <div
                  key={loc}
                  style={{
                    borderRight: loc === 'top-left' || loc === 'bottom-left' ? '2px solid var(--border)' : 'none',
                    borderBottom: isTop ? '2px solid var(--border)' : 'none',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: isActive
                      ? 'rgba(56, 189, 248, 0.12)'
                      : 'transparent',
                    position: 'relative',
                  }}
                >
                  {/* Subtle Zone Label */}
                  <span
                    style={{
                      position: 'absolute',
                      top: isTop ? '6px' : 'auto',
                      bottom: !isTop ? '6px' : 'auto',
                      fontSize: '11px',
                      color: 'var(--text-secondary)',
                      opacity: 0.6,
                    }}
                  >
                    {isTop ? (isZh ? '數字區' : 'Number') : (isZh ? '字母區' : 'Letter')}
                  </span>

                  {isActive && activeTrial && (
                    <span
                      style={{
                        fontSize: '44px',
                        fontWeight: 900,
                        color: 'var(--text-primary)',
                        letterSpacing: '3px',
                      }}
                    >
                      {activeTrial.stimulusString}
                    </span>
                  )}
                </div>
              );
            })}

            {/* Central Fixation Cross when active */}
            {isFixation && (
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: 'var(--card-bg)',
                }}
              >
                <span style={{ fontSize: '48px', fontWeight: 900, color: 'var(--text-secondary)' }}>+</span>
              </div>
            )}
          </div>

          {/* Bottom Dynamic Choice Buttons */}
          <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {activeTrial?.task === 'number' ? (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <button
                  type="button"
                  onClick={() => handleUserAnswer('odd')}
                  disabled={isFixation || currentTrialAnsweredRef.current}
                  style={{
                    minHeight: '76px',
                    fontSize: '22px',
                    fontWeight: 900,
                    borderRadius: '18px',
                    border: '3px solid #38bdf8',
                    background: 'var(--card-bg)',
                    color: 'var(--text-primary)',
                    cursor: isFixation || currentTrialAnsweredRef.current ? 'not-allowed' : 'pointer',
                    opacity: isFixation || currentTrialAnsweredRef.current ? 0.6 : 1,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <span>{isZh ? '奇數 (Odd)' : 'Odd'}</span>
                  <span style={{ fontSize: '13px', opacity: 0.75 }}>(3, 5, 7, 9)</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleUserAnswer('even')}
                  disabled={isFixation || currentTrialAnsweredRef.current}
                  style={{
                    minHeight: '76px',
                    fontSize: '22px',
                    fontWeight: 900,
                    borderRadius: '18px',
                    border: '3px solid #38bdf8',
                    background: 'var(--card-bg)',
                    color: 'var(--text-primary)',
                    cursor: isFixation || currentTrialAnsweredRef.current ? 'not-allowed' : 'pointer',
                    opacity: isFixation || currentTrialAnsweredRef.current ? 0.6 : 1,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <span>{isZh ? '偶數 (Even)' : 'Even'}</span>
                  <span style={{ fontSize: '13px', opacity: 0.75 }}>(2, 4, 6, 8)</span>
                </button>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <button
                  type="button"
                  onClick={() => handleUserAnswer('vowel')}
                  disabled={isFixation || currentTrialAnsweredRef.current}
                  style={{
                    minHeight: '76px',
                    fontSize: '22px',
                    fontWeight: 900,
                    borderRadius: '18px',
                    border: '3px solid #34d399',
                    background: 'var(--card-bg)',
                    color: 'var(--text-primary)',
                    cursor: isFixation || currentTrialAnsweredRef.current ? 'not-allowed' : 'pointer',
                    opacity: isFixation || currentTrialAnsweredRef.current ? 0.6 : 1,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <span>{isZh ? '母音 (Vowel)' : 'Vowel'}</span>
                  <span style={{ fontSize: '13px', opacity: 0.75 }}>(A, E, I, U)</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleUserAnswer('consonant')}
                  disabled={isFixation || currentTrialAnsweredRef.current}
                  style={{
                    minHeight: '76px',
                    fontSize: '22px',
                    fontWeight: 900,
                    borderRadius: '18px',
                    border: '3px solid #34d399',
                    background: 'var(--card-bg)',
                    color: 'var(--text-primary)',
                    cursor: isFixation || currentTrialAnsweredRef.current ? 'not-allowed' : 'pointer',
                    opacity: isFixation || currentTrialAnsweredRef.current ? 0.6 : 1,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <span>{isZh ? '子音 (Consonant)' : 'Consonant'}</span>
                  <span style={{ fontSize: '13px', opacity: 0.75 }}>(G, K, M, R)</span>
                </button>
              </div>
            )}
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
                {isZh ? '數字字母切換 (Number-Letter) 當次紀錄換算參考值' : 'Number-Letter Task performance metrics'}
              </p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div style={{ padding: '16px', background: 'var(--bg)', borderRadius: '16px', textAlign: 'center' }}>
                <div style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>
                  {isZh ? '分類正確率' : 'Accuracy'}
                </div>
                <div style={{ fontSize: '36px', fontWeight: 900, color: 'var(--accent)', marginTop: '4px' }}>
                  {results.accuracyPercent}%
                </div>
                <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                  {results.correctCount} / {results.totalRounds} {isZh ? '題正確' : 'correct'}
                </div>
              </div>

              <div style={{ padding: '16px', background: 'var(--bg)', borderRadius: '16px', textAlign: 'center' }}>
                <div style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>
                  {isZh ? '切換耗時 (Switch Cost)' : 'Switch Cost'}
                </div>
                <div style={{ fontSize: '36px', fontWeight: 900, color: '#38bdf8', marginTop: '4px' }}>
                  {results.switchCostMs} <span style={{ fontSize: '18px' }}>ms</span>
                </div>
                <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                  {isZh ? '切換反應時 - 重複反應時' : 'Switch RT - Repeat RT'}
                </div>
              </div>

              <div style={{ padding: '16px', background: 'var(--bg)', borderRadius: '16px', textAlign: 'center' }}>
                <div style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>
                  {isZh ? '重複階段反應時' : 'Repeat RT'}
                </div>
                <div style={{ fontSize: '32px', fontWeight: 900, marginTop: '4px' }}>
                  {results.repeatRtMs} <span style={{ fontSize: '16px' }}>ms</span>
                </div>
              </div>

              <div style={{ padding: '16px', background: 'var(--bg)', borderRadius: '16px', textAlign: 'center' }}>
                <div style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>
                  {isZh ? '切換階段反應時' : 'Switch RT'}
                </div>
                <div style={{ fontSize: '32px', fontWeight: 900, marginTop: '4px' }}>
                  {results.switchRtMs} <span style={{ fontSize: '16px' }}>ms</span>
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

function GenerateNumberLetterTrials(rounds: number, mode: 'alternating' | 'number-only' | 'letter-only'): NumberLetterTrial[] {
  const trials: NumberLetterTrial[] = [];
  const quadrants: QuadrantLocation[] = ['top-left', 'top-right', 'bottom-right', 'bottom-left']; // clockwise rotation

  let prevTask: CurrentTask | null = null;

  for (let i = 0; i < rounds; i++) {
    let quad: QuadrantLocation = quadrants[i % 4];
    if (mode === 'number-only') quad = i % 2 === 0 ? 'top-left' : 'top-right';
    else if (mode === 'letter-only') quad = i % 2 === 0 ? 'bottom-left' : 'bottom-right';

    const isTop = quad === 'top-left' || quad === 'top-right';
    const task: CurrentTask = isTop ? 'number' : 'letter';
    const isSwitch = prevTask !== null && prevTask !== task;
    prevTask = task;

    // Pick characters
    const isOdd = Math.random() < 0.5;
    const isVowel = Math.random() < 0.5;
    const num = isOdd
      ? oddNumbers[Math.floor(Math.random() * oddNumbers.length)]
      : evenNumbers[Math.floor(Math.random() * evenNumbers.length)];
    const letChar = isVowel
      ? vowels[Math.floor(Math.random() * vowels.length)]
      : consonants[Math.floor(Math.random() * consonants.length)];

    const stimulusString = Math.random() < 0.5 ? `${num}${letChar}` : `${letChar}${num}`;
    const correctAnswer = isTop
      ? (isOdd ? 'odd' : 'even')
      : (isVowel ? 'vowel' : 'consonant');

    trials.push({
      trialNumber: i + 1,
      quadrant: quad,
      task,
      isSwitch,
      stimulusString,
      numberChar: num,
      letterChar: letChar,
      correctAnswer,
      responded: false,
      correct: false,
      reactionTimeMs: null,
    });
  }

  return trials;
}

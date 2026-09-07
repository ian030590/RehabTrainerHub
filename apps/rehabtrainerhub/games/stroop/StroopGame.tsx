// Canonical Hub-owned brain Stroop color-word interference runtime.
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

export type StroopColorKey = 'red' | 'green' | 'blue' | 'yellow';
export type StroopDifficulty = 'easy' | 'medium' | 'hard';
type StroopCondition = 'congruent' | 'incongruent' | 'neutral';
type StroopPhase = 'menu' | 'rules' | 'playing' | 'results';

interface StroopGameProps {
  onExit: () => void;
}

interface ColorOption {
  key: StroopColorKey;
  hex: string;
  wordZh: string;
  wordEn: string;
  labelZh: string;
  labelEn: string;
  shortcut: string;
}

const colorOptions: readonly ColorOption[] = [
  { key: 'red', hex: '#ef4444', wordZh: '紅', wordEn: 'RED', labelZh: '紅色', labelEn: 'Red', shortcut: '1' },
  { key: 'green', hex: '#22c55e', wordZh: '綠', wordEn: 'GREEN', labelZh: '綠色', labelEn: 'Green', shortcut: '2' },
  { key: 'blue', hex: '#3b82f6', wordZh: '藍', wordEn: 'BLUE', labelZh: '藍色', labelEn: 'Blue', shortcut: '3' },
  { key: 'yellow', hex: '#eab308', wordZh: '黃', wordEn: 'YELLOW', labelZh: '黃色', labelEn: 'Yellow', shortcut: '4' },
];

interface StroopTrial {
  trialNumber: number;
  condition: StroopCondition;
  word: string;
  inkColor: StroopColorKey;
  inkHex: string;
  userResponse: StroopColorKey | null;
  correct: boolean;
  reactionTimeMs: number;
}

interface StroopSessionRecord {
  totalRounds: number;
  correctCount: number;
  accuracyPercent: number;
  meanRtMs: number;
  congruentRtMs: number;
  incongruentRtMs: number;
  interferenceMs: number;
  trials: StroopTrial[];
}

export function StroopGame({ onExit }: StroopGameProps) {
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

  const [phase, setPhase] = useState<StroopPhase>('menu');
  const [difficulty, setDifficulty] = useState<StroopDifficulty>('medium');
  const [rounds, setRounds] = useState(20);
  const [stimulusDurationMs, setStimulusDurationMs] = useState(2500);
  const [soundEnabled, setSoundEnabled] = useState(true);

  const hostedSettings = useHostedGameSettings();
  const hostedSettingsAppliedRef = useRef(false);
  useTrainingConfigReady(phase === 'menu');

  const [currentTrialIndex, setCurrentTrialIndex] = useState(0);
  const [trials, setTrials] = useState<StroopTrial[]>([]);
  const [isFixation, setIsFixation] = useState(false);
  const [trialFeedback, setTrialFeedback] = useState<'correct' | 'incorrect' | null>(null);
  const [results, setResults] = useState<StroopSessionRecord | null>(null);

  const trialStartTimeRef = useRef<number>(0);
  const trialTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const currentTrialAnsweredRef = useRef(false);

  useEffect(() => {
    if (!hostedSettings || hostedSettingsAppliedRef.current) return;
    hostedSettingsAppliedRef.current = true;
    if (hostedSettings.difficulty === 'easy' || hostedSettings.difficulty === 'medium' || hostedSettings.difficulty === 'hard') {
      setDifficulty(hostedSettings.difficulty);
    }
    if (typeof hostedSettings.rounds === 'number' && hostedSettings.rounds >= 10 && hostedSettings.rounds <= 60) {
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

  const generatedTrials = useMemo(() => {
    return GenerateStroopTrials(difficulty, rounds, isZh);
  }, [difficulty, isZh, rounds]);

  const activeTrial = trials[currentTrialIndex] ?? null;

  const handleResponse = useCallback((selectedColor: StroopColorKey) => {
    if (phase !== 'playing' || isFixation || !activeTrial || currentTrialAnsweredRef.current) return;
    currentTrialAnsweredRef.current = true;

    if (trialTimeoutRef.current) {
      clearTimeout(trialTimeoutRef.current);
      trialTimeoutRef.current = null;
    }

    const rt = Math.max(1, Math.round(performance.now() - trialStartTimeRef.current));
    const isCorrect = selectedColor === activeTrial.inkColor;

    if (soundEnabled) {
      if (isCorrect) PlaySuccessSound(jsPsychRef);
      else PlayFailureSound(jsPsychRef);
    }

    setTrialFeedback(isCorrect ? 'correct' : 'incorrect');

    const updatedTrial: StroopTrial = {
      ...activeTrial,
      userResponse: selectedColor,
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
      const nextIndex = currentTrialIndex + 1;
      if (nextIndex >= trials.length) {
        completeSession([...trials.slice(0, currentTrialIndex), updatedTrial]);
      } else {
        setCurrentTrialIndex(nextIndex);
        startTrialFixation();
      }
    }, 280);
  }, [activeTrial, currentTrialIndex, isFixation, phase, soundEnabled, trials]);

  const startTrialFixation = useCallback(() => {
    setIsFixation(true);
    currentTrialAnsweredRef.current = true;
    setTimeout(() => {
      setIsFixation(false);
      currentTrialAnsweredRef.current = false;
      trialStartTimeRef.current = performance.now();

      if (stimulusDurationMs > 0) {
        trialTimeoutRef.current = setTimeout(() => {
          if (!currentTrialAnsweredRef.current) {
            handleResponse('red' === activeTrial?.inkColor ? 'blue' : 'red');
          }
        }, stimulusDurationMs);
      }
    }, 450);
  }, [activeTrial?.inkColor, handleResponse, stimulusDurationMs]);

  const completeSession = useCallback((finalTrials: StroopTrial[]) => {
    const totalRounds = finalTrials.length;
    const correctTrials = finalTrials.filter((t) => t.correct);
    const correctCount = correctTrials.length;
    const accuracyPercent = Math.round((correctCount / Math.max(1, totalRounds)) * 100);

    const correctRts = correctTrials.map((t) => t.reactionTimeMs);
    const meanRtMs = correctRts.length > 0 ? Math.round(correctRts.reduce((a, b) => a + b, 0) / correctRts.length) : 0;

    const congruentCorrect = correctTrials.filter((t) => t.condition === 'congruent').map((t) => t.reactionTimeMs);
    const incongruentCorrect = correctTrials.filter((t) => t.condition === 'incongruent').map((t) => t.reactionTimeMs);

    const congruentRtMs = congruentCorrect.length > 0
      ? Math.round(congruentCorrect.reduce((a, b) => a + b, 0) / congruentCorrect.length)
      : 0;
    const incongruentRtMs = incongruentCorrect.length > 0
      ? Math.round(incongruentCorrect.reduce((a, b) => a + b, 0) / incongruentCorrect.length)
      : 0;

    const interferenceMs = (congruentRtMs > 0 && incongruentRtMs > 0)
      ? Math.max(0, incongruentRtMs - congruentRtMs)
      : 0;

    const record: StroopSessionRecord = {
      totalRounds,
      correctCount,
      accuracyPercent,
      meanRtMs,
      congruentRtMs,
      incongruentRtMs,
      interferenceMs,
      trials: finalTrials,
    };

    jsPsychLifecycleRef.current?.finish(record as unknown as Record<string, unknown>);
    PlayGameEndSound('Victory', jsPsychRef);
    setResults(record);
    setPhase('results');

    const participantId = GetAuthUserNameFromToken() || 'Unknown';
    void SaveTrainingSessionRecord({
      userName: participantId,
      moduleId: 'attention-training',
      gameId: 'stroop',
      gameTitle: isZh ? '色彩干擾抑制（Stroop）' : 'Color Word Interference (Stroop)',
      difficulty,
      trainingDate: FormatTestDate(new Date()),
      details: {
        Game_Result: 'Complete',
        Total_Rounds: totalRounds,
        Correct_Count: correctCount,
        Accuracy_Percent: accuracyPercent,
        Mean_RT_Ms: meanRtMs,
        Congruent_RT_Ms: congruentRtMs,
        Incongruent_RT_Ms: incongruentRtMs,
        Interference_Ms: interferenceMs,
      },
    });
  }, [difficulty, isZh]);

  const startGame = useCallback(async () => {
    PrepareAudioFeedback(jsPsychRef);
    await enterTrainingFullscreen();
    const freshTrials = GenerateStroopTrials(difficulty, rounds, isZh);
    setTrials(freshTrials);
    setCurrentTrialIndex(0);
    setResults(null);
    setPhase('playing');
    await jsPsychLifecycleRef.current?.start({
      moduleId: 'brain:stroop',
      onStart: () => undefined,
    });
    setIsFixation(true);
    currentTrialAnsweredRef.current = true;
    setTimeout(() => {
      setIsFixation(false);
      currentTrialAnsweredRef.current = false;
      trialStartTimeRef.current = performance.now();
      if (stimulusDurationMs > 0) {
        trialTimeoutRef.current = setTimeout(() => {
          if (!currentTrialAnsweredRef.current) {
            handleResponse('red' === freshTrials[0]?.inkColor ? 'blue' : 'red');
          }
        }, stimulusDurationMs);
      }
    }, 500);
  }, [difficulty, enterTrainingFullscreen, handleResponse, isZh, rounds, stimulusDurationMs]);

  useEffect(() => {
    if (phase !== 'playing') return;
    const handleKeyDown = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      if (key === '1' || key === 'r') handleResponse('red');
      else if (key === '2' || key === 'g') handleResponse('green');
      else if (key === '3' || key === 'b') handleResponse('blue');
      else if (key === '4' || key === 'y') handleResponse('yellow');
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleResponse, phase]);

  const difficultyLabels = {
    easy: isZh ? '初級（一致為主）' : 'Beginner',
    medium: isZh ? '中級（標準平衡）' : 'Intermediate',
    hard: isZh ? '高級（高強度衝突）' : 'Advanced',
  };

  const durationLabels = {
    1500: isZh ? '1.5 秒' : '1.5s',
    2500: isZh ? '2.5 秒' : '2.5s',
    4000: isZh ? '4.0 秒' : '4.0s',
    0: isZh ? '不限時' : 'Unlimited',
  };

  return (
    <div ref={fullscreenRootRef} className={`cognitive-reference-game stroop-game stroop-phase-${phase}`}>
      <div ref={jsPsychHostRef} style={{ display: 'none' }} />

      {phase === 'menu' && (
        <TrainingConfigPanel
          title={isZh ? '色彩干擾抑制（Stroop）' : 'Color Word Interference (Stroop)'}
          subtitle={isZh ? '辨識文字印刷顏色並抑制字義干擾，練習選擇性注意力。' : 'Identify font color while suppressing word meaning to practise selective attention.'}
          onStart={() => setPhase('rules')}
          actionLabel={isZh ? '查看規則說明' : 'View Rules'}
        >
          <TrainingConfigSection title={isZh ? '難度設定' : 'Difficulty'}>
            <TrainingConfigOptionGroup
              options={[
                { value: 'easy', label: difficultyLabels.easy, description: isZh ? '70% 一致色彩，刺激溫和' : '70% congruent trials' },
                { value: 'medium', label: difficultyLabels.medium, description: isZh ? '一致與衝突平衡出現' : 'Balanced congruent and conflict' },
                { value: 'hard', label: difficultyLabels.hard, description: isZh ? '70% 衝突色彩，高度抗干擾' : '70% conflict trials' },
              ]}
              selectedValue={difficulty}
              onChange={(val) => setDifficulty(val as StroopDifficulty)}
            />
          </TrainingConfigSection>

          <TrainingConfigSection title={isZh ? '回合題數' : 'Trials'}>
            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
              {[10, 20, 30, 40].map((count) => (
                <button
                  key={count}
                  type="button"
                  onClick={() => setRounds(count)}
                  style={{
                    flex: 1,
                    minWidth: '80px',
                    padding: '12px',
                    borderRadius: '8px',
                    border: rounds === count ? '2px solid var(--primary)' : '1px solid var(--border)',
                    background: rounds === count ? 'color-mix(in srgb, var(--primary) 18%, transparent)' : 'var(--surface)',
                    color: 'var(--text-primary)',
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  {count} {isZh ? '題' : 'trials'}
                </button>
              ))}
            </div>
          </TrainingConfigSection>

          <TrainingConfigSection title={isZh ? '每題作答時限' : 'Time Limit Per Trial'}>
            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
              {([1500, 2500, 4000, 0] as const).map((ms) => (
                <button
                  key={ms}
                  type="button"
                  onClick={() => setStimulusDurationMs(ms)}
                  style={{
                    flex: 1,
                    minWidth: '80px',
                    padding: '12px',
                    borderRadius: '8px',
                    border: stimulusDurationMs === ms ? '2px solid var(--primary)' : '1px solid var(--border)',
                    background: stimulusDurationMs === ms ? 'color-mix(in srgb, var(--primary) 18%, transparent)' : 'var(--surface)',
                    color: 'var(--text-primary)',
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  {durationLabels[ms]}
                </button>
              ))}
            </div>
          </TrainingConfigSection>

          <TrainingConfigNavigationActions
            onStart={() => setPhase('rules')}
            startLabel={isZh ? '查看規則說明' : 'View Rules'}
            onBack={handleExitTraining}
            backLabel={isZh ? '返回模組選單' : 'Back'}
          />
        </TrainingConfigPanel>
      )}

      {phase === 'rules' && (
        <BrainTrainingRulesPanel
          gameId="stroop"
          title={isZh ? '色彩干擾抑制（Stroop）' : 'Color Word Interference (Stroop)'}
          summaryTitle={isZh ? '目前設定摘要' : 'Settings Summary'}
          summaryItems={[
            { label: isZh ? '難度' : 'Difficulty', value: difficultyLabels[difficulty] },
            { label: isZh ? '總題數' : 'Trials', value: `${rounds} ${isZh ? '題' : 'trials'}` },
            { label: isZh ? '作答時限' : 'Time Limit', value: durationLabels[stimulusDurationMs as keyof typeof durationLabels] ?? `${stimulusDurationMs}ms` },
            { label: isZh ? '聲音' : 'Audio', value: soundEnabled ? (isZh ? '開啟' : 'On') : (isZh ? '關閉' : 'Off') },
          ]}
          onStart={() => void startGame()}
          onBack={() => setPhase('menu')}
        />
      )}

      {phase === 'playing' && (
        <div style={{
          position: 'fixed',
          inset: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: 'max(16px, env(safe-area-inset-top)) 16px max(24px, env(safe-area-inset-bottom))',
          background: 'var(--bg)',
          color: 'var(--text-primary)',
          userSelect: 'none',
        }}>
          {/* Header Info */}
          <div style={{
            width: '100%',
            maxWidth: '680px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '12px 18px',
            background: 'var(--surface)',
            borderRadius: '16px',
            border: '1px solid var(--border)',
          }}>
            <span style={{ fontSize: '20px', fontWeight: 700 }}>
              {isZh ? `第 ${currentTrialIndex + 1} / ${trials.length} 題` : `Trial ${currentTrialIndex + 1} of ${trials.length}`}
            </span>
            <button
              type="button"
              onClick={handleExitTraining}
              style={{
                background: 'transparent',
                border: '1px solid var(--border)',
                color: 'var(--text-secondary)',
                borderRadius: '8px',
                padding: '6px 14px',
                cursor: 'pointer',
                fontSize: '16px',
              }}
            >
              {isZh ? '結束' : 'Quit'}
            </button>
          </div>

          {/* Central Instruction Banner */}
          <div style={{
            padding: '8px 20px',
            background: 'color-mix(in srgb, var(--primary) 12%, transparent)',
            borderRadius: '999px',
            border: '1px solid color-mix(in srgb, var(--primary) 40%, transparent)',
            color: 'var(--text-primary)',
            fontSize: '20px',
            fontWeight: 700,
            textAlign: 'center',
          }}>
            {isZh ? '請判斷【文字的顏色】，勿依字義！' : 'Identify the FONT COLOR, ignore word meaning!'}
          </div>

          {/* Stimulus Area */}
          <div style={{
            flex: 1,
            width: '100%',
            maxWidth: '680px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: '220px',
          }}>
            <div style={{
              width: '100%',
              minHeight: '200px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'var(--surface)',
              borderRadius: '24px',
              border: trialFeedback === 'correct'
                ? '4px solid #22c55e'
                : trialFeedback === 'incorrect'
                  ? '4px solid #ef4444'
                  : '2px solid var(--border)',
              boxShadow: '0 8px 32px rgba(0,0,0,0.25)',
              transition: 'border-color 0.15s ease',
            }}>
              {isFixation ? (
                <span style={{ fontSize: '72px', fontWeight: 900, color: 'var(--text-secondary)' }}>+</span>
              ) : activeTrial ? (
                <span style={{
                  fontSize: '84px',
                  fontWeight: 900,
                  letterSpacing: '8px',
                  color: activeTrial.inkHex,
                  textShadow: '0 4px 20px rgba(0,0,0,0.4)',
                }}>
                  {activeTrial.word}
                </span>
              ) : null}
            </div>
          </div>

          {/* 4 Large Screen Buttons */}
          <div style={{
            width: '100%',
            maxWidth: '680px',
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '14px',
          }}>
            {colorOptions.map((opt) => {
              return (
                <button
                  key={opt.key}
                  type="button"
                  disabled={isFixation || currentTrialAnsweredRef.current}
                  onClick={() => handleResponse(opt.key)}
                  style={{
                    minHeight: '76px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '12px',
                    background: 'var(--surface)',
                    border: `3px solid ${opt.hex}`,
                    borderRadius: '16px',
                    color: 'var(--text-primary)',
                    fontSize: '26px',
                    fontWeight: 800,
                    cursor: isFixation || currentTrialAnsweredRef.current ? 'default' : 'pointer',
                    boxShadow: '0 4px 14px rgba(0,0,0,0.15)',
                    transition: 'transform 0.1s ease, filter 0.1s ease',
                  }}
                  onMouseDown={(e) => { e.currentTarget.style.transform = 'scale(0.97)'; }}
                  onMouseUp={(e) => { e.currentTarget.style.transform = 'none'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.transform = 'none'; }}
                >
                  <span style={{
                    width: '28px',
                    height: '28px',
                    borderRadius: '50%',
                    background: opt.hex,
                    display: 'inline-block',
                    boxShadow: '0 2px 6px rgba(0,0,0,0.3)',
                  }} />
                  <span>{isZh ? opt.labelZh : opt.labelEn}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {phase === 'results' && results && (
        <div style={{
          position: 'fixed',
          inset: 0,
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '24px 16px',
          background: 'var(--bg)',
          color: 'var(--text-primary)',
        }}>
          <div style={{
            width: '100%',
            maxWidth: '620px',
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: '24px',
            padding: '28px',
            boxShadow: '0 12px 40px rgba(0,0,0,0.3)',
          }}>
            <h2 style={{ fontSize: '32px', fontWeight: 800, textAlign: 'center', marginBottom: '8px' }}>
              {isZh ? '練習完成' : 'Training Complete'}
            </h2>
            <p style={{ textAlign: 'center', color: 'var(--text-secondary)', fontSize: '18px', marginBottom: '24px' }}>
              {isZh ? '以下為當次色彩干擾抑制練習之反應紀錄與換算參考值' : 'Summary records for this color-word interference session'}
            </p>

            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(2, 1fr)',
              gap: '14px',
              marginBottom: '28px',
            }}>
              <div style={{ padding: '16px', background: 'var(--bg)', borderRadius: '16px', textAlign: 'center' }}>
                <div style={{ fontSize: '15px', color: 'var(--text-secondary)' }}>{isZh ? '正確率' : 'Accuracy'}</div>
                <div style={{ fontSize: '36px', fontWeight: 900, color: 'var(--primary)', marginTop: '4px' }}>
                  {results.accuracyPercent}%
                </div>
                <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                  {results.correctCount} / {results.totalRounds} {isZh ? '題' : 'trials'}
                </div>
              </div>

              <div style={{ padding: '16px', background: 'var(--bg)', borderRadius: '16px', textAlign: 'center' }}>
                <div style={{ fontSize: '15px', color: 'var(--text-secondary)' }}>{isZh ? '平均反應時間' : 'Mean Response Time'}</div>
                <div style={{ fontSize: '36px', fontWeight: 900, marginTop: '4px' }}>
                  {results.meanRtMs} <span style={{ fontSize: '18px' }}>ms</span>
                </div>
                <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>{isZh ? '毫秒' : 'milliseconds'}</div>
              </div>

              <div style={{ padding: '16px', background: 'var(--bg)', borderRadius: '16px', textAlign: 'center' }}>
                <div style={{ fontSize: '15px', color: 'var(--text-secondary)' }}>{isZh ? '一致刺激反應' : 'Congruent RT'}</div>
                <div style={{ fontSize: '28px', fontWeight: 800, color: '#22c55e', marginTop: '4px' }}>
                  {results.congruentRtMs} <span style={{ fontSize: '16px' }}>ms</span>
                </div>
                <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>{isZh ? '字義與顏色相同' : 'Word matches ink'}</div>
              </div>

              <div style={{ padding: '16px', background: 'var(--bg)', borderRadius: '16px', textAlign: 'center' }}>
                <div style={{ fontSize: '15px', color: 'var(--text-secondary)' }}>{isZh ? '衝突刺激反應' : 'Incongruent RT'}</div>
                <div style={{ fontSize: '28px', fontWeight: 800, color: '#ef4444', marginTop: '4px' }}>
                  {results.incongruentRtMs} <span style={{ fontSize: '16px' }}>ms</span>
                </div>
                <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>{isZh ? '字義與顏色衝突' : 'Word conflicts with ink'}</div>
              </div>
            </div>

            {/* Interference cost note */}
            <div style={{
              padding: '14px 18px',
              background: 'color-mix(in srgb, var(--primary) 10%, transparent)',
              borderRadius: '12px',
              border: '1px solid color-mix(in srgb, var(--primary) 25%, transparent)',
              fontSize: '15px',
              color: 'var(--text-primary)',
              marginBottom: '28px',
            }}>
              <strong>{isZh ? 'Stroop 干擾耗時：' : 'Interference latency: '}</strong>
              {results.interferenceMs > 0 ? `+${results.interferenceMs} ms` : `${results.interferenceMs} ms`}
              <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                {isZh
                  ? '（衝突情境相較於一致情境多花費的平均毫秒數，反映大腦抑制直覺字義干擾的耗時）'
                  : '(Difference in response time between conflict and congruent conditions, reflecting cognitive suppression cost)'}
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

function GenerateStroopTrials(
  difficulty: StroopDifficulty,
  rounds: number,
  isZh: boolean,
): StroopTrial[] {
  const result: StroopTrial[] = [];
  const colorKeys: StroopColorKey[] = ['red', 'green', 'blue', 'yellow'];

  let congruentRatio = 0.5;
  let incongruentRatio = 0.5;
  if (difficulty === 'easy') {
    congruentRatio = 0.7;
    incongruentRatio = 0.3;
  } else if (difficulty === 'hard') {
    congruentRatio = 0.2;
    incongruentRatio = 0.8;
  }

  for (let i = 0; i < rounds; i += 1) {
    const isCongruent = Math.random() < congruentRatio;
    const condition: StroopCondition = isCongruent ? 'congruent' : 'incongruent';

    const inkIndex = Math.floor(Math.random() * colorKeys.length);
    const inkKey = colorKeys[inkIndex];
    const inkOption = colorOptions.find((o) => o.key === inkKey)!;

    let wordKey = inkKey;
    if (!isCongruent) {
      const remaining = colorKeys.filter((k) => k !== inkKey);
      wordKey = remaining[Math.floor(Math.random() * remaining.length)];
    }
    const wordOption = colorOptions.find((o) => o.key === wordKey)!;
    const word = isZh ? wordOption.wordZh : wordOption.wordEn;

    result.push({
      trialNumber: i + 1,
      condition,
      word,
      inkColor: inkKey,
      inkHex: inkOption.hex,
      userResponse: null,
      correct: false,
      reactionTimeMs: 0,
    });
  }

  return result;
}

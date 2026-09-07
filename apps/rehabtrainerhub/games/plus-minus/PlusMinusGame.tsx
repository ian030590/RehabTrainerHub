// Canonical Hub-owned brain Plus-Minus task runtime.
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

type PlusMinusPhase = 'menu' | 'rules' | 'playing' | 'results';
type BlockType = 'plus' | 'minus' | 'alternating';

interface PlusMinusGameProps {
  onExit?: () => void;
}

interface TrialProblem {
  baseNumber: number;
  operation: 'plus' | 'minus';
  offset: number;
  correctAnswer: number;
  options: number[];
}

interface TrialResult {
  block: BlockType;
  baseNumber: number;
  operation: 'plus' | 'minus';
  correctAnswer: number;
  selectedAnswer: number;
  isCorrect: boolean;
  rt: number;
}

interface PlusMinusSessionRecord {
  totalTrials: number;
  accuracyPercent: number;
  shiftCostMs: number;
  plusRt: number;
  minusRt: number;
  switchRt: number;
  trials: TrialResult[];
}

function GenerateTrialOptions(correctAnswer: number, oppositeAnswer: number): number[] {
  const optionsSet = new Set<number>();
  optionsSet.add(correctAnswer);
  optionsSet.add(oppositeAnswer);

  const offsets = [-2, -1, 1, 2, 4, -4];
  for (const off of offsets) {
    if (optionsSet.size >= 4) break;
    const candidate = correctAnswer + off;
    if (candidate > 0 && candidate !== correctAnswer && candidate !== oppositeAnswer) {
      optionsSet.add(candidate);
    }
  }

  let fallbackOff = 3;
  while (optionsSet.size < 4) {
    optionsSet.add(correctAnswer + fallbackOff);
    fallbackOff += 2;
  }

  const arr = Array.from(optionsSet);
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function GenerateBlockTrials(block: BlockType, count: number, offset: number): TrialProblem[] {
  const trials: TrialProblem[] = [];
  for (let i = 0; i < count; i++) {
    let op: 'plus' | 'minus';
    if (block === 'plus') {
      op = 'plus';
    } else if (block === 'minus') {
      op = 'minus';
    } else {
      op = i % 2 === 0 ? 'plus' : 'minus';
    }

    const baseNumber = Math.floor(Math.random() * 70) + 15;
    const correctAnswer = op === 'plus' ? baseNumber + offset : baseNumber - offset;
    const oppositeAnswer = op === 'plus' ? baseNumber - offset : baseNumber + offset;
    const options = GenerateTrialOptions(correctAnswer, oppositeAnswer);

    trials.push({
      baseNumber,
      operation: op,
      offset,
      correctAnswer,
      options,
    });
  }
  return trials;
}

export function PlusMinusGame({ onExit }: PlusMinusGameProps) {
  const { lang, t } = useT();
  const isZh = lang === 'zh' || lang === 'zh-TW';
  const hostedSettings = useHostedGameSettings();
  const [fullscreenRootRef, requestFullscreenOnPlay] = useFullscreenTrainingRoot<HTMLDivElement>();
  const jsPsychLifecycleRef = useRef<JsPsychExternalLifecycle | null>(null);

  const defaultDifficulty = '3';
  const defaultProblemCount = 10;

  const [difficulty, setDifficulty] = useState<string>(() => (
    String(hostedSettings?.difficulty ?? defaultDifficulty)
  ));
  const [problemCount, setProblemCount] = useState<number>(() => (
    Number(hostedSettings?.problemCount ?? defaultProblemCount)
  ));

  useEffect(() => {
    if (hostedSettings?.difficulty !== undefined) {
      setDifficulty(String(hostedSettings.difficulty));
    }
    if (hostedSettings?.problemCount !== undefined) {
      setProblemCount(Number(hostedSettings.problemCount));
    }
  }, [hostedSettings]);

  const offset = Number(difficulty);

  const [phase, setPhase] = useState<PlusMinusPhase>('menu');
  const [currentBlockIndex, setCurrentBlockIndex] = useState<number>(0);
  const [subPhase, setSubPhase] = useState<'block-intro' | 'problem' | 'feedback'>('block-intro');
  const [blockTrials, setBlockTrials] = useState<TrialProblem[]>([]);
  const [currentProblemIndex, setCurrentProblemIndex] = useState<number>(0);
  const [results, setResults] = useState<TrialResult[]>([]);
  const [lastFeedback, setLastFeedback] = useState<{ isCorrect: boolean; selected: number } | null>(null);
  const [sessionSummary, setSessionSummary] = useState<PlusMinusSessionRecord | null>(null);

  const stimulusStartRef = useRef<number>(0);
  const blockSequence: BlockType[] = ['plus', 'minus', 'alternating'];
  const currentBlockType = blockSequence[currentBlockIndex];

  useTrainingConfigReady(phase === 'menu');

  const handleExitTraining = useCallback(() => {
    try {
      jsPsychLifecycleRef.current?.abort({ reason: 'user_exit' });
    } catch {
      // Fallback
    }
    onExit?.();
  }, [onExit]);

  useTrainingAbort(phase === 'playing', handleExitTraining);

  useEffect(() => {
    return () => {
      const lifecycle = jsPsychLifecycleRef.current;
      if (lifecycle) {
        lifecycle.dispose();
      }
    };
  }, []);

  const startGame = useCallback(() => {
    PrepareAudioFeedback();
    try {
      const jsPsych = initJsPsych();
      const lifecycle = new JsPsychExternalLifecycle(jsPsych);
      jsPsychLifecycleRef.current = lifecycle;
      jsPsychLifecycleRef.current?.start({
        name: 'plus-minus',
      });
    } catch {
      // Fallback
    }

    setPhase('playing');
    setCurrentBlockIndex(0);
    setResults([]);
    const firstTrials = GenerateBlockTrials('plus', problemCount, offset);
    setBlockTrials(firstTrials);
    setCurrentProblemIndex(0);
    setSubPhase('block-intro');
  }, [problemCount, offset]);

  const handleStartPlay = () => {
    requestFullscreenOnPlay();
    startGame();
  };

  const startBlockProblems = useCallback(() => {
    setSubPhase('problem');
    stimulusStartRef.current = performance.now();
  }, []);

  const handleAnswer = (selected: number) => {
    if (subPhase !== 'problem') return;
    const currentProblem = blockTrials[currentProblemIndex];
    if (!currentProblem) return;

    const rt = Math.round(performance.now() - stimulusStartRef.current);
    const isCorrect = selected === currentProblem.correctAnswer;

    if (isCorrect) {
      PlaySuccessSound();
    } else {
      PlayFailureSound();
    }

    const newResult: TrialResult = {
      block: currentBlockType,
      baseNumber: currentProblem.baseNumber,
      operation: currentProblem.operation,
      correctAnswer: currentProblem.correctAnswer,
      selectedAnswer: selected,
      isCorrect,
      rt,
    };

    const nextResults = [...results, newResult];
    setResults(nextResults);
    setLastFeedback({ isCorrect, selected });
    setSubPhase('feedback');

    setTimeout(() => {
      setLastFeedback(null);
      const nextProblemIdx = currentProblemIndex + 1;

      if (nextProblemIdx < blockTrials.length) {
        setCurrentProblemIndex(nextProblemIdx);
        setSubPhase('problem');
        stimulusStartRef.current = performance.now();
      } else {
        const nextBlockIdx = currentBlockIndex + 1;
        if (nextBlockIdx < blockSequence.length) {
          setCurrentBlockIndex(nextBlockIdx);
          const nextTrials = GenerateBlockTrials(blockSequence[nextBlockIdx], problemCount, offset);
          setBlockTrials(nextTrials);
          setCurrentProblemIndex(0);
          setSubPhase('block-intro');
        } else {
          PlayGameEndSound();
          const plusTrials = nextResults.filter((r) => r.block === 'plus');
          const minusTrials = nextResults.filter((r) => r.block === 'minus');
          const switchTrials = nextResults.filter((r) => r.block === 'alternating');

          const plusRt = plusTrials.length > 0 ? Math.round(plusTrials.reduce((a, b) => a + b.rt, 0) / plusTrials.length) : 0;
          const minusRt = minusTrials.length > 0 ? Math.round(minusTrials.reduce((a, b) => a + b.rt, 0) / minusTrials.length) : 0;
          const switchRt = switchTrials.length > 0 ? Math.round(switchTrials.reduce((a, b) => a + b.rt, 0) / switchTrials.length) : 0;

          const baselineRt = (plusRt + minusRt) / 2;
          const shiftCostMs = baselineRt > 0 && switchRt > 0 ? Math.round(switchRt - baselineRt) : 0;

          const totalCorrect = nextResults.filter((r) => r.isCorrect).length;
          const accuracyPercent = nextResults.length > 0 ? Math.round((totalCorrect / nextResults.length) * 100) : 0;

          const summary: PlusMinusSessionRecord = {
            totalTrials: nextResults.length,
            accuracyPercent,
            shiftCostMs,
            plusRt,
            minusRt,
            switchRt,
            trials: nextResults,
          };

          setSessionSummary(summary);
          SaveTrainingSessionRecord({
            module: 'plus-minus',
            date: FormatTestDate(new Date()),
            accuracyPercent,
            meanReactionTimeMs: switchRt,
            totalTrials: nextResults.length,
            successfulTrials: totalCorrect,
            user: GetAuthUserNameFromToken() ?? 'Guest',
          });

          try {
            jsPsychLifecycleRef.current?.finish({
              status: 'completed',
              totalTrials: nextResults.length,
              accuracyPercent,
              shiftCostMs,
            });
          } catch {
            // Fallback
          }
          setPhase('results');
        }
      }
    }, 400);
  };

  const currentProblem = blockTrials[currentProblemIndex];

  return (
    <div
      ref={fullscreenRootRef}
      className="thinking-game-wrapper"
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100dvh',
        width: '100%',
        boxSizing: 'border-box',
        position: 'relative',
      }}
    >
      {phase === 'menu' && (
        <TrainingConfigPanel
          title={isZh ? '心算加減切換任務' : 'Plus-Minus Task'}
          subtitle={
            isZh
              ? '進行純加法、純減法與交替運算區塊，評估心智設定轉換代價與認知靈活度'
              : 'Measure mental set shifting cost between addition and subtraction blocks'
          }
        >
          <TrainingConfigSection title={isZh ? '運算難度（加減數值）' : 'Operation Difficulty'}>
            <TrainingConfigOptionGroup
              name="difficulty"
              options={[
                { value: '2', label: isZh ? '加減 2（入門）' : 'Add/Subtract 2 (Easy)' },
                { value: '3', label: isZh ? '加減 3（經典標準）' : 'Add/Subtract 3 (Standard)' },
                { value: '5', label: isZh ? '加減 5（進階）' : 'Add/Subtract 5 (Hard)' },
              ]}
              selectedValue={difficulty}
              onChange={(val) => setDifficulty(val)}
            />
          </TrainingConfigSection>

          <TrainingConfigSection title={isZh ? '每階段題數' : 'Problems per Block'}>
            <TrainingConfigOptionGroup
              name="problemCount"
              options={[
                { value: '8', label: isZh ? '8 題' : '8 problems' },
                { value: '10', label: isZh ? '10 題' : '10 problems' },
                { value: '14', label: isZh ? '14 題' : '14 problems' },
              ]}
              selectedValue={String(problemCount)}
              onChange={(val) => setProblemCount(Number(val))}
            />
          </TrainingConfigSection>

          <TrainingConfigNavigationActions
            onStart={handleStartPlay}
            onRules={() => setPhase('rules')}
            onExit={handleExitTraining}
          />
        </TrainingConfigPanel>
      )}

      {phase === 'rules' && (
        <BrainTrainingRulesPanel
          gameId="plus-minus"
          isEn={!isZh}
          onBack={() => setPhase('menu')}
          onStart={handleStartPlay}
        />
      )}

      {phase === 'playing' && (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            width: '100%',
            maxWidth: '680px',
            padding: '20px 16px',
            boxSizing: 'border-box',
          }}
        >
          <div
            style={{
              width: '100%',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '16px',
            }}
          >
            <span style={{ fontSize: '20px', fontWeight: 800, color: 'var(--accent)' }}>
              {isZh
                ? `階段 ${currentBlockIndex + 1} / 3: ${
                    currentBlockType === 'plus'
                      ? `純加法 (+${offset})`
                      : currentBlockType === 'minus'
                      ? `純減法 (-${offset})`
                      : `交替切換 (+/- ${offset})`
                  }`
                : `Block ${currentBlockIndex + 1} / 3: ${
                    currentBlockType === 'plus'
                      ? 'Pure Addition'
                      : currentBlockType === 'minus'
                      ? 'Pure Subtraction'
                      : 'Alternating Shift'
                  }`}
            </span>
            <button
              type="button"
              onClick={handleExitTraining}
              style={{
                background: 'transparent',
                border: '1px solid var(--border)',
                borderRadius: '12px',
                padding: '8px 16px',
                color: 'var(--text-secondary)',
                fontSize: '15px',
                cursor: 'pointer',
              }}
            >
              {isZh ? '退出' : 'Exit'}
            </button>
          </div>

          {subPhase === 'block-intro' && (
            <div
              style={{
                width: '100%',
                background: 'var(--card-bg)',
                borderRadius: '24px',
                padding: '36px 24px',
                textAlign: 'center',
                boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
              }}
            >
              <div style={{ fontSize: '48px', marginBottom: '12px' }}>
                {currentBlockType === 'plus' ? '➕' : currentBlockType === 'minus' ? '➖' : '🔀'}
              </div>
              <h2 style={{ fontSize: '26px', fontWeight: 900, marginBottom: '12px', color: 'var(--accent)' }}>
                {isZh
                  ? currentBlockType === 'plus'
                    ? `第一階段：全部加 ${offset}`
                    : currentBlockType === 'minus'
                    ? `第二階段：全部減 ${offset}`
                    : `第三階段：加減交替輪流 (+${offset} / -${offset})`
                  : currentBlockType === 'plus'
                  ? `Block 1: Add ${offset}`
                  : currentBlockType === 'minus'
                  ? `Block 2: Subtract ${offset}`
                  : `Block 3: Alternating (+${offset} / -${offset})`}
              </h2>
              <p style={{ fontSize: '18px', color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: '32px' }}>
                {isZh
                  ? currentBlockType === 'plus'
                    ? `每個題目都請計算【原數字 ＋ ${offset}】並點選正確答案。`
                    : currentBlockType === 'minus'
                    ? `每個題目都請計算【原數字 － ${offset}】並點選正確答案。`
                    : `題目將逐題交替輪替：第一題 ＋${offset}、第二題 －${offset}、第三題 ＋${offset}⋯隨時切換運算！`
                  : currentBlockType === 'plus'
                  ? `Calculate number + ${offset} for every problem.`
                  : currentBlockType === 'minus'
                  ? `Calculate number - ${offset} for every problem.`
                  : `Operations alternate every trial: first +${offset}, then -${offset}, then +${offset}...`}
              </p>
              <button
                type="button"
                onClick={startBlockProblems}
                style={{
                  minHeight: '64px',
                  width: '100%',
                  maxWidth: '360px',
                  fontSize: '22px',
                  fontWeight: 900,
                  borderRadius: '16px',
                  border: 'none',
                  background: 'var(--accent)',
                  color: '#ffffff',
                  cursor: 'pointer',
                  boxShadow: '0 4px 16px rgba(56, 189, 248, 0.4)',
                }}
              >
                {isZh ? '開始此階段' : 'Start This Block'}
              </button>
            </div>
          )}

          {(subPhase === 'problem' || subPhase === 'feedback') && currentProblem && (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                width: '100%',
                minHeight: '50vh',
              }}
            >
              <div style={{ marginBottom: '16px', fontSize: '16px', color: 'var(--text-secondary)' }}>
                {isZh
                  ? `題目 ${currentProblemIndex + 1} / ${blockTrials.length}`
                  : `Problem ${currentProblemIndex + 1} / ${blockTrials.length}`}
              </div>

              <div
                style={{
                  width: '320px',
                  padding: '24px',
                  background: 'var(--card-bg)',
                  border: '3px solid var(--accent)',
                  borderRadius: '24px',
                  textAlign: 'center',
                  boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
                  marginBottom: '28px',
                }}
              >
                <div style={{ fontSize: '64px', fontWeight: 900, color: 'var(--text-primary)', lineHeight: 1 }}>
                  {currentProblem.baseNumber}
                </div>
                <div
                  style={{
                    display: 'inline-block',
                    marginTop: '12px',
                    padding: '6px 18px',
                    borderRadius: '12px',
                    fontSize: '24px',
                    fontWeight: 800,
                    background: currentProblem.operation === 'plus' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(245, 158, 11, 0.15)',
                    color: currentProblem.operation === 'plus' ? '#10b981' : '#f59e0b',
                    border: `2px solid ${currentProblem.operation === 'plus' ? '#10b981' : '#f59e0b'}`,
                  }}
                >
                  {currentProblem.operation === 'plus' ? `＋ ${offset}` : `－ ${offset}`}
                </div>
              </div>

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(2, 1fr)',
                  gap: '14px',
                  width: '100%',
                  maxWidth: '480px',
                }}
              >
                {currentProblem.options.map((opt) => {
                  let btnBg = 'var(--bg)';
                  let btnBorder = 'var(--border)';
                  if (lastFeedback) {
                    if (opt === currentProblem.correctAnswer) {
                      btnBg = 'rgba(16, 185, 129, 0.25)';
                      btnBorder = '#10b981';
                    } else if (opt === lastFeedback.selected && !lastFeedback.isCorrect) {
                      btnBg = 'rgba(239, 68, 68, 0.25)';
                      btnBorder = '#ef4444';
                    }
                  }

                  return (
                    <button
                      key={opt}
                      type="button"
                      disabled={subPhase === 'feedback'}
                      onClick={() => handleAnswer(opt)}
                      style={{
                        minHeight: '84px',
                        background: btnBg,
                        border: `3px solid ${btnBorder}`,
                        borderRadius: '20px',
                        color: 'var(--text-primary)',
                        fontSize: '36px',
                        fontWeight: 900,
                        cursor: subPhase === 'feedback' ? 'default' : 'pointer',
                        transition: 'transform 0.1s',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      {opt}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {phase === 'results' && sessionSummary && (
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
                {isZh ? '心算加減切換 (Plus-Minus) 當次紀錄換算參考值' : 'Mental set shift cost metrics'}
              </p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div style={{ padding: '16px', background: 'var(--bg)', borderRadius: '16px', textAlign: 'center' }}>
                <div style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>
                  {isZh ? '整體正確率' : 'Accuracy'}
                </div>
                <div style={{ fontSize: '36px', fontWeight: 900, color: 'var(--accent)', marginTop: '4px' }}>
                  {sessionSummary.accuracyPercent}%
                </div>
                <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                  {sessionSummary.totalTrials} {isZh ? '題總計' : 'problems'}
                </div>
              </div>

              <div style={{ padding: '16px', background: 'var(--bg)', borderRadius: '16px', textAlign: 'center' }}>
                <div style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>
                  {isZh ? '心智切換耗損 (Shift Cost)' : 'Shift Cost'}
                </div>
                <div style={{ fontSize: '36px', fontWeight: 900, marginTop: '4px' }}>
                  {sessionSummary.shiftCostMs > 0 ? `+${sessionSummary.shiftCostMs}` : sessionSummary.shiftCostMs}
                </div>
                <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                  ms
                </div>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
              <div style={{ padding: '12px', background: 'var(--bg)', borderRadius: '12px', textAlign: 'center' }}>
                <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{isZh ? '純加法反應' : 'Pure Add RT'}</div>
                <div style={{ fontSize: '20px', fontWeight: 800, marginTop: '4px' }}>{sessionSummary.plusRt} ms</div>
              </div>
              <div style={{ padding: '12px', background: 'var(--bg)', borderRadius: '12px', textAlign: 'center' }}>
                <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{isZh ? '純減法反應' : 'Pure Sub RT'}</div>
                <div style={{ fontSize: '20px', fontWeight: 800, marginTop: '4px' }}>{sessionSummary.minusRt} ms</div>
              </div>
              <div style={{ padding: '12px', background: 'var(--bg)', borderRadius: '12px', textAlign: 'center' }}>
                <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{isZh ? '交替切換反應' : 'Shift RT'}</div>
                <div style={{ fontSize: '20px', fontWeight: 800, marginTop: '4px' }}>{sessionSummary.switchRt} ms</div>
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

export default PlusMinusGame;

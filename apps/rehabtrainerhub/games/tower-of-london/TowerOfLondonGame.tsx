// Canonical Hub-owned brain Tower of London (TOL) executive planning runtime.
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

export type TowerDifficulty = 'easy' | 'medium' | 'hard';
type TowerPhase = 'menu' | 'rules' | 'playing' | 'results';
type BallColor = 'R' | 'G' | 'B';
type PegsState = [BallColor[], BallColor[], BallColor[]];

const pegCapacities = [3, 2, 1] as const;

interface TowerOfLondonGameProps {
  onExit: () => void;
}

interface TowerPuzzle {
  puzzleNumber: number;
  startPegs: PegsState;
  goalPegs: PegsState;
  optimalMoves: number;
}

interface TowerTrialRecord {
  puzzleNumber: number;
  optimalMoves: number;
  actualMoves: number;
  isOptimal: boolean;
  timeTakenMs: number;
}

interface TowerSessionRecord {
  totalRounds: number;
  difficulty: TowerDifficulty;
  solvedCount: number;
  optimalCount: number;
  optimalRatePercent: number;
  meanMoves: number;
  meanOptimalMoves: number;
  totalPlanningTimeSeconds: number;
  trials: TowerTrialRecord[];
}

export function TowerOfLondonGame({ onExit }: TowerOfLondonGameProps) {
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

  const [phase, setPhase] = useState<TowerPhase>('menu');
  const [difficulty, setDifficulty] = useState<TowerDifficulty>('medium');
  const [rounds, setRounds] = useState(6);
  const [showOptimalHint, setShowOptimalHint] = useState(true);
  const [soundEnabled, setSoundEnabled] = useState(true);

  const hostedSettings = useHostedGameSettings();
  const hostedSettingsAppliedRef = useRef(false);
  useTrainingConfigReady(phase === 'menu');

  const [puzzles, setPuzzles] = useState<TowerPuzzle[]>([]);
  const [currentPuzzleIndex, setCurrentPuzzleIndex] = useState(0);
  const [currentPegs, setCurrentPegs] = useState<PegsState>([[], [], []]);
  const [selectedPeg, setSelectedPeg] = useState<number | null>(null);
  const [currentMovesCount, setCurrentMovesCount] = useState(0);
  const [warningMessage, setWarningMessage] = useState<string | null>(null);
  const [isPuzzleSolved, setIsPuzzleSolved] = useState(false);
  const [trialRecords, setTrialRecords] = useState<TowerTrialRecord[]>([]);
  const [results, setResults] = useState<TowerSessionRecord | null>(null);

  const puzzleStartTimeRef = useRef<number>(0);
  const totalSessionStartTimeRef = useRef<number>(0);

  useEffect(() => {
    if (!hostedSettings || hostedSettingsAppliedRef.current) return;
    hostedSettingsAppliedRef.current = true;
    if (hostedSettings.difficulty === 'easy' || hostedSettings.difficulty === 'medium' || hostedSettings.difficulty === 'hard') {
      setDifficulty(hostedSettings.difficulty);
    }
    if (typeof hostedSettings.rounds === 'number' && hostedSettings.rounds >= 3 && hostedSettings.rounds <= 12) {
      setRounds(hostedSettings.rounds);
    }
    if (typeof hostedSettings.showOptimalHint === 'boolean') {
      setShowOptimalHint(hostedSettings.showOptimalHint);
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

  const activePuzzle = puzzles[currentPuzzleIndex] ?? null;

  const showWarning = useCallback((msg: string) => {
    setWarningMessage(msg);
    if (soundEnabled) PlayFailureSound(jsPsychRef);
    setTimeout(() => {
      setWarningMessage((prev) => (prev === msg ? null : prev));
    }, 1500);
  }, [soundEnabled]);

  const completeSession = useCallback((finalTrials: TowerTrialRecord[]) => {
    const totalRounds = finalTrials.length;
    const solvedCount = totalRounds;
    const optimalCount = finalTrials.filter((t) => t.isOptimal).length;
    const optimalRatePercent = totalRounds > 0 ? Math.round((optimalCount / totalRounds) * 100) : 0;

    const totalMoves = finalTrials.reduce((sum, t) => sum + t.actualMoves, 0);
    const meanMoves = totalRounds > 0 ? Math.round((totalMoves / totalRounds) * 10) / 10 : 0;

    const totalOptimalMoves = finalTrials.reduce((sum, t) => sum + t.optimalMoves, 0);
    const meanOptimalMoves = totalRounds > 0 ? Math.round((totalOptimalMoves / totalRounds) * 10) / 10 : 0;

    const totalPlanningTimeSeconds = Math.round((performance.now() - totalSessionStartTimeRef.current) / 1000);

    const record: TowerSessionRecord = {
      totalRounds,
      difficulty,
      solvedCount,
      optimalCount,
      optimalRatePercent,
      meanMoves,
      meanOptimalMoves,
      totalPlanningTimeSeconds,
      trials: finalTrials,
    };

    jsPsychLifecycleRef.current?.finish(record as unknown as Record<string, unknown>);
    PlayGameEndSound('Victory', jsPsychRef);
    setResults(record);
    setPhase('results');

    const participantId = GetAuthUserNameFromToken() || 'Unknown';
    void SaveTrainingSessionRecord({
      gameId: 'tower-of-london',
      gameTitle: isZh ? '倫敦塔規劃 (Tower of London)' : 'Tower of London Planning',
      category: 'higher-cognition',
      score: optimalRatePercent,
      metrics: {
        totalRounds,
        difficulty,
        optimalCount,
        optimalRatePercent,
        meanMoves,
        meanOptimalMoves,
        totalPlanningTimeSeconds,
      },
      participantId,
      notes: isZh
        ? `規劃難度: ${difficulty}, 最佳解率: ${optimalRatePercent}%, 平均步數: ${meanMoves} (最佳: ${meanOptimalMoves}), 總耗時: ${totalPlanningTimeSeconds}秒`
        : `Planning: ${difficulty}, Optimal Rate: ${optimalRatePercent}%, Mean Moves: ${meanMoves} (Optimal: ${meanOptimalMoves}), Time: ${totalPlanningTimeSeconds}s`,
    });
  }, [difficulty, isZh]);

  const advanceToNextPuzzle = useCallback((updatedTrials: TowerTrialRecord[]) => {
    const nextIndex = currentPuzzleIndex + 1;
    if (nextIndex >= puzzles.length) {
      completeSession(updatedTrials);
    } else {
      setCurrentPuzzleIndex(nextIndex);
      const nextPuzzle = puzzles[nextIndex];
      setCurrentPegs(ClonePegs(nextPuzzle.startPegs));
      setSelectedPeg(null);
      setCurrentMovesCount(0);
      setIsPuzzleSolved(false);
      puzzleStartTimeRef.current = performance.now();
    }
  }, [completeSession, currentPuzzleIndex, puzzles]);

  const handlePegClick = useCallback((pegIndex: number) => {
    if (phase !== 'playing' || isPuzzleSolved || !activePuzzle) return;

    if (selectedPeg === null) {
      // Pick up ball from pegIndex
      if (currentPegs[pegIndex].length === 0) {
        showWarning(isZh ? '此柱子上沒有球！' : 'This peg has no balls!');
        return;
      }
      setSelectedPeg(pegIndex);
      if (soundEnabled) PlaySuccessSound(jsPsychRef);
    } else if (selectedPeg === pegIndex) {
      // Deselect
      setSelectedPeg(null);
    } else {
      // Attempt to move top ball from selectedPeg to pegIndex
      const targetCapacity = pegCapacities[pegIndex];
      if (currentPegs[pegIndex].length >= targetCapacity) {
        showWarning(isZh ? `此柱最多只能容納 ${targetCapacity} 顆球！` : `This peg can hold at most ${targetCapacity} balls!`);
        return;
      }

      // Valid move
      const sourceBall = currentPegs[selectedPeg][currentPegs[selectedPeg].length - 1];
      const nextPegs: PegsState = [
        [...currentPegs[0]],
        [...currentPegs[1]],
        [...currentPegs[2]],
      ];
      nextPegs[selectedPeg].pop();
      nextPegs[pegIndex].push(sourceBall);

      setCurrentPegs(nextPegs);
      setSelectedPeg(null);
      const newMoves = currentMovesCount + 1;
      setCurrentMovesCount(newMoves);
      if (soundEnabled) PlaySuccessSound(jsPsychRef);

      // Check if goal reached
      if (ArePegsEqual(nextPegs, activePuzzle.goalPegs)) {
        setIsPuzzleSolved(true);
        if (soundEnabled) PlayGameEndSound('StageClear', jsPsychRef);

        const timeTakenMs = Math.round(performance.now() - puzzleStartTimeRef.current);
        const trialRecord: TowerTrialRecord = {
          puzzleNumber: activePuzzle.puzzleNumber,
          optimalMoves: activePuzzle.optimalMoves,
          actualMoves: newMoves,
          isOptimal: newMoves <= activePuzzle.optimalMoves,
          timeTakenMs,
        };

        const nextTrialList = [...trialRecords, trialRecord];
        setTrialRecords(nextTrialList);

        setTimeout(() => {
          advanceToNextPuzzle(nextTrialList);
        }, 700);
      }
    }
  }, [activePuzzle, advanceToNextPuzzle, currentMovesCount, currentPegs, isPuzzleSolved, isZh, phase, selectedPeg, showWarning, soundEnabled, trialRecords]);

  const handleResetCurrentPuzzle = useCallback(() => {
    if (phase !== 'playing' || !activePuzzle) return;
    setCurrentPegs(ClonePegs(activePuzzle.startPegs));
    setSelectedPeg(null);
    setCurrentMovesCount(0);
    if (soundEnabled) PlayFailureSound(jsPsychRef);
  }, [activePuzzle, phase, soundEnabled]);

  const startGame = useCallback(() => {
    PrepareAudioFeedback();
    const generatedPuzzles = GenerateTowerPuzzles(difficulty, rounds);
    setPuzzles(generatedPuzzles);
    setCurrentPuzzleIndex(0);
    setCurrentPegs(ClonePegs(generatedPuzzles[0].startPegs));
    setSelectedPeg(null);
    setCurrentMovesCount(0);
    setIsPuzzleSolved(false);
    setTrialRecords([]);
    setResults(null);
    setWarningMessage(null);
    setPhase('playing');

    totalSessionStartTimeRef.current = performance.now();
    puzzleStartTimeRef.current = performance.now();

    jsPsychLifecycleRef.current?.start({
      difficulty,
      rounds,
      showOptimalHint,
    });
  }, [difficulty, rounds, showOptimalHint]);

  const configOptions = useMemo(() => {
    const diffOptions = [
      { id: 'easy', label: isZh ? '初級（2~3 步解題）' : 'Easy (2-3 steps)' },
      { id: 'medium', label: isZh ? '中級（3~4 步解題）' : 'Medium (3-4 steps)' },
      { id: 'hard', label: isZh ? '高級（4~5 步解題）' : 'Hard (4-5 steps)' },
    ];
    return { diffOptions };
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
          title={isZh ? '倫敦塔規劃 (Tower of London)' : 'Tower of London Planning'}
          subtitle={isZh ? '居家前額葉執行功能與策略規劃練習' : 'Executive planning & problem-solving home activity'}
        >
          <TrainingConfigSection title={isZh ? '規劃難度' : 'Planning Difficulty'}>
            <TrainingConfigOptionGroup
              options={configOptions.diffOptions}
              value={difficulty}
              onChange={(val) => setDifficulty(val as TowerDifficulty)}
            />
          </TrainingConfigSection>

          <TrainingConfigSection title={isZh ? '題目數量' : 'Trial Count'}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '8px 0' }}>
              <input
                type="range"
                min={3}
                max={12}
                step={1}
                value={rounds}
                onChange={(e) => setRounds(Number(e.target.value))}
                style={{ flex: 1, accentColor: 'var(--accent)', cursor: 'pointer' }}
              />
              <span style={{ minWidth: '60px', fontWeight: 700, fontSize: '18px' }}>
                {rounds} {isZh ? '題' : 'puzzles'}
              </span>
            </div>
          </TrainingConfigSection>

          <TrainingConfigSection title={isZh ? '提示設定' : 'Hint Settings'}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer', fontSize: '16px' }}>
              <input
                type="checkbox"
                checked={showOptimalHint}
                onChange={(e) => setShowOptimalHint(e.target.checked)}
                style={{ width: '20px', height: '20px', accentColor: 'var(--accent)' }}
              />
              <span>{isZh ? '顯示最佳最少步數提示' : 'Show minimum step hint'}</span>
            </label>
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
          gameId="tower-of-london"
          onStart={() => void startGame()}
          onBack={() => setPhase('menu')}
        />
      )}

      {phase === 'playing' && activePuzzle && (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'space-between',
            width: '100%',
            maxWidth: '680px',
            height: '96dvh',
            padding: '16px 16px',
            boxSizing: 'border-box',
          }}
        >
          {/* Top Status & Target Goal */}
          <div
            style={{
              width: '100%',
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
              background: 'var(--card-bg)',
              borderRadius: '20px',
              padding: '14px 20px',
              boxSizing: 'border-box',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '17px', fontWeight: 700 }}>
              <span>
                {isZh ? '進度' : 'Puzzle'}: {currentPuzzleIndex + 1} / {puzzles.length}
              </span>
              {showOptimalHint && (
                <span style={{ color: 'var(--accent)' }}>
                  {isZh ? '最少步數' : 'Optimal'}: {activePuzzle.optimalMoves} {isZh ? '步' : 'moves'}
                </span>
              )}
            </div>

            {/* Target Goal Towers Display */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '20px', paddingTop: '4px' }}>
              <span style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-secondary)' }}>
                {isZh ? '目標狀態：' : 'Target Goal:'}
              </span>
              <RenderTowerMini pegs={activePuzzle.goalPegs} />
            </div>
          </div>

          {/* Center Play Area: Interactive Current Towers */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              width: '100%',
              background: isPuzzleSolved ? 'rgba(34, 197, 94, 0.15)' : 'var(--card-bg)',
              border: isPuzzleSolved ? '4px solid #22c55e' : '3px solid var(--border)',
              borderRadius: '24px',
              padding: '24px 16px',
              boxSizing: 'border-box',
              position: 'relative',
              transition: 'all 0.2s ease',
            }}
          >
            {/* Warning Message Toast */}
            {warningMessage && (
              <div
                style={{
                  position: 'absolute',
                  top: '12px',
                  background: '#ef4444',
                  color: '#ffffff',
                  fontWeight: 700,
                  fontSize: '15px',
                  padding: '6px 16px',
                  borderRadius: '12px',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
                  zIndex: 10,
                }}
              >
                {warningMessage}
              </div>
            )}

            {/* Instruction Cue */}
            <div style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '16px', textAlign: 'center' }}>
              {selectedPeg === null
                ? (isZh ? '👇 請點選柱子，拿起最上方的球' : 'Tap a peg to lift its top ball')
                : (isZh ? `已選取柱子 ${selectedPeg + 1} 的彩球，請點選目標柱子放下` : `Ball selected, tap destination peg to place`)}
            </div>

            {/* Interactive Pegs Display */}
            <div style={{ display: 'flex', justifyContent: 'space-around', alignItems: 'flex-end', width: '100%', height: '220px', paddingBottom: '16px' }}>
              {[0, 1, 2].map((pegIdx) => {
                const capacity = pegCapacities[pegIdx];
                const balls = currentPegs[pegIdx];
                const isSelected = selectedPeg === pegIdx;

                return (
                  <div
                    key={pegIdx}
                    onClick={() => handlePegClick(pegIdx)}
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'flex-end',
                      width: '90px',
                      cursor: 'pointer',
                      position: 'relative',
                    }}
                  >
                    {/* Peg Pole */}
                    <div
                      style={{
                        position: 'absolute',
                        bottom: '0',
                        width: '14px',
                        height: capacity === 3 ? '180px' : capacity === 2 ? '130px' : '80px',
                        background: isSelected ? 'var(--accent)' : '#b45309',
                        borderRadius: '6px',
                        zIndex: 1,
                        transition: 'background 0.2s',
                      }}
                    />

                    {/* Balls Stacked from bottom to top */}
                    <div
                      style={{
                        display: 'flex',
                        flexDirection: 'column-reverse',
                        alignItems: 'center',
                        gap: '6px',
                        zIndex: 2,
                        marginBottom: '8px',
                      }}
                    >
                      {balls.map((color, bIdx) => {
                        const isTopBall = bIdx === balls.length - 1;
                        const isBallLifted = isSelected && isTopBall;

                        return (
                          <div
                            key={bIdx}
                            style={{
                              transform: isBallLifted ? 'translateY(-16px) scale(1.1)' : 'none',
                              boxShadow: isBallLifted ? '0 8px 20px rgba(56, 189, 248, 0.6)' : '0 4px 8px rgba(0,0,0,0.2)',
                              borderRadius: '50%',
                              transition: 'all 0.2s ease',
                            }}
                          >
                            <RenderBall color={color} size={48} />
                          </div>
                        );
                      })}
                    </div>

                    {/* Peg Base */}
                    <div
                      style={{
                        width: '84px',
                        height: '14px',
                        background: '#78350f',
                        borderRadius: '8px',
                        zIndex: 3,
                      }}
                    />
                  </div>
                );
              })}
            </div>
          </div>

          {/* Bottom Action Peg Buttons & Control Buttons */}
          <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
              {[0, 1, 2].map((pegIdx) => {
                const capacity = pegCapacities[pegIdx];
                const isSelected = selectedPeg === pegIdx;

                return (
                  <button
                    key={pegIdx}
                    type="button"
                    onClick={() => handlePegClick(pegIdx)}
                    style={{
                      minHeight: '68px',
                      padding: '8px 4px',
                      fontSize: '18px',
                      fontWeight: 900,
                      borderRadius: '16px',
                      border: isSelected ? '3px solid var(--accent)' : '2px solid var(--border)',
                      background: isSelected ? 'var(--accent)' : 'var(--card-bg)',
                      color: isSelected ? '#ffffff' : 'var(--text-primary)',
                      cursor: 'pointer',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                    }}
                  >
                    <span>{isZh ? `柱子 ${pegIdx + 1}` : `Peg ${pegIdx + 1}`}</span>
                    <span style={{ fontSize: '13px', opacity: 0.85, fontWeight: 600 }}>
                      {isZh ? `(最多${capacity}顆)` : `(cap ${capacity})`}
                    </span>
                  </button>
                );
              })}
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontSize: '17px', fontWeight: 800 }}>
                {isZh ? '目前移動' : 'Current Moves'}: <span style={{ color: 'var(--accent)', fontSize: '22px' }}>{currentMovesCount}</span> {isZh ? '步' : 'moves'}
              </div>

              <div style={{ display: 'flex', gap: '8px' }}>
                {selectedPeg !== null && (
                  <button
                    type="button"
                    onClick={() => setSelectedPeg(null)}
                    style={{
                      padding: '10px 16px',
                      borderRadius: '12px',
                      border: '1px solid var(--border)',
                      background: 'var(--card-bg)',
                      color: 'var(--text-secondary)',
                      fontSize: '15px',
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                  >
                    {isZh ? '取消選取' : 'Deselect'}
                  </button>
                )}

                <button
                  type="button"
                  onClick={handleResetCurrentPuzzle}
                  style={{
                    padding: '10px 16px',
                    borderRadius: '12px',
                    border: '1px solid var(--border)',
                    background: 'var(--card-bg)',
                    color: 'var(--text-primary)',
                    fontSize: '15px',
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  {isZh ? '↺ 重設此題' : '↺ Reset'}
                </button>
              </div>
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
                {isZh ? '倫敦塔規劃 (Tower of London) 當次紀錄換算參考值' : 'Tower of London planning metrics'}
              </p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div style={{ padding: '16px', background: 'var(--bg)', borderRadius: '16px', textAlign: 'center' }}>
                <div style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>
                  {isZh ? '最佳步數達成率' : 'Optimal Solution Rate'}
                </div>
                <div style={{ fontSize: '36px', fontWeight: 900, color: 'var(--accent)', marginTop: '4px' }}>
                  {results.optimalRatePercent}%
                </div>
                <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                  {results.optimalCount} / {results.totalRounds} {isZh ? '題達成最少步數' : 'optimal'}
                </div>
              </div>

              <div style={{ padding: '16px', background: 'var(--bg)', borderRadius: '16px', textAlign: 'center' }}>
                <div style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>
                  {isZh ? '平均完成步數' : 'Mean Moves per Puzzle'}
                </div>
                <div style={{ fontSize: '36px', fontWeight: 900, marginTop: '4px' }}>
                  {results.meanMoves}
                </div>
                <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                  {isZh ? `(題目平均最少步數: ${results.meanOptimalMoves})` : `(Mean optimal: ${results.meanOptimalMoves})`}
                </div>
              </div>

              <div style={{ padding: '16px', background: 'var(--bg)', borderRadius: '16px', textAlign: 'center' }}>
                <div style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>
                  {isZh ? '完成題數' : 'Puzzles Solved'}
                </div>
                <div style={{ fontSize: '36px', fontWeight: 900, marginTop: '4px' }}>
                  {results.solvedCount} / {results.totalRounds}
                </div>
                <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>{isZh ? '題全部解開' : 'completed'}</div>
              </div>

              <div style={{ padding: '16px', background: 'var(--bg)', borderRadius: '16px', textAlign: 'center' }}>
                <div style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>
                  {isZh ? '總解題耗時' : 'Total Planning Time'}
                </div>
                <div style={{ fontSize: '36px', fontWeight: 900, color: '#38bdf8', marginTop: '4px' }}>
                  {results.totalPlanningTimeSeconds} <span style={{ fontSize: '18px' }}>s</span>
                </div>
                <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>{isZh ? '秒' : 'seconds'}</div>
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

function RenderBall({ color, size }: { color: BallColor; size: number }) {
  const fillColor = color === 'R' ? '#ef4444' : color === 'G' ? '#22c55e' : '#3b82f6';
  const strokeColor = color === 'R' ? '#991b1b' : color === 'G' ? '#166534' : '#1e40af';

  return (
    <svg viewBox="0 0 60 60" width={size} height={size}>
      <circle cx="30" cy="30" r="26" fill={fillColor} stroke={strokeColor} strokeWidth="3" />
      <circle cx="22" cy="22" r="8" fill="#ffffff" fillOpacity="0.5" />
    </svg>
  );
}

function RenderTowerMini({ pegs }: { pegs: PegsState }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: '12px', height: '60px' }}>
      {[0, 1, 2].map((pIdx) => {
        const capacity = pegCapacities[pIdx];
        const balls = pegs[pIdx];
        return (
          <div
            key={pIdx}
            style={{
              display: 'flex',
              flexDirection: 'column-reverse',
              alignItems: 'center',
              width: '26px',
              height: capacity === 3 ? '56px' : capacity === 2 ? '42px' : '28px',
              borderBottom: '3px solid #78350f',
              borderLeft: '2px solid rgba(180, 83, 9, 0.4)',
              borderRight: '2px solid rgba(180, 83, 9, 0.4)',
              boxSizing: 'border-box',
              paddingBottom: '2px',
              gap: '2px',
            }}
          >
            {balls.map((col, bIdx) => (
              <RenderBall key={bIdx} color={col} size={14} />
            ))}
          </div>
        );
      })}
    </div>
  );
}

function ClonePegs(pegs: PegsState): PegsState {
  return [
    [...pegs[0]],
    [...pegs[1]],
    [...pegs[2]],
  ];
}

function ArePegsEqual(a: PegsState, b: PegsState): boolean {
  for (let i = 0; i < 3; i++) {
    if (a[i].length !== b[i].length) return false;
    for (let j = 0; j < a[i].length; j++) {
      if (a[i][j] !== b[i][j]) return false;
    }
  }
  return true;
}

function SerializePegs(pegs: PegsState): string {
  return pegs.map((p) => p.join('')).join('|');
}

function DeserializePegs(s: string): PegsState {
  const parts = s.split('|');
  return [
    (parts[0] ? parts[0].split('') : []) as BallColor[],
    (parts[1] ? parts[1].split('') : []) as BallColor[],
    (parts[2] ? parts[2].split('') : []) as BallColor[],
  ];
}

function CalculateOptimalMoves(start: PegsState, goal: PegsState): number {
  const startKey = SerializePegs(start);
  const goalKey = SerializePegs(goal);
  if (startKey === goalKey) return 0;

  const queue: { key: string; dist: number }[] = [{ key: startKey, dist: 0 }];
  const visited = new Set<string>([startKey]);

  while (queue.length > 0) {
    const { key, dist } = queue.shift()!;
    const state = DeserializePegs(key);

    for (let from = 0; from < 3; from++) {
      if (state[from].length === 0) continue;
      for (let to = 0; to < 3; to++) {
        if (from === to) continue;
        if (state[to].length >= pegCapacities[to]) continue;

        const nextState = ClonePegs(state);
        const ball = nextState[from].pop()!;
        nextState[to].push(ball);

        const nextKey = SerializePegs(nextState);
        if (nextKey === goalKey) {
          return dist + 1;
        }

        if (!visited.has(nextKey)) {
          visited.add(nextKey);
          queue.push({ key: nextKey, dist: dist + 1 });
        }
      }
    }
  }

  return 999;
}

const classicConfigurations: PegsState[] = [
  [['R', 'G', 'B'], [], []],
  [['R', 'B', 'G'], [], []],
  [['G', 'R', 'B'], [], []],
  [['B', 'R', 'G'], [], []],
  [['R', 'G'], ['B'], []],
  [['R', 'B'], ['G'], []],
  [['G', 'B'], ['R'], []],
  [['R', 'G'], [], ['B']],
  [['R', 'B'], [], ['G']],
  [['G', 'R'], [], ['B']],
  [['R'], ['G', 'B'], []],
  [['B'], ['R', 'G'], []],
  [['G'], ['R', 'B'], []],
  [['R'], ['G'], ['B']],
  [['R'], ['B'], ['G']],
  [['B'], ['R'], ['G']],
  [['G'], ['R'], ['B']],
  [[], ['R', 'G'], ['B']],
  [[], ['B', 'G'], ['R']],
  [['B'], [], ['R']],
];

function GenerateTowerPuzzles(difficulty: TowerDifficulty, count: number): TowerPuzzle[] {
  const puzzles: TowerPuzzle[] = [];
  const minMoves = difficulty === 'easy' ? 2 : difficulty === 'medium' ? 3 : 4;
  const maxMoves = difficulty === 'easy' ? 3 : difficulty === 'medium' ? 4 : 5;

  let attempts = 0;
  while (puzzles.length < count && attempts < 500) {
    attempts++;
    const startIdx = Math.floor(Math.random() * classicConfigurations.length);
    const goalIdx = Math.floor(Math.random() * classicConfigurations.length);
    if (startIdx === goalIdx) continue;

    const start = classicConfigurations[startIdx];
    const goal = classicConfigurations[goalIdx];
    const optimal = CalculateOptimalMoves(start, goal);

    if (optimal >= minMoves && optimal <= maxMoves) {
      const alreadyExists = puzzles.some(
        (p) => SerializePegs(p.startPegs) === SerializePegs(start) && SerializePegs(p.goalPegs) === SerializePegs(goal),
      );
      if (!alreadyExists) {
        puzzles.push({
          puzzleNumber: puzzles.length + 1,
          startPegs: ClonePegs(start),
          goalPegs: ClonePegs(goal),
          optimalMoves: optimal,
        });
      }
    }
  }

  // Fallback if not enough puzzles generated
  if (puzzles.length < count) {
    const fallbackStart: PegsState = [['R', 'G', 'B'], [], []];
    const fallbackGoal: PegsState = [['R'], ['G'], ['B']];
    while (puzzles.length < count) {
      puzzles.push({
        puzzleNumber: puzzles.length + 1,
        startPegs: ClonePegs(fallbackStart),
        goalPegs: ClonePegs(fallbackGoal),
        optimalMoves: CalculateOptimalMoves(fallbackStart, fallbackGoal),
      });
    }
  }

  return puzzles;
}

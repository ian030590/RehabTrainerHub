import { FormatTestDate } from '@rehab-trainer/ui/trainingGameUtils';
import { GetHostedGameSetting } from '@rehab-trainer/ui/embeddedTraining';
import { RequestHubTrainingConfiguration } from '@rehab-trainer/ui/embeddedTraining';
// Canonical Hub-owned brain Antisaccade response inhibition runtime.
import { GetAuthUserNameFromToken } from '@rehab-trainer/ui/auth/authClient';
import { TrainingResultActions } from '@rehab-trainer/ui/components/TrainingResultActions';
import { useFullscreenTrainingRoot } from '@rehab-trainer/ui/hooks/useFullscreenTrainingRoot';
import { useHostedGameSettings } from '@rehab-trainer/ui/hooks/useHostedGameSettings';
import { useTrainingAbort } from '@rehab-trainer/ui/hooks/useTrainingAbort';
import { useT } from '@rehab-trainer/ui/i18n/games';
import { PlayFailureSound,PlayGameEndSound,PlaySuccessSound,PrepareAudioFeedback } from './runtime/soundManager';
import { SaveTrainingSessionRecord } from '@rehab-trainer/ui/storage/trainingRecords';
import { initJsPsych } from 'jspsych';
import { useCallback,useEffect,useMemo,useRef,useState } from 'react';
import './runtime/cognitive/ThinkingGames.css';
import { BrainTrainingRulesPanel } from './runtime/components/rules/BrainTrainingRulesPanel';
import { JsPsychExternalLifecycle } from './runtime/jsPsychLifecycle';
type AntiPhase = 'menu' | 'rules' | 'playing' | 'results';
type CueLocation = 'left' | 'right';
type TargetOrientation = 'up' | 'down';
type TrialStep = 'fixation' | 'flash' | 'target' | 'mask';
interface AntisaccadeGameProps {
    onExit: () => void;
}
interface AntisaccadeTrial {
    trialNumber: number;
    cueLocation: CueLocation;
    targetLocation: CueLocation; // opposite of cueLocation
    targetOrientation: TargetOrientation;
    flashDurationMs: number;
    responded: boolean;
    correct: boolean;
    reactionTimeMs: number | null;
}
interface AntisaccadeSessionRecord {
    totalRounds: number;
    difficulty: 'easy' | 'medium' | 'hard';
    correctCount: number;
    accuracyPercent: number;
    meanRtMs: number;
    trials: AntisaccadeTrial[];
}
export function AntisaccadeGame({ onExit }: AntisaccadeGameProps) {
    const { lang, t } = useT();
    const isZh = lang !== 'en';
    const { fullscreenRootRef, enterTrainingFullscreen } = useFullscreenTrainingRoot();
    const handleExitTraining = useCallback(() => {
        jsPsychLifecycleRef.current?.abort({ abort_reason: 'return-to-menu' });
        onExit();
    }, [onExit]);

    const jsPsychHostRef = useRef<HTMLDivElement | null>(null);
    const jsPsychRef = useRef<ReturnType<typeof initJsPsych> | null>(null);
    const jsPsychLifecycleRef = useRef<JsPsychExternalLifecycle | null>(null);
    const [phase, setPhase] = useState<AntiPhase>('rules');
    useTrainingAbort({ active: phase === 'playing', onAbort: handleExitTraining });
    const [difficulty, setDifficulty] = useState<'easy' | 'medium' | 'hard'>(GetHostedGameSetting<'easy' | 'medium' | 'hard'>('difficulty'));
    const [rounds, setRounds] = useState(GetHostedGameSetting<number>('rounds'));
    const [soundEnabled, setSoundEnabled] = useState(GetHostedGameSetting<boolean>('soundEnabled'));
    const hostedSettings = useHostedGameSettings();
    const hostedSettingsAppliedRef = useRef(false);

    const [currentTrialIndex, setCurrentTrialIndex] = useState(0);
    const [trials, setTrials] = useState<AntisaccadeTrial[]>([]);
    const [trialStep, setTrialStep] = useState<TrialStep>('fixation');
    const [trialFeedback, setTrialFeedback] = useState<'correct' | 'incorrect' | null>(null);
    const [results, setResults] = useState<AntisaccadeSessionRecord | null>(null);
    const trialStartTimeRef = useRef<number>(0);
    const stepTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const trialAnsweredRef = useRef(false);
    const getFlashDurationMs = useCallback((diff: 'easy' | 'medium' | 'hard') => {
        switch (diff) {
            case 'easy': return 350;
            case 'medium': return 225;
            case 'hard': return 150;
        }
    }, []);
    useEffect(() => {
        if (!hostedSettings || hostedSettingsAppliedRef.current)
            return;
        hostedSettingsAppliedRef.current = true;
        if (hostedSettings.difficulty === 'easy' || hostedSettings.difficulty === 'medium' || hostedSettings.difficulty === 'hard') {
            setDifficulty(hostedSettings.difficulty);
        }
        if (typeof hostedSettings.rounds === 'number' && hostedSettings.rounds >= 12 && hostedSettings.rounds <= 48) {
            setRounds(hostedSettings.rounds);
        }
        if (typeof hostedSettings.soundEnabled === 'boolean') {
            setSoundEnabled(hostedSettings.soundEnabled);
        }
        setPhase('rules');
    }, [hostedSettings]);
    useEffect(() => {
        const host = jsPsychHostRef.current;
        if (!host)
            return;
        const jsPsych = initJsPsych({ display_element: host });
        const lifecycle = new JsPsychExternalLifecycle(jsPsych);
        jsPsychRef.current = jsPsych;
        jsPsychLifecycleRef.current = lifecycle;
        return () => {
            lifecycle.dispose();
            if (jsPsychRef.current === jsPsych)
                jsPsychRef.current = null;
            if (jsPsychLifecycleRef.current === lifecycle)
                jsPsychLifecycleRef.current = null;
        };
    }, []);
    const activeTrial = trials[currentTrialIndex] ?? null;
    const clearTimers = useCallback(() => {
        if (stepTimerRef.current) {
            clearTimeout(stepTimerRef.current);
            stepTimerRef.current = null;
        }
    }, []);
    const completeSession = useCallback((finalTrials: AntisaccadeTrial[]) => {
        const totalRounds = finalTrials.length;
        const correctTrials = finalTrials.filter((t) => t.correct);
        const correctCount = correctTrials.length;
        const accuracyPercent = Math.round((correctCount / Math.max(1, totalRounds)) * 100);
        const validRts = correctTrials.filter((t) => t.reactionTimeMs !== null).map((t) => t.reactionTimeMs as number);
        const meanRtMs = validRts.length > 0 ? Math.round(validRts.reduce((a, b) => a + b, 0) / validRts.length) : 0;
        const record: AntisaccadeSessionRecord = {
            totalRounds,
            difficulty,
            correctCount,
            accuracyPercent,
            meanRtMs,
            trials: finalTrials,
        };
        jsPsychLifecycleRef.current?.finish(record as unknown as Record<string, unknown>);
        PlayGameEndSound('Victory', jsPsychRef);
        setResults(record);
        setPhase('results');
        const participantId = GetAuthUserNameFromToken() || 'Unknown';
        void SaveTrainingSessionRecord({ userName: GetAuthUserNameFromToken() || 'Guest', moduleId: 'antisaccade', gameId: 'antisaccade', gameTitle: isZh ? '反向眼跳抑制 (Antisaccade)' : 'Antisaccade Response Inhibition', difficulty: 'configured', trainingDate: FormatTestDate(new Date()), details: { category: 'attention',
score: accuracyPercent,
metrics: {
                totalRounds,
                difficulty,
                accuracyPercent,
                meanRtMs,
            },
notes: isZh
                ? `難度: ${difficulty} (提示 ${getFlashDurationMs(difficulty)}ms), 正確率: ${accuracyPercent}%, 平均RT: ${meanRtMs}ms`
                : `Diff: ${difficulty}, Acc: ${accuracyPercent}%, RT: ${meanRtMs}ms` } });
    }, [difficulty, getFlashDurationMs, isZh]);
    const advanceTrial = useCallback((updatedTrial: AntisaccadeTrial) => {
        const nextIndex = currentTrialIndex + 1;
        if (nextIndex >= trials.length) {
            completeSession([...trials.slice(0, currentTrialIndex), updatedTrial]);
        }
        else {
            setCurrentTrialIndex(nextIndex);
            startTrialTimeline(trials, nextIndex);
        }
    }, [completeSession, currentTrialIndex, trials]);
    const handleOrientationAnswer = useCallback((chosen: TargetOrientation) => {
        if (phase !== 'playing' || trialStep === 'fixation' || trialStep === 'flash' || !activeTrial || trialAnsweredRef.current)
            return;
        trialAnsweredRef.current = true;
        clearTimers();
        const rt = Math.max(1, Math.round(performance.now() - trialStartTimeRef.current));
        const isCorrect = chosen === activeTrial.targetOrientation;
        if (soundEnabled) {
            if (isCorrect)
                PlaySuccessSound(jsPsychRef);
            else
                PlayFailureSound(jsPsychRef);
        }
        setTrialFeedback(isCorrect ? 'correct' : 'incorrect');
        const updatedTrial: AntisaccadeTrial = {
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
    }, [activeTrial, advanceTrial, clearTimers, currentTrialIndex, phase, soundEnabled, trialStep]);
    const startTrialTimeline = useCallback((trialList: AntisaccadeTrial[], index: number) => {
        const trial = trialList[index];
        if (!trial)
            return;
        trialAnsweredRef.current = true;
        setTrialStep('fixation');
        // 1. Fixation (600ms)
        setTimeout(() => {
            // 2. Cue Flash on one side (flashDurationMs: e.g. 225ms)
            setTrialStep('flash');
            if (soundEnabled)
                PlaySuccessSound(jsPsychRef);
            setTimeout(() => {
                // 3. Target arrow appears on OPPOSITE side (175ms)
                setTrialStep('target');
                trialAnsweredRef.current = false;
                trialStartTimeRef.current = performance.now();
                setTimeout(() => {
                    // 4. Target replaced by mask until user response (up to 2500ms total)
                    setTrialStep('mask');
                    stepTimerRef.current = setTimeout(() => {
                        if (!trialAnsweredRef.current) {
                            trialAnsweredRef.current = true;
                            if (soundEnabled)
                                PlayFailureSound(jsPsychRef);
                            setTrialFeedback('incorrect');
                            const timedOutTrial: AntisaccadeTrial = {
                                ...trial,
                                responded: false,
                                correct: false,
                                reactionTimeMs: null,
                            };
                            setTrials((prev) => {
                                const copy = [...prev];
                                copy[index] = timedOutTrial;
                                return copy;
                            });
                            setTimeout(() => {
                                setTrialFeedback(null);
                                advanceTrial(timedOutTrial);
                            }, 280);
                        }
                    }, 2000);
                }, 175);
            }, trial.flashDurationMs);
        }, 600);
    }, [advanceTrial, soundEnabled]);
    useEffect(() => {
        if (phase !== 'playing')
            return;
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'ArrowUp') {
                e.preventDefault();
                handleOrientationAnswer('up');
            }
            else if (e.key === 'ArrowDown') {
                e.preventDefault();
                handleOrientationAnswer('down');
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [handleOrientationAnswer, phase]);
    const startGame = useCallback(() => {
        PrepareAudioFeedback();
        const flashDur = getFlashDurationMs(difficulty);
        const generated = GenerateAntisaccadeTrials(rounds, flashDur);
        setTrials(generated);
        setCurrentTrialIndex(0);
        setResults(null);
        setTrialFeedback(null);
        setPhase('playing');
        jsPsychLifecycleRef.current?.start({ moduleId: "antisaccade", onStart: () => undefined });
        startTrialTimeline(generated, 0);
    }, [difficulty, getFlashDurationMs, rounds, startTrialTimeline]);
    const configOptions = useMemo(() => {
        const diffOptions = [
            { id: 'easy', label: isZh ? '入門（提示 350ms）' : 'Easy (350ms cue)' },
            { id: 'medium', label: isZh ? '標準（提示 225ms）' : 'Medium (225ms cue)' },
            { id: 'hard', label: isZh ? '進階（提示 150ms）' : 'Hard (150ms cue)' },
        ];
        return { diffOptions };
    }, [isZh]);
    return (<div ref={fullscreenRootRef} className="cognitive-reference-game" style={{
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
        }}>
      <div ref={jsPsychHostRef} style={{ display: 'none' }}/>

      {null}

      {phase === 'rules' && (<BrainTrainingRulesPanel gameId="antisaccade" onStart={() => void startGame()} onBack={() => RequestHubTrainingConfiguration()} title={document.title}/>)}

      {phase === 'playing' && (<div style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'space-between',
                width: '100%',
                maxWidth: '680px',
                height: '92dvh',
                padding: '20px 16px',
                boxSizing: 'border-box',
            }}>
          {/* Top Status */}
          <div style={{
                width: '100%',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '12px 20px',
                background: 'var(--card-bg)',
                borderRadius: '16px',
                fontSize: '18px',
                fontWeight: 700,
            }}>
            <span>
              {isZh ? '進度' : 'Trial'}: {currentTrialIndex + 1} / {trials.length}
            </span>
            <span style={{ color: 'var(--accent)' }}>
              {isZh ? '抑制紅點！看向「反方向」的箭頭！' : 'Ignore flash! Look to OPPOSITE side!'}
            </span>
          </div>

          {/* Center Stage: Left slot, Center fixation, Right slot */}
          <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                width: '100%',
                maxWidth: '560px',
                height: '300px',
                background: trialFeedback === 'correct'
                    ? 'rgba(34, 197, 94, 0.12)'
                    : trialFeedback === 'incorrect'
                        ? 'rgba(239, 68, 68, 0.15)'
                        : 'var(--card-bg)',
                borderRadius: '28px',
                border: trialFeedback === 'correct'
                    ? '4px solid #22c55e'
                    : trialFeedback === 'incorrect'
                        ? '4px solid #ef4444'
                        : '3px solid var(--border)',
                padding: '0 32px',
                boxSizing: 'border-box',
                position: 'relative',
                transition: 'all 0.15s ease',
            }}>
            {/* Left Slot */}
            <div style={{ width: '80px', height: '80px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {trialStep === 'flash' && activeTrial?.cueLocation === 'left' && (<div style={{
                    width: '36px',
                    height: '36px',
                    borderRadius: '50%',
                    background: '#ef4444',
                    boxShadow: '0 0 24px #ef4444',
                }}/>)}

              {trialStep === 'target' && activeTrial?.targetLocation === 'left' && (<span style={{ fontSize: '56px', fontWeight: 900, color: 'var(--accent)' }}>
                  {activeTrial.targetOrientation === 'up' ? '↑' : '↓'}
                </span>)}

              {trialStep === 'mask' && activeTrial?.targetLocation === 'left' && (<span style={{ fontSize: '48px', fontWeight: 900, color: 'var(--text-secondary)' }}>
                  ■
                </span>)}
            </div>

            {/* Center Fixation */}
            <div style={{ width: '60px', height: '60px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ fontSize: '48px', fontWeight: 900, color: 'var(--text-secondary)' }}>+</span>
            </div>

            {/* Right Slot */}
            <div style={{ width: '80px', height: '80px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {trialStep === 'flash' && activeTrial?.cueLocation === 'right' && (<div style={{
                    width: '36px',
                    height: '36px',
                    borderRadius: '50%',
                    background: '#ef4444',
                    boxShadow: '0 0 24px #ef4444',
                }}/>)}

              {trialStep === 'target' && activeTrial?.targetLocation === 'right' && (<span style={{ fontSize: '56px', fontWeight: 900, color: 'var(--accent)' }}>
                  {activeTrial.targetOrientation === 'up' ? '↑' : '↓'}
                </span>)}

              {trialStep === 'mask' && activeTrial?.targetLocation === 'right' && (<span style={{ fontSize: '48px', fontWeight: 900, color: 'var(--text-secondary)' }}>
                  ■
                </span>)}
            </div>
          </div>

          {/* Bottom Action Orientation Buttons */}
          <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ textAlign: 'center', fontSize: '15px', color: 'var(--text-secondary)' }}>
              {isZh ? '看到紅點時忍住不要看，看向反方向出現的箭頭是「朝上」還是「朝下」' : 'Report target arrow orientation on OPPOSITE side'}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <button type="button" onClick={() => handleOrientationAnswer('up')} disabled={trialStep === 'fixation' || trialStep === 'flash' || trialAnsweredRef.current} style={{
                minHeight: '76px',
                fontSize: '24px',
                fontWeight: 900,
                borderRadius: '18px',
                border: '3px solid var(--accent)',
                background: 'var(--card-bg)',
                color: 'var(--text-primary)',
                cursor: trialStep === 'fixation' || trialStep === 'flash' || trialAnsweredRef.current ? 'not-allowed' : 'pointer',
                opacity: trialStep === 'fixation' || trialStep === 'flash' || trialAnsweredRef.current ? 0.6 : 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '12px',
                boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
            }}>
                <span style={{ fontSize: '32px' }}>↑</span>
                <span>{isZh ? '朝上' : 'Up'}</span>
              </button>

              <button type="button" onClick={() => handleOrientationAnswer('down')} disabled={trialStep === 'fixation' || trialStep === 'flash' || trialAnsweredRef.current} style={{
                minHeight: '76px',
                fontSize: '24px',
                fontWeight: 900,
                borderRadius: '18px',
                border: '3px solid var(--accent)',
                background: 'var(--card-bg)',
                color: 'var(--text-primary)',
                cursor: trialStep === 'fixation' || trialStep === 'flash' || trialAnsweredRef.current ? 'not-allowed' : 'pointer',
                opacity: trialStep === 'fixation' || trialStep === 'flash' || trialAnsweredRef.current ? 0.6 : 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '12px',
                boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
            }}>
                <span style={{ fontSize: '32px' }}>↓</span>
                <span>{isZh ? '朝下' : 'Down'}</span>
              </button>
            </div>
          </div>
        </div>)}

      {phase === 'results' && results && (<div style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                width: '100%',
                maxWidth: '640px',
                padding: '24px 16px',
                boxSizing: 'border-box',
            }}>
          <div style={{
                width: '100%',
                background: 'var(--card-bg)',
                borderRadius: '24px',
                padding: '28px 24px',
                boxSizing: 'border-box',
                display: 'flex',
                flexDirection: 'column',
                gap: '20px',
                boxShadow: '0 8px 32px rgba(0,0,0,0.15)',
            }}>
            <div style={{ textAlign: 'center' }}>
              <h2 style={{ fontSize: '26px', fontWeight: 900, margin: '0 0 8px 0' }}>
                {isZh ? '練習完成：成果回饋' : 'Session Complete: Results'}
              </h2>
              <p style={{ color: 'var(--text-secondary)', fontSize: '15px', margin: 0 }}>
                {isZh ? '反向眼跳抑制 (Antisaccade) 當次紀錄換算參考值' : 'Antisaccade Task performance metrics'}
              </p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div style={{ padding: '16px', background: 'var(--bg)', borderRadius: '16px', textAlign: 'center' }}>
                <div style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>
                  {isZh ? '反向抑制正確率' : 'Inhibition Accuracy'}
                </div>
                <div style={{ fontSize: '36px', fontWeight: 900, color: 'var(--accent)', marginTop: '4px' }}>
                  {results.accuracyPercent}%
                </div>
                <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                  {results.correctCount} / {results.totalRounds} {isZh ? '題成功抑制' : 'correct'}
                </div>
              </div>

              <div style={{ padding: '16px', background: 'var(--bg)', borderRadius: '16px', textAlign: 'center' }}>
                <div style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>
                  {isZh ? '平均反應時間' : 'Mean Reaction Time'}
                </div>
                <div style={{ fontSize: '36px', fontWeight: 900, marginTop: '4px' }}>
                  {results.meanRtMs} <span style={{ fontSize: '18px' }}>ms</span>
                </div>
                <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>{isZh ? '毫秒' : 'milliseconds'}</div>
              </div>
            </div>

            <TrainingResultActions onBackHome={handleExitTraining} backLabel={isZh ? '返回入口' : 'Back to entry'} hubLabel={isZh ? '返回大廳' : 'Back to lobby'} />
          </div>
        </div>)}
    </div>);
}
function GenerateAntisaccadeTrials(rounds: number, flashDurationMs: number): AntisaccadeTrial[] {
    const trials: AntisaccadeTrial[] = [];
    for (let i = 0; i < rounds; i++) {
        const cueLocation: CueLocation = Math.random() < 0.5 ? 'left' : 'right';
        const targetLocation: CueLocation = cueLocation === 'left' ? 'right' : 'left';
        const targetOrientation: TargetOrientation = Math.random() < 0.5 ? 'up' : 'down';
        trials.push({
            trialNumber: i + 1,
            cueLocation,
            targetLocation,
            targetOrientation,
            flashDurationMs,
            responded: false,
            correct: false,
            reactionTimeMs: null,
        });
    }
    return trials;
}

import { GetHostedGameSetting } from '@rehab-trainer/ui/embeddedTraining';
import { RequestHubTrainingConfiguration } from '@rehab-trainer/ui/embeddedTraining';
// Canonical Hub-owned brain Go/No-go response inhibition runtime.
import { GetAuthUserNameFromToken } from '@rehab-trainer/ui/auth/authClient';
import { TrainingResultActions } from '@rehab-trainer/ui/components/TrainingResultActions';
import { useFullscreenTrainingRoot } from '@rehab-trainer/ui/hooks/useFullscreenTrainingRoot';
import { useHostedGameSettings } from '@rehab-trainer/ui/hooks/useHostedGameSettings';
import { useTrainingAbort } from '@rehab-trainer/ui/hooks/useTrainingAbort';
import { useT } from '@rehab-trainer/ui/i18n/games';
import { PlayFailureSound,PlayGameEndSound,PlaySuccessSound,PrepareAudioFeedback } from './runtime/soundManager';
import { SaveTrainingSessionRecord } from '@rehab-trainer/ui/storage/trainingRecords';
import { FormatTestDate } from '@rehab-trainer/ui/trainingGameUtils';
import { initJsPsych } from 'jspsych';
import { useCallback,useEffect,useRef,useState } from 'react';
import './runtime/cognitive/ThinkingGames.css';
import { BrainTrainingRulesPanel } from './runtime/components/rules/BrainTrainingRulesPanel';
import { JsPsychExternalLifecycle } from './runtime/jsPsychLifecycle';
export type GoNoGoDifficulty = 'easy' | 'medium' | 'hard';
type GoNoGoPhase = 'menu' | 'rules' | 'playing' | 'results';
type StimulusType = 'go' | 'nogo';
interface GoNoGoGameProps {
    onExit: () => void;
}
interface GoNoGoTrial {
    trialNumber: number;
    stimulusType: StimulusType;
    responded: boolean;
    correct: boolean;
    reactionTimeMs: number | null;
}
interface GoNoGoSessionRecord {
    totalRounds: number;
    goCount: number;
    nogoCount: number;
    goHitCount: number;
    goHitRatePercent: number;
    nogoCorrectRejectionCount: number;
    nogoInhibitionRatePercent: number;
    falseAlarmRatePercent: number;
    meanRtMs: number;
    trials: GoNoGoTrial[];
}
export function GoNoGoGame({ onExit }: GoNoGoGameProps) {
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
    const [phase, setPhase] = useState<GoNoGoPhase>('rules');
    useTrainingAbort({ active: phase === 'playing', onAbort: handleExitTraining });
    const [difficulty, setDifficulty] = useState<GoNoGoDifficulty>(GetHostedGameSetting<GoNoGoDifficulty>('difficulty'));
    const [rounds, setRounds] = useState(GetHostedGameSetting<number>('rounds'));
    const [stimulusDurationMs, setStimulusDurationMs] = useState(GetHostedGameSetting<number>('stimulusDurationMs'));
    const [soundEnabled, setSoundEnabled] = useState(GetHostedGameSetting<boolean>('soundEnabled'));
    const hostedSettings = useHostedGameSettings();
    const hostedSettingsAppliedRef = useRef(false);

    const [currentTrialIndex, setCurrentTrialIndex] = useState(0);
    const [trials, setTrials] = useState<GoNoGoTrial[]>([]);
    const [isFixation, setIsFixation] = useState(false);
    const [trialFeedback, setTrialFeedback] = useState<'correct' | 'incorrect' | null>(null);
    const [results, setResults] = useState<GoNoGoSessionRecord | null>(null);
    const trialStartTimeRef = useRef<number>(0);
    const trialTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const currentTrialAnsweredRef = useRef(false);
    useEffect(() => {
        if (!hostedSettings || hostedSettingsAppliedRef.current)
            return;
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
    const handleUserTap = useCallback(() => {
        if (phase !== 'playing' || isFixation || !activeTrial || currentTrialAnsweredRef.current)
            return;
        currentTrialAnsweredRef.current = true;
        if (trialTimeoutRef.current) {
            clearTimeout(trialTimeoutRef.current);
            trialTimeoutRef.current = null;
        }
        const rt = Math.max(1, Math.round(performance.now() - trialStartTimeRef.current));
        const isCorrect = activeTrial.stimulusType === 'go';
        if (soundEnabled) {
            if (isCorrect)
                PlaySuccessSound(jsPsychRef);
            else
                PlayFailureSound(jsPsychRef);
        }
        setTrialFeedback(isCorrect ? 'correct' : 'incorrect');
        const updatedTrial: GoNoGoTrial = {
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
            const nextIndex = currentTrialIndex + 1;
            if (nextIndex >= trials.length) {
                completeSession([...trials.slice(0, currentTrialIndex), updatedTrial]);
            }
            else {
                setCurrentTrialIndex(nextIndex);
                startTrialFixation();
            }
        }, 280);
    }, [activeTrial, currentTrialIndex, isFixation, phase, soundEnabled, trials]);
    const handleTrialTimeout = useCallback(() => {
        if (phase !== 'playing' || isFixation || !activeTrial || currentTrialAnsweredRef.current)
            return;
        currentTrialAnsweredRef.current = true;
        // Timeout: User did NOT respond.
        // If stimulus was No-go, withholding response is correct!
        // If stimulus was Go, omission is incorrect!
        const isCorrect = activeTrial.stimulusType === 'nogo';
        if (soundEnabled && !isCorrect) {
            PlayFailureSound(jsPsychRef);
        }
        setTrialFeedback(isCorrect ? 'correct' : 'incorrect');
        const updatedTrial: GoNoGoTrial = {
            ...activeTrial,
            responded: false,
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
            const nextIndex = currentTrialIndex + 1;
            if (nextIndex >= trials.length) {
                completeSession([...trials.slice(0, currentTrialIndex), updatedTrial]);
            }
            else {
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
            trialTimeoutRef.current = setTimeout(() => {
                handleTrialTimeout();
            }, stimulusDurationMs);
        }, 450);
    }, [handleTrialTimeout, stimulusDurationMs]);
    const completeSession = useCallback((finalTrials: GoNoGoTrial[]) => {
        const totalRounds = finalTrials.length;
        const goTrials = finalTrials.filter((t) => t.stimulusType === 'go');
        const nogoTrials = finalTrials.filter((t) => t.stimulusType === 'nogo');
        const goCount = goTrials.length;
        const nogoCount = nogoTrials.length;
        const goHitCount = goTrials.filter((t) => t.responded && t.correct).length;
        const goHitRatePercent = Math.round((goHitCount / Math.max(1, goCount)) * 100);
        const nogoCorrectRejectionCount = nogoTrials.filter((t) => !t.responded && t.correct).length;
        const nogoInhibitionRatePercent = Math.round((nogoCorrectRejectionCount / Math.max(1, nogoCount)) * 100);
        const falseAlarmCount = nogoTrials.filter((t) => t.responded).length;
        const falseAlarmRatePercent = Math.round((falseAlarmCount / Math.max(1, nogoCount)) * 100);
        const goRts = goTrials.filter((t) => t.reactionTimeMs !== null).map((t) => t.reactionTimeMs as number);
        const meanRtMs = goRts.length > 0 ? Math.round(goRts.reduce((a, b) => a + b, 0) / goRts.length) : 0;
        const record: GoNoGoSessionRecord = {
            totalRounds,
            goCount,
            nogoCount,
            goHitCount,
            goHitRatePercent,
            nogoCorrectRejectionCount,
            nogoInhibitionRatePercent,
            falseAlarmRatePercent,
            meanRtMs,
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
            gameId: 'go-nogo',
            gameTitle: isZh ? '通行與抑制反應（Go/No-go）' : 'Go / No-Go Sustained Attention',
            difficulty,
            trainingDate: FormatTestDate(new Date()),
            details: {
                Game_Result: 'Complete',
                Total_Rounds: totalRounds,
                Go_Count: goCount,
                NoGo_Count: nogoCount,
                Go_Hit_Rate_Percent: goHitRatePercent,
                NoGo_Inhibition_Rate_Percent: nogoInhibitionRatePercent,
                False_Alarm_Rate_Percent: falseAlarmRatePercent,
                Mean_Go_RT_Ms: meanRtMs,
            },
        });
    }, [difficulty, isZh]);
    const startGame = useCallback(async () => {
        PrepareAudioFeedback(jsPsychRef);
        await enterTrainingFullscreen();
        const freshTrials = GenerateGoNoGoTrials(difficulty, rounds);
        setTrials(freshTrials);
        setCurrentTrialIndex(0);
        setResults(null);
        setPhase('playing');
        await jsPsychLifecycleRef.current?.start({ moduleId: 'brain:go-nogo', onStart: () => undefined });
        setIsFixation(true);
        currentTrialAnsweredRef.current = true;
        setTimeout(() => {
            setIsFixation(false);
            currentTrialAnsweredRef.current = false;
            trialStartTimeRef.current = performance.now();
            trialTimeoutRef.current = setTimeout(() => {
                handleTrialTimeout();
            }, stimulusDurationMs);
        }, 500);
    }, [difficulty, enterTrainingFullscreen, handleTrialTimeout, rounds, stimulusDurationMs]);
    useEffect(() => {
        if (phase !== 'playing')
            return;
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.code === 'Space') {
                event.preventDefault();
                handleUserTap();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [handleUserTap, phase]);
    const difficultyLabels = {
        easy: isZh ? '初級（80% 通行，節奏平穩）' : 'Beginner',
        medium: isZh ? '中級（75% 通行，標準挑戰）' : 'Intermediate',
        hard: isZh ? '高級（70% 通行，快速專注）' : 'Advanced',
    };
    const durationLabels = {
        800: isZh ? '0.8 秒' : '0.8s',
        1200: isZh ? '1.2 秒' : '1.2s',
        1600: isZh ? '1.6 秒' : '1.6s',
    };
    return (<div ref={fullscreenRootRef} className={`cognitive-reference-game gonogo-game gonogo-phase-${phase}`}>
      <div ref={jsPsychHostRef} style={{ display: 'none' }}/>

      {null}

      {phase === 'rules' && (<BrainTrainingRulesPanel gameId="go-nogo" title={isZh ? '通行與抑制反應（Go / No-go）' : 'Go / No-Go Sustained Attention'} summaryTitle={isZh ? '目前設定摘要' : 'Settings Summary'} summaryItems={[
                { label: isZh ? '難度' : 'Difficulty', value: difficultyLabels[difficulty] },
                { label: isZh ? '總題數' : 'Trials', value: `${rounds} ${isZh ? '題' : 'trials'}` },
                { label: isZh ? '時限' : 'Time Limit', value: durationLabels[stimulusDurationMs as keyof typeof durationLabels] ?? `${stimulusDurationMs}ms` },
                { label: isZh ? '聲音' : 'Audio', value: soundEnabled ? (isZh ? '開啟' : 'On') : (isZh ? '關閉' : 'Off') },
            ]} onStart={() => void startGame()} onBack={() => RequestHubTrainingConfiguration()}/>)}

      {phase === 'playing' && (<div style={{
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
          {/* Header */}
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
            <button type="button" onClick={handleExitTraining} style={{
                background: 'transparent',
                border: '1px solid var(--border)',
                color: 'var(--text-secondary)',
                borderRadius: '8px',
                padding: '6px 14px',
                cursor: 'pointer',
                fontSize: '16px',
            }}>
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
            {isZh ? '綠色通行請立刻【反應】，紅色禁止請【忍住不按】！' : 'Green means GO (click button); Red means STOP (do not click)!'}
          </div>

          {/* Central Stimulus Card */}
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
                minHeight: '220px',
                display: 'flex',
                flexDirection: 'column',
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
              {isFixation ? (<span style={{ fontSize: '72px', fontWeight: 900, color: 'var(--text-secondary)' }}>+</span>) : activeTrial ? (activeTrial.stimulusType === 'go' ? (<div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                    <div style={{
                    width: '100px',
                    height: '100px',
                    borderRadius: '50%',
                    background: '#22c55e',
                    display: 'grid',
                    placeItems: 'center',
                    boxShadow: '0 0 32px rgba(34, 197, 94, 0.6)',
                }}>
                      <span style={{ fontSize: '48px', color: '#ffffff', fontWeight: 900 }}>✓</span>
                    </div>
                    <span style={{ fontSize: '36px', fontWeight: 900, color: '#22c55e' }}>
                      {isZh ? '通行 (GO!)' : 'GO!'}
                    </span>
                  </div>) : (<div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                    <div style={{
                    width: '100px',
                    height: '100px',
                    borderRadius: '50%',
                    background: '#ef4444',
                    display: 'grid',
                    placeItems: 'center',
                    boxShadow: '0 0 32px rgba(239, 68, 68, 0.6)',
                }}>
                      <span style={{ fontSize: '48px', color: '#ffffff', fontWeight: 900 }}>✕</span>
                    </div>
                    <span style={{ fontSize: '36px', fontWeight: 900, color: '#ef4444' }}>
                      {isZh ? '禁止 (STOP!)' : 'STOP!'}
                    </span>
                  </div>)) : null}
            </div>
          </div>

          {/* Huge Action Button */}
          <div style={{ width: '100%', maxWidth: '680px' }}>
            <button type="button" disabled={isFixation || currentTrialAnsweredRef.current} onClick={handleUserTap} style={{
                width: '100%',
                minHeight: '88px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '16px',
                background: 'var(--primary)',
                border: 'none',
                borderRadius: '24px',
                color: '#ffffff',
                fontSize: '32px',
                fontWeight: 900,
                cursor: isFixation || currentTrialAnsweredRef.current ? 'default' : 'pointer',
                boxShadow: '0 8px 24px color-mix(in srgb, var(--primary) 40%, transparent)',
                transition: 'transform 0.1s ease',
            }} onMouseDown={(e) => { e.currentTarget.style.transform = 'scale(0.98)'; }} onMouseUp={(e) => { e.currentTarget.style.transform = 'none'; }} onMouseLeave={(e) => { e.currentTarget.style.transform = 'none'; }}>
              <span>{isZh ? '點擊反應 (Go!)' : 'Click to Respond (Go!)'}</span>
            </button>
          </div>
        </div>)}

      {phase === 'results' && results && (<div style={{
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
              {isZh ? '以下為當次通行與抑制反應之專注指標與換算參考值' : 'Summary metrics for this Go / No-Go session'}
            </p>

            <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(2, 1fr)',
                gap: '14px',
                marginBottom: '28px',
            }}>
              <div style={{ padding: '16px', background: 'var(--bg)', borderRadius: '16px', textAlign: 'center' }}>
                <div style={{ fontSize: '15px', color: 'var(--text-secondary)' }}>{isZh ? 'Go 命中率' : 'Go Hit Rate'}</div>
                <div style={{ fontSize: '36px', fontWeight: 900, color: '#22c55e', marginTop: '4px' }}>
                  {results.goHitRatePercent}%
                </div>
                <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                  {results.goHitCount} / {results.goCount} {isZh ? '次通行' : 'Go trials'}
                </div>
              </div>

              <div style={{ padding: '16px', background: 'var(--bg)', borderRadius: '16px', textAlign: 'center' }}>
                <div style={{ fontSize: '15px', color: 'var(--text-secondary)' }}>{isZh ? 'No-Go 抑制率' : 'Inhibition Rate'}</div>
                <div style={{ fontSize: '36px', fontWeight: 900, color: 'var(--primary)', marginTop: '4px' }}>
                  {results.nogoInhibitionRatePercent}%
                </div>
                <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                  {results.nogoCorrectRejectionCount} / {results.nogoCount} {isZh ? '次成功忍住' : 'inhabited'}
                </div>
              </div>

              <div style={{ padding: '16px', background: 'var(--bg)', borderRadius: '16px', textAlign: 'center' }}>
                <div style={{ fontSize: '15px', color: 'var(--text-secondary)' }}>{isZh ? '平均反應時間' : 'Mean Go RT'}</div>
                <div style={{ fontSize: '36px', fontWeight: 900, marginTop: '4px' }}>
                  {results.meanRtMs} <span style={{ fontSize: '18px' }}>ms</span>
                </div>
                <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>{isZh ? '毫秒' : 'milliseconds'}</div>
              </div>

              <div style={{ padding: '16px', background: 'var(--bg)', borderRadius: '16px', textAlign: 'center' }}>
                <div style={{ fontSize: '15px', color: 'var(--text-secondary)' }}>{isZh ? '虛驚失誤率' : 'False Alarm Rate'}</div>
                <div style={{ fontSize: '36px', fontWeight: 900, color: results.falseAlarmRatePercent > 20 ? '#ef4444' : 'var(--text-primary)', marginTop: '4px' }}>
                  {results.falseAlarmRatePercent}%
                </div>
                <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>{isZh ? '禁止時誤按' : 'Pressed on Stop'}</div>
              </div>
            </div>

            <TrainingResultActions onBackHome={handleExitTraining} backLabel={isZh ? '返回入口' : 'Back to entry'} hubLabel={isZh ? '返回大廳' : 'Back to lobby'} />
          </div>
        </div>)}
    </div>);
}
function GenerateGoNoGoTrials(difficulty: GoNoGoDifficulty, rounds: number): GoNoGoTrial[] {
    const result: GoNoGoTrial[] = [];
    let goRatio = 0.75;
    if (difficulty === 'easy')
        goRatio = 0.8;
    else if (difficulty === 'hard')
        goRatio = 0.7;
    for (let i = 0; i < rounds; i += 1) {
        const isGo = Math.random() < goRatio;
        result.push({
            trialNumber: i + 1,
            stimulusType: isGo ? 'go' : 'nogo',
            responded: false,
            correct: false,
            reactionTimeMs: null,
        });
    }
    return result;
}

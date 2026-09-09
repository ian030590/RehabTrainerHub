import { GetHostedGameSetting } from '@rehab-trainer/ui/embeddedTraining';
import { RequestHubTrainingConfiguration } from '@rehab-trainer/ui/embeddedTraining';
// Canonical Hub-owned brain Flanker selective attention runtime.
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
export type FlankerDirection = 'left' | 'right';
export type FlankerDifficulty = 'easy' | 'medium' | 'hard';
type FlankerCondition = 'congruent' | 'incongruent' | 'neutral';
type FlankerPhase = 'menu' | 'rules' | 'playing' | 'results';
interface FlankerGameProps {
    onExit: () => void;
}
interface FlankerTrial {
    trialNumber: number;
    condition: FlankerCondition;
    targetDirection: FlankerDirection;
    flankerDirection: FlankerDirection | 'neutral';
    displaySymbols: string[];
    userResponse: FlankerDirection | null;
    correct: boolean;
    reactionTimeMs: number;
}
interface FlankerSessionRecord {
    totalRounds: number;
    correctCount: number;
    accuracyPercent: number;
    meanRtMs: number;
    congruentRtMs: number;
    incongruentRtMs: number;
    interferenceMs: number;
    trials: FlankerTrial[];
}
export function FlankerGame({ onExit }: FlankerGameProps) {
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
    const [phase, setPhase] = useState<FlankerPhase>('rules');
    useTrainingAbort({ active: phase === 'playing', onAbort: handleExitTraining });
    const [difficulty, setDifficulty] = useState<FlankerDifficulty>(GetHostedGameSetting<FlankerDifficulty>('difficulty'));
    const [rounds, setRounds] = useState(GetHostedGameSetting<number>('rounds'));
    const [stimulusDurationMs, setStimulusDurationMs] = useState(GetHostedGameSetting<number>('stimulusDurationMs'));
    const [soundEnabled, setSoundEnabled] = useState(GetHostedGameSetting<boolean>('soundEnabled'));
    const hostedSettings = useHostedGameSettings();
    const hostedSettingsAppliedRef = useRef(false);

    const [currentTrialIndex, setCurrentTrialIndex] = useState(0);
    const [trials, setTrials] = useState<FlankerTrial[]>([]);
    const [isFixation, setIsFixation] = useState(false);
    const [trialFeedback, setTrialFeedback] = useState<'correct' | 'incorrect' | null>(null);
    const [results, setResults] = useState<FlankerSessionRecord | null>(null);
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
    const handleResponse = useCallback((selectedDirection: FlankerDirection) => {
        if (phase !== 'playing' || isFixation || !activeTrial || currentTrialAnsweredRef.current)
            return;
        currentTrialAnsweredRef.current = true;
        if (trialTimeoutRef.current) {
            clearTimeout(trialTimeoutRef.current);
            trialTimeoutRef.current = null;
        }
        const rt = Math.max(1, Math.round(performance.now() - trialStartTimeRef.current));
        const isCorrect = selectedDirection === activeTrial.targetDirection;
        if (soundEnabled) {
            if (isCorrect)
                PlaySuccessSound(jsPsychRef);
            else
                PlayFailureSound(jsPsychRef);
        }
        setTrialFeedback(isCorrect ? 'correct' : 'incorrect');
        const updatedTrial: FlankerTrial = {
            ...activeTrial,
            userResponse: selectedDirection,
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
                        handleResponse(activeTrial?.targetDirection === 'left' ? 'right' : 'left');
                    }
                }, stimulusDurationMs);
            }
        }, 450);
    }, [activeTrial?.targetDirection, handleResponse, stimulusDurationMs]);
    const completeSession = useCallback((finalTrials: FlankerTrial[]) => {
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
        const record: FlankerSessionRecord = {
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
            gameId: 'flanker',
            gameTitle: isZh ? '側翼干擾選擇（Flanker）' : 'Flanker Selective Attention',
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
        const freshTrials = GenerateFlankerTrials(difficulty, rounds);
        setTrials(freshTrials);
        setCurrentTrialIndex(0);
        setResults(null);
        setPhase('playing');
        await jsPsychLifecycleRef.current?.start({ moduleId: 'brain:flanker', onStart: () => undefined });
        setIsFixation(true);
        currentTrialAnsweredRef.current = true;
        setTimeout(() => {
            setIsFixation(false);
            currentTrialAnsweredRef.current = false;
            trialStartTimeRef.current = performance.now();
            if (stimulusDurationMs > 0) {
                trialTimeoutRef.current = setTimeout(() => {
                    if (!currentTrialAnsweredRef.current) {
                        handleResponse(freshTrials[0]?.targetDirection === 'left' ? 'right' : 'left');
                    }
                }, stimulusDurationMs);
            }
        }, 500);
    }, [difficulty, enterTrainingFullscreen, handleResponse, rounds, stimulusDurationMs]);
    useEffect(() => {
        if (phase !== 'playing')
            return;
        const handleKeyDown = (event: KeyboardEvent) => {
            const key = event.key;
            if (key === 'ArrowLeft' || key.toLowerCase() === 'a')
                handleResponse('left');
            else if (key === 'ArrowRight' || key.toLowerCase() === 'd')
                handleResponse('right');
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [handleResponse, phase]);
    const difficultyLabels = {
        easy: isZh ? '初級（同向為主）' : 'Beginner',
        medium: isZh ? '中級（標準平衡）' : 'Intermediate',
        hard: isZh ? '高級（高強度干擾）' : 'Advanced',
    };
    const durationLabels = {
        1200: isZh ? '1.2 秒' : '1.2s',
        2000: isZh ? '2.0 秒' : '2.0s',
        3500: isZh ? '3.5 秒' : '3.5s',
        0: isZh ? '不限時' : 'Unlimited',
    };
    return (<div ref={fullscreenRootRef} className={`cognitive-reference-game flanker-game flanker-phase-${phase}`}>
      <div ref={jsPsychHostRef} style={{ display: 'none' }}/>

      {null}

      {phase === 'rules' && (<BrainTrainingRulesPanel gameId="flanker" title={isZh ? '側翼干擾選擇（Flanker）' : 'Flanker Selective Attention'} summaryTitle={isZh ? '目前設定摘要' : 'Settings Summary'} summaryItems={[
                { label: isZh ? '難度' : 'Difficulty', value: difficultyLabels[difficulty] },
                { label: isZh ? '總題數' : 'Trials', value: `${rounds} ${isZh ? '題' : 'trials'}` },
                { label: isZh ? '作答時限' : 'Time Limit', value: durationLabels[stimulusDurationMs as keyof typeof durationLabels] ?? `${stimulusDurationMs}ms` },
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
            {isZh ? '請依【最中間箭頭】的方向作答，忽略兩側干擾！' : 'Respond to the CENTER arrow direction, ignore distractors!'}
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
              {isFixation ? (<span style={{ fontSize: '72px', fontWeight: 900, color: 'var(--text-secondary)' }}>+</span>) : activeTrial ? (<div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '16px',
                }}>
                  {activeTrial.displaySymbols.map((sym, idx) => {
                    const isCenter = idx === 2;
                    return (<span key={idx} style={{
                            fontSize: isCenter ? '76px' : '56px',
                            fontWeight: 900,
                            color: isCenter ? 'var(--primary)' : 'var(--text-primary)',
                            background: isCenter ? 'color-mix(in srgb, var(--primary) 14%, transparent)' : 'transparent',
                            border: isCenter ? '2px dashed var(--primary)' : 'none',
                            borderRadius: '12px',
                            padding: isCenter ? '4px 16px' : '4px 8px',
                            display: 'inline-block',
                            lineHeight: 1,
                            boxShadow: isCenter ? '0 4px 18px color-mix(in srgb, var(--primary) 25%, transparent)' : 'none',
                        }}>
                        {sym}
                      </span>);
                })}
                </div>) : null}
            </div>
          </div>

          {/* 2 Massive Screen Buttons */}
          <div style={{
                width: '100%',
                maxWidth: '680px',
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: '16px',
            }}>
            <button type="button" disabled={isFixation || currentTrialAnsweredRef.current} onClick={() => handleResponse('left')} style={{
                minHeight: '84px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '14px',
                background: 'var(--surface)',
                border: '3px solid var(--primary)',
                borderRadius: '20px',
                color: 'var(--text-primary)',
                fontSize: '28px',
                fontWeight: 900,
                cursor: isFixation || currentTrialAnsweredRef.current ? 'default' : 'pointer',
                boxShadow: '0 6px 20px rgba(0,0,0,0.2)',
                transition: 'transform 0.1s ease',
            }} onMouseDown={(e) => { e.currentTarget.style.transform = 'scale(0.97)'; }} onMouseUp={(e) => { e.currentTarget.style.transform = 'none'; }} onMouseLeave={(e) => { e.currentTarget.style.transform = 'none'; }}>
              <span style={{ fontSize: '36px', color: 'var(--primary)' }}>←</span>
              <span>{isZh ? '向左' : 'Left'}</span>
            </button>

            <button type="button" disabled={isFixation || currentTrialAnsweredRef.current} onClick={() => handleResponse('right')} style={{
                minHeight: '84px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '14px',
                background: 'var(--surface)',
                border: '3px solid var(--primary)',
                borderRadius: '20px',
                color: 'var(--text-primary)',
                fontSize: '28px',
                fontWeight: 900,
                cursor: isFixation || currentTrialAnsweredRef.current ? 'default' : 'pointer',
                boxShadow: '0 6px 20px rgba(0,0,0,0.2)',
                transition: 'transform 0.1s ease',
            }} onMouseDown={(e) => { e.currentTarget.style.transform = 'scale(0.97)'; }} onMouseUp={(e) => { e.currentTarget.style.transform = 'none'; }} onMouseLeave={(e) => { e.currentTarget.style.transform = 'none'; }}>
              <span>{isZh ? '向右' : 'Right'}</span>
              <span style={{ fontSize: '36px', color: 'var(--primary)' }}>→</span>
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
              {isZh ? '以下為當次側翼干擾選擇練習之反應紀錄與換算參考值' : 'Summary records for this flanker selective attention session'}
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
                <div style={{ fontSize: '15px', color: 'var(--text-secondary)' }}>{isZh ? '同向情境反應' : 'Congruent RT'}</div>
                <div style={{ fontSize: '28px', fontWeight: 800, color: '#22c55e', marginTop: '4px' }}>
                  {results.congruentRtMs} <span style={{ fontSize: '16px' }}>ms</span>
                </div>
                <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>{isZh ? '箭頭方向完全一致' : 'All arrows aligned'}</div>
              </div>

              <div style={{ padding: '16px', background: 'var(--bg)', borderRadius: '16px', textAlign: 'center' }}>
                <div style={{ fontSize: '15px', color: 'var(--text-secondary)' }}>{isZh ? '衝突干擾反應' : 'Incongruent RT'}</div>
                <div style={{ fontSize: '28px', fontWeight: 800, color: '#ef4444', marginTop: '4px' }}>
                  {results.incongruentRtMs} <span style={{ fontSize: '16px' }}>ms</span>
                </div>
                <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>{isZh ? '側翼與中央衝突' : 'Flankers opposite to center'}</div>
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
              <strong>{isZh ? '側翼干擾延遲：' : 'Flanker Interference: '}</strong>
              {results.interferenceMs > 0 ? `+${results.interferenceMs} ms` : `${results.interferenceMs} ms`}
              <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                {isZh
                ? '（周圍箭頭衝突時額外花費的時間，數值越小代表抗側翼干擾能力越佳）'
                : '(Extra response latency caused by conflicting flankers; lower values indicate better distracter suppression)'}
              </div>
            </div>

            <TrainingResultActions onBackHome={handleExitTraining} backLabel={isZh ? '返回入口' : 'Back to entry'} hubLabel={isZh ? '返回大廳' : 'Back to lobby'} />
          </div>
        </div>)}
    </div>);
}
function GenerateFlankerTrials(difficulty: FlankerDifficulty, rounds: number): FlankerTrial[] {
    const result: FlankerTrial[] = [];
    const directions: FlankerDirection[] = ['left', 'right'];
    let congruentRatio = 0.45;
    let neutralRatio = 0.1;
    if (difficulty === 'easy') {
        congruentRatio = 0.6;
        neutralRatio = 0.3;
    }
    else if (difficulty === 'hard') {
        congruentRatio = 0.2;
        neutralRatio = 0.1;
    }
    for (let i = 0; i < rounds; i += 1) {
        const roll = Math.random();
        let condition: FlankerCondition = 'incongruent';
        if (roll < congruentRatio) {
            condition = 'congruent';
        }
        else if (roll < congruentRatio + neutralRatio) {
            condition = 'neutral';
        }
        const targetDir: FlankerDirection = directions[Math.floor(Math.random() * directions.length)];
        let flankerDir: FlankerDirection | 'neutral' = targetDir;
        if (condition === 'incongruent') {
            flankerDir = targetDir === 'left' ? 'right' : 'left';
        }
        else if (condition === 'neutral') {
            flankerDir = 'neutral';
        }
        const targetSym = targetDir === 'left' ? '<' : '>';
        const flankerSym = flankerDir === 'neutral' ? '—' : flankerDir === 'left' ? '<' : '>';
        const displaySymbols = [flankerSym, flankerSym, targetSym, flankerSym, flankerSym];
        result.push({
            trialNumber: i + 1,
            condition,
            targetDirection: targetDir,
            flankerDirection: flankerDir,
            displaySymbols,
            userResponse: null,
            correct: false,
            reactionTimeMs: 0,
        });
    }
    return result;
}

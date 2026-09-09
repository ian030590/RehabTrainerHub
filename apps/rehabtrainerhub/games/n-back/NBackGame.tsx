import { GetHostedGameSetting } from '@rehab-trainer/ui/embeddedTraining';
import { RequestHubTrainingConfiguration } from '@rehab-trainer/ui/embeddedTraining';
// Canonical Hub-owned brain N-back working memory updating runtime.
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
import { useCallback,useEffect,useMemo,useRef,useState } from 'react';
import './runtime/cognitive/ThinkingGames.css';
import { BrainTrainingRulesPanel } from './runtime/components/rules/BrainTrainingRulesPanel';
import { JsPsychExternalLifecycle } from './runtime/jsPsychLifecycle';
export type NBackLevel = 1 | 2 | 3;
type NBackPhase = 'menu' | 'rules' | 'playing' | 'results';
interface NBackGameProps {
    onExit: () => void;
}
interface NBackTrial {
    trialNumber: number;
    symbolId: number;
    isMatch: boolean;
    isObservationOnly: boolean;
    userResponse: 'match' | 'nomatch' | null;
    correct: boolean;
    reactionTimeMs: number | null;
}
interface NBackSessionRecord {
    totalRounds: number;
    nBackLevel: NBackLevel;
    testTrialsCount: number;
    correctCount: number;
    accuracyPercent: number;
    matchTrialsCount: number;
    matchHitCount: number;
    matchHitRatePercent: number;
    noMatchTrialsCount: number;
    noMatchCorrectRejectionCount: number;
    noMatchCorrectRejectionRatePercent: number;
    meanRtMs: number;
    trials: NBackTrial[];
}
export function NBackGame({ onExit }: NBackGameProps) {
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
    const [phase, setPhase] = useState<NBackPhase>('rules');
    useTrainingAbort({ active: phase === 'playing', onAbort: handleExitTraining });
    const [nBackLevel, setNBackLevel] = useState<NBackLevel>(Number(GetHostedGameSetting<'1' | '2' | '3'>('nBackLevel')) as NBackLevel);
    const [rounds, setRounds] = useState(GetHostedGameSetting<number>('rounds'));
    const [stimulusDurationMs, setStimulusDurationMs] = useState(GetHostedGameSetting<number>('stimulusDurationMs'));
    const [soundEnabled, setSoundEnabled] = useState(GetHostedGameSetting<boolean>('soundEnabled'));
    const hostedSettings = useHostedGameSettings();
    const hostedSettingsAppliedRef = useRef(false);

    const [currentTrialIndex, setCurrentTrialIndex] = useState(0);
    const [trials, setTrials] = useState<NBackTrial[]>([]);
    const [isFixation, setIsFixation] = useState(false);
    const [trialFeedback, setTrialFeedback] = useState<'correct' | 'incorrect' | null>(null);
    const [results, setResults] = useState<NBackSessionRecord | null>(null);
    const trialStartTimeRef = useRef<number>(0);
    const trialTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const currentTrialAnsweredRef = useRef(false);
    useEffect(() => {
        if (!hostedSettings || hostedSettingsAppliedRef.current)
            return;
        hostedSettingsAppliedRef.current = true;
        if (hostedSettings.nBackLevel === '1' || hostedSettings.nBackLevel === 1) {
            setNBackLevel(1);
        }
        else if (hostedSettings.nBackLevel === '2' || hostedSettings.nBackLevel === 2) {
            setNBackLevel(2);
        }
        else if (hostedSettings.nBackLevel === '3' || hostedSettings.nBackLevel === 3) {
            setNBackLevel(3);
        }
        if (typeof hostedSettings.rounds === 'number' && hostedSettings.rounds >= 10 && hostedSettings.rounds <= 50) {
            setRounds(hostedSettings.rounds);
        }
        if (typeof hostedSettings.stimulusDurationMs === 'number') {
            setStimulusDurationMs(hostedSettings.stimulusDurationMs);
        }
        if (typeof hostedSettings.soundEnabled === 'boolean') {
            setSoundEnabled(hostedSettings.soundEnabled);
        }
    }, [hostedSettings]);
    useEffect(() => {
        if (!jsPsychHostRef.current || jsPsychLifecycleRef.current)
            return;
        const jsPsychInstance = initJsPsych({
            display_element: jsPsychHostRef.current,
            on_finish: () => undefined,
        });
        jsPsychRef.current = jsPsychInstance;
        const lifecycle = new JsPsychExternalLifecycle(jsPsychInstance);
        jsPsychLifecycleRef.current = lifecycle;
        return () => {
            lifecycle.dispose();
            jsPsychLifecycleRef.current = null;
            jsPsychRef.current = null;
        };
    }, [onExit]);
    const activeTrial = trials[currentTrialIndex] as NBackTrial | undefined;
    const handleTrialTimeout = useCallback(() => {
        if (currentTrialAnsweredRef.current || !activeTrial)
            return;
        currentTrialAnsweredRef.current = true;
        if (activeTrial.isObservationOnly) {
            const updatedTrial: NBackTrial = {
                ...activeTrial,
                userResponse: null,
                correct: true,
                reactionTimeMs: stimulusDurationMs,
            };
            advanceToNextTrial(updatedTrial);
            return;
        }
        if (soundEnabled)
            PlayFailureSound(jsPsychRef);
        setTrialFeedback('incorrect');
        const updatedTrial: NBackTrial = {
            ...activeTrial,
            userResponse: null,
            correct: false,
            reactionTimeMs: null,
        };
        setTimeout(() => {
            setTrialFeedback(null);
            advanceToNextTrial(updatedTrial);
        }, 320);
    }, [activeTrial, soundEnabled, stimulusDurationMs]);
    const advanceToNextTrial = useCallback((updatedTrial: NBackTrial) => {
        const nextIndex = currentTrialIndex + 1;
        const nextTrials = [...trials.slice(0, currentTrialIndex), updatedTrial];
        if (nextIndex >= trials.length) {
            completeSession(nextTrials);
        }
        else {
            setTrials(nextTrials);
            setCurrentTrialIndex(nextIndex);
            startTrialFixation();
        }
    }, [currentTrialIndex, trials]);
    const handleUserAnswer = useCallback((response: 'match' | 'nomatch') => {
        if (isFixation || currentTrialAnsweredRef.current || !activeTrial)
            return;
        currentTrialAnsweredRef.current = true;
        if (trialTimeoutRef.current) {
            clearTimeout(trialTimeoutRef.current);
            trialTimeoutRef.current = null;
        }
        const rt = Math.round(performance.now() - trialStartTimeRef.current);
        const isCorrect = (activeTrial.isMatch && response === 'match') || (!activeTrial.isMatch && response === 'nomatch');
        if (isCorrect) {
            if (soundEnabled)
                PlaySuccessSound(jsPsychRef);
            setTrialFeedback('correct');
        }
        else {
            if (soundEnabled)
                PlayFailureSound(jsPsychRef);
            setTrialFeedback('incorrect');
        }
        const updatedTrial: NBackTrial = {
            ...activeTrial,
            userResponse: response,
            correct: isCorrect,
            reactionTimeMs: rt,
        };
        setTimeout(() => {
            setTrialFeedback(null);
            advanceToNextTrial(updatedTrial);
        }, 320);
    }, [activeTrial, advanceToNextTrial, isFixation, soundEnabled]);
    const handleObservationAdvance = useCallback(() => {
        if (isFixation || currentTrialAnsweredRef.current || !activeTrial || !activeTrial.isObservationOnly)
            return;
        currentTrialAnsweredRef.current = true;
        if (trialTimeoutRef.current) {
            clearTimeout(trialTimeoutRef.current);
            trialTimeoutRef.current = null;
        }
        const updatedTrial: NBackTrial = {
            ...activeTrial,
            userResponse: null,
            correct: true,
            reactionTimeMs: Math.round(performance.now() - trialStartTimeRef.current),
        };
        advanceToNextTrial(updatedTrial);
    }, [activeTrial, advanceToNextTrial, isFixation]);
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
        }, 400);
    }, [handleTrialTimeout, stimulusDurationMs]);
    const completeSession = useCallback((finalTrials: NBackTrial[]) => {
        const totalRounds = finalTrials.length;
        const testTrials = finalTrials.filter((t) => !t.isObservationOnly);
        const testTrialsCount = testTrials.length;
        const correctCount = testTrials.filter((t) => t.correct).length;
        const accuracyPercent = Math.round((correctCount / Math.max(1, testTrialsCount)) * 100);
        const matchTrials = testTrials.filter((t) => t.isMatch);
        const matchTrialsCount = matchTrials.length;
        const matchHitCount = matchTrials.filter((t) => t.correct).length;
        const matchHitRatePercent = Math.round((matchHitCount / Math.max(1, matchTrialsCount)) * 100);
        const noMatchTrials = testTrials.filter((t) => !t.isMatch);
        const noMatchTrialsCount = noMatchTrials.length;
        const noMatchCorrectRejectionCount = noMatchTrials.filter((t) => t.correct).length;
        const noMatchCorrectRejectionRatePercent = Math.round((noMatchCorrectRejectionCount / Math.max(1, noMatchTrialsCount)) * 100);
        const validRts = testTrials.filter((t) => t.reactionTimeMs !== null).map((t) => t.reactionTimeMs as number);
        const meanRtMs = validRts.length > 0 ? Math.round(validRts.reduce((a, b) => a + b, 0) / validRts.length) : 0;
        const record: NBackSessionRecord = {
            totalRounds,
            nBackLevel,
            testTrialsCount,
            correctCount,
            accuracyPercent,
            matchTrialsCount,
            matchHitCount,
            matchHitRatePercent,
            noMatchTrialsCount,
            noMatchCorrectRejectionCount,
            noMatchCorrectRejectionRatePercent,
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
            moduleId: 'memory-training',
            gameId: 'n-back',
            gameTitle: isZh ? '工作記憶更新（N-back）' : 'Working Memory Updating (N-back)',
            difficulty: `${nBackLevel}-back`,
            trainingDate: FormatTestDate(new Date()),
            details: {
                Game_Result: 'Complete',
                Total_Rounds: totalRounds,
                N_Back_Level: nBackLevel,
                Accuracy_Percent: accuracyPercent,
                Match_Hit_Rate_Percent: matchHitRatePercent,
                Correct_Rejection_Rate_Percent: noMatchCorrectRejectionRatePercent,
                Mean_RT_Ms: meanRtMs,
            },
        });
    }, [isZh, nBackLevel]);
    const startGame = useCallback(async () => {
        PrepareAudioFeedback(jsPsychRef);
        await enterTrainingFullscreen();
        const freshTrials = GenerateNBackTrials(nBackLevel, rounds);
        setTrials(freshTrials);
        setCurrentTrialIndex(0);
        setResults(null);
        setPhase('playing');
        await jsPsychLifecycleRef.current?.start({ moduleId: 'brain:n-back', onStart: () => undefined });
        setIsFixation(true);
        currentTrialAnsweredRef.current = true;
        setTimeout(() => {
            setIsFixation(false);
            currentTrialAnsweredRef.current = false;
            trialStartTimeRef.current = performance.now();
            trialTimeoutRef.current = setTimeout(() => {
                handleTrialTimeout();
            }, stimulusDurationMs);
        }, 400);
    }, [enterTrainingFullscreen, handleTrialTimeout, nBackLevel, rounds, stimulusDurationMs]);
    useEffect(() => {
        if (phase !== 'playing')
            return;
        const handleKeyDown = (event: KeyboardEvent) => {
            if (activeTrial?.isObservationOnly) {
                if (event.key === ' ' || event.key === 'Enter') {
                    event.preventDefault();
                    handleObservationAdvance();
                }
                return;
            }
            if (event.key === '1' || event.key === 'ArrowLeft') {
                event.preventDefault();
                handleUserAnswer('match');
            }
            else if (event.key === '2' || event.key === 'ArrowRight') {
                event.preventDefault();
                handleUserAnswer('nomatch');
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [activeTrial, handleObservationAdvance, handleUserAnswer, phase]);
    const summaryItems = useMemo(() => [
        {
            label: isZh ? '記憶步數 (N)' : 'N-back Level',
            value: `${nBackLevel}-back`,
        },
        {
            label: isZh ? '總題數' : 'Trials',
            value: `${rounds} ${isZh ? '題' : 'trials'}`,
        },
        {
            label: isZh ? '展示速度' : 'Display Speed',
            value: `${(stimulusDurationMs / 1000).toFixed(1)} ${isZh ? '秒' : 'sec'}`,
        },
        {
            label: isZh ? '聲音回饋' : 'Sound Feedback',
            value: soundEnabled ? (isZh ? '開啟' : 'Enabled') : (isZh ? '關閉' : 'Disabled'),
        },
    ], [isZh, nBackLevel, rounds, soundEnabled, stimulusDurationMs]);
    return (<div ref={fullscreenRootRef} className="thinking-game-container" style={{
            width: '100%',
            minHeight: '100%',
            position: 'relative',
            display: 'flex',
            flexDirection: 'column',
        }}>
      <div ref={jsPsychHostRef} style={{ display: 'none' }}/>

      {null}

      {phase === 'rules' && (<BrainTrainingRulesPanel gameId="n-back" title={isZh ? '工作記憶更新（N-back）說明' : 'N-back Working Memory Rules'} summaryTitle={isZh ? '目前設定摘要' : 'Settings Summary'} summaryItems={summaryItems} onStart={() => void startGame()} onBack={() => RequestHubTrainingConfiguration()}/>)}

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
            <span style={{
                fontSize: '16px',
                fontWeight: 800,
                padding: '4px 12px',
                borderRadius: '999px',
                background: 'var(--primary)',
                color: '#ffffff',
            }}>
              {nBackLevel}-back
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
                maxWidth: '680px',
            }}>
            {activeTrial?.isObservationOnly ? (isZh
                ? `請記住此圖形（第 ${currentTrialIndex + 1} / ${nBackLevel} 張記憶觀察）`
                : `Memorize this symbol (${currentTrialIndex + 1} of ${nBackLevel} warmup)`) : (isZh
                ? `目前圖形是否與「前 ${nBackLevel} 個」相同？`
                : `Does this match the symbol from ${nBackLevel} steps back?`)}
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
                padding: '24px',
            }}>
              {isFixation ? (<span style={{ fontSize: '72px', fontWeight: 900, color: 'var(--text-secondary)' }}>+</span>) : activeTrial ? (<RenderNBackSymbol symbolId={activeTrial.symbolId} size={130}/>) : null}
            </div>
          </div>

          {/* Action Buttons */}
          <div style={{ width: '100%', maxWidth: '680px' }}>
            {activeTrial?.isObservationOnly ? (<button type="button" disabled={isFixation || currentTrialAnsweredRef.current} onClick={handleObservationAdvance} style={{
                    width: '100%',
                    minHeight: '84px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '12px',
                    borderRadius: '20px',
                    background: 'var(--primary)',
                    color: '#ffffff',
                    fontSize: '24px',
                    fontWeight: 800,
                    border: 'none',
                    cursor: 'pointer',
                    boxShadow: '0 6px 20px rgba(0,0,0,0.2)',
                }}>
                <span>{isZh ? '記住了，繼續下一張' : 'Memorized, Next'}</span>
                <span style={{ fontSize: '18px', opacity: 0.85 }}>→</span>
              </button>) : (<div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px' }}>
                <button type="button" disabled={isFixation || currentTrialAnsweredRef.current} onClick={() => handleUserAnswer('match')} style={{
                    minHeight: '88px',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderRadius: '20px',
                    background: '#22c55e',
                    color: '#ffffff',
                    fontSize: '24px',
                    fontWeight: 900,
                    border: 'none',
                    cursor: 'pointer',
                    boxShadow: '0 6px 24px rgba(34, 197, 94, 0.4)',
                }}>
                  <span>{isZh ? '符合（相同）' : 'Match (Same)'}</span>
                  <span style={{ fontSize: '15px', fontWeight: 600, opacity: 0.9 }}>
                    {isZh ? '鍵盤 [1] 或 [←]' : 'Key [1] / [←]'}
                  </span>
                </button>

                <button type="button" disabled={isFixation || currentTrialAnsweredRef.current} onClick={() => handleUserAnswer('nomatch')} style={{
                    minHeight: '88px',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderRadius: '20px',
                    background: 'var(--surface)',
                    color: 'var(--text-primary)',
                    fontSize: '24px',
                    fontWeight: 900,
                    border: '3px solid var(--border)',
                    cursor: 'pointer',
                    boxShadow: '0 6px 20px rgba(0,0,0,0.15)',
                }}>
                  <span>{isZh ? '不符合（不同）' : 'No Match (Diff)'}</span>
                  <span style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-secondary)' }}>
                    {isZh ? '鍵盤 [2] 或 [→]' : 'Key [2] / [→]'}
                  </span>
                </button>
              </div>)}
          </div>
        </div>)}

      {phase === 'results' && results && (<div style={{
                position: 'fixed',
                inset: 0,
                overflowY: 'auto',
                display: 'flex',
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
              {isZh ? `以下為當次 ${results.nBackLevel}-back 工作記憶更新之表現指標與換算參考值` : `Summary metrics for this ${results.nBackLevel}-back session`}
            </p>

            <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(2, 1fr)',
                gap: '14px',
                marginBottom: '28px',
            }}>
              <div style={{ padding: '16px', background: 'var(--bg)', borderRadius: '16px', textAlign: 'center' }}>
                <div style={{ fontSize: '15px', color: 'var(--text-secondary)' }}>{isZh ? '總體正確率' : 'Accuracy'}</div>
                <div style={{ fontSize: '36px', fontWeight: 900, color: '#22c55e', marginTop: '4px' }}>
                  {results.accuracyPercent}%
                </div>
                <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                  {results.correctCount} / {results.testTrialsCount} {isZh ? '題比對成功' : 'correct'}
                </div>
              </div>

              <div style={{ padding: '16px', background: 'var(--bg)', borderRadius: '16px', textAlign: 'center' }}>
                <div style={{ fontSize: '15px', color: 'var(--text-secondary)' }}>{isZh ? '相同命中率' : 'Match Hit Rate'}</div>
                <div style={{ fontSize: '36px', fontWeight: 900, color: 'var(--primary)', marginTop: '4px' }}>
                  {results.matchHitRatePercent}%
                </div>
                <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                  {results.matchHitCount} / {results.matchTrialsCount} {isZh ? '次正確符合' : 'hits'}
                </div>
              </div>

              <div style={{ padding: '16px', background: 'var(--bg)', borderRadius: '16px', textAlign: 'center' }}>
                <div style={{ fontSize: '15px', color: 'var(--text-secondary)' }}>{isZh ? '不同辨識率' : 'Correct Rejection'}</div>
                <div style={{ fontSize: '36px', fontWeight: 900, marginTop: '4px' }}>
                  {results.noMatchCorrectRejectionRatePercent}%
                </div>
                <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                  {results.noMatchCorrectRejectionCount} / {results.noMatchTrialsCount} {isZh ? '次正確不同' : 'correct rejects'}
                </div>
              </div>

              <div style={{ padding: '16px', background: 'var(--bg)', borderRadius: '16px', textAlign: 'center' }}>
                <div style={{ fontSize: '15px', color: 'var(--text-secondary)' }}>{isZh ? '平均反應時間' : 'Mean RT'}</div>
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
function RenderNBackSymbol({ symbolId, size }: {
    symbolId: number;
    size: number;
}) {
    switch (symbolId) {
        case 1:
            return (<svg viewBox="0 0 100 100" width={size} height={size}>
          <polygon points="50,14 86,50 50,86 14,50" fill="#38bdf8" stroke="#0284c7" strokeWidth="4"/>
        </svg>);
        case 2:
            return (<svg viewBox="0 0 100 100" width={size} height={size}>
          <polygon points="50,12 61,38 88,40 68,58 74,86 50,71 26,86 32,58 12,40 39,38" fill="#eab308" stroke="#ca8a04" strokeWidth="3"/>
        </svg>);
        case 3:
            return (<svg viewBox="0 0 100 100" width={size} height={size}>
          <polygon points="50,15 82,33 82,67 50,85 18,67 18,33" fill="#a855f7" stroke="#7e22ce" strokeWidth="4"/>
        </svg>);
        case 4:
            return (<svg viewBox="0 0 100 100" width={size} height={size}>
          <polygon points="50,16 86,80 14,80" fill="#22c55e" stroke="#15803d" strokeWidth="4"/>
        </svg>);
        case 5:
        default:
            return (<svg viewBox="0 0 100 100" width={size} height={size}>
          <circle cx="50" cy="50" r="36" fill="#f43f5e" stroke="#be123c" strokeWidth="4"/>
          <circle cx="50" cy="50" r="16" fill="#ffffff" fillOpacity="0.3"/>
        </svg>);
    }
}
function GenerateNBackTrials(nLevel: NBackLevel, totalTrials: number): NBackTrial[] {
    const symbolPool = [1, 2, 3, 4, 5];
    const trials: NBackTrial[] = [];
    const sequence: number[] = [];
    for (let i = 0; i < totalTrials; i += 1) {
        let sym: number;
        let isMatch = false;
        const isObservationOnly = i < nLevel;
        if (isObservationOnly) {
            sym = symbolPool[Math.floor(Math.random() * symbolPool.length)];
        }
        else {
            const matchProbability = 0.35;
            const shouldMatch = Math.random() < matchProbability;
            if (shouldMatch) {
                sym = sequence[i - nLevel];
                isMatch = true;
            }
            else {
                const otherSymbols = symbolPool.filter((s) => s !== sequence[i - nLevel]);
                sym = otherSymbols[Math.floor(Math.random() * otherSymbols.length)];
                isMatch = false;
            }
        }
        sequence.push(sym);
        trials.push({
            trialNumber: i + 1,
            symbolId: sym,
            isMatch,
            isObservationOnly,
            userResponse: null,
            correct: false,
            reactionTimeMs: null,
        });
    }
    return trials;
}

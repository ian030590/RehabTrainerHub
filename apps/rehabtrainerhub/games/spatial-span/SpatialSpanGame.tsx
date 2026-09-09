import { GetHostedGameSetting } from '@rehab-trainer/ui/embeddedTraining';
import { RequestHubTrainingConfiguration } from '@rehab-trainer/ui/embeddedTraining';
// Canonical Hub-owned brain Spatial Span visuospatial memory runtime.
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
export type SpanMode = 'forward' | 'backward';
type SpatialSpanPhase = 'menu' | 'rules' | 'playing' | 'results';
type TrialSubPhase = 'ready' | 'presenting' | 'input' | 'feedback';
interface SpatialSpanGameProps {
    onExit: () => void;
}
interface SpatialSpanTrial {
    trialNumber: number;
    spanLength: number;
    sequence: number[];
    targetSequence: number[];
    userClicks: number[];
    correct: boolean;
    reactionTimeMs: number | null;
}
interface SpatialSpanSessionRecord {
    totalRounds: number;
    spanMode: SpanMode;
    startLength: number;
    maxSpanLength: number;
    correctCount: number;
    accuracyPercent: number;
    meanRtMs: number;
    trials: SpatialSpanTrial[];
}
export function SpatialSpanGame({ onExit }: SpatialSpanGameProps) {
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
    const [phase, setPhase] = useState<SpatialSpanPhase>('rules');
    useTrainingAbort({ active: phase === 'playing', onAbort: handleExitTraining });
    const [spanMode, setSpanMode] = useState<SpanMode>(GetHostedGameSetting<SpanMode>('spanMode'));
    const [startLength, setStartLength] = useState<number>(GetHostedGameSetting<number>('startLength'));
    const [rounds, setRounds] = useState<number>(GetHostedGameSetting<number>('rounds'));
    const [displaySpeedMs, setDisplaySpeedMs] = useState<number>(GetHostedGameSetting<number>('displaySpeedMs'));
    const [soundEnabled, setSoundEnabled] = useState<boolean>(GetHostedGameSetting<boolean>('soundEnabled'));
    const hostedSettings = useHostedGameSettings();
    const hostedSettingsAppliedRef = useRef(false);

    const [currentTrialIndex, setCurrentTrialIndex] = useState(0);
    const [currentSpanLength, setCurrentSpanLength] = useState(3);
    const [trials, setTrials] = useState<SpatialSpanTrial[]>([]);
    const [subPhase, setSubPhase] = useState<TrialSubPhase>('ready');
    const [highlightedBlockIndex, setHighlightedBlockIndex] = useState<number | null>(null);
    const [userClicks, setUserClicks] = useState<number[]>([]);
    const [trialFeedback, setTrialFeedback] = useState<'correct' | 'incorrect' | null>(null);
    const [results, setResults] = useState<SpatialSpanSessionRecord | null>(null);
    const trialStartTimeRef = useRef<number>(0);
    const activeSequenceRef = useRef<number[]>([]);
    const presentationTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const currentSpanRef = useRef(3);
    const maxSpanRef = useRef(3);
    useEffect(() => {
        if (!hostedSettings || hostedSettingsAppliedRef.current)
            return;
        hostedSettingsAppliedRef.current = true;
        if (hostedSettings.spanMode === 'forward' || hostedSettings.spanMode === 'backward') {
            setSpanMode(hostedSettings.spanMode);
        }
        if (typeof hostedSettings.startLength === 'number' && hostedSettings.startLength >= 2 && hostedSettings.startLength <= 5) {
            setStartLength(hostedSettings.startLength);
            setCurrentSpanLength(hostedSettings.startLength);
            currentSpanRef.current = hostedSettings.startLength;
            maxSpanRef.current = hostedSettings.startLength;
        }
        if (typeof hostedSettings.rounds === 'number' && hostedSettings.rounds >= 5 && hostedSettings.rounds <= 20) {
            setRounds(hostedSettings.rounds);
        }
        if (typeof hostedSettings.displaySpeedMs === 'number') {
            setDisplaySpeedMs(hostedSettings.displaySpeedMs);
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
    const clearPresentationTimer = useCallback(() => {
        if (presentationTimerRef.current) {
            clearTimeout(presentationTimerRef.current);
            presentationTimerRef.current = null;
        }
    }, []);
    useEffect(() => {
        return () => {
            clearPresentationTimer();
        };
    }, [clearPresentationTimer]);
    const completeSession = useCallback((finalTrials: SpatialSpanTrial[]) => {
        const totalRounds = finalTrials.length;
        const correctCount = finalTrials.filter((t) => t.correct).length;
        const accuracyPercent = Math.round((correctCount / Math.max(1, totalRounds)) * 100);
        const validRts = finalTrials.filter((t) => t.reactionTimeMs !== null).map((t) => t.reactionTimeMs as number);
        const meanRtMs = validRts.length > 0 ? Math.round(validRts.reduce((a, b) => a + b, 0) / validRts.length) : 0;
        const maxSpanAchieved = maxSpanRef.current;
        const record: SpatialSpanSessionRecord = {
            totalRounds,
            spanMode,
            startLength,
            maxSpanLength: maxSpanAchieved,
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
        void SaveTrainingSessionRecord({
            userName: participantId,
            moduleId: 'memory-training',
            gameId: 'spatial-span',
            gameTitle: isZh ? '空間廣度記憶（Spatial Span）' : 'Spatial Span Visuospatial Memory',
            difficulty: `${spanMode}-${startLength}blocks`,
            trainingDate: FormatTestDate(new Date()),
            details: {
                Game_Result: 'Complete',
                Span_Mode: spanMode,
                Max_Span_Length: maxSpanAchieved,
                Correct_Count: correctCount,
                Total_Rounds: totalRounds,
                Accuracy_Percent: accuracyPercent,
                Mean_RT_Ms: meanRtMs,
            },
        });
    }, [isZh, spanMode, startLength]);
    const runTrialPresentation = useCallback((sequence: number[]) => {
        setSubPhase('presenting');
        let index = 0;
        const flashDuration = Math.round(displaySpeedMs * 0.75);
        const pauseDuration = Math.round(displaySpeedMs * 0.25);
        const flashNextBlock = () => {
            if (index >= sequence.length) {
                setHighlightedBlockIndex(null);
                setSubPhase('input');
                setUserClicks([]);
                trialStartTimeRef.current = performance.now();
                return;
            }
            const blockIdx = sequence[index];
            index += 1;
            setHighlightedBlockIndex(blockIdx);
            if (soundEnabled)
                PlaySuccessSound(jsPsychRef);
            presentationTimerRef.current = setTimeout(() => {
                setHighlightedBlockIndex(null);
                presentationTimerRef.current = setTimeout(() => {
                    flashNextBlock();
                }, pauseDuration);
            }, flashDuration);
        };
        presentationTimerRef.current = setTimeout(() => {
            flashNextBlock();
        }, 450);
    }, [displaySpeedMs, soundEnabled]);
    const startNextTrial = useCallback((trialIndex: number, spanLen: number) => {
        setCurrentTrialIndex(trialIndex);
        setCurrentSpanLength(spanLen);
        currentSpanRef.current = spanLen;
        setUserClicks([]);
        setTrialFeedback(null);
        setSubPhase('ready');
        const newSequence = GenerateRandomBlockSequence(spanLen);
        activeSequenceRef.current = newSequence;
        presentationTimerRef.current = setTimeout(() => {
            runTrialPresentation(newSequence);
        }, 850);
    }, [runTrialPresentation]);
    const handleBlockClick = useCallback((blockIndex: number) => {
        if (subPhase !== 'input')
            return;
        if (userClicks.length >= activeSequenceRef.current.length)
            return;
        setUserClicks((prev) => [...prev, blockIndex]);
    }, [subPhase, userClicks.length]);
    const handleUndoClick = useCallback(() => {
        if (subPhase !== 'input')
            return;
        setUserClicks((prev) => prev.slice(0, -1));
    }, [subPhase]);
    const handleClearClicks = useCallback(() => {
        if (subPhase !== 'input')
            return;
        setUserClicks([]);
    }, [subPhase]);
    const handleSubmitInput = useCallback(() => {
        if (subPhase !== 'input')
            return;
        const seq = activeSequenceRef.current;
        if (seq.length === 0)
            return;
        const rt = Math.round(performance.now() - trialStartTimeRef.current);
        const targetSequence = spanMode === 'forward'
            ? [...seq]
            : [...seq].reverse();
        const isCorrect = userClicks.length === targetSequence.length &&
            userClicks.every((val, idx) => val === targetSequence[idx]);
        if (isCorrect) {
            if (soundEnabled)
                PlaySuccessSound(jsPsychRef);
            setTrialFeedback('correct');
            const nextSpan = Math.min(9, currentSpanRef.current + 1);
            currentSpanRef.current = nextSpan;
            maxSpanRef.current = Math.max(maxSpanRef.current, nextSpan);
        }
        else {
            if (soundEnabled)
                PlayFailureSound(jsPsychRef);
            setTrialFeedback('incorrect');
            const nextSpan = Math.max(2, currentSpanRef.current - 1);
            currentSpanRef.current = nextSpan;
        }
        setSubPhase('feedback');
        const recordedTrial: SpatialSpanTrial = {
            trialNumber: currentTrialIndex + 1,
            spanLength: seq.length,
            sequence: [...seq],
            targetSequence,
            userClicks: [...userClicks],
            correct: isCorrect,
            reactionTimeMs: rt,
        };
        const nextTrials = [...trials, recordedTrial];
        setTrials(nextTrials);
        presentationTimerRef.current = setTimeout(() => {
            const nextIndex = currentTrialIndex + 1;
            if (nextIndex >= rounds) {
                completeSession(nextTrials);
            }
            else {
                startNextTrial(nextIndex, currentSpanRef.current);
            }
        }, 1200);
    }, [completeSession, currentTrialIndex, rounds, soundEnabled, spanMode, startNextTrial, subPhase, trials, userClicks]);
    const startGame = useCallback(async () => {
        clearPresentationTimer();
        PrepareAudioFeedback(jsPsychRef);
        await enterTrainingFullscreen();
        setTrials([]);
        setResults(null);
        currentSpanRef.current = startLength;
        maxSpanRef.current = startLength;
        setPhase('playing');
        await jsPsychLifecycleRef.current?.start({ moduleId: 'brain:spatial-span', onStart: () => undefined });
        startNextTrial(0, startLength);
    }, [clearPresentationTimer, enterTrainingFullscreen, startLength, startNextTrial]);
    const summaryItems = useMemo(() => [
        {
            label: isZh ? '記憶模式' : 'Span Mode',
            value: spanMode === 'forward' ? (isZh ? '順向回憶（原順序）' : 'Forward Span') : (isZh ? '逆向回憶（倒序）' : 'Backward Span'),
        },
        {
            label: isZh ? '起始方塊數' : 'Starting Blocks',
            value: `${startLength} ${isZh ? '塊' : 'blocks'}`,
        },
        {
            label: isZh ? '總題數' : 'Rounds',
            value: `${rounds} ${isZh ? '題' : 'trials'}`,
        },
        {
            label: isZh ? '閃爍速度' : 'Flash Speed',
            value: `${(displaySpeedMs / 1000).toFixed(1)} ${isZh ? '秒' : 'sec'}`,
        },
        {
            label: isZh ? '聲音回饋' : 'Audio Feedback',
            value: soundEnabled ? (isZh ? '開啟' : 'Enabled') : (isZh ? '關閉' : 'Disabled'),
        },
    ], [displaySpeedMs, isZh, rounds, soundEnabled, spanMode, startLength]);
    const targetLength = activeSequenceRef.current.length || currentSpanLength;
    return (<div ref={fullscreenRootRef} className="thinking-game-container" style={{
            width: '100%',
            minHeight: '100%',
            position: 'relative',
            display: 'flex',
            flexDirection: 'column',
        }}>
      <div ref={jsPsychHostRef} style={{ display: 'none' }}/>

      {null}

      {phase === 'rules' && (<BrainTrainingRulesPanel gameId="spatial-span" title={isZh ? '空間廣度記憶說明' : 'Spatial Span Rules'} summaryTitle={isZh ? '目前設定摘要' : 'Settings Summary'} summaryItems={summaryItems} onStart={() => void startGame()} onBack={() => RequestHubTrainingConfiguration()}/>)}

      {phase === 'playing' && (<div style={{
                position: 'fixed',
                inset: 0,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: 'max(14px, env(safe-area-inset-top)) 16px max(20px, env(safe-area-inset-bottom))',
                background: 'var(--bg)',
                color: 'var(--text-primary)',
                userSelect: 'none',
            }}>
          {/* Header */}
          <div style={{
                width: '100%',
                maxWidth: '560px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '10px 16px',
                background: 'var(--surface)',
                borderRadius: '16px',
                border: '1px solid var(--border)',
            }}>
            <span style={{ fontSize: '18px', fontWeight: 700 }}>
              {isZh ? `第 ${currentTrialIndex + 1} / ${rounds} 題` : `Trial ${currentTrialIndex + 1} of ${rounds}`}
            </span>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <span style={{
                fontSize: '15px',
                fontWeight: 800,
                padding: '4px 10px',
                borderRadius: '999px',
                background: 'var(--primary)',
                color: '#ffffff',
            }}>
                {currentSpanLength} {isZh ? '塊' : 'blocks'}
              </span>
              <span style={{
                fontSize: '14px',
                fontWeight: 700,
                padding: '4px 10px',
                borderRadius: '999px',
                background: 'var(--border)',
                color: 'var(--text-primary)',
            }}>
                {spanMode === 'forward' ? (isZh ? '順向' : 'Forward') : (isZh ? '逆向' : 'Backward')}
              </span>
            </div>
            <button type="button" onClick={handleExitTraining} style={{
                background: 'transparent',
                border: '1px solid var(--border)',
                color: 'var(--text-secondary)',
                borderRadius: '8px',
                padding: '4px 12px',
                cursor: 'pointer',
                fontSize: '15px',
            }}>
              {isZh ? '結束' : 'Quit'}
            </button>
          </div>

          {/* Central Instruction Banner */}
          <div style={{
                padding: '8px 18px',
                background: 'color-mix(in srgb, var(--primary) 12%, transparent)',
                borderRadius: '999px',
                border: '1px solid color-mix(in srgb, var(--primary) 40%, transparent)',
                color: 'var(--text-primary)',
                fontSize: '18px',
                fontWeight: 700,
                textAlign: 'center',
                maxWidth: '560px',
            }}>
            {subPhase === 'ready' && (isZh ? '準備開始... 請注意看方塊亮起的順序' : 'Get ready... Watch the blocks light up')}
            {subPhase === 'presenting' && (isZh ? '記住方塊閃爍順序...' : 'Memorize the spatial sequence...')}
            {subPhase === 'input' && (spanMode === 'forward'
                ? (isZh ? `請依「原順序」點選剛才亮起的 ${targetLength} 個方塊（已點 ${userClicks.length}/${targetLength}）` : `Click blocks in original order (${userClicks.length}/${targetLength})`)
                : (isZh ? `請依「倒序（從最後一個往前）」點選方塊（已點 ${userClicks.length}/${targetLength}）` : `Click blocks in REVERSE order (${userClicks.length}/${targetLength})`))}
            {subPhase === 'feedback' && (trialFeedback === 'correct'
                ? (isZh ? '✓ 答對了！' : '✓ Correct!')
                : (isZh ? '✕ 順序不正確' : '✕ Incorrect sequence'))}
          </div>

          {/* 3x3 Spatial Grid */}
          <div style={{
                width: '100%',
                maxWidth: '420px',
                aspectRatio: '1 / 1',
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gap: '14px',
                padding: '16px',
                background: 'var(--surface)',
                borderRadius: '28px',
                border: trialFeedback === 'correct'
                    ? '4px solid #22c55e'
                    : trialFeedback === 'incorrect'
                        ? '4px solid #ef4444'
                        : '2px solid var(--border)',
                boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
                transition: 'border-color 0.2s ease',
            }}>
            {Array.from({ length: 9 }).map((_, blockIdx) => {
                const isHighlighted = highlightedBlockIndex === blockIdx;
                const clickOrder = userClicks.indexOf(blockIdx);
                const isClicked = clickOrder !== -1;
                return (<button key={blockIdx} type="button" disabled={subPhase !== 'input'} onClick={() => handleBlockClick(blockIdx)} style={{
                        position: 'relative',
                        width: '100%',
                        height: '100%',
                        borderRadius: '20px',
                        border: isHighlighted
                            ? '4px solid #38bdf8'
                            : isClicked
                                ? '3px solid var(--primary)'
                                : '2px solid var(--border)',
                        background: isHighlighted
                            ? '#38bdf8'
                            : isClicked
                                ? 'color-mix(in srgb, var(--primary) 22%, var(--surface))'
                                : 'var(--bg)',
                        boxShadow: isHighlighted ? '0 0 28px rgba(56, 189, 248, 0.8)' : 'none',
                        cursor: subPhase === 'input' ? 'pointer' : 'default',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        transition: 'all 0.15s ease',
                    }}>
                  {isClicked && (<span style={{
                            position: 'absolute',
                            top: '6px',
                            right: '8px',
                            background: 'var(--primary)',
                            color: '#ffffff',
                            fontSize: '15px',
                            fontWeight: 900,
                            width: '26px',
                            height: '26px',
                            borderRadius: '50%',
                            display: 'grid',
                            placeItems: 'center',
                        }}>
                      {clickOrder + 1}
                    </span>)}
                  {isHighlighted && (<div style={{
                            width: '24px',
                            height: '24px',
                            borderRadius: '50%',
                            background: '#ffffff',
                            boxShadow: '0 0 16px rgba(255,255,255,0.9)',
                        }}/>)}
                </button>);
            })}
          </div>

          {/* Action Buttons */}
          <div style={{
                width: '100%',
                maxWidth: '560px',
                display: 'grid',
                gridTemplateColumns: '1fr 1fr 2fr',
                gap: '12px',
            }}>
            <button type="button" disabled={subPhase !== 'input' || userClicks.length === 0} onClick={handleUndoClick} style={{
                minHeight: '64px',
                borderRadius: '16px',
                background: 'var(--surface)',
                border: '2px solid var(--border)',
                color: 'var(--text-secondary)',
                fontSize: '18px',
                fontWeight: 800,
                cursor: (subPhase === 'input' && userClicks.length > 0) ? 'pointer' : 'default',
                opacity: (subPhase === 'input' && userClicks.length > 0) ? 1 : 0.5,
            }}>
              {isZh ? '倒退' : 'Undo'}
            </button>

            <button type="button" disabled={subPhase !== 'input' || userClicks.length === 0} onClick={handleClearClicks} style={{
                minHeight: '64px',
                borderRadius: '16px',
                background: 'var(--surface)',
                border: '2px solid var(--border)',
                color: 'var(--text-secondary)',
                fontSize: '18px',
                fontWeight: 800,
                cursor: (subPhase === 'input' && userClicks.length > 0) ? 'pointer' : 'default',
                opacity: (subPhase === 'input' && userClicks.length > 0) ? 1 : 0.5,
            }}>
              {isZh ? '重填' : 'Clear'}
            </button>

            <button type="button" disabled={subPhase !== 'input' || userClicks.length === 0} onClick={handleSubmitInput} style={{
                minHeight: '64px',
                borderRadius: '16px',
                background: userClicks.length === targetLength ? 'var(--primary)' : 'var(--surface)',
                border: userClicks.length === targetLength ? 'none' : '2px solid var(--border)',
                color: userClicks.length === targetLength ? '#ffffff' : 'var(--text-primary)',
                fontSize: '22px',
                fontWeight: 900,
                cursor: (subPhase === 'input' && userClicks.length > 0) ? 'pointer' : 'default',
                opacity: (subPhase === 'input' && userClicks.length > 0) ? 1 : 0.5,
                boxShadow: userClicks.length === targetLength ? '0 6px 20px rgba(0,0,0,0.25)' : 'none',
            }}>
              {isZh ? '確認送出' : 'Submit'}
            </button>
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
              {isZh ? `以下為當次空間廣度記憶（${results.spanMode === 'forward' ? '順向' : '逆向'}）之容量表現與換算參考值` : `Summary metrics for this spatial span session`}
            </p>

            <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(2, 1fr)',
                gap: '14px',
                marginBottom: '28px',
            }}>
              <div style={{ padding: '16px', background: 'var(--bg)', borderRadius: '16px', textAlign: 'center' }}>
                <div style={{ fontSize: '15px', color: 'var(--text-secondary)' }}>{isZh ? '最大空間跨度' : 'Max Spatial Span'}</div>
                <div style={{ fontSize: '36px', fontWeight: 900, color: '#22c55e', marginTop: '4px' }}>
                  {results.maxSpanLength} <span style={{ fontSize: '18px' }}>{isZh ? '塊' : 'blocks'}</span>
                </div>
                <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                  {isZh ? `起始：${results.startLength} 塊方塊` : `Started at ${results.startLength}`}
                </div>
              </div>

              <div style={{ padding: '16px', background: 'var(--bg)', borderRadius: '16px', textAlign: 'center' }}>
                <div style={{ fontSize: '15px', color: 'var(--text-secondary)' }}>{isZh ? '總體正確率' : 'Accuracy'}</div>
                <div style={{ fontSize: '36px', fontWeight: 900, color: 'var(--primary)', marginTop: '4px' }}>
                  {results.accuracyPercent}%
                </div>
                <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                  {results.correctCount} / {results.totalRounds} {isZh ? '題完全正確' : 'correct rounds'}
                </div>
              </div>

              <div style={{ padding: '16px', background: 'var(--bg)', borderRadius: '16px', textAlign: 'center' }}>
                <div style={{ fontSize: '15px', color: 'var(--text-secondary)' }}>{isZh ? '記憶模式' : 'Span Mode'}</div>
                <div style={{ fontSize: '28px', fontWeight: 900, marginTop: '8px' }}>
                  {results.spanMode === 'forward' ? (isZh ? '順向記憶' : 'Forward') : (isZh ? '逆向記憶' : 'Backward')}
                </div>
                <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                  {results.spanMode === 'forward' ? (isZh ? '原順序' : 'in order') : (isZh ? '倒序' : 'in reverse')}
                </div>
              </div>

              <div style={{ padding: '16px', background: 'var(--bg)', borderRadius: '16px', textAlign: 'center' }}>
                <div style={{ fontSize: '15px', color: 'var(--text-secondary)' }}>{isZh ? '平均反應時間' : 'Mean Response Time'}</div>
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
function GenerateRandomBlockSequence(length: number): number[] {
    const sequence: number[] = [];
    while (sequence.length < length) {
        const candidate = Math.floor(Math.random() * 9);
        if (sequence.length === 0 || candidate !== sequence[sequence.length - 1]) {
            sequence.push(candidate);
        }
    }
    return sequence;
}

import { GetHostedGameSetting } from '@rehab-trainer/ui/embeddedTraining';
import { RequestHubTrainingConfiguration } from '@rehab-trainer/ui/embeddedTraining';
// Canonical Hub-owned brain Digit Span memory capacity runtime.
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
type DigitSpanPhase = 'menu' | 'rules' | 'playing' | 'results';
type TrialSubPhase = 'ready' | 'presenting' | 'input' | 'feedback';
interface DigitSpanGameProps {
    onExit: () => void;
}
interface DigitSpanTrial {
    trialNumber: number;
    spanLength: number;
    digits: number[];
    targetString: string;
    userString: string;
    correct: boolean;
    reactionTimeMs: number | null;
}
interface DigitSpanSessionRecord {
    totalRounds: number;
    spanMode: SpanMode;
    startLength: number;
    maxSpanLength: number;
    correctCount: number;
    accuracyPercent: number;
    meanRtMs: number;
    trials: DigitSpanTrial[];
}
export function DigitSpanGame({ onExit }: DigitSpanGameProps) {
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
    const [phase, setPhase] = useState<DigitSpanPhase>('rules');
    useTrainingAbort({ active: phase === 'playing', onAbort: handleExitTraining });
    const [spanMode, setSpanMode] = useState<SpanMode>(GetHostedGameSetting<SpanMode>('spanMode'));
    const [startLength, setStartLength] = useState<number>(GetHostedGameSetting<number>('startLength'));
    const [rounds, setRounds] = useState<number>(GetHostedGameSetting<number>('rounds'));
    const [digitSpeedMs, setDigitSpeedMs] = useState<number>(GetHostedGameSetting<number>('digitSpeedMs'));
    const [soundEnabled, setSoundEnabled] = useState<boolean>(GetHostedGameSetting<boolean>('soundEnabled'));
    const hostedSettings = useHostedGameSettings();
    const hostedSettingsAppliedRef = useRef(false);

    const [currentTrialIndex, setCurrentTrialIndex] = useState(0);
    const [currentSpanLength, setCurrentSpanLength] = useState(3);
    const [trials, setTrials] = useState<DigitSpanTrial[]>([]);
    const [subPhase, setSubPhase] = useState<TrialSubPhase>('ready');
    const [presentingDigit, setPresentingDigit] = useState<number | null>(null);
    const [userInput, setUserInput] = useState<string>('');
    const [trialFeedback, setTrialFeedback] = useState<'correct' | 'incorrect' | null>(null);
    const [feedbackTarget, setFeedbackTarget] = useState<string>('');
    const [results, setResults] = useState<DigitSpanSessionRecord | null>(null);
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
        if (typeof hostedSettings.digitSpeedMs === 'number') {
            setDigitSpeedMs(hostedSettings.digitSpeedMs);
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
    const completeSession = useCallback((finalTrials: DigitSpanTrial[]) => {
        const totalRounds = finalTrials.length;
        const correctCount = finalTrials.filter((t) => t.correct).length;
        const accuracyPercent = Math.round((correctCount / Math.max(1, totalRounds)) * 100);
        const validRts = finalTrials.filter((t) => t.reactionTimeMs !== null).map((t) => t.reactionTimeMs as number);
        const meanRtMs = validRts.length > 0 ? Math.round(validRts.reduce((a, b) => a + b, 0) / validRts.length) : 0;
        const maxSpanAchieved = maxSpanRef.current;
        const record: DigitSpanSessionRecord = {
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
            gameId: 'digit-span',
            gameTitle: isZh ? '數字廣度記憶（Digit Span）' : 'Digit Span Memory Capacity',
            difficulty: `${spanMode}-${startLength}digits`,
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
        const digitDuration = Math.round(digitSpeedMs * 0.75);
        const blankDuration = Math.round(digitSpeedMs * 0.25);
        const showNextDigit = () => {
            if (index >= sequence.length) {
                setPresentingDigit(null);
                setSubPhase('input');
                setUserInput('');
                trialStartTimeRef.current = performance.now();
                return;
            }
            const digit = sequence[index];
            index += 1;
            setPresentingDigit(digit);
            presentationTimerRef.current = setTimeout(() => {
                setPresentingDigit(null);
                presentationTimerRef.current = setTimeout(() => {
                    showNextDigit();
                }, blankDuration);
            }, digitDuration);
        };
        presentationTimerRef.current = setTimeout(() => {
            showNextDigit();
        }, 400);
    }, [digitSpeedMs]);
    const startNextTrial = useCallback((trialIndex: number, spanLen: number) => {
        setCurrentTrialIndex(trialIndex);
        setCurrentSpanLength(spanLen);
        currentSpanRef.current = spanLen;
        setUserInput('');
        setTrialFeedback(null);
        setFeedbackTarget('');
        setSubPhase('ready');
        const newSequence = GenerateRandomDigits(spanLen);
        activeSequenceRef.current = newSequence;
        presentationTimerRef.current = setTimeout(() => {
            runTrialPresentation(newSequence);
        }, 900);
    }, [runTrialPresentation]);
    const handleKeypadPress = useCallback((digit: number) => {
        if (subPhase !== 'input')
            return;
        if (userInput.length >= activeSequenceRef.current.length)
            return;
        setUserInput((prev) => `${prev}${digit}`);
    }, [subPhase, userInput]);
    const handleKeypadBackspace = useCallback(() => {
        if (subPhase !== 'input')
            return;
        setUserInput((prev) => prev.slice(0, -1));
    }, [subPhase]);
    const handleKeypadClear = useCallback(() => {
        if (subPhase !== 'input')
            return;
        setUserInput('');
    }, [subPhase]);
    const handleSubmitInput = useCallback(() => {
        if (subPhase !== 'input')
            return;
        const digits = activeSequenceRef.current;
        if (digits.length === 0)
            return;
        const rt = Math.round(performance.now() - trialStartTimeRef.current);
        const targetString = spanMode === 'forward'
            ? digits.join('')
            : [...digits].reverse().join('');
        const isCorrect = userInput.trim() === targetString;
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
            setFeedbackTarget(targetString);
            const nextSpan = Math.max(2, currentSpanRef.current - 1);
            currentSpanRef.current = nextSpan;
        }
        setSubPhase('feedback');
        const recordedTrial: DigitSpanTrial = {
            trialNumber: currentTrialIndex + 1,
            spanLength: digits.length,
            digits: [...digits],
            targetString,
            userString: userInput,
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
    }, [completeSession, currentTrialIndex, rounds, soundEnabled, spanMode, startNextTrial, subPhase, trials, userInput]);
    const startGame = useCallback(async () => {
        clearPresentationTimer();
        PrepareAudioFeedback(jsPsychRef);
        await enterTrainingFullscreen();
        setTrials([]);
        setResults(null);
        currentSpanRef.current = startLength;
        maxSpanRef.current = startLength;
        setPhase('playing');
        await jsPsychLifecycleRef.current?.start({ moduleId: 'brain:digit-span', onStart: () => undefined });
        startNextTrial(0, startLength);
    }, [clearPresentationTimer, enterTrainingFullscreen, startLength, startNextTrial]);
    useEffect(() => {
        if (phase !== 'playing' || subPhase !== 'input')
            return;
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key >= '0' && event.key <= '9') {
                event.preventDefault();
                handleKeypadPress(Number(event.key));
            }
            else if (event.key === 'Backspace') {
                event.preventDefault();
                handleKeypadBackspace();
            }
            else if (event.key === 'Escape') {
                event.preventDefault();
                handleKeypadClear();
            }
            else if (event.key === 'Enter') {
                event.preventDefault();
                handleSubmitInput();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [handleKeypadBackspace, handleKeypadClear, handleKeypadPress, handleSubmitInput, phase, subPhase]);
    const summaryItems = useMemo(() => [
        {
            label: isZh ? '記憶模式' : 'Span Mode',
            value: spanMode === 'forward' ? (isZh ? '順向回憶（原順序）' : 'Forward Span') : (isZh ? '逆向回憶（倒序）' : 'Backward Span'),
        },
        {
            label: isZh ? '起始位數' : 'Starting Length',
            value: `${startLength} ${isZh ? '位數' : 'digits'}`,
        },
        {
            label: isZh ? '總題數' : 'Rounds',
            value: `${rounds} ${isZh ? '題' : 'trials'}`,
        },
        {
            label: isZh ? '切換速度' : 'Digit Speed',
            value: `${(digitSpeedMs / 1000).toFixed(1)} ${isZh ? '秒' : 'sec'}`,
        },
        {
            label: isZh ? '聲音回饋' : 'Audio Feedback',
            value: soundEnabled ? (isZh ? '開啟' : 'Enabled') : (isZh ? '關閉' : 'Disabled'),
        },
    ], [digitSpeedMs, isZh, rounds, soundEnabled, spanMode, startLength]);
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

      {phase === 'rules' && (<BrainTrainingRulesPanel gameId="digit-span" title={isZh ? '數字廣度記憶（Digit Span）說明' : 'Digit Span Rules'} summaryTitle={isZh ? '目前設定摘要' : 'Settings Summary'} summaryItems={summaryItems} onStart={() => void startGame()} onBack={() => RequestHubTrainingConfiguration()}/>)}

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
                {currentSpanLength} {isZh ? '位數' : 'digits'}
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
            {subPhase === 'ready' && (isZh ? '準備開始... 請注意看出現的數字' : 'Get ready... Watch the numbers appear')}
            {subPhase === 'presenting' && (isZh ? '記住數字順序...' : 'Memorize the digits...')}
            {(subPhase === 'input' || subPhase === 'feedback') && (spanMode === 'forward'
                ? (isZh ? '請依「原順序」點擊輸入剛才看到的數字' : 'Enter digits in original order')
                : (isZh ? '請依「倒序（從最後一個往前）」點擊輸入' : 'Enter digits in REVERSE order'))}
          </div>

          {/* Central Digit Display / Input Box */}
          <div style={{
                width: '100%',
                maxWidth: '560px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                minHeight: '130px',
                background: 'var(--surface)',
                borderRadius: '24px',
                border: trialFeedback === 'correct'
                    ? '4px solid #22c55e'
                    : trialFeedback === 'incorrect'
                        ? '4px solid #ef4444'
                        : '2px solid var(--border)',
                boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
                transition: 'border-color 0.2s ease',
                padding: '16px',
            }}>
            {subPhase === 'ready' && (<span style={{ fontSize: '28px', fontWeight: 800, color: 'var(--primary)' }}>
                {isZh ? '預備...' : 'Ready...'}
              </span>)}

            {subPhase === 'presenting' && (presentingDigit !== null ? (<div style={{
                    fontSize: '84px',
                    fontWeight: 900,
                    color: 'var(--primary)',
                    lineHeight: 1,
                    fontFamily: 'monospace',
                }}>
                  {presentingDigit}
                </div>) : (<div style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'var(--border)' }}/>))}

            {(subPhase === 'input' || subPhase === 'feedback') && (<div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', justifyContent: 'center' }}>
                  {Array.from({ length: targetLength }).map((_, idx) => {
                    const char = userInput[idx];
                    return (<div key={idx} style={{
                            width: '46px',
                            height: '56px',
                            borderRadius: '12px',
                            border: '2px solid var(--border)',
                            background: char ? 'color-mix(in srgb, var(--primary) 15%, transparent)' : 'var(--bg)',
                            display: 'grid',
                            placeItems: 'center',
                            fontSize: '32px',
                            fontWeight: 900,
                            color: 'var(--text-primary)',
                            fontFamily: 'monospace',
                        }}>
                        {char ?? ''}
                      </div>);
                })}
                </div>

                {trialFeedback === 'correct' && (<span style={{ fontSize: '20px', fontWeight: 900, color: '#22c55e' }}>
                    {isZh ? '✓ 答對了！' : '✓ Correct!'}
                  </span>)}
                {trialFeedback === 'incorrect' && (<span style={{ fontSize: '18px', fontWeight: 800, color: '#ef4444' }}>
                    {isZh ? `✕ 答錯了（正確為：${feedbackTarget}）` : `✕ Incorrect (Target: ${feedbackTarget})`}
                  </span>)}
              </div>)}
          </div>

          {/* Keypad Container */}
          <div style={{
                width: '100%',
                maxWidth: '560px',
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gap: '10px',
            }}>
            {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (<button key={num} type="button" disabled={subPhase !== 'input'} onClick={() => handleKeypadPress(num)} style={{
                    minHeight: '64px',
                    borderRadius: '16px',
                    background: 'var(--surface)',
                    border: '2px solid var(--border)',
                    color: 'var(--text-primary)',
                    fontSize: '30px',
                    fontWeight: 900,
                    cursor: subPhase === 'input' ? 'pointer' : 'default',
                    opacity: subPhase === 'input' ? 1 : 0.6,
                    boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                }}>
                {num}
              </button>))}

            <button type="button" disabled={subPhase !== 'input' || userInput.length === 0} onClick={handleKeypadBackspace} style={{
                minHeight: '64px',
                borderRadius: '16px',
                background: 'var(--surface)',
                border: '2px solid var(--border)',
                color: 'var(--text-secondary)',
                fontSize: '20px',
                fontWeight: 800,
                cursor: (subPhase === 'input' && userInput.length > 0) ? 'pointer' : 'default',
                opacity: (subPhase === 'input' && userInput.length > 0) ? 1 : 0.5,
            }}>
              {isZh ? '倒退' : 'Del'}
            </button>

            <button type="button" disabled={subPhase !== 'input'} onClick={() => handleKeypadPress(0)} style={{
                minHeight: '64px',
                borderRadius: '16px',
                background: 'var(--surface)',
                border: '2px solid var(--border)',
                color: 'var(--text-primary)',
                fontSize: '30px',
                fontWeight: 900,
                cursor: subPhase === 'input' ? 'pointer' : 'default',
                opacity: subPhase === 'input' ? 1 : 0.6,
                boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
            }}>
              0
            </button>

            <button type="button" disabled={subPhase !== 'input' || userInput.length === 0} onClick={handleSubmitInput} style={{
                minHeight: '64px',
                borderRadius: '16px',
                background: userInput.length === targetLength ? 'var(--primary)' : 'var(--surface)',
                border: userInput.length === targetLength ? 'none' : '2px solid var(--border)',
                color: userInput.length === targetLength ? '#ffffff' : 'var(--text-primary)',
                fontSize: '20px',
                fontWeight: 900,
                cursor: (subPhase === 'input' && userInput.length > 0) ? 'pointer' : 'default',
                opacity: (subPhase === 'input' && userInput.length > 0) ? 1 : 0.5,
                boxShadow: userInput.length === targetLength ? '0 6px 20px rgba(0,0,0,0.25)' : 'none',
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
              {isZh ? `以下為當次數字廣度記憶（${results.spanMode === 'forward' ? '順向' : '逆向'}）之容量指標與換算參考值` : `Summary metrics for this digit span session`}
            </p>

            <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(2, 1fr)',
                gap: '14px',
                marginBottom: '28px',
            }}>
              <div style={{ padding: '16px', background: 'var(--bg)', borderRadius: '16px', textAlign: 'center' }}>
                <div style={{ fontSize: '15px', color: 'var(--text-secondary)' }}>{isZh ? '最大記憶跨度' : 'Max Span Length'}</div>
                <div style={{ fontSize: '36px', fontWeight: 900, color: '#22c55e', marginTop: '4px' }}>
                  {results.maxSpanLength} <span style={{ fontSize: '18px' }}>{isZh ? '位數' : 'digits'}</span>
                </div>
                <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                  {isZh ? `起始：${results.startLength} 位數` : `Started at ${results.startLength}`}
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
                <div style={{ fontSize: '15px', color: 'var(--text-secondary)' }}>{isZh ? '平均作答時間' : 'Mean Response Time'}</div>
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
function GenerateRandomDigits(length: number): number[] {
    const digits: number[] = [];
    for (let i = 0; i < length; i += 1) {
        let digit: number;
        do {
            digit = Math.floor(Math.random() * 10);
        } while (i > 0 && digit === digits[i - 1]);
        digits.push(digit);
    }
    return digits;
}

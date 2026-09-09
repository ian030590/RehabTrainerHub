import { FormatTestDate } from '@rehab-trainer/ui/trainingGameUtils';
import { GetHostedGameSetting } from '@rehab-trainer/ui/embeddedTraining';
import { RequestHubTrainingConfiguration } from '@rehab-trainer/ui/embeddedTraining';
// Canonical Hub-owned brain Letter Memory updating task runtime.
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
type LetterPhase = 'menu' | 'rules' | 'playing' | 'results';
type PresentationState = 'ready' | 'streaming' | 'recall' | 'feedback';
interface LetterMemoryGameProps {
    onExit: () => void;
}
interface LetterMemorySequence {
    sequenceNumber: number;
    fullStream: string[];
    targetLetters: string[];
    recallLength: number;
}
interface LetterTrialRecord {
    sequenceNumber: number;
    targetLetters: string[];
    userLetters: string[];
    correctCount: number;
    isFullyCorrect: boolean;
    accuracyPercent: number;
}
interface LetterMemorySessionRecord {
    totalRounds: number;
    recallLength: number;
    fullyCorrectCount: number;
    accuracyPercent: number;
    meanLetterAccuracyPercent: number;
    trials: LetterTrialRecord[];
}
const consonantPool = ['B', 'C', 'D', 'F', 'G', 'H', 'J', 'K', 'L', 'M', 'N', 'P', 'R', 'S', 'T', 'W'];
export function LetterMemoryGame({ onExit }: LetterMemoryGameProps) {
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
    const [phase, setPhase] = useState<LetterPhase>('rules');
    useTrainingAbort({ active: phase === 'playing', onAbort: handleExitTraining });
    const [recallLength, setRecallLength] = useState<number>(Number(GetHostedGameSetting<string>('recallLength')));
    const [rounds, setRounds] = useState(GetHostedGameSetting<number>('rounds'));
    const [presentationSpeedMs, setPresentationSpeedMs] = useState(GetHostedGameSetting<number>('presentationSpeedMs'));
    const [soundEnabled, setSoundEnabled] = useState(GetHostedGameSetting<boolean>('soundEnabled'));
    const hostedSettings = useHostedGameSettings();
    const hostedSettingsAppliedRef = useRef(false);

    const [sequences, setSequences] = useState<LetterMemorySequence[]>([]);
    const [currentSequenceIndex, setCurrentSequenceIndex] = useState(0);
    const [streamState, setStreamState] = useState<PresentationState>('ready');
    const [currentLetter, setCurrentLetter] = useState<string | null>(null);
    const [userSelection, setUserSelection] = useState<string[]>([]);
    const [trialRecords, setTrialRecords] = useState<LetterTrialRecord[]>([]);
    const [results, setResults] = useState<LetterMemorySessionRecord | null>(null);
    const streamTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    useEffect(() => {
        if (!hostedSettings || hostedSettingsAppliedRef.current)
            return;
        hostedSettingsAppliedRef.current = true;
        if (hostedSettings.recallLength === '3' || hostedSettings.recallLength === '4') {
            setRecallLength(Number(hostedSettings.recallLength));
        }
        if (typeof hostedSettings.rounds === 'number' && hostedSettings.rounds >= 3 && hostedSettings.rounds <= 12) {
            setRounds(hostedSettings.rounds);
        }
        if (typeof hostedSettings.presentationSpeedMs === 'number') {
            setPresentationSpeedMs(hostedSettings.presentationSpeedMs);
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
    const activeSequence = sequences[currentSequenceIndex] ?? null;
    const clearTimers = useCallback(() => {
        if (streamTimerRef.current) {
            clearTimeout(streamTimerRef.current);
            streamTimerRef.current = null;
        }
    }, []);
    const completeSession = useCallback((finalRecords: LetterTrialRecord[]) => {
        const totalRounds = finalRecords.length;
        const fullyCorrectCount = finalRecords.filter((r) => r.isFullyCorrect).length;
        const accuracyPercent = Math.round((fullyCorrectCount / Math.max(1, totalRounds)) * 100);
        const totalLetterAcc = finalRecords.reduce((sum, r) => sum + r.accuracyPercent, 0);
        const meanLetterAccuracyPercent = Math.round(totalLetterAcc / Math.max(1, totalRounds));
        const record: LetterMemorySessionRecord = {
            totalRounds,
            recallLength,
            fullyCorrectCount,
            accuracyPercent,
            meanLetterAccuracyPercent,
            trials: finalRecords,
        };
        jsPsychLifecycleRef.current?.finish(record as unknown as Record<string, unknown>);
        PlayGameEndSound('Victory', jsPsychRef);
        setResults(record);
        setPhase('results');
        const participantId = GetAuthUserNameFromToken() || 'Unknown';
        void SaveTrainingSessionRecord({ userName: GetAuthUserNameFromToken() || 'Guest', moduleId: 'letter-memory', gameId: 'letter-memory', gameTitle: isZh ? '字母記憶更新 (Letter Memory)' : 'Letter Memory Updating Task', difficulty: 'configured', trainingDate: FormatTestDate(new Date()), details: { category: 'memory',
score: accuracyPercent,
metrics: {
                totalRounds,
                recallLength,
                fullyCorrectCount,
                accuracyPercent,
                meanLetterAccuracyPercent,
            },
notes: isZh
                ? `追蹤長度: 最後 ${recallLength} 個字母, 全對率: ${accuracyPercent}%, 平均位置正確率: ${meanLetterAccuracyPercent}%`
                : `Target: Last ${recallLength} letters, Full match: ${accuracyPercent}%, Pos accuracy: ${meanLetterAccuracyPercent}%` } });
    }, [isZh, recallLength]);
    const advanceToNextSequence = useCallback((updatedRecords: LetterTrialRecord[]) => {
        const nextIdx = currentSequenceIndex + 1;
        if (nextIdx >= sequences.length) {
            completeSession(updatedRecords);
        }
        else {
            setCurrentSequenceIndex(nextIdx);
            setUserSelection([]);
            startStreamPresentation(sequences[nextIdx]);
        }
    }, [completeSession, currentSequenceIndex, sequences]);
    const startStreamPresentation = useCallback((seq: LetterMemorySequence) => {
        clearTimers();
        setStreamState('streaming');
        let streamIndex = 0;
        const showNext = () => {
            if (streamIndex < seq.fullStream.length) {
                setCurrentLetter(seq.fullStream[streamIndex]);
                if (soundEnabled)
                    PlaySuccessSound(jsPsychRef);
                streamIndex++;
                streamTimerRef.current = setTimeout(showNext, presentationSpeedMs);
            }
            else {
                // Stream finished -> recall stage
                setCurrentLetter(null);
                setStreamState('recall');
            }
        };
        showNext();
    }, [clearTimers, presentationSpeedMs, soundEnabled]);
    const handleLetterTap = useCallback((letter: string) => {
        if (streamState !== 'recall' || !activeSequence)
            return;
        if (userSelection.length >= activeSequence.recallLength)
            return;
        const nextSelection = [...userSelection, letter];
        setUserSelection(nextSelection);
        if (soundEnabled)
            PlaySuccessSound(jsPsychRef);
    }, [activeSequence, soundEnabled, streamState, userSelection]);
    const handleBackspace = useCallback(() => {
        if (streamState !== 'recall' || userSelection.length === 0)
            return;
        setUserSelection(userSelection.slice(0, -1));
    }, [streamState, userSelection]);
    const handleSubmitRecall = useCallback(() => {
        if (streamState !== 'recall' || !activeSequence)
            return;
        if (userSelection.length < activeSequence.recallLength)
            return;
        // Check correctness
        let correctLetters = 0;
        for (let i = 0; i < activeSequence.recallLength; i++) {
            if (userSelection[i] === activeSequence.targetLetters[i]) {
                correctLetters++;
            }
        }
        const isFullyCorrect = correctLetters === activeSequence.recallLength;
        const accuracyPercent = Math.round((correctLetters / activeSequence.recallLength) * 100);
        if (soundEnabled) {
            if (isFullyCorrect)
                PlaySuccessSound(jsPsychRef);
            else
                PlayFailureSound(jsPsychRef);
        }
        const trialRecord: LetterTrialRecord = {
            sequenceNumber: activeSequence.sequenceNumber,
            targetLetters: activeSequence.targetLetters,
            userLetters: userSelection,
            correctCount: correctLetters,
            isFullyCorrect,
            accuracyPercent,
        };
        const nextRecords = [...trialRecords, trialRecord];
        setTrialRecords(nextRecords);
        setStreamState('feedback');
        setTimeout(() => {
            advanceToNextSequence(nextRecords);
        }, 1200);
    }, [activeSequence, advanceToNextSequence, soundEnabled, streamState, trialRecords, userSelection]);
    const startGame = useCallback(() => {
        PrepareAudioFeedback();
        const generated = GenerateLetterSequences(rounds, recallLength);
        setSequences(generated);
        setCurrentSequenceIndex(0);
        setUserSelection([]);
        setTrialRecords([]);
        setResults(null);
        setPhase('playing');
        jsPsychLifecycleRef.current?.start({ moduleId: "letter-memory", onStart: () => undefined });
        startStreamPresentation(generated[0]);
    }, [presentationSpeedMs, recallLength, rounds, startStreamPresentation]);
    const configOptions = useMemo(() => {
        const recOptions = [
            { id: '3', label: isZh ? '最後 3 個字母（初級）' : 'Last 3 letters (Easy)' },
            { id: '4', label: isZh ? '最後 4 個字母（標準經典）' : 'Last 4 letters (Standard)' },
        ];
        const spdOptions = [
            { id: '1200', label: isZh ? '1.2 秒（緊湊）' : '1.2 seconds' },
            { id: '1500', label: isZh ? '1.5 秒（標準）' : '1.5 seconds' },
            { id: '2000', label: isZh ? '2.0 秒（從容）' : '2.0 seconds' },
        ];
        return { recOptions, spdOptions };
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

      {phase === 'rules' && (<BrainTrainingRulesPanel gameId="letter-memory" onStart={() => void startGame()} onBack={() => RequestHubTrainingConfiguration()} title={document.title}/>)}

      {phase === 'playing' && (<div style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'space-between',
                width: '100%',
                maxWidth: '640px',
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
              {isZh ? '進度' : 'Trial'}: {currentSequenceIndex + 1} / {sequences.length}
            </span>
            <span style={{ color: 'var(--accent)' }}>
              {isZh ? `請記住最後 ${recallLength} 個字母` : `Keep last ${recallLength} letters`}
            </span>
          </div>

          {/* Central Stage: Stream / Recall Slots */}
          <div style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                width: '100%',
                maxWidth: '480px',
                minHeight: '260px',
                background: 'var(--card-bg)',
                borderRadius: '28px',
                border: '3px solid var(--border)',
                padding: '24px',
                boxSizing: 'border-box',
            }}>
            {streamState === 'streaming' && (<div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
                <span style={{ fontSize: '15px', color: 'var(--text-secondary)', fontWeight: 600 }}>
                  {isZh ? '字母依序出現中... 請在心中持續更新最後出現的字母' : 'Stream playing... Keep updating the last letters'}
                </span>
                <div style={{
                    width: '120px',
                    height: '120px',
                    borderRadius: '24px',
                    background: 'var(--accent)',
                    color: '#ffffff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '64px',
                    fontWeight: 900,
                    boxShadow: '0 8px 24px rgba(56, 189, 248, 0.4)',
                }}>
                  {currentLetter ?? ''}
                </div>
              </div>)}

            {(streamState === 'recall' || streamState === 'feedback') && activeSequence && (<div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px', width: '100%' }}>
                <span style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-secondary)' }}>
                  {isZh ? `請點選剛才出現的「最後 ${recallLength} 個字母」：` : `Select the last ${recallLength} letters in order:`}
                </span>

                {/* Slots display */}
                <div style={{ display: 'flex', gap: '12px' }}>
                  {Array.from({ length: recallLength }).map((_, idx) => {
                    const letter = userSelection[idx];
                    const isFeedback = streamState === 'feedback';
                    const target = activeSequence.targetLetters[idx];
                    const isCorrect = letter === target;
                    return (<div key={idx} style={{
                            width: '64px',
                            height: '64px',
                            borderRadius: '16px',
                            border: isFeedback
                                ? isCorrect
                                    ? '3px solid #22c55e'
                                    : '3px solid #ef4444'
                                : letter
                                    ? '3px solid var(--accent)'
                                    : '2px dashed var(--border)',
                            background: isFeedback
                                ? isCorrect
                                    ? 'rgba(34, 197, 94, 0.15)'
                                    : 'rgba(239, 68, 68, 0.15)'
                                : letter
                                    ? 'var(--bg)'
                                    : 'transparent',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '32px',
                            fontWeight: 900,
                            color: letter ? 'var(--text-primary)' : 'var(--text-secondary)',
                        }}>
                        {letter ?? (idx + 1)}
                      </div>);
                })}
                </div>

                {streamState === 'feedback' && (<div style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-secondary)' }}>
                    {isZh ? '正確答案：' : 'Correct: '}
                    <span style={{ color: 'var(--accent)', fontWeight: 900, letterSpacing: '2px' }}>
                      {activeSequence.targetLetters.join(' ')}
                    </span>
                  </div>)}
              </div>)}
          </div>

          {/* Bottom Virtual Keyboard & Controls */}
          {streamState === 'recall' ? (<div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(8, 1fr)',
                    gap: '8px',
                    width: '100%',
                }}>
                {consonantPool.map((char) => (<button key={char} type="button" onClick={() => handleLetterTap(char)} style={{
                        height: '52px',
                        fontSize: '22px',
                        fontWeight: 900,
                        borderRadius: '12px',
                        border: '2px solid var(--border)',
                        background: 'var(--card-bg)',
                        color: 'var(--text-primary)',
                        cursor: 'pointer',
                    }}>
                    {char}
                  </button>))}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '12px', marginTop: '4px' }}>
                <button type="button" onClick={handleBackspace} disabled={userSelection.length === 0} style={{
                    height: '60px',
                    fontSize: '18px',
                    fontWeight: 700,
                    borderRadius: '16px',
                    border: '1px solid var(--border)',
                    background: 'var(--card-bg)',
                    color: 'var(--text-primary)',
                    cursor: userSelection.length === 0 ? 'not-allowed' : 'pointer',
                    opacity: userSelection.length === 0 ? 0.5 : 1,
                }}>
                  {isZh ? '⌫ 刪除' : '⌫ Delete'}
                </button>

                <button type="button" onClick={handleSubmitRecall} disabled={userSelection.length < recallLength} style={{
                    height: '60px',
                    fontSize: '22px',
                    fontWeight: 900,
                    borderRadius: '16px',
                    border: 'none',
                    background: userSelection.length === recallLength ? 'var(--accent)' : 'var(--card-bg)',
                    color: userSelection.length === recallLength ? '#ffffff' : 'var(--text-secondary)',
                    cursor: userSelection.length === recallLength ? 'pointer' : 'not-allowed',
                    opacity: userSelection.length === recallLength ? 1 : 0.6,
                    boxShadow: userSelection.length === recallLength ? '0 4px 16px rgba(56, 189, 248, 0.4)' : 'none',
                }}>
                  {isZh ? '✓ 確認送出' : '✓ Submit'}
                </button>
              </div>
            </div>) : (<div style={{ height: '124px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ fontSize: '15px', color: 'var(--text-secondary)' }}>
                {streamState === 'streaming' ? (isZh ? '專心注視螢幕...' : 'Focus on screen...') : ''}
              </span>
            </div>)}
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
                {isZh ? '字母記憶更新 (Letter Memory) 當次紀錄換算參考值' : 'Letter Memory performance metrics'}
              </p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div style={{ padding: '16px', background: 'var(--bg)', borderRadius: '16px', textAlign: 'center' }}>
                <div style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>
                  {isZh ? '序列完全正確率' : 'Full Match Accuracy'}
                </div>
                <div style={{ fontSize: '36px', fontWeight: 900, color: 'var(--accent)', marginTop: '4px' }}>
                  {results.accuracyPercent}%
                </div>
                <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                  {results.fullyCorrectCount} / {results.totalRounds} {isZh ? '題完全吻合' : 'sequences'}
                </div>
              </div>

              <div style={{ padding: '16px', background: 'var(--bg)', borderRadius: '16px', textAlign: 'center' }}>
                <div style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>
                  {isZh ? '平均字母位置命中率' : 'Mean Letter Accuracy'}
                </div>
                <div style={{ fontSize: '36px', fontWeight: 900, marginTop: '4px' }}>
                  {results.meanLetterAccuracyPercent}%
                </div>
                <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                  {isZh ? '個別位置加總' : 'across all positions'}
                </div>
              </div>
            </div>

            <TrainingResultActions onBackHome={handleExitTraining} backLabel={isZh ? '返回入口' : 'Back to entry'} hubLabel={isZh ? '返回大廳' : 'Back to lobby'} />
          </div>
        </div>)}
    </div>);
}
function GenerateLetterSequences(rounds: number, recallLength: number): LetterMemorySequence[] {
    const sequences: LetterMemorySequence[] = [];
    for (let i = 0; i < rounds; i++) {
        // Stream length varies between recallLength + 3 and recallLength + 6 (e.g. 7 to 10 letters)
        const streamLength = recallLength + 3 + Math.floor(Math.random() * 4);
        const fullStream: string[] = [];
        while (fullStream.length < streamLength) {
            const candidate = consonantPool[Math.floor(Math.random() * consonantPool.length)];
            if (fullStream.length === 0 || candidate !== fullStream[fullStream.length - 1]) {
                fullStream.push(candidate);
            }
        }
        const targetLetters = fullStream.slice(fullStream.length - recallLength);
        sequences.push({
            sequenceNumber: i + 1,
            fullStream,
            targetLetters,
            recallLength,
        });
    }
    return sequences;
}

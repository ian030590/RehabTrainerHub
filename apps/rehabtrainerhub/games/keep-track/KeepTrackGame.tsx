import { GetHostedGameSetting } from '@rehab-trainer/ui/embeddedTraining';
import { RequestHubTrainingConfiguration } from '@rehab-trainer/ui/embeddedTraining';
// Canonical Hub-owned brain Keep Track task runtime.
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
type KeepTrackPhase = 'menu' | 'rules' | 'playing' | 'results';
type PresentationState = 'target-preview' | 'streaming' | 'blank' | 'recalling';
interface KeepTrackGameProps {
    onExit?: () => void;
}
interface CategoryItem {
    id: string;
    zh: string;
    en: string;
}
interface CategoryDef {
    id: string;
    nameZh: string;
    nameEn: string;
    icon: string;
    color: string;
    items: CategoryItem[];
}
const categoryDefinitions: CategoryDef[] = [
    {
        id: 'animals',
        nameZh: '動物',
        nameEn: 'Animals',
        icon: '🐾',
        color: '#10b981',
        items: [
            { id: 'dog', zh: '狗', en: 'Dog' },
            { id: 'cat', zh: '貓', en: 'Cat' },
            { id: 'lion', zh: '獅子', en: 'Lion' },
            { id: 'elephant', zh: '大象', en: 'Elephant' },
            { id: 'tiger', zh: '老虎', en: 'Tiger' },
            { id: 'rabbit', zh: '兔子', en: 'Rabbit' },
            { id: 'monkey', zh: '猴子', en: 'Monkey' },
            { id: 'bear', zh: '熊', en: 'Bear' },
        ],
    },
    {
        id: 'fruits',
        nameZh: '水果',
        nameEn: 'Fruits',
        icon: '🍎',
        color: '#f59e0b',
        items: [
            { id: 'apple', zh: '蘋果', en: 'Apple' },
            { id: 'banana', zh: '香蕉', en: 'Banana' },
            { id: 'orange', zh: '柳丁', en: 'Orange' },
            { id: 'grape', zh: '葡萄', en: 'Grape' },
            { id: 'watermelon', zh: '西瓜', en: 'Watermelon' },
            { id: 'strawberry', zh: '草莓', en: 'Strawberry' },
            { id: 'mango', zh: '芒果', en: 'Mango' },
            { id: 'peach', zh: '水蜜桃', en: 'Peach' },
        ],
    },
    {
        id: 'colors',
        nameZh: '顏色',
        nameEn: 'Colors',
        icon: '🎨',
        color: '#6366f1',
        items: [
            { id: 'red', zh: '紅色', en: 'Red' },
            { id: 'blue', zh: '藍色', en: 'Blue' },
            { id: 'green', zh: '綠色', en: 'Green' },
            { id: 'yellow', zh: '黃色', en: 'Yellow' },
            { id: 'purple', zh: '紫色', en: 'Purple' },
            { id: 'black', zh: '黑色', en: 'Black' },
            { id: 'white', zh: '白色', en: 'White' },
            { id: 'orange_col', zh: '橙色', en: 'Orange' },
        ],
    },
    {
        id: 'countries',
        nameZh: '國家',
        nameEn: 'Countries',
        icon: '🌍',
        color: '#ec4899',
        items: [
            { id: 'taiwan', zh: '台灣', en: 'Taiwan' },
            { id: 'japan', zh: '日本', en: 'Japan' },
            { id: 'usa', zh: '美國', en: 'USA' },
            { id: 'france', zh: '法國', en: 'France' },
            { id: 'germany', zh: '德國', en: 'Germany' },
            { id: 'korea', zh: '韓國', en: 'Korea' },
            { id: 'uk', zh: '英國', en: 'UK' },
            { id: 'canada', zh: '加拿大', en: 'Canada' },
        ],
    },
    {
        id: 'shapes',
        nameZh: '幾何形狀',
        nameEn: 'Shapes',
        icon: '🔷',
        color: '#06b6d4',
        items: [
            { id: 'circle', zh: '圓形', en: 'Circle' },
            { id: 'square', zh: '正方形', en: 'Square' },
            { id: 'triangle', zh: '三角形', en: 'Triangle' },
            { id: 'star', zh: '星形', en: 'Star' },
            { id: 'diamond', zh: '菱形', en: 'Diamond' },
            { id: 'heart', zh: '心形', en: 'Heart' },
            { id: 'oval', zh: '橢圓形', en: 'Oval' },
            { id: 'cross', zh: '十字形', en: 'Cross' },
        ],
    },
    {
        id: 'vehicles',
        nameZh: '交通工具',
        nameEn: 'Vehicles',
        icon: '🚗',
        color: '#8b5cf6',
        items: [
            { id: 'car', zh: '汽車', en: 'Car' },
            { id: 'airplane', zh: '飛機', en: 'Airplane' },
            { id: 'train', zh: '火車', en: 'Train' },
            { id: 'ship', zh: '輪船', en: 'Ship' },
            { id: 'bicycle', zh: '腳踏車', en: 'Bicycle' },
            { id: 'motorcycle', zh: '機車', en: 'Motorcycle' },
            { id: 'bus', zh: '公車', en: 'Bus' },
            { id: 'subway', zh: '捷運', en: 'Subway' },
        ],
    },
];
interface StreamWord {
    categoryId: string;
    item: CategoryItem;
}
interface RoundPlan {
    targetCategories: CategoryDef[];
    stream: StreamWord[];
    lastWords: Record<string, CategoryItem>;
}
interface KeepTrackTrialRecord {
    roundNumber: number;
    targetCount: number;
    correctCount: number;
    decisionRt: number;
}
interface KeepTrackSessionRecord {
    totalRounds: number;
    targetCount: number;
    totalPossible: number;
    totalCorrect: number;
    accuracyPercent: number;
    meanRt: number;
    trials: KeepTrackTrialRecord[];
}
function ShuffleArray<T>(array: T[]): T[] {
    const arr = [...array];
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
}
function GenerateKeepTrackRound(targetCount: number, streamLength: number): RoundPlan {
    const shuffledCats = ShuffleArray(categoryDefinitions);
    const targetCategories = shuffledCats.slice(0, targetCount);
    const fillerCategories = shuffledCats.slice(targetCount);
    const stream: StreamWord[] = [];
    const lastWords: Record<string, CategoryItem> = {};
    for (let i = 0; i < streamLength; i++) {
        const useTarget = Math.random() < 0.75 || i >= streamLength - targetCount;
        let chosenCat: CategoryDef;
        if (useTarget) {
            chosenCat = targetCategories[Math.floor(Math.random() * targetCategories.length)];
        }
        else {
            chosenCat = fillerCategories[Math.floor(Math.random() * fillerCategories.length)];
        }
        const chosenItem = chosenCat.items[Math.floor(Math.random() * chosenCat.items.length)];
        stream.push({ categoryId: chosenCat.id, item: chosenItem });
        if (targetCategories.some((cat) => cat.id === chosenCat.id)) {
            lastWords[chosenCat.id] = chosenItem;
        }
    }
    for (const cat of targetCategories) {
        if (!lastWords[cat.id]) {
            const fallbackItem = cat.items[Math.floor(Math.random() * cat.items.length)];
            stream.push({ categoryId: cat.id, item: fallbackItem });
            lastWords[cat.id] = fallbackItem;
        }
    }
    return { targetCategories, stream, lastWords };
}
export function KeepTrackGame({ onExit }: KeepTrackGameProps) {
    const { lang, t } = useT();
    const isZh = lang === 'zh';
    const hostedSettings = useHostedGameSettings();
    const { fullscreenRootRef, enterTrainingFullscreen: requestFullscreenOnPlay } = useFullscreenTrainingRoot<HTMLDivElement>();
    const jsPsychLifecycleRef = useRef<JsPsychExternalLifecycle | null>(null);
    const defaultCategoryCount = 3;
    const defaultRounds = 3;
    const defaultWordDurationMs = 1800;
    const [categoryCount, setCategoryCount] = useState<number>(Number(GetHostedGameSetting<string>('categoryCount')));
    const [rounds, setRounds] = useState<number>(GetHostedGameSetting<number>('rounds'));
    const [wordDurationMs, setWordDurationMs] = useState<number>(GetHostedGameSetting<number>('wordDurationMs'));
    useEffect(() => {
        if (hostedSettings?.categoryCount !== undefined) {
            setCategoryCount(Number(hostedSettings.categoryCount));
        }
        if (hostedSettings?.rounds !== undefined) {
            setRounds(Number(hostedSettings.rounds));
        }
        if (hostedSettings?.wordDurationMs !== undefined) {
            setWordDurationMs(Number(hostedSettings.wordDurationMs));
        }
    }, [hostedSettings]);
    const [phase, setPhase] = useState<KeepTrackPhase>('rules');
    const [presentationState, setPresentationState] = useState<PresentationState>('target-preview');
    const [currentRoundIndex, setCurrentRoundIndex] = useState<number>(0);
    const [currentRound, setCurrentRound] = useState<RoundPlan | null>(null);
    const [streamIndex, setStreamIndex] = useState<number>(0);
    const [recallingCategoryIndex, setRecallingCategoryIndex] = useState<number>(0);
    const [roundScores, setRoundScores] = useState<Array<{
        correct: number;
        total: number;
        rt: number;
    }>>([]);
    const [results, setResults] = useState<KeepTrackSessionRecord | null>(null);
    const recallStartRef = useRef<number>(0);
    const roundPlanRef = useRef<RoundPlan | null>(null);
    roundPlanRef.current = currentRound;

    const handleExitTraining = useCallback(() => {
        try {
            jsPsychLifecycleRef.current?.abort({ reason: 'user_exit' });
        }
        catch {
            // Fallback
        }
        onExit?.();
    }, [onExit]);
    useTrainingAbort({ active: phase === 'playing', onAbort: handleExitTraining });
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
            jsPsychLifecycleRef.current?.start({ moduleId: 'keep-track', onStart: () => undefined });
        }
        catch {
            // Fallback
        }
        setPhase('playing');
        setCurrentRoundIndex(0);
        setRoundScores([]);
        const firstRound = GenerateKeepTrackRound(categoryCount, 12);
        setCurrentRound(firstRound);
        setPresentationState('target-preview');
    }, [categoryCount]);
    const handleStartPlay = () => {
        requestFullscreenOnPlay();
        startGame();
    };
    const startWordStream = useCallback(() => {
        if (!currentRound)
            return;
        setPresentationState('streaming');
        setStreamIndex(0);
    }, [currentRound]);
    // Word presentation streaming
    useEffect(() => {
        if (phase !== 'playing' || presentationState !== 'streaming' || !currentRound)
            return;
        if (streamIndex >= currentRound.stream.length) {
            setPresentationState('recalling');
            setRecallingCategoryIndex(0);
            recallStartRef.current = performance.now();
            return;
        }
        const timer = setTimeout(() => {
            setPresentationState('blank');
            const blankTimer = setTimeout(() => {
                setStreamIndex((prev) => prev + 1);
                setPresentationState('streaming');
            }, 400);
            return () => clearTimeout(blankTimer);
        }, wordDurationMs);
        return () => clearTimeout(timer);
    }, [phase, presentationState, streamIndex, currentRound, wordDurationMs]);
    const handleAnswerChoice = (chosenItem: CategoryItem) => {
        if (!currentRound)
            return;
        const currentTargetCat = currentRound.targetCategories[recallingCategoryIndex];
        const expectedItem = currentRound.lastWords[currentTargetCat.id];
        const isCorrect = chosenItem.id === expectedItem.id;
        const decisionRt = Math.round(performance.now() - recallStartRef.current);
        if (isCorrect) {
            PlaySuccessSound();
        }
        else {
            PlayFailureSound();
        }
        const nextIndex = recallingCategoryIndex + 1;
        if (nextIndex < currentRound.targetCategories.length) {
            setRecallingCategoryIndex(nextIndex);
            recallStartRef.current = performance.now();
        }
        else {
            // Round complete
            const newScores = [
                ...roundScores,
                {
                    correct: isCorrect ? 1 : 0,
                    total: currentRound.targetCategories.length,
                    rt: decisionRt,
                },
            ];
            setRoundScores(newScores);
            const nextRoundIdx = currentRoundIndex + 1;
            if (nextRoundIdx < rounds) {
                setCurrentRoundIndex(nextRoundIdx);
                const nextRound = GenerateKeepTrackRound(categoryCount, 12);
                setCurrentRound(nextRound);
                setPresentationState('target-preview');
            }
            else {
                // Entire session complete
                PlayGameEndSound('Victory');
                const totalPossible = rounds * categoryCount;
                const totalCorrect = newScores.reduce((acc, curr) => acc + curr.correct, 0);
                const accuracyPercent = totalPossible > 0 ? Math.round((totalCorrect / totalPossible) * 100) : 0;
                const meanRt = newScores.length > 0 ? Math.round(newScores.reduce((acc, curr) => acc + curr.rt, 0) / newScores.length) : 0;
                const sessionRecord: KeepTrackSessionRecord = {
                    totalRounds: rounds,
                    targetCount: categoryCount,
                    totalPossible,
                    totalCorrect,
                    accuracyPercent,
                    meanRt,
                    trials: newScores.map((s, idx) => ({
                        roundNumber: idx + 1,
                        targetCount: s.total,
                        correctCount: s.correct,
                        decisionRt: s.rt,
                    })),
                };
                setResults(sessionRecord);
                SaveTrainingSessionRecord({ userName: GetAuthUserNameFromToken() ?? 'Guest', moduleId: 'keep-track', gameId: 'keep-track', gameTitle: document.title, difficulty: 'configured', trainingDate: FormatTestDate(new Date()), details: { module: 'keep-track',
accuracyPercent,
meanReactionTimeMs: meanRt,
totalTrials: totalPossible,
successfulTrials: totalCorrect } });
                try {
                    jsPsychLifecycleRef.current?.finish({
                        status: 'completed',
                        totalCorrect,
                        totalPossible,
                    });
                }
                catch {
                    // Fallback
                }
                setPhase('results');
            }
        }
    };
    return (<div ref={fullscreenRootRef} className="thinking-game-wrapper" style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: '100dvh',
            width: '100%',
            boxSizing: 'border-box',
            position: 'relative',
        }}>
      {null}

      {phase === 'rules' && (<BrainTrainingRulesPanel gameId="keep-track" onBack={() => RequestHubTrainingConfiguration()} onStart={handleStartPlay} title={document.title}/>)}

      {phase === 'playing' && currentRound && (<div style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                width: '100%',
                maxWidth: '720px',
                padding: '20px 16px',
                boxSizing: 'border-box',
            }}>
          <div style={{
                width: '100%',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '16px',
            }}>
            <span style={{ fontSize: '20px', fontWeight: 800, color: 'var(--accent)' }}>
              {isZh ? `第 ${currentRoundIndex + 1} / ${rounds} 回合` : `Round ${currentRoundIndex + 1} / ${rounds}`}
            </span>
            <button type="button" onClick={handleExitTraining} style={{
                background: 'transparent',
                border: '1px solid var(--border)',
                borderRadius: '12px',
                padding: '8px 16px',
                color: 'var(--text-secondary)',
                fontSize: '15px',
                cursor: 'pointer',
            }}>
              {isZh ? '退出' : 'Exit'}
            </button>
          </div>

          {presentationState === 'target-preview' && (<div style={{
                    width: '100%',
                    background: 'var(--card-bg)',
                    borderRadius: '24px',
                    padding: '32px 24px',
                    textAlign: 'center',
                    boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
                }}>
              <h2 style={{ fontSize: '24px', fontWeight: 900, marginBottom: '12px', color: 'var(--accent)' }}>
                {isZh ? '🎯 本回合追蹤目標類別' : '🎯 Target Categories'}
              </h2>
              <p style={{ fontSize: '18px', color: 'var(--text-secondary)', marginBottom: '28px', lineHeight: 1.6 }}>
                {isZh
                    ? '稍後的單詞流中，請隨時記住下列各類別中【最後出現】的單詞：'
                    : 'Track and remember the LAST word shown for each category:'}
              </p>

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', justifyContent: 'center', marginBottom: '32px' }}>
                {currentRound.targetCategories.map((cat) => (<div key={cat.id} style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px',
                        background: 'rgba(255,255,255,0.06)',
                        border: `2px solid ${cat.color}`,
                        borderRadius: '16px',
                        padding: '12px 20px',
                        fontSize: '22px',
                        fontWeight: 800,
                        color: cat.color,
                    }}>
                    <span>{cat.icon}</span>
                    <span>{isZh ? cat.nameZh : cat.nameEn}</span>
                  </div>))}
              </div>

              <button type="button" onClick={startWordStream} style={{
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
                }}>
                {isZh ? '準備好了，開始播放' : 'Ready! Start Stream'}
              </button>
            </div>)}

          {(presentationState === 'streaming' || presentationState === 'blank') && (<div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: '100%',
                    minHeight: '50vh',
                }}>
              <div style={{ display: 'flex', gap: '10px', marginBottom: '24px', flexWrap: 'wrap', justifyContent: 'center' }}>
                {currentRound.targetCategories.map((cat) => (<span key={cat.id} style={{
                        background: 'rgba(255,255,255,0.06)',
                        border: `1px solid ${cat.color}`,
                        borderRadius: '10px',
                        padding: '6px 12px',
                        fontSize: '15px',
                        color: cat.color,
                    }}>
                    {cat.icon} {isZh ? cat.nameZh : cat.nameEn}
                  </span>))}
              </div>

              <div style={{
                    width: '320px',
                    height: '200px',
                    background: presentationState === 'blank' ? 'rgba(30, 41, 59, 0.3)' : 'var(--card-bg)',
                    border: '3px solid var(--accent)',
                    borderRadius: '24px',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
                    transition: 'opacity 0.15s',
                    opacity: presentationState === 'blank' ? 0.3 : 1,
                }}>
                {presentationState === 'streaming' && currentRound.stream[streamIndex] && (<>
                    <span style={{ fontSize: '52px', fontWeight: 900, color: 'var(--text-primary)' }}>
                      {currentRound.stream[streamIndex].item.zh}
                    </span>
                    <span style={{ fontSize: '20px', color: 'var(--text-secondary)', marginTop: '6px' }}>
                      {currentRound.stream[streamIndex].item.en}
                    </span>
                  </>)}
                {presentationState === 'blank' && (<span style={{ fontSize: '36px', color: 'var(--text-secondary)' }}>+</span>)}
              </div>

              <div style={{ marginTop: '24px', fontSize: '16px', color: 'var(--text-secondary)' }}>
                {isZh
                    ? `進度：${Math.min(streamIndex + 1, currentRound.stream.length)} / ${currentRound.stream.length}`
                    : `Item ${Math.min(streamIndex + 1, currentRound.stream.length)} / ${currentRound.stream.length}`}
              </div>
            </div>)}

          {presentationState === 'recalling' && (<div style={{
                    width: '100%',
                    background: 'var(--card-bg)',
                    borderRadius: '24px',
                    padding: '28px 20px',
                    textAlign: 'center',
                    boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
                }}>
              {(() => {
                    const activeCat = currentRound.targetCategories[recallingCategoryIndex];
                    const expectedItem = currentRound.lastWords[activeCat.id];
                    const lures = activeCat.items.filter((item) => item.id !== expectedItem.id);
                    const shuffledLures = ShuffleArray(lures).slice(0, 3);
                    const optionChoices = ShuffleArray([expectedItem, ...shuffledLures]);
                    return (<div>
                    <span style={{
                            display: 'inline-block',
                            background: 'rgba(56, 189, 248, 0.15)',
                            border: '1px solid var(--accent)',
                            color: 'var(--accent)',
                            borderRadius: '20px',
                            padding: '4px 14px',
                            fontSize: '15px',
                            fontWeight: 700,
                            marginBottom: '16px',
                        }}>
                      {isZh
                            ? `回憶目標 ${recallingCategoryIndex + 1} / ${currentRound.targetCategories.length}`
                            : `Target ${recallingCategoryIndex + 1} / ${currentRound.targetCategories.length}`}
                    </span>
                    <h2 style={{ fontSize: '32px', color: activeCat.color, margin: '0 0 8px 0' }}>
                      {activeCat.icon} {isZh ? activeCat.nameZh : activeCat.nameEn}
                    </h2>
                    <p style={{ fontSize: '18px', color: 'var(--text-secondary)', marginBottom: '24px' }}>
                      {isZh
                            ? `剛剛的單詞流中，【${activeCat.nameZh}】最後出現的是哪一個？`
                            : `Which word in [${activeCat.nameEn}] was the LAST ONE shown?`}
                    </p>

                    <div style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(2, 1fr)',
                            gap: '14px',
                            maxWidth: '520px',
                            margin: '0 auto',
                        }}>
                      {optionChoices.map((choice) => (<button key={choice.id} type="button" onClick={() => handleAnswerChoice(choice)} style={{
                                minHeight: '84px',
                                background: 'var(--bg)',
                                border: '2px solid var(--border)',
                                borderRadius: '16px',
                                color: 'var(--text-primary)',
                                cursor: 'pointer',
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                justifyContent: 'center',
                                padding: '12px',
                            }}>
                          <span style={{ fontSize: '28px', fontWeight: 900 }}>{choice.zh}</span>
                          <span style={{ fontSize: '15px', color: 'var(--text-secondary)' }}>{choice.en}</span>
                        </button>))}
                    </div>
                  </div>);
                })()}
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
                {isZh ? '類別記憶追蹤 (Keep Track) 當次紀錄換算參考值' : 'Keep Track performance metrics'}
              </p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div style={{ padding: '16px', background: 'var(--bg)', borderRadius: '16px', textAlign: 'center' }}>
                <div style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>
                  {isZh ? '記憶召回正確率' : 'Recall Accuracy'}
                </div>
                <div style={{ fontSize: '36px', fontWeight: 900, color: 'var(--accent)', marginTop: '4px' }}>
                  {results.accuracyPercent}%
                </div>
                <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                  {results.totalCorrect} / {results.totalPossible} {isZh ? '類別吻合' : 'categories'}
                </div>
              </div>

              <div style={{ padding: '16px', background: 'var(--bg)', borderRadius: '16px', textAlign: 'center' }}>
                <div style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>
                  {isZh ? '平均決策反應時間' : 'Mean Decision Time'}
                </div>
                <div style={{ fontSize: '36px', fontWeight: 900, marginTop: '4px' }}>
                  {results.meanRt}
                </div>
                <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                  ms
                </div>
              </div>
            </div>

            <TrainingResultActions onBackHome={handleExitTraining} backLabel={isZh ? '返回入口' : 'Back to entry'} hubLabel={isZh ? '返回大廳' : 'Back to lobby'} />
          </div>
        </div>)}
    </div>);
}
export default KeepTrackGame;

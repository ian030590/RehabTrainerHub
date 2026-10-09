import { useFullscreenTrainingRoot, useTrainingAbort } from './runtime/trainingLifecycle';
import { useT } from './i18n/useT';
import { SendGameResult, RetryGameSave, IsHubGame } from './runtime/hubBridge';
import { defaultSettings, BuildRuntimeConfig, BuildGameScore, type AsteroidSettings } from './settings';
import { PlayFailureSound, PlayGameEndSound, PlaySuccessSound, PrepareAudioFeedback, SetSoundEnabled } from './runtime/soundManager';
import { initJsPsych } from 'jspsych';
import { Application, Assets, Container, Sprite, Texture, TilingSprite, type Ticker } from 'pixi.js';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Clamp, FormatTestDate } from './gameUtils';
import { AsteroidShieldTutorial } from './rules/AsteroidShieldTutorial';
import { ScoreAnalysis } from './ScoreAnalysis';
import { JsPsychExternalLifecycle } from './runtime/jsPsychLifecycle';
type DifficultyId = 'beginner' | 'intermediate' | 'advanced';
type GamePhase = 'menu' | 'rules' | 'initializing' | 'playing' | 'results';
type GameResult = 'Victory' | 'Defeat';

type ThreatKind = 'normal' | 'heavy' | 'lethal' | 'energy';
type ThreatOutcome = 'shielded' | 'hit' | 'collected' | 'missed';
type ControlMode = 'mouse';
type ControlSource = ControlMode;
interface AsteroidShieldGameProps {
    onExit: () => void;
}
interface DifficultyDefinition {
    id: DifficultyId;
    spawnIntervalSec: number;
    baseSpeed: number;
    maxThreats: number;
    heavyChance: number;
    lethalChance: number;
    energyChance: number;
}
interface AssetTextures {
    background: Texture;
    ship: Texture;
    shield: Texture;
    normal: Texture;
    heavy: Texture;
    lethal: Texture;
    energy: Texture;
}
interface ShieldLayout {
    shipX: number;
    shipY: number;
    shipWidth: number;
    shipHeight: number;
    shieldX: number;
    shieldY: number;
    shieldWidth: number;
    shieldHeight: number;
}
interface Threat {
    id: number;
    kind: ThreatKind;
    sprite: Sprite;
    trail: Sprite[];
    size: number;
    x: number;
    y: number;
    vx: number;
    vy: number;
    radius: number;
    damage: number;
    score: number;
    spawnedAtMs: number;
    rotationSpeed: number;
    resultIndex: number;
}
interface AsteroidScene {
    background: TilingSprite;
    objectsLayer: Container;
    ship: Sprite;
    shield: Sprite;
    textures: AssetTextures;
    threats: Threat[];
}
interface SessionMetrics {
    startedAt: number;
    elapsedMs: number;
    lastTickAt: number;
    spawnTimerSec: number;
    hp: number;
    maxHp: number;
    score: number;
    blocked: number;
    hits: number;
    collected: number;
    spawned: number;
    nextId: number;
    speedLevel: number;
    lastControlSource: ControlSource;
}
interface ThreatRecord {
    Object_Number: number;
    Type: ThreatKind;
    Outcome: ThreatOutcome;
    Spawn_Time_Seconds: number;
    Response_Time_Seconds: number | null;
    Damage: number;
    HP_After: number;
    Score_After: number;
    Speed_Level: number;
    Control_Source: ControlSource;
}
interface SessionRecord {
    Test_Date: string;
    Participant_ID: string;
    Difficulty: DifficultyId;
    Duration_Seconds: number;
    Starting_HP: number;
    Shield_Size_Percent: number;
    Control_Mode: ControlMode;
    Tracking_Hand: null;
    Total_Duration_Seconds: number;
    Final_HP: number;
    Score: number;
    Objects_Spawned: number;
    Objects_Blocked: number;
    Ship_Hits: number;
    Energy_Collected: number;
    Final_Speed_Level: number;
    Game_Result: GameResult;
    Object_Records: ThreatRecord[];
}
const assetUrls = {
    background: new URL('./textures/background.png', import.meta.url).href,
    ship: new URL('./textures/ship.png', import.meta.url).href,
    shield: new URL('./textures/shield.png', import.meta.url).href,
    normal: new URL('./textures/asteroid-blue.png', import.meta.url).href,
    heavy: new URL('./textures/asteroid-green.png', import.meta.url).href,
    lethal: new URL('./textures/asteroid-dark.png', import.meta.url).href,
    energy: new URL('./textures/energy-rock.png', import.meta.url).href,
} as const;
const speedLevelStep = 15;
const defaultDurationSeconds = 60;
const defaultHp = 10;
const defaultShieldSizePercent = 135;
const difficulties: readonly DifficultyDefinition[] = [
    {
        id: 'beginner',
        spawnIntervalSec: 1.35,
        baseSpeed: 120,
        maxThreats: 4,
        heavyChance: 0.13,
        lethalChance: 0.04,
        energyChance: 0.1,
    },
    {
        id: 'intermediate',
        spawnIntervalSec: 1.08,
        baseSpeed: 165,
        maxThreats: 5,
        heavyChance: 0.17,
        lethalChance: 0.07,
        energyChance: 0.08,
    },
    {
        id: 'advanced',
        spawnIntervalSec: 0.82,
        baseSpeed: 215,
        maxThreats: 6,
        heavyChance: 0.2,
        lethalChance: 0.1,
        energyChance: 0.07,
    },
] as const;
const copy = {
    zh: {
        title: '小行星護盾防衛',
        configLabel: '護盾設定',
        difficulty: '難度',
        difficultyDesc: '調整小行星出現頻率、速度與危險物比例。',
        duration: '活動時間',
        durationDesc: '設定這次護盾防衛的總秒數。',
        hp: '飛船耐久',
        hpDesc: '飛船可承受的總傷害。暗色小行星若命中會直接結束。',
        shieldSize: '護盾大小',
        shieldSizeDesc: '較大的透明護盾更接近保護飛船的視覺，也降低攔截難度。',
        controlMode: '操作方式',
        controlModeDesc: '選擇使用滑鼠，或以 MediaPipe 追蹤手掌位置的體感操作。',
        mouseControl: '滑鼠',
        mediaPipeControl: '體感操作（MediaPipe）',
        hand: '追蹤手',
        handDesc: '選擇任一可見手，或指定左手/右手。',
        privacyTitle: '攝影機影像只在本機分析',
        privacyDesc: 'MediaPipe 只用來估計手部位置。影像不會錄製或上傳，紀錄只保存訓練統計。',
        beginner: '初階',
        intermediate: '中階',
        advanced: '進階',
        handAny: '任一手',
        handLeft: '左手',
        handRight: '右手',
        loadingTitle: '準備手部追蹤',
        loadingCamera: '正在啟動攝影機，請允許瀏覽器使用攝影機。',
        loadingModel: '正在載入 MediaPipe 手部模型。',
        cameraPreview: '即時手部攝影機預覽',
        tracking: '已追蹤手部',
        finding: '請把手放入畫面',
        unsupported: '此瀏覽器不支援攝影機存取，已改用滑鼠。',
        permission: '無法使用攝影機。請允許攝影機權限，否則將改用滑鼠。',
        disconnected: '攝影機已中斷，體感操作停止，已改用滑鼠。',
        initialization: '手部追蹤無法啟動，已改用滑鼠。',
        errorTitle: '體感操作無法啟動',
        openDetails: '開啟錯誤詳情',
        statusScore: '分數',
        resultTitle: '護盾防衛活動完成',
        user: '使用者',
        finalHp: '剩餘耐久',
        objectsBlocked: '攔截物件',
        shipHits: '飛船受擊',
        energyCollected: '能量石',
        objectType: '類型',
        outcome: '結果',
        responseTime: '反應時間',
        damage: '傷害',
        normal: '藍色小行星',
        heavy: '綠色小行星',
        lethal: '暗色小行星',
        energy: '能量石',
        shielded: '護盾攔截',
        hit: '命中飛船',
        collected: '收集',
        missed: '離場',
    },
    en: {
        title: 'Asteroid Shield Defense',
        configLabel: 'Shield Settings',
        difficulty: 'Difficulty',
        difficultyDesc: 'Adjust asteroid spawn rate, speed, and high-risk object mix.',
        duration: 'Session Duration',
        durationDesc: 'Set the total seconds for this shield defense session.',
        hp: 'Ship Durability',
        hpDesc: 'Total damage the ship can take. A dark asteroid hit ends the session.',
        shieldSize: 'Shield Size',
        shieldSizeDesc: 'A larger transparent shield looks protective and lowers interception load.',
        controlMode: 'Control Method',
        controlModeDesc: 'Choose mouse control or motion control that tracks palm position with MediaPipe.',
        mouseControl: 'Mouse',
        mediaPipeControl: 'Motion Control (MediaPipe)',
        hand: 'Tracking Hand',
        handDesc: 'Use either visible hand or specify left/right hand tracking.',
        privacyTitle: 'Camera video is analyzed on this device',
        privacyDesc: 'MediaPipe estimates hand position only. Video is not recorded or uploaded; only training statistics are saved.',
        beginner: 'Beginner',
        intermediate: 'Intermediate',
        advanced: 'Advanced',
        handAny: 'Any Hand',
        handLeft: 'Left Hand',
        handRight: 'Right Hand',
        loadingTitle: 'Preparing Hand Tracking',
        loadingCamera: 'Starting the camera. Allow browser camera access when prompted.',
        loadingModel: 'Loading the MediaPipe hand model.',
        cameraPreview: 'Live hand camera preview',
        tracking: 'Hand tracked',
        finding: 'Place your hand in the frame',
        unsupported: 'This browser does not support camera access. Continuing with mouse control.',
        permission: 'Camera access is unavailable. Allow camera permission or the session will use mouse control.',
        disconnected: 'The camera disconnected. Motion control stopped and the session switched to mouse control.',
        initialization: 'Hand tracking could not start. Continuing with mouse control.',
        errorTitle: 'Unable to Start Motion Control',
        openDetails: 'Open error details',
        statusScore: 'Score',
        resultTitle: 'Asteroid Shield Training Complete',
        user: 'User',
        finalHp: 'Final HP',
        objectsBlocked: 'Objects Blocked',
        shipHits: 'Ship Hits',
        energyCollected: 'Energy Rocks',
        objectType: 'Type',
        outcome: 'Outcome',
        responseTime: 'Response Time',
        damage: 'Damage',
        normal: 'Blue Asteroid',
        heavy: 'Green Asteroid',
        lethal: 'Dark Asteroid',
        energy: 'Energy Rock',
        shielded: 'Shielded',
        hit: 'Ship Hit',
        collected: 'Collected',
        missed: 'Missed',
    },
} as const;
export function AsteroidShieldGame({ onExit }: AsteroidShieldGameProps) {
    const { lang, t } = useT();
    const labels = copy[lang];
    const { fullscreenRootRef, enterTrainingFullscreen } = useFullscreenTrainingRoot<HTMLDivElement>();
    const pixiHostRef = useRef<HTMLDivElement | null>(null);
    const settingsDialogRef = useRef<HTMLDialogElement | null>(null);
    const appRef = useRef<Application | null>(null);
    const texturesRef = useRef<AssetTextures | null>(null);
    const sceneRef = useRef<AsteroidScene | null>(null);
    const shieldPositionRef = useRef(0.5);
    const activeControlModeRef = useRef<ControlMode>('mouse');
    const phaseRef = useRef<GamePhase>('menu');
    const mountedRef = useRef(true);
    const resultRecordsRef = useRef<ThreatRecord[]>([]);
    const metricsRef = useRef<SessionMetrics>(CreateEmptyMetrics(defaultHp));
    const [settings, setSettings] = useState<AsteroidSettings>({ ...defaultSettings });
    const settingsRef = useRef(settings);
    settingsRef.current = settings;
    const { difficulty, durationSec, maxHp, shieldSizePercent, controlMode } = BuildRuntimeConfig(settings);
    const configRef = useRef(BuildRuntimeConfig(settings));
    configRef.current = BuildRuntimeConfig(settings);
    const jsPsychHostRef = useRef<HTMLDivElement | null>(null);
    const jsPsychRef = useRef<ReturnType<typeof initJsPsych> | null>(null);
    const jsPsychLifecycleRef = useRef<JsPsychExternalLifecycle | null>(null);
    const [phase, setPhaseState] = useState<GamePhase>('menu');
    const [result, setResult] = useState<SessionRecord | null>(null);
    const [saveState, setSaveState] = useState<'saving' | 'saved' | 'error'>('saving');
    const [rendererReady, setRendererReady] = useState(false);
    const [rendererError, setRendererError] = useState(false);
    useEffect(() => {
      if (phase === 'menu') settingsDialogRef.current?.showModal();
    }, [phase]);
    useEffect(() => { SetSoundEnabled(settings.soundEnabled); }, [settings.soundEnabled]);
    useEffect(() => {
      const saved = (event: Event) => setSaveState((event as CustomEvent).detail);
      const configure = () => setPhase('menu');
      window.addEventListener('game:saved', saved);
      window.addEventListener('game:configure', configure);
      return () => { window.removeEventListener('game:saved', saved); window.removeEventListener('game:configure', configure); };
    }, []);
    const summaryItems = useMemo(() => [
        { label: labels.difficulty, value: labels[difficulty] },
        { label: labels.duration, value: `${durationSec}s` },
        { label: labels.hp, value: maxHp },
        { label: labels.shieldSize, value: `${shieldSizePercent}%` },
        { label: labels.controlMode, value: labels.mouseControl },
    ], [controlMode, difficulty, durationSec, labels, maxHp, shieldSizePercent]);
    const setPhase = useCallback((nextPhase: GamePhase) => {
        phaseRef.current = nextPhase;
        setPhaseState(nextPhase);
    }, []);
    const showConfiguration = useCallback(() => setPhase('menu'), [setPhase]);
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
    useEffect(() => { mountedRef.current = true; return () => { mountedRef.current = false; }; }, []);
    const finishGame = useCallback((gameResult: GameResult) => {
        if (!mountedRef.current || phaseRef.current === 'results' || phaseRef.current === 'menu')
            return;
        const metrics = metricsRef.current;
        const config = configRef.current;
        const participantId = 'Guest';
        const totalDuration = Number((metrics.elapsedMs / 1000).toFixed(1));
        const record: SessionRecord = {
            Test_Date: FormatTestDate(new Date()),
            Participant_ID: participantId,
            Difficulty: config.difficulty,
            Duration_Seconds: config.durationSec,
            Starting_HP: config.maxHp,
            Shield_Size_Percent: config.shieldSizePercent,
            Control_Mode: config.controlMode,
            Tracking_Hand: null,
            Total_Duration_Seconds: totalDuration,
            Final_HP: metrics.hp,
            Score: metrics.score,
            Objects_Spawned: metrics.spawned,
            Objects_Blocked: metrics.blocked,
            Ship_Hits: metrics.hits,
            Energy_Collected: metrics.collected,
            Final_Speed_Level: metrics.speedLevel,
            Game_Result: gameResult,
            Object_Records: resultRecordsRef.current.map((item) => ({ ...item })),
        };
        ClearAsteroidScene(sceneRef.current);
        PlayGameEndSound(gameResult, jsPsychRef);
        jsPsychLifecycleRef.current?.finish(record as unknown as Record<string, unknown>);
        setResult(record);
        setPhase('results');
        setSaveState('saving');
        const score = BuildGameScore(record);
        SendGameResult({ ...settingsRef.current }, score.summary, score.rounds);
    }, [setPhase]);
    const beginPlaying = useCallback(() => {
        const app = appRef.current;
        const textures = texturesRef.current;
        if (!app || !textures)
            return;
        ResizePixiAppToElement(app, pixiHostRef.current);
        ResetAsteroidScene(app, sceneRef, textures);
        const config = configRef.current;
        metricsRef.current = {
            ...CreateEmptyMetrics(config.maxHp),
            startedAt: performance.now(),
            lastTickAt: performance.now(),
            lastControlSource: activeControlModeRef.current,
        };
        resultRecordsRef.current = [];
        shieldPositionRef.current = 0.5;
        setResult(null);
        setPhase('playing');
    }, [setPhase]);
    const startGame = useCallback(async () => {
        if (!rendererReady) return;
        SetSoundEnabled(settingsRef.current.soundEnabled);
        const fullscreenPromise = enterTrainingFullscreen();
        PrepareAudioFeedback(jsPsychRef);
        await fullscreenPromise;
        await jsPsychLifecycleRef.current?.start({ moduleId: 'motor:asteroid-shield', onStart: beginPlaying });
    }, [beginPlaying, enterTrainingFullscreen, rendererReady]);
    const returnToMenu = useCallback(() => {
        jsPsychLifecycleRef.current?.abort({ abort_reason: 'return-to-menu' });
        ClearAsteroidScene(sceneRef.current);
        metricsRef.current = CreateEmptyMetrics(configRef.current.maxHp);
        resultRecordsRef.current = [];
        setResult(null);
        showConfiguration();
    }, [showConfiguration]);
    const exitGame = useCallback(() => {
        jsPsychLifecycleRef.current?.abort({ abort_reason: 'exit-training' });
        onExit();
    }, [onExit]);
    useTrainingAbort({
        active: phase === 'initializing' || phase === 'playing',
        onAbort: returnToMenu,
    });
    useEffect(() => {
        let cancelled = false;
        const app = new Application();
        const host = pixiHostRef.current;
        const initialize = async () => {
            if (!host)
                return;
            await app.init({
                backgroundAlpha: 0,
                antialias: true,
                autoDensity: true,
                resolution: Math.min(window.devicePixelRatio || 1, 2),
                resizeTo: host,
            });
            const textures = await LoadAssetTextures();
            if (cancelled) {
                app.destroy(true, { children: true, texture: true });
                return;
            }
            appRef.current = app;
            texturesRef.current = textures;
            host.appendChild(app.canvas);
            app.canvas.className = 'asteroid-shield-canvas';
            ResetAsteroidScene(app, sceneRef, textures);
            onResize();
            setRendererReady(true);
            app.ticker.add((ticker: Ticker) => {
                if (phaseRef.current !== 'playing')
                    return;
                UpdateAsteroidGame({
                    app,
                    ticker,
                    sceneRef,
                    metricsRef,
                    configRef,
                    shieldPositionRef,
                    resultRecordsRef,
                    onSuccess: () => PlaySuccessSound(jsPsychRef),
                    onFailure: () => PlayFailureSound(jsPsychRef),
                    onComplete: finishGame,
                });
            });
        };
        void initialize().catch(error => {
            if (cancelled) return;
            console.warn('Unable to initialize asteroid shield renderer.', error);
            setRendererError(true);
        });
        const onResize = () => {
            const currentApp = appRef.current;
            const scene = sceneRef.current;
            if (!currentApp || !scene)
                return;
            ResizePixiAppToElement(currentApp, host);
            UpdateSceneLayout(currentApp, scene, configRef.current.shieldSizePercent, shieldPositionRef.current);
        };
        const resizeObserver = host && typeof ResizeObserver !== 'undefined'
            ? new ResizeObserver(onResize)
            : null;
        window.addEventListener('resize', onResize);
        window.visualViewport?.addEventListener('resize', onResize);
        document.addEventListener('fullscreenchange', onResize);
        if (resizeObserver && host)
            resizeObserver.observe(host);
        return () => {
            cancelled = true;
            window.removeEventListener('resize', onResize);
            window.visualViewport?.removeEventListener('resize', onResize);
            document.removeEventListener('fullscreenchange', onResize);
            resizeObserver?.disconnect();
            app.destroy(true, { children: true, texture: true });
            appRef.current = null;
            texturesRef.current = null;
            sceneRef.current = null;
        };
    }, [finishGame]);
    useEffect(() => {
        const host = pixiHostRef.current;
        if (!host)
            return;
        const updateFromPointer = (event: PointerEvent) => {
            if (phaseRef.current !== 'playing' || activeControlModeRef.current !== 'mouse')
                return;
            const rect = host.getBoundingClientRect();
            shieldPositionRef.current = Clamp((event.clientX - rect.left) / rect.width, 0, 1);
            metricsRef.current.lastControlSource = 'mouse';
        };
        host.addEventListener('pointerdown', updateFromPointer);
        host.addEventListener('pointermove', updateFromPointer);
        return () => {
            host.removeEventListener('pointerdown', updateFromPointer);
            host.removeEventListener('pointermove', updateFromPointer);
        };
    }, []);
    const rendererErrorNotice = rendererError && <p className="renderer-error" role="alert">{lang === 'en' ? 'The game could not load. Return and try again.' : '遊戲無法載入，請返回後重試。'}</p>;
    return (<div ref={fullscreenRootRef} className={`asteroid-shield-game asteroid-shield-phase-${phase}`}>
      <div ref={jsPsychHostRef} style={{ display: 'none' }} aria-hidden="true"/>
      <div ref={pixiHostRef} className="asteroid-shield-stage"/>

      {(phase === 'menu' || phase === 'rules') && <div className="training-panel" style={{ padding: 0 }} inert={phase === 'menu'} aria-hidden={phase === 'menu'}>
        <AsteroidShieldTutorial title={labels.title} summaryItems={summaryItems} shieldSizePercent={shieldSizePercent} onStart={() => void startGame()} onBack={showConfiguration} ready={rendererReady} active={phase === 'rules'}/>
      </div>}

      {phase === 'menu' && <dialog ref={settingsDialogRef} className="game-settings-dialog" aria-labelledby="asteroid-settings-title" onCancel={event => { event.preventDefault(); onExit(); }}>
        <form className="game-settings-form" onKeyDown={event => {
          if (event.key === 'Tab') {
            const controls = event.currentTarget.querySelectorAll<HTMLElement>('button, input, select');
            if (document.activeElement === controls[event.shiftKey ? 0 : controls.length - 1]) {
              event.preventDefault(); controls[event.shiftKey ? controls.length - 1 : 0]?.focus();
            }
          }
          if (event.key === 'Enter') { event.preventDefault(); if (event.currentTarget.reportValidity()) setPhase('rules'); }
        }} onSubmit={event => event.preventDefault()}>
          <h2 id="asteroid-settings-title">{labels.title}</h2>
          <p>{lang === 'en' ? 'These values apply only to this session.' : '設定值只用於這次活動。'}</p>
          {rendererErrorNotice}
          <label>{lang === 'en' ? 'Spawn interval / base speed' : '生成間隔／基礎速度'}
            <select value={settings.difficulty} onChange={event => setSettings({ ...settings, difficulty: event.target.value as AsteroidSettings['difficulty'] })}>
              <option value="easy">1.35 s / 120 px/s</option><option value="medium">1.08 s / 165 px/s</option><option value="hard">0.82 s / 215 px/s</option>
            </select>
          </label>
          <p>{lang === 'en' ? 'Analyze different conditions separately.' : '不同條件應分開分析。'}</p>
          <label>{labels.duration}: <output>{settings.durationSec} s</output>
            <input type="range" min="30" max="300" step="15" value={settings.durationSec} onChange={event => setSettings({ ...settings, durationSec: Number(event.target.value) })}/>
          </label>
          <label>{lang === 'en' ? 'Shield size level' : '護盾大小級距'}: <output>{settings.sensitivity} ({shieldSizePercent}%)</output>
            <input type="range" min="1" max="10" step="1" value={settings.sensitivity} onChange={event => setSettings({ ...settings, sensitivity: Number(event.target.value) })}/>
          </label>
          <p>{lang === 'en' ? 'Shield scale = 70 + level × 5 (75–120%); larger shields ease interception.' : '護盾比例 = 70 + 級距 × 5（75–120%）；較大較容易攔截。此設定不是追蹤靈敏度。'}</p>
          <label><input type="checkbox" checked={settings.soundEnabled} onChange={event => setSettings({ ...settings, soundEnabled: event.target.checked })}/> {lang === 'en' ? 'Sound feedback' : '聲音回饋'}</label>
          <button type="button" className="btn-primary" onClick={event => { if (event.currentTarget.form?.reportValidity()) setPhase('rules'); }}>{lang === 'en' ? 'Continue to tutorial' : '進入教學'}</button>
          <button type="button" onClick={onExit}>{IsHubGame() ? t('training.returnLobby') : t('training.returnHome')}</button>
        </form>
      </dialog>}

      {phase !== 'menu' && rendererErrorNotice}
      {phase === 'results' && result && (<div className="experiment-container experiment-container-scrollable asteroid-shield-results-container">
          <div className="experiment-results">
            <h1>{labels.resultTitle}</h1>
            <p className="score-note">{lang === 'en' ? 'Descriptive statistics for this practice session.' : '呈現當次練習紀錄與描述統計。'}</p>
            <section className="score-priority" aria-labelledby="score-priority-title">
              <h2 id="score-priority-title">{lang === 'en' ? 'Key outcomes' : '重點指標'}</h2>
              <dl className="score-key-grid">
                <div><dt>{labels.statusScore}</dt><dd>{result.Score}</dd></div>
                <div><dt>{labels.finalHp}</dt><dd>{result.Final_HP}<small> / {result.Starting_HP}</small></dd></div>
                <div><dt>{labels.objectsBlocked}</dt><dd>{result.Objects_Blocked}<small> / {result.Objects_Spawned}</small></dd></div>
              </dl>
            </section>
            <section className="score-context" aria-labelledby="score-context-title">
              <h2 id="score-context-title">{lang === 'en' ? 'Record context' : '紀錄概況'}</h2>
              <dl>
                <div><dt>{labels.user}</dt><dd>{result.Participant_ID}</dd></div>
                <div><dt>{labels.duration}</dt><dd>{result.Total_Duration_Seconds} s</dd></div>
                <div><dt>{labels.shipHits}</dt><dd>{result.Ship_Hits}</dd></div>
                <div><dt>{labels.energyCollected}</dt><dd>{result.Energy_Collected}</dd></div>
                <div><dt>{lang === 'en' ? 'Spawned objects' : '生成物件數'}</dt><dd>{result.Objects_Spawned}</dd></div>
                <div><dt>{lang === 'en' ? 'Final speed level' : '最終速度級別'}</dt><dd>{result.Final_Speed_Level}</dd></div>
                <div><dt>{lang === 'en' ? 'Session outcome' : '活動結局'}</dt><dd>{result.Game_Result === 'Victory' ? (lang === 'en' ? 'Completed the selected duration' : '完成設定時長') : (lang === 'en' ? 'Ship durability reached zero' : '飛船耐久歸零')}</dd></div>
              </dl>
            </section>
            <ScoreAnalysis rounds={BuildGameScore(result).rounds} language={lang}/>

            <p role="status">{!IsHubGame() ? (lang === 'en' ? 'Open from Hub to save records' : '從 Hub 開啟才能保存紀錄') : saveState === 'saved' ? (lang === 'en' ? 'Record saved' : '紀錄已保存') : saveState === 'error' ? (lang === 'en' ? 'Save failed' : '保存失敗') : (lang === 'en' ? 'Saving…' : '保存中…')}</p>
            {IsHubGame() && saveState === 'error' && <button onClick={RetryGameSave}>{lang === 'en' ? 'Retry save' : '重試保存'}</button>}
            <button onClick={exitGame}>{IsHubGame() ? t('training.returnLobby') : t('training.returnHome')}</button>
          </div>
        </div>)}

    </div>);
}
function CreateEmptyMetrics(maxHp: number): SessionMetrics {
    return {
        startedAt: 0,
        elapsedMs: 0,
        lastTickAt: 0,
        spawnTimerSec: 0,
        hp: maxHp,
        maxHp,
        score: 0,
        blocked: 0,
        hits: 0,
        collected: 0,
        spawned: 0,
        nextId: 1,
        speedLevel: 1,
        lastControlSource: 'mouse',
    };
}
async function LoadAssetTextures(): Promise<AssetTextures> {
    // Image elements work under connect-src/worker-src 'none'; fetch and bitmap workers do not.
    Assets.setPreferences({ preferCreateImageBitmap: false, preferWorkers: false });
    const [background, ship, shield, normal, heavy, lethal, energy] = await Promise.all([
        Assets.load<Texture>(assetUrls.background),
        Assets.load<Texture>(assetUrls.ship),
        Assets.load<Texture>(assetUrls.shield),
        Assets.load<Texture>(assetUrls.normal),
        Assets.load<Texture>(assetUrls.heavy),
        Assets.load<Texture>(assetUrls.lethal),
        Assets.load<Texture>(assetUrls.energy),
    ]);
    return { background, ship, shield, normal, heavy, lethal, energy };
}
function ResetAsteroidScene(app: Application, sceneRef: {
    current: AsteroidScene | null;
}, textures: AssetTextures): void {
    ClearAsteroidScene(sceneRef.current);
    app.stage.removeChildren().forEach((child) => child.destroy({ children: true }));
    const background = TilingSprite.from(textures.background, {
        width: app.screen.width,
        height: app.screen.height,
        tileScale: { x: 1.35, y: 1.35 },
    });
    const objectsLayer = new Container();
    const ship = new Sprite({ texture: textures.ship, anchor: 0.5 });
    const shield = new Sprite({ texture: textures.shield, anchor: 0.5, alpha: 0.5 });
    shield.blendMode = 'add';
    app.stage.addChild(background, objectsLayer, ship, shield);
    sceneRef.current = {
        background,
        objectsLayer,
        ship,
        shield,
        textures,
        threats: [],
    };
    UpdateSceneLayout(app, sceneRef.current, defaultShieldSizePercent, 0.5);
}
function ClearAsteroidScene(scene: AsteroidScene | null): void {
    if (!scene)
        return;
    scene.threats.forEach((threat) => {
        for (const sprite of [threat.sprite, ...threat.trail]) {
            sprite.removeFromParent();
            sprite.destroy();
        }
    });
    scene.threats = [];
}
function UpdateAsteroidGame({ app, ticker, sceneRef, metricsRef, configRef, shieldPositionRef, resultRecordsRef, onSuccess, onFailure, onComplete, }: {
    app: Application;
    ticker: Ticker;
    sceneRef: {
        current: AsteroidScene | null;
    };
    metricsRef: {
        current: SessionMetrics;
    };
    configRef: {
        current: {
            difficulty: DifficultyId;
            durationSec: number;
            maxHp: number;
            shieldSizePercent: number;
            controlMode: ControlMode;
        };
    };
    shieldPositionRef: {
        current: number;
    };
    resultRecordsRef: {
        current: ThreatRecord[];
    };
    onSuccess: () => void;
    onFailure: () => void;
    onComplete: (result: GameResult) => void;
}): void {
    const scene = sceneRef.current;
    if (!scene)
        return;
    const metrics = metricsRef.current;
    const config = configRef.current;
    const dt = Math.min(ticker.deltaMS / 1000, 0.05);
    metrics.elapsedMs += dt * 1000;
    metrics.spawnTimerSec += dt;
    const layout = UpdateSceneLayout(app, scene, config.shieldSizePercent, shieldPositionRef.current);
    scene.background.tilePosition.y += dt * (10 + metrics.speedLevel * 3);
    const difficulty = difficulties.find((item) => item.id === config.difficulty) ?? difficulties[0];
    const activeInterval = Math.max(0.46, difficulty.spawnIntervalSec - (metrics.speedLevel - 1) * 0.045);
    if (metrics.spawnTimerSec >= activeInterval && scene.threats.length < difficulty.maxThreats) {
        metrics.spawnTimerSec = 0;
        SpawnThreat(scene, app.screen.width, app.screen.height, difficulty, metrics);
    }
    for (const threat of [...scene.threats]) {
        const previousY = threat.y;
        threat.x += threat.vx * dt;
        threat.y += threat.vy * dt;
        threat.sprite.x = threat.x;
        threat.sprite.y = threat.y;
        const animationPhase = (metrics.elapsedMs - threat.spawnedAtMs) / 1000 * 8 + threat.id;
        const pulse = Math.sin(animationPhase);
        threat.sprite.width = threat.size * (1 + pulse * 0.08);
        threat.sprite.height = threat.size * (1 - pulse * 0.04);
        threat.sprite.alpha = 0.9 + pulse * 0.1;
        threat.sprite.rotation += threat.rotationSpeed * dt;
        for (const [index, sprite] of threat.trail.entries()) {
            sprite.x = threat.x;
            sprite.y = threat.y - threat.vy * (index + 1) * 0.045;
            sprite.width = threat.sprite.width * (1 - (index + 1) * 0.12);
            sprite.height = threat.sprite.height;
            sprite.rotation = threat.sprite.rotation;
            sprite.alpha = (0.22 - index * 0.06) * (0.8 + pulse * 0.2);
        }
        const touchesShield = IntersectsFallingThreat(threat, previousY, layout.shieldX, layout.shieldY, layout.shieldWidth, layout.shieldHeight);
        const touchesShip = IntersectsFallingThreat(threat, previousY, layout.shipX, layout.shipY, layout.shipWidth, layout.shipHeight);
        if (threat.kind === 'energy' && touchesShield) {
            metrics.collected += 1;
            metrics.score += threat.score;
            metrics.hp = Math.min(metrics.maxHp, metrics.hp + 2);
            RecordThreatOutcome(threat, 'collected', metrics, resultRecordsRef.current, 0);
            RemoveThreat(scene, threat);
            onSuccess();
            continue;
        }
        if (threat.kind !== 'energy' && touchesShield) {
            metrics.blocked += 1;
            metrics.score += threat.score;
            metrics.speedLevel = 1 + Math.floor(metrics.blocked / speedLevelStep);
            RecordThreatOutcome(threat, 'shielded', metrics, resultRecordsRef.current, 0);
            RemoveThreat(scene, threat);
            onSuccess();
            continue;
        }
        if (touchesShip) {
            const damage = threat.kind === 'energy' ? 0 : threat.damage;
            if (threat.kind === 'energy') {
                metrics.collected += 1;
                metrics.score += threat.score;
                metrics.hp = Math.min(metrics.maxHp, metrics.hp + 2);
                RecordThreatOutcome(threat, 'collected', metrics, resultRecordsRef.current, 0);
                onSuccess();
            }
            else {
                metrics.hits += 1;
                metrics.hp = threat.kind === 'lethal' ? 0 : Math.max(0, metrics.hp - damage);
                RecordThreatOutcome(threat, 'hit', metrics, resultRecordsRef.current, damage);
                onFailure();
            }
            RemoveThreat(scene, threat);
            continue;
        }
        if (threat.y > app.screen.height + threat.radius * 2) {
            RecordThreatOutcome(threat, 'missed', metrics, resultRecordsRef.current, 0);
            RemoveThreat(scene, threat);
        }
    }
    const elapsedSec = metrics.elapsedMs / 1000;
    if (metrics.hp <= 0) {
        onComplete('Defeat');
    }
    else if (elapsedSec >= config.durationSec) {
        onComplete('Victory');
    }
}
function UpdateSceneLayout(app: Application, scene: AsteroidScene, shieldSizePercent: number, shieldPosition: number): ShieldLayout {
    const layout = GetShieldLayout(app.screen.width, app.screen.height, shieldSizePercent, shieldPosition);
    scene.background.width = app.screen.width;
    scene.background.height = app.screen.height;
    scene.ship.width = layout.shipWidth;
    scene.ship.height = layout.shipHeight;
    scene.ship.x = layout.shipX;
    scene.ship.y = layout.shipY;
    scene.ship.rotation = 0;
    scene.shield.width = layout.shieldWidth;
    scene.shield.height = layout.shieldHeight;
    scene.shield.alpha = 0.82;
    scene.shield.x = layout.shieldX;
    scene.shield.y = layout.shieldY;
    scene.shield.rotation = 0;
    return layout;
}
function GetShieldLayout(width: number, height: number, shieldSizePercent: number, shieldPosition: number): ShieldLayout {
    const minSide = Math.min(width, height);
    const shipWidth = width * 0.82;
    const shipHeight = Math.min(shipWidth * (164 / 512), height * 0.22);
    const shipX = width * 0.5;
    const shipY = height - Math.min(20, height * 0.03) - shipHeight / 2;
    const shieldWidth = Math.min(width * 0.6, Math.max(100, minSide * 0.4 * (shieldSizePercent / 100)));
    const shieldHeight = shieldWidth * 0.28;
    return {
        shipX,
        shipY,
        shipWidth,
        shipHeight,
        shieldX: Clamp(width * shieldPosition, shieldWidth / 2, width - shieldWidth / 2),
        shieldY: shipY - shipHeight / 2 - shieldHeight / 2 - Math.max(12, minSide * 0.025),
        shieldWidth,
        shieldHeight,
    };
}
function IntersectsFallingThreat(threat: Threat, previousY: number, x: number, y: number, width: number, height: number): boolean {
    // Test the swept vertical path so fast objects cannot pass through the defense between frames.
    return Math.abs(threat.x - x) <= width / 2 + threat.radius
        && previousY - threat.radius <= y + height / 2
        && threat.y + threat.radius >= y - height / 2;
}
function SpawnThreat(scene: AsteroidScene, width: number, height: number, difficulty: DifficultyDefinition, metrics: SessionMetrics): void {
    const kind = ChooseThreatKind(difficulty);
    const texture = GetThreatTexture(scene, kind);
    const size = GetThreatSize(kind, width, height);
    const sprite = new Sprite({ texture, anchor: 0.5, width: size, height: size });
    sprite.tint = GetThreatTint(kind);
    sprite.alpha = 1;
    const spawnPoint = RandomSpawnPoint(width, height, size * 0.5);
    const speed = difficulty.baseSpeed * RandomBetween(0.55, 1.8) + (metrics.speedLevel - 1) * 18;
    const trail = Array.from({ length: 3 }, () => new Sprite({ texture, anchor: 0.5, alpha: 0 }));
    const threat: Threat = {
        id: metrics.nextId++,
        kind,
        sprite,
        trail,
        size,
        x: spawnPoint.x,
        y: spawnPoint.y,
        vx: 0,
        vy: speed,
        radius: size * 0.42,
        damage: kind === 'normal' ? 1 : kind === 'heavy' ? 3 : kind === 'lethal' ? metrics.maxHp : 0,
        score: kind === 'normal' ? 10 : kind === 'heavy' ? 25 : kind === 'lethal' ? 55 : 8,
        spawnedAtMs: metrics.elapsedMs,
        rotationSpeed: kind === 'normal' ? 0 : RandomBetween(0.7, 1.8),
        resultIndex: metrics.spawned,
    };
    sprite.x = threat.x;
    sprite.y = threat.y;
    scene.objectsLayer.addChild(...trail, sprite);
    scene.threats.push(threat);
    metrics.spawned += 1;
}
function GetThreatTexture(scene: AsteroidScene, kind: ThreatKind): Texture {
    if (kind === 'normal')
        return scene.textures.normal;
    if (kind === 'heavy')
        return scene.textures.heavy;
    if (kind === 'lethal')
        return scene.textures.lethal;
    return scene.textures.energy;
}
function ChooseThreatKind(difficulty: DifficultyDefinition): ThreatKind {
    const roll = Math.random();
    if (roll < difficulty.energyChance)
        return 'energy';
    if (roll < difficulty.energyChance + difficulty.lethalChance)
        return 'lethal';
    if (roll < difficulty.energyChance + difficulty.lethalChance + difficulty.heavyChance)
        return 'heavy';
    return 'normal';
}
function GetThreatSize(kind: ThreatKind, width: number, height: number): number {
    const base = Clamp(Math.min(width, height) * 0.065, 42, 74);
    if (kind === 'energy')
        return base * 0.72;
    if (kind === 'heavy')
        return base * 1.1;
    if (kind === 'lethal')
        return base * 1.24;
    return base;
}
function GetThreatTint(kind: ThreatKind): number {
    return 0xffffff;
}
function RandomSpawnPoint(width: number, height: number, radius = 30): {
    x: number;
    y: number;
} {
    return {
        x: RandomBetween(radius + 20, width - radius - 20),
        y: -radius - 15,
    };
}
function RecordThreatOutcome(threat: Threat, outcome: ThreatOutcome, metrics: SessionMetrics, records: ThreatRecord[], damage: number): void {
    if (records.some((record) => record.Object_Number === threat.resultIndex + 1))
        return;
    const responseTime = metrics.elapsedMs >= threat.spawnedAtMs
        ? Number(((metrics.elapsedMs - threat.spawnedAtMs) / 1000).toFixed(2))
        : null;
    records.push({
        Object_Number: threat.resultIndex + 1,
        Type: threat.kind,
        Outcome: outcome,
        Spawn_Time_Seconds: Number((threat.spawnedAtMs / 1000).toFixed(2)),
        Response_Time_Seconds: responseTime,
        Damage: damage,
        HP_After: metrics.hp,
        Score_After: metrics.score,
        Speed_Level: metrics.speedLevel,
        Control_Source: metrics.lastControlSource,
    });
}
function RemoveThreat(scene: AsteroidScene, threat: Threat): void {
    scene.threats = scene.threats.filter((item) => item.id !== threat.id);
    for (const sprite of [threat.sprite, ...threat.trail]) {
        sprite.removeFromParent();
        sprite.destroy();
    }
}
function RandomBetween(min: number, max: number): number {
    return min + Math.random() * (max - min);
}
function ResizePixiAppToElement(app: Application, element: HTMLElement | null): void {
    const fullscreenElement = document.fullscreenElement as HTMLElement | null;
    const rect = fullscreenElement?.getBoundingClientRect() ?? element?.getBoundingClientRect();
    const width = Math.max(1, Math.round(rect?.width || window.visualViewport?.width || window.innerWidth));
    const height = Math.max(1, Math.round(rect?.height || window.visualViewport?.height || window.innerHeight));
    app.renderer.resize(width, height);
    app.canvas.style.width = `${width}px`;
    app.canvas.style.height = `${height}px`;
}

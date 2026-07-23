import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Application,
  Assets,
  Container,
  Sprite,
  Texture,
  TilingSprite,
  type Ticker,
} from 'pixi.js';
import {
  FilesetResolver,
  HandLandmarker,
  type Category,
  type NormalizedLandmark,
} from '@mediapipe/tasks-vision';
import { initJsPsych } from 'jspsych';
import { StartTrainingButton } from '@rehab-trainer/ui/components/StartTrainingButton';
import {
  TrainingConfigNotice,
  TrainingConfigOptionGroup,
  TrainingConfigPanel,
  TrainingConfigSection,
} from '@rehab-trainer/ui/components/TrainingConfigPanel';
import { TrainingResultActions } from '@rehab-trainer/ui/components/TrainingResultActions';
import { useFullscreenTrainingRoot } from '@rehab-trainer/ui/hooks/useFullscreenTrainingRoot';
import { useTrainingAbort } from '@rehab-trainer/ui/hooks/useTrainingAbort';
import { useT } from '../../i18n';
import { InlineAlert } from '../../components/InlineAlert';
import { MediaDeviceErrorDialog } from '../../components/MediaDeviceErrorDialog';
import { DownloadCsvFile } from '../../utils/downloadFile';
import { getActiveUser } from '../../utils/settings';
import {
  PlayFailureSound,
  PlayGameEndSound,
  PlaySuccessSound,
  PrepareAudioFeedback,
} from '../../utils/soundManager';
import { SaveTrainingSessionRecord } from '../../utils/trainingRecords';
import { Clamp, csvCell, FormatTestDate, WriteJsPsychData } from './gameUtils';
import { VerifySelectedTrainingUser } from './selectedUserGuard';
import { MotorTrainingRulesPanel } from './MotorTrainingRulesPanel';

type DifficultyId = 'beginner' | 'intermediate' | 'advanced';
type GamePhase = 'menu' | 'rules' | 'initializing' | 'playing' | 'results';
type GameResult = 'Victory' | 'Defeat';
type HandChoice = 'any' | 'left' | 'right';
type ThreatKind = 'normal' | 'heavy' | 'lethal' | 'energy';
type ThreatOutcome = 'shielded' | 'hit' | 'collected' | 'missed';
type ControlSource = 'mouse' | 'keyboard' | 'hand' | 'none';

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
  shipRadius: number;
  shieldX: number;
  shieldY: number;
  shieldRadius: number;
}

interface Threat {
  id: number;
  kind: ThreatKind;
  sprite: Sprite;
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
  Hand_Control_Enabled: boolean;
  Tracking_Hand: HandChoice;
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

interface HandState {
  x: number;
  y: number;
  visible: boolean;
  lastSeenAt: number;
}

const mediapipeWasmUrl = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35/wasm';
const handModelUrl = 'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task';
const assetBaseUrl = `${import.meta.env.BASE_URL}assets/asteroid-shield/`;
const assetUrls = {
  background: `${assetBaseUrl}background.png`,
  ship: `${assetBaseUrl}ship.png`,
  shield: `${assetBaseUrl}shield.png`,
  normal: `${assetBaseUrl}asteroid-blue.png`,
  heavy: `${assetBaseUrl}asteroid-green.png`,
  lethal: `${assetBaseUrl}asteroid-dark.png`,
  energy: `${assetBaseUrl}energy-rock.png`,
} as const;

const detectionIntervalMs = 66;
const trackingGraceMs = 260;
const manualControlGraceMs = 850;
const speedLevelStep = 15;
const durationOptions = [45, 60, 90] as const;
const hpOptions = [6, 10, 14] as const;
const handChoices: readonly HandChoice[] = ['any', 'left', 'right'];
const shieldSizeOptions = [115, 135, 155] as const;
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
    configLabel: '護盾動作訓練設定',
    difficulty: '難度',
    difficultyDesc: '調整小行星出現頻率、速度與危險物比例。',
    duration: '訓練時間',
    durationDesc: '設定這次護盾防衛的總秒數。',
    hp: '飛船耐久',
    hpDesc: '飛船可承受的總傷害。暗色小行星若命中會直接結束。',
    shieldSize: '護盾大小',
    shieldSizeDesc: '較大的透明護盾更接近保護飛船的視覺，也降低攔截難度。',
    handControl: 'MediaPipe 手部控制',
    handControlDesc: '開啟後可用手掌位置控制護盾，同時保留滑鼠與方向鍵。',
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
    cameraFallback: '攝影機無法使用，已改用滑鼠與方向鍵繼續訓練。',
    cameraPreview: '即時手部攝影機預覽',
    tracking: '已追蹤手部',
    finding: '請把手放入畫面',
    unsupported: '此瀏覽器不支援攝影機存取，已改用滑鼠與方向鍵。',
    permission: '無法使用攝影機。請允許攝影機權限，或使用滑鼠與方向鍵。',
    disconnected: '攝影機已中斷，手部控制停止。仍可用滑鼠與方向鍵。',
    initialization: '手部追蹤無法啟動，已改用滑鼠與方向鍵。',
    errorTitle: '手部控制無法啟動',
    openDetails: '開啟錯誤詳情',
    statusScore: '分數',
    resultTitle: '護盾防衛訓練完成',
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
    configLabel: 'Shield Motor Training Settings',
    difficulty: 'Difficulty',
    difficultyDesc: 'Adjust asteroid spawn rate, speed, and high-risk object mix.',
    duration: 'Training Duration',
    durationDesc: 'Set the total seconds for this shield defense session.',
    hp: 'Ship Durability',
    hpDesc: 'Total damage the ship can take. A dark asteroid hit ends the session.',
    shieldSize: 'Shield Size',
    shieldSizeDesc: 'A larger transparent shield looks protective and lowers interception load.',
    handControl: 'MediaPipe Hand Control',
    handControlDesc: 'When enabled, palm position controls the shield while mouse and arrow keys remain active.',
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
    cameraFallback: 'Camera is unavailable. Continuing with mouse and arrow keys.',
    cameraPreview: 'Live hand camera preview',
    tracking: 'Hand tracked',
    finding: 'Place your hand in the frame',
    unsupported: 'This browser does not support camera access. Continuing with mouse and arrow keys.',
    permission: 'Camera access is unavailable. Allow camera permission or use mouse and arrow keys.',
    disconnected: 'The camera disconnected. Hand control stopped; mouse and arrow keys still work.',
    initialization: 'Hand tracking could not start. Continuing with mouse and arrow keys.',
    errorTitle: 'Unable to Start Hand Control',
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

const threatCopyKeys: Record<ThreatKind, 'normal' | 'heavy' | 'lethal' | 'energy'> = {
  normal: 'normal',
  heavy: 'heavy',
  lethal: 'lethal',
  energy: 'energy',
};

const outcomeCopyKeys: Record<ThreatOutcome, 'shielded' | 'hit' | 'collected' | 'missed'> = {
  shielded: 'shielded',
  hit: 'hit',
  collected: 'collected',
  missed: 'missed',
};

export function AsteroidShieldGame({ onExit }: AsteroidShieldGameProps) {
  const { lang, t } = useT();
  const labels = copy[lang];
  const { fullscreenRootRef, enterTrainingFullscreen } = useFullscreenTrainingRoot<HTMLDivElement>();
  const pixiHostRef = useRef<HTMLDivElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const handCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const appRef = useRef<Application | null>(null);
  const texturesRef = useRef<AssetTextures | null>(null);
  const sceneRef = useRef<AsteroidScene | null>(null);
  const handLandmarkerRef = useRef<HandLandmarker | null>(null);
  const cameraStreamRef = useRef<MediaStream | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const lastDetectionAtRef = useRef(0);
  const lastVideoTimeRef = useRef(-1);
  const lastManualControlAtRef = useRef(0);
  const shieldAngleRef = useRef(-Math.PI / 2);
  const keysRef = useRef({ up: false, down: false, left: false, right: false });
  const handRef = useRef<HandState>({ x: 0, y: 0, visible: false, lastSeenAt: 0 });
  const phaseRef = useRef<GamePhase>('menu');
  const mountedRef = useRef(true);
  const resultRecordsRef = useRef<ThreatRecord[]>([]);
  const metricsRef = useRef<SessionMetrics>(CreateEmptyMetrics(defaultHp));
  const configRef = useRef({
    difficulty: 'beginner' as DifficultyId,
    durationSec: defaultDurationSeconds,
    maxHp: defaultHp,
    shieldSizePercent: defaultShieldSizePercent,
    handControlEnabled: true,
    handChoice: 'any' as HandChoice,
  });
  const jsPsychRef = useRef<ReturnType<typeof initJsPsych> | null>(null);

  const [phase, setPhaseState] = useState<GamePhase>('menu');
  const [difficulty, setDifficulty] = useState<DifficultyId>('beginner');
  const [durationSec, setDurationSec] = useState(defaultDurationSeconds);
  const [maxHp, setMaxHp] = useState(defaultHp);
  const [shieldSizePercent, setShieldSizePercent] = useState(defaultShieldSizePercent);
  const [handControlEnabled, setHandControlEnabled] = useState(true);
  const [handChoice, setHandChoice] = useState<HandChoice>('any');
  const [statusMessage, setStatusMessage] = useState('');
  const [visionError, setVisionError] = useState('');
  const [showVisionError, setShowVisionError] = useState(false);
  const [isHandTrackingActive, setIsHandTrackingActive] = useState(false);
  const [result, setResult] = useState<SessionRecord | null>(null);

  const summaryItems = useMemo(() => [
    { label: labels.difficulty, value: labels[difficulty] },
    { label: labels.duration, value: `${durationSec}s` },
    { label: labels.hp, value: maxHp },
    { label: labels.shieldSize, value: `${shieldSizePercent}%` },
    { label: labels.handControl, value: handControlEnabled ? t('common.on') : t('common.off') },
    { label: labels.hand, value: FormatHandChoice(handChoice, labels) },
  ], [difficulty, durationSec, handChoice, handControlEnabled, labels, maxHp, shieldSizePercent, t]);

  const setPhase = useCallback((nextPhase: GamePhase) => {
    phaseRef.current = nextPhase;
    setPhaseState(nextPhase);
  }, []);

  useEffect(() => {
    configRef.current = {
      difficulty,
      durationSec,
      maxHp,
      shieldSizePercent,
      handControlEnabled,
      handChoice,
    };
  }, [difficulty, durationSec, handChoice, handControlEnabled, maxHp, shieldSizePercent]);

  useEffect(() => {
    jsPsychRef.current = initJsPsych();
  }, []);

  const stopVision = useCallback(() => {
    if (animationFrameRef.current !== null) {
      window.cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    cameraStreamRef.current?.getTracks().forEach((track) => track.stop());
    cameraStreamRef.current = null;
    const video = videoRef.current;
    if (video) video.srcObject = null;
    handLandmarkerRef.current?.close();
    handLandmarkerRef.current = null;
    if (mountedRef.current) setIsHandTrackingActive(false);
    const canvas = handCanvasRef.current;
    canvas?.getContext('2d')?.clearRect(0, 0, canvas.width, canvas.height);
    handRef.current = { x: 0, y: 0, visible: false, lastSeenAt: 0 };
  }, []);

  useEffect(() => () => {
    mountedRef.current = false;
    stopVision();
  }, [stopVision]);

  const finishGame = useCallback((gameResult: GameResult) => {
    if (!mountedRef.current || phaseRef.current === 'results' || phaseRef.current === 'menu') return;
    const metrics = metricsRef.current;
    const config = configRef.current;
    const participantId = getActiveUser() || 'Unknown';
    const totalDuration = Number((metrics.elapsedMs / 1000).toFixed(1));
    const record: SessionRecord = {
      Test_Date: FormatTestDate(new Date()),
      Participant_ID: participantId,
      Difficulty: config.difficulty,
      Duration_Seconds: config.durationSec,
      Starting_HP: config.maxHp,
      Shield_Size_Percent: config.shieldSizePercent,
      Hand_Control_Enabled: config.handControlEnabled,
      Tracking_Hand: config.handChoice,
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

    sceneRef.current?.threats.forEach((threat) => threat.sprite.destroy());
    if (sceneRef.current) sceneRef.current.threats = [];
    PlayGameEndSound(gameResult, jsPsychRef);
    setResult(record);
    setPhase('results');
    stopVision();
    void SaveTrainingSessionRecord({
      userName: participantId,
      moduleId: 'upper-limb-training',
      gameId: 'asteroid-shield',
      gameTitle: labels.title,
      difficulty: config.difficulty,
      trainingDate: record.Test_Date,
      details: {
        Duration_Seconds: record.Duration_Seconds,
        Starting_HP: record.Starting_HP,
        Shield_Size_Percent: record.Shield_Size_Percent,
        Hand_Control_Enabled: record.Hand_Control_Enabled,
        Tracking_Hand: record.Tracking_Hand,
        Total_Duration_Seconds: record.Total_Duration_Seconds,
        Final_HP: record.Final_HP,
        Score: record.Score,
        Objects_Spawned: record.Objects_Spawned,
        Objects_Blocked: record.Objects_Blocked,
        Ship_Hits: record.Ship_Hits,
        Energy_Collected: record.Energy_Collected,
        Final_Speed_Level: record.Final_Speed_Level,
        Game_Result: record.Game_Result,
      },
      detailRows: record.Object_Records.map((item) => ({ ...item })),
    });
    WriteJsPsychData(
      jsPsychRef,
      record as unknown as Record<string, unknown>,
      'Unable to write asteroid shield result to jsPsych data.',
    );
  }, [labels.title, setPhase, stopVision]);

  const beginPlaying = useCallback(() => {
    const app = appRef.current;
    const textures = texturesRef.current;
    if (!app || !textures) return;
    ResizePixiAppToElement(app, pixiHostRef.current);
    ResetAsteroidScene(app, sceneRef, textures);
    const config = configRef.current;
    metricsRef.current = {
      ...CreateEmptyMetrics(config.maxHp),
      startedAt: performance.now(),
      lastTickAt: performance.now(),
    };
    resultRecordsRef.current = [];
    shieldAngleRef.current = -Math.PI / 2;
    setResult(null);
    setPhase('playing');
  }, [setPhase]);

  const handleHandFrame = useCallback((now: number) => {
    animationFrameRef.current = window.requestAnimationFrame(handleHandFrame);
    if (phaseRef.current !== 'playing') return;
    const video = videoRef.current;
    const landmarker = handLandmarkerRef.current;
    const host = pixiHostRef.current;
    const rect = host?.getBoundingClientRect();
    if (!video || !landmarker || !rect || video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) return;
    if (now - lastDetectionAtRef.current < detectionIntervalMs) return;
    if (video.currentTime === lastVideoTimeRef.current) return;

    lastVideoTimeRef.current = video.currentTime;
    lastDetectionAtRef.current = now;
    try {
      const detection = landmarker.detectForVideo(video, now);
      const selection = SelectHand(detection.landmarks, detection.handedness ?? detection.handednesses, configRef.current.handChoice);
      DrawHandLandmarks(handCanvasRef.current, video, selection?.landmarks);
      if (selection) {
        const point = GetHandCursorPoint(selection.landmarks, rect.width, rect.height);
        handRef.current = { x: point.x, y: point.y, visible: true, lastSeenAt: now };
        if (now - lastManualControlAtRef.current > manualControlGraceMs) {
          const layout = GetShieldLayout(rect.width, rect.height, configRef.current.shieldSizePercent, shieldAngleRef.current);
          shieldAngleRef.current = Math.atan2(point.y - layout.shipY, point.x - layout.shipX);
          metricsRef.current.lastControlSource = 'hand';
        }
      } else if (now - handRef.current.lastSeenAt > trackingGraceMs) {
        handRef.current = { ...handRef.current, visible: false };
      }
    } catch (error) {
      console.warn('Hand detection failed for asteroid shield.', error);
      setVisionError(labels.initialization);
      setShowVisionError(true);
      stopVision();
    }
  }, [labels.initialization, stopVision]);

  const startGame = useCallback(async () => {
    if (!VerifySelectedTrainingUser()) return;
    const fullscreenPromise = enterTrainingFullscreen();
    PrepareAudioFeedback(jsPsychRef);
    await fullscreenPromise;
    stopVision();
    setVisionError('');
    setShowVisionError(false);

    if (!texturesRef.current) {
      const app = appRef.current;
      if (!app) return;
      setStatusMessage(labels.initialization);
      setPhase('initializing');
      try {
        const textures = await LoadAssetTextures();
        if (!mountedRef.current) return;
        texturesRef.current = textures;
        ResetAsteroidScene(app, sceneRef, textures);
      } catch (error) {
        console.warn('Unable to load asteroid shield assets.', error);
        setVisionError(labels.initialization);
        setShowVisionError(true);
        setPhase('menu');
        return;
      }
    }

    if (!configRef.current.handControlEnabled) {
      beginPlaying();
      return;
    }

    if (!navigator.mediaDevices?.getUserMedia) {
      setVisionError(labels.unsupported);
      setShowVisionError(true);
      beginPlaying();
      return;
    }

    setStatusMessage(labels.loadingCamera);
    setPhase('initializing');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          facingMode: 'user',
          width: { ideal: 960 },
          height: { ideal: 720 },
        },
      });
      cameraStreamRef.current = stream;
      const cameraTrack = stream.getVideoTracks()[0];
      if (!cameraTrack) throw new Error('Camera track is unavailable.');
      cameraTrack.addEventListener('ended', () => {
        if (!mountedRef.current || cameraStreamRef.current !== stream) return;
        setVisionError(labels.disconnected);
        setShowVisionError(true);
        stopVision();
      }, { once: true });

      const video = videoRef.current;
      if (!video) throw new Error('Camera preview is unavailable.');
      video.srcObject = stream;
      await video.play();

      setStatusMessage(labels.loadingModel);
      const vision = await FilesetResolver.forVisionTasks(mediapipeWasmUrl);
      const landmarker = await HandLandmarker.createFromOptions(vision, {
        baseOptions: { modelAssetPath: handModelUrl },
        runningMode: 'VIDEO',
        numHands: configRef.current.handChoice === 'any' ? 1 : 2,
        minHandDetectionConfidence: 0.5,
        minHandPresenceConfidence: 0.5,
        minTrackingConfidence: 0.5,
      });
      if (!mountedRef.current) {
        landmarker.close();
        return;
      }
      handLandmarkerRef.current = landmarker;
      setIsHandTrackingActive(true);
      beginPlaying();
      animationFrameRef.current = window.requestAnimationFrame(handleHandFrame);
    } catch (error) {
      console.warn('Unable to initialize asteroid shield hand control.', error);
      setVisionError(error instanceof DOMException && error.name === 'NotAllowedError'
        ? labels.permission
        : labels.initialization);
      setShowVisionError(true);
      stopVision();
      beginPlaying();
    }
  }, [beginPlaying, enterTrainingFullscreen, handleHandFrame, labels, setPhase, stopVision]);

  const returnToMenu = useCallback(() => {
    stopVision();
    ClearAsteroidScene(sceneRef.current);
    metricsRef.current = CreateEmptyMetrics(configRef.current.maxHp);
    resultRecordsRef.current = [];
    setResult(null);
    setPhase('menu');
  }, [setPhase, stopVision]);

  const exitGame = useCallback(() => {
    stopVision();
    onExit();
  }, [onExit, stopVision]);

  const downloadResult = useCallback(() => {
    if (!result) return;
    DownloadCsvFile(BuildAsteroidShieldCsv(result), `asteroid_shield_${result.Test_Date}.csv`);
  }, [result]);

  useTrainingAbort({
    active: phase === 'rules' || phase === 'initializing' || phase === 'playing',
    onAbort: returnToMenu,
  });

  useEffect(() => {
    let cancelled = false;
    const app = new Application();
    const host = pixiHostRef.current;

    const initialize = async () => {
      if (!host) return;
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
      app.ticker.add((ticker: Ticker) => {
        if (phaseRef.current !== 'playing') return;
        UpdateAsteroidGame({
          app,
          ticker,
          sceneRef,
          metricsRef,
          configRef,
          shieldAngleRef,
          keysRef,
          resultRecordsRef,
          onSuccess: () => PlaySuccessSound(jsPsychRef),
          onFailure: () => PlayFailureSound(jsPsychRef),
          onComplete: finishGame,
        });
      });
    };

    void initialize();

    const onResize = () => {
      const currentApp = appRef.current;
      const scene = sceneRef.current;
      if (!currentApp || !scene) return;
      ResizePixiAppToElement(currentApp, host);
      UpdateSceneLayout(currentApp, scene, configRef.current.shieldSizePercent, shieldAngleRef.current);
    };
    const resizeObserver = host && typeof ResizeObserver !== 'undefined'
      ? new ResizeObserver(onResize)
      : null;

    window.addEventListener('resize', onResize);
    window.visualViewport?.addEventListener('resize', onResize);
    document.addEventListener('fullscreenchange', onResize);
    if (resizeObserver && host) resizeObserver.observe(host);
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
    if (!host) return;
    const updateFromPointer = (event: PointerEvent) => {
      if (phaseRef.current !== 'playing') return;
      const rect = host.getBoundingClientRect();
      const layout = GetShieldLayout(rect.width, rect.height, configRef.current.shieldSizePercent, shieldAngleRef.current);
      shieldAngleRef.current = Math.atan2(event.clientY - rect.top - layout.shipY, event.clientX - rect.left - layout.shipX);
      lastManualControlAtRef.current = performance.now();
      metricsRef.current.lastControlSource = 'mouse';
    };
    host.addEventListener('pointerdown', updateFromPointer);
    host.addEventListener('pointermove', updateFromPointer);
    return () => {
      host.removeEventListener('pointerdown', updateFromPointer);
      host.removeEventListener('pointermove', updateFromPointer);
    };
  }, []);

  useEffect(() => {
    const setKey = (key: string, pressed: boolean) => {
      if (key === 'ArrowUp') keysRef.current.up = pressed;
      else if (key === 'ArrowDown') keysRef.current.down = pressed;
      else if (key === 'ArrowLeft') keysRef.current.left = pressed;
      else if (key === 'ArrowRight') keysRef.current.right = pressed;
      else return false;
      return true;
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (!setKey(event.key, true)) return;
      if (phaseRef.current === 'playing') event.preventDefault();
      lastManualControlAtRef.current = performance.now();
      metricsRef.current.lastControlSource = 'keyboard';
    };
    const onKeyUp = (event: KeyboardEvent) => {
      if (!setKey(event.key, false)) return;
      if (phaseRef.current === 'playing') event.preventDefault();
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, []);

  const latestRows = result?.Object_Records.slice(-10) ?? [];

  return (
    <div ref={fullscreenRootRef} className={`asteroid-shield-game asteroid-shield-phase-${phase}`}>
      <div ref={pixiHostRef} className="asteroid-shield-stage" />

      <div className={`asteroid-shield-camera ${phase === 'playing' && isHandTrackingActive ? '' : 'asteroid-shield-camera-hidden'}`}>
        <video ref={videoRef} muted playsInline aria-label={labels.cameraPreview} />
        <canvas ref={handCanvasRef} aria-hidden="true" />
        <span>{handRef.current.visible ? labels.tracking : labels.finding}</span>
      </div>

      {phase === 'menu' && (
        <div className="training-panel">
          <TrainingConfigPanel
            label={labels.configLabel}
            title={labels.title}
            summaryTitle={labels.title}
            summaryItems={summaryItems}
            actions={(
              <>
                {visionError && (
                  <InlineAlert
                    tone="warning"
                    className="training-start-alert"
                    onClick={() => setShowVisionError(true)}
                    aria-label={labels.openDetails}
                  >
                    {visionError}
                  </InlineAlert>
                )}
                <StartTrainingButton onClick={() => setPhase('rules')}>
                  {t('training.rules')}
                </StartTrainingButton>
                <button className="btn btn-ghost btn-lg" type="button" onClick={exitGame}>
                  {t('training.cancel')}
                </button>
              </>
            )}
          >
            <TrainingConfigSection
              title={labels.difficulty}
              description={labels.difficultyDesc}
              value={labels[difficulty]}
            >
              <TrainingConfigOptionGroup columns={3}>
                {difficulties.map((item) => (
                  <button
                    className={`training-option ${difficulty === item.id ? 'active' : ''}`}
                    key={item.id}
                    type="button"
                    onClick={() => setDifficulty(item.id)}
                  >
                    <span className="training-option-title">{labels[item.id]}</span>
                    <span className="training-option-meta">{Math.round(item.baseSpeed)} px/s</span>
                  </button>
                ))}
              </TrainingConfigOptionGroup>
            </TrainingConfigSection>

            <TrainingConfigSection
              title={labels.duration}
              description={labels.durationDesc}
              value={`${durationSec}s`}
            >
              <TrainingConfigOptionGroup columns={3}>
                {durationOptions.map((value) => (
                  <button
                    className={`training-option ${durationSec === value ? 'active' : ''}`}
                    key={value}
                    type="button"
                    onClick={() => setDurationSec(value)}
                  >
                    <span className="training-option-title">{value}s</span>
                  </button>
                ))}
              </TrainingConfigOptionGroup>
            </TrainingConfigSection>

            <TrainingConfigSection title={labels.hp} description={labels.hpDesc} value={maxHp}>
              <TrainingConfigOptionGroup columns={3}>
                {hpOptions.map((value) => (
                  <button
                    className={`training-option ${maxHp === value ? 'active' : ''}`}
                    key={value}
                    type="button"
                    onClick={() => setMaxHp(value)}
                  >
                    <span className="training-option-title">{value}</span>
                  </button>
                ))}
              </TrainingConfigOptionGroup>
            </TrainingConfigSection>

            <TrainingConfigSection
              title={labels.shieldSize}
              description={labels.shieldSizeDesc}
              value={`${shieldSizePercent}%`}
            >
              <TrainingConfigOptionGroup columns={3}>
                {shieldSizeOptions.map((value) => (
                  <button
                    className={`training-option ${shieldSizePercent === value ? 'active' : ''}`}
                    key={value}
                    type="button"
                    onClick={() => setShieldSizePercent(value)}
                  >
                    <span className="training-option-title">{value}%</span>
                  </button>
                ))}
              </TrainingConfigOptionGroup>
            </TrainingConfigSection>

            <TrainingConfigSection
              title={labels.handControl}
              description={labels.handControlDesc}
              value={handControlEnabled ? t('common.on') : t('common.off')}
            >
              <TrainingConfigOptionGroup columns={2}>
                <button
                  className={`training-option ${handControlEnabled ? 'active' : ''}`}
                  type="button"
                  onClick={() => setHandControlEnabled(true)}
                >
                  <span className="training-option-title">{t('common.on')}</span>
                </button>
                <button
                  className={`training-option asteroid-shield-hand-control-off ${!handControlEnabled ? 'active' : ''}`}
                  type="button"
                  onClick={() => setHandControlEnabled(false)}
                >
                  <span className="training-option-title">{t('common.off')}</span>
                </button>
              </TrainingConfigOptionGroup>
            </TrainingConfigSection>

            <TrainingConfigSection
              title={labels.hand}
              description={labels.handDesc}
              value={FormatHandChoice(handChoice, labels)}
            >
              <TrainingConfigOptionGroup columns={3}>
                {handChoices.map((value) => (
                  <button
                    className={`training-option ${handChoice === value ? 'active' : ''}`}
                    key={value}
                    type="button"
                    onClick={() => setHandChoice(value)}
                  >
                    <span className="training-option-title">{FormatHandChoice(value, labels)}</span>
                  </button>
                ))}
              </TrainingConfigOptionGroup>
            </TrainingConfigSection>

            <TrainingConfigNotice
              title={labels.privacyTitle}
              description={labels.privacyDesc}
            />
          </TrainingConfigPanel>
        </div>
      )}

      {phase === 'rules' && (
        <div className="training-panel">
          <MotorTrainingRulesPanel
            gameId="asteroid-shield"
            title={labels.title}
            summaryTitle={labels.title}
            summaryItems={summaryItems}
            onStart={() => void startGame()}
            onBack={() => setPhase('menu')}
          />
        </div>
      )}

      {phase === 'initializing' && (
        <div className="asteroid-shield-loading-overlay">
          <div className="gesture-loading-card">
            <div className="gesture-loader" />
            <h1>{labels.loadingTitle}</h1>
            <p>{statusMessage}</p>
          </div>
        </div>
      )}

      {phase === 'results' && result && (
        <div className="experiment-container experiment-container-scrollable asteroid-shield-results-container">
          <div className="experiment-results">
            <h1>{labels.resultTitle}</h1>
            <div className="training-result-summary asteroid-shield-result-summary">
              <span>
                <small>{labels.user}</small>
                <strong>{result.Participant_ID}</strong>
              </span>
              <span>
                <small>{labels.statusScore}</small>
                <strong>{result.Score}</strong>
              </span>
              <span>
                <small>{labels.finalHp}</small>
                <strong>{result.Final_HP}/{result.Starting_HP}</strong>
              </span>
              <span>
                <small>{labels.objectsBlocked}</small>
                <strong>{result.Objects_Blocked}/{result.Objects_Spawned}</strong>
              </span>
              <span>
                <small>{labels.shipHits}</small>
                <strong>{result.Ship_Hits}</strong>
              </span>
              <span>
                <small>{labels.energyCollected}</small>
                <strong>{result.Energy_Collected}</strong>
              </span>
            </div>

            <table className="results-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>{labels.objectType}</th>
                  <th>{labels.outcome}</th>
                  <th>{labels.responseTime}</th>
                  <th>{labels.damage}</th>
                </tr>
              </thead>
              <tbody>
                {latestRows.map((item) => (
                  <tr key={`${item.Object_Number}-${item.Outcome}`}>
                    <td>{item.Object_Number}</td>
                    <td>{labels[threatCopyKeys[item.Type]]}</td>
                    <td>{labels[outcomeCopyKeys[item.Outcome]]}</td>
                    <td>{item.Response_Time_Seconds === null ? '-' : `${item.Response_Time_Seconds}s`}</td>
                    <td>{item.Damage}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <TrainingResultActions
              downloadLabel={t('training.downloadCsvRecord')}
              restartLabel={t('training.restart')}
              backLabel={t('training.returnHome')}
              onDownloadCsv={downloadResult}
              onRestart={() => setPhase('rules')}
              onBackHome={returnToMenu}
            />
          </div>
        </div>
      )}

      {showVisionError && visionError && (
        <MediaDeviceErrorDialog
          title={labels.errorTitle}
          titleId="asteroid-shield-error-modal-title"
          message={visionError}
          onClose={() => setShowVisionError(false)}
        />
      )}
    </div>
  );
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
    lastControlSource: 'none',
  };
}

async function LoadAssetTextures(): Promise<AssetTextures> {
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

function ResetAsteroidScene(
  app: Application,
  sceneRef: { current: AsteroidScene | null },
  textures: AssetTextures,
): void {
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
  UpdateSceneLayout(app, sceneRef.current, defaultShieldSizePercent, -Math.PI / 2);
}

function ClearAsteroidScene(scene: AsteroidScene | null): void {
  if (!scene) return;
  scene.threats.forEach((threat) => {
    threat.sprite.removeFromParent();
    threat.sprite.destroy();
  });
  scene.threats = [];
}

function UpdateAsteroidGame({
  app,
  ticker,
  sceneRef,
  metricsRef,
  configRef,
  shieldAngleRef,
  keysRef,
  resultRecordsRef,
  onSuccess,
  onFailure,
  onComplete,
}: {
  app: Application;
  ticker: Ticker;
  sceneRef: { current: AsteroidScene | null };
  metricsRef: { current: SessionMetrics };
  configRef: {
    current: {
      difficulty: DifficultyId;
      durationSec: number;
      maxHp: number;
      shieldSizePercent: number;
      handControlEnabled: boolean;
      handChoice: HandChoice;
    };
  };
  shieldAngleRef: { current: number };
  keysRef: { current: { up: boolean; down: boolean; left: boolean; right: boolean } };
  resultRecordsRef: { current: ThreatRecord[] };
  onSuccess: () => void;
  onFailure: () => void;
  onComplete: (result: GameResult) => void;
}): void {
  const scene = sceneRef.current;
  if (!scene) return;
  const metrics = metricsRef.current;
  const config = configRef.current;
  const dt = Math.min(ticker.deltaMS / 1000, 0.05);
  metrics.elapsedMs += dt * 1000;
  metrics.spawnTimerSec += dt;
  ApplyKeyboardShieldControl(keysRef.current, shieldAngleRef, metrics);
  const layout = UpdateSceneLayout(app, scene, config.shieldSizePercent, shieldAngleRef.current);
  scene.background.tilePosition.y += dt * (10 + metrics.speedLevel * 3);

  const difficulty = difficulties.find((item) => item.id === config.difficulty) ?? difficulties[0];
  const activeInterval = Math.max(0.46, difficulty.spawnIntervalSec - (metrics.speedLevel - 1) * 0.045);
  if (metrics.spawnTimerSec >= activeInterval && scene.threats.length < difficulty.maxThreats) {
    metrics.spawnTimerSec = 0;
    SpawnThreat(scene, layout, app.screen.width, app.screen.height, difficulty, metrics);
  }

  for (const threat of [...scene.threats]) {
    threat.x += threat.vx * dt;
    threat.y += threat.vy * dt;
    if (threat.x < threat.radius || threat.x > app.screen.width - threat.radius) {
      threat.vx *= -1;
      threat.x = Clamp(threat.x, threat.radius, app.screen.width - threat.radius);
    }
    if (threat.y < threat.radius) {
      threat.vy *= -1;
      threat.y = threat.radius;
    }
    threat.sprite.x = threat.x;
    threat.sprite.y = threat.y;
    threat.sprite.rotation += threat.rotationSpeed * dt;

    const shieldDistance = Math.hypot(threat.x - layout.shieldX, threat.y - layout.shieldY);
    const shipDistance = Math.hypot(threat.x - layout.shipX, threat.y - layout.shipY);
    if (threat.kind === 'energy' && shieldDistance <= layout.shieldRadius + threat.radius) {
      metrics.collected += 1;
      metrics.score += threat.score;
      metrics.hp = Math.min(metrics.maxHp, metrics.hp + 2);
      RecordThreatOutcome(threat, 'collected', metrics, resultRecordsRef.current, 0);
      RemoveThreat(scene, threat);
      onSuccess();
      continue;
    }
    if (threat.kind !== 'energy' && shieldDistance <= layout.shieldRadius + threat.radius * 0.82) {
      metrics.blocked += 1;
      metrics.score += threat.score;
      metrics.speedLevel = 1 + Math.floor(metrics.blocked / speedLevelStep);
      RecordThreatOutcome(threat, 'shielded', metrics, resultRecordsRef.current, 0);
      RemoveThreat(scene, threat);
      onSuccess();
      continue;
    }
    if (shipDistance <= layout.shipRadius + threat.radius * 0.7) {
      const damage = threat.kind === 'energy' ? 0 : threat.damage;
      if (threat.kind === 'energy') {
        metrics.collected += 1;
        metrics.score += threat.score;
        metrics.hp = Math.min(metrics.maxHp, metrics.hp + 2);
        RecordThreatOutcome(threat, 'collected', metrics, resultRecordsRef.current, 0);
        onSuccess();
      } else {
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
  } else if (elapsedSec >= config.durationSec) {
    onComplete('Victory');
  }
}

function UpdateSceneLayout(
  app: Application,
  scene: AsteroidScene,
  shieldSizePercent: number,
  shieldAngle: number,
): ShieldLayout {
  const width = app.screen.width;
  const height = app.screen.height;
  scene.background.width = width;
  scene.background.height = height;
  const minSide = Math.min(width, height);
  const shipWidth = Clamp(minSide * 0.14, 82, 148);
  scene.ship.width = shipWidth;
  scene.ship.height = shipWidth * (scene.ship.texture.height / scene.ship.texture.width);
  scene.ship.x = width * 0.5;
  scene.ship.y = Clamp(height * 0.68, height * 0.56, height - scene.ship.height * 0.7);
  scene.ship.rotation = 0;

  const shieldDiameter = Clamp(minSide * 0.23 * (shieldSizePercent / 100), 170, 330);
  scene.shield.width = shieldDiameter;
  scene.shield.height = shieldDiameter * (scene.shield.texture.height / scene.shield.texture.width);
  scene.shield.alpha = 0.46;
  const shipRadius = Math.max(scene.ship.width, scene.ship.height) * 0.38;
  const shieldRadius = Math.max(scene.shield.width, scene.shield.height) * 0.38;
  const shieldOffset = shipRadius + shieldRadius * 0.44;
  scene.shield.x = scene.ship.x + Math.cos(shieldAngle) * shieldOffset;
  scene.shield.y = scene.ship.y + Math.sin(shieldAngle) * shieldOffset;
  scene.shield.rotation = shieldAngle + Math.PI / 2;
  return {
    shipX: scene.ship.x,
    shipY: scene.ship.y,
    shipRadius,
    shieldX: scene.shield.x,
    shieldY: scene.shield.y,
    shieldRadius,
  };
}

function GetShieldLayout(width: number, height: number, shieldSizePercent: number, shieldAngle: number): ShieldLayout {
  const minSide = Math.min(width, height);
  const shipWidth = Clamp(minSide * 0.14, 82, 148);
  const shipHeight = shipWidth * (75 / 99);
  const shipX = width * 0.5;
  const shipY = Clamp(height * 0.68, height * 0.56, height - shipHeight * 0.7);
  const shieldDiameter = Clamp(minSide * 0.23 * (shieldSizePercent / 100), 170, 330);
  const shieldRadius = shieldDiameter * 0.38;
  const shipRadius = Math.max(shipWidth, shipHeight) * 0.38;
  const shieldOffset = shipRadius + shieldRadius * 0.44;
  return {
    shipX,
    shipY,
    shipRadius,
    shieldX: shipX + Math.cos(shieldAngle) * shieldOffset,
    shieldY: shipY + Math.sin(shieldAngle) * shieldOffset,
    shieldRadius,
  };
}

function ApplyKeyboardShieldControl(
  keys: { up: boolean; down: boolean; left: boolean; right: boolean },
  shieldAngleRef: { current: number },
  metrics: SessionMetrics,
): void {
  const x = (keys.right ? 1 : 0) - (keys.left ? 1 : 0);
  const y = (keys.down ? 1 : 0) - (keys.up ? 1 : 0);
  if (x === 0 && y === 0) return;
  shieldAngleRef.current = Math.atan2(y, x);
  metrics.lastControlSource = 'keyboard';
}

function SpawnThreat(
  scene: AsteroidScene,
  layout: ShieldLayout,
  width: number,
  height: number,
  difficulty: DifficultyDefinition,
  metrics: SessionMetrics,
): void {
  const kind = ChooseThreatKind(difficulty);
  const texture = GetThreatTexture(scene, kind);
  const size = GetThreatSize(kind, width, height);
  const sprite = new Sprite({ texture, anchor: 0.5, width: size, height: size });
  sprite.tint = GetThreatTint(kind);
  sprite.alpha = kind === 'lethal' ? 0.96 : 1;
  const spawnPoint = RandomSpawnPoint(width, height);
  const aimX = layout.shipX + RandomBetween(-layout.shipRadius * 0.55, layout.shipRadius * 0.55);
  const aimY = layout.shipY + RandomBetween(-layout.shipRadius * 0.4, layout.shipRadius * 0.4);
  const direction = NormalizeVector(aimX - spawnPoint.x, aimY - spawnPoint.y);
  const speed = difficulty.baseSpeed + (metrics.speedLevel - 1) * 18 + RandomBetween(-12, 18);
  const tangent = RandomBetween(-0.18, 0.18);
  const threat: Threat = {
    id: metrics.nextId++,
    kind,
    sprite,
    x: spawnPoint.x,
    y: spawnPoint.y,
    vx: (direction.x - direction.y * tangent) * speed,
    vy: (direction.y + direction.x * tangent) * speed,
    radius: size * 0.42,
    damage: kind === 'normal' ? 1 : kind === 'heavy' ? 3 : kind === 'lethal' ? metrics.maxHp : 0,
    score: kind === 'normal' ? 10 : kind === 'heavy' ? 25 : kind === 'lethal' ? 55 : 8,
    spawnedAtMs: metrics.elapsedMs,
    rotationSpeed: RandomBetween(-2.2, 2.2),
    resultIndex: metrics.spawned,
  };
  sprite.x = threat.x;
  sprite.y = threat.y;
  scene.objectsLayer.addChild(sprite);
  scene.threats.push(threat);
  metrics.spawned += 1;
}

function GetThreatTexture(scene: AsteroidScene, kind: ThreatKind): Texture {
  if (kind === 'normal') return scene.textures.normal;
  if (kind === 'heavy') return scene.textures.heavy;
  if (kind === 'lethal') return scene.textures.lethal;
  return scene.textures.energy;
}

function ChooseThreatKind(difficulty: DifficultyDefinition): ThreatKind {
  const roll = Math.random();
  if (roll < difficulty.energyChance) return 'energy';
  if (roll < difficulty.energyChance + difficulty.lethalChance) return 'lethal';
  if (roll < difficulty.energyChance + difficulty.lethalChance + difficulty.heavyChance) return 'heavy';
  return 'normal';
}

function GetThreatSize(kind: ThreatKind, width: number, height: number): number {
  const base = Clamp(Math.min(width, height) * 0.065, 42, 74);
  if (kind === 'energy') return base * 0.72;
  if (kind === 'heavy') return base * 1.1;
  if (kind === 'lethal') return base * 1.24;
  return base;
}

function GetThreatTint(kind: ThreatKind): number {
  if (kind === 'normal') return 0x76b7ff;
  if (kind === 'heavy') return 0x63e27a;
  if (kind === 'lethal') return 0x2f3446;
  return 0xffffff;
}

function RandomSpawnPoint(width: number, height: number): { x: number; y: number } {
  const edge = Math.random();
  if (edge < 0.72) {
    return { x: RandomBetween(30, width - 30), y: -44 };
  }
  if (edge < 0.86) {
    return { x: -44, y: RandomBetween(40, height * 0.52) };
  }
  return { x: width + 44, y: RandomBetween(40, height * 0.52) };
}

function RecordThreatOutcome(
  threat: Threat,
  outcome: ThreatOutcome,
  metrics: SessionMetrics,
  records: ThreatRecord[],
  damage: number,
): void {
  if (records.some((record) => record.Object_Number === threat.resultIndex + 1)) return;
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
  threat.sprite.removeFromParent();
  threat.sprite.destroy();
}

function SelectHand(
  landmarks: NormalizedLandmark[][],
  handedness: Category[][],
  handChoice: HandChoice,
): { landmarks: NormalizedLandmark[]; handedness: HandChoice | null } | null {
  if (!landmarks.length) return null;
  if (handChoice === 'any') {
    return { landmarks: landmarks[0], handedness: ToHandChoice(handedness[0]?.[0]?.categoryName) };
  }
  const index = handedness.findIndex((categories) => ToHandChoice(categories[0]?.categoryName) === handChoice);
  if (index >= 0 && landmarks[index]) {
    return { landmarks: landmarks[index], handedness: handChoice };
  }
  return null;
}

function ToHandChoice(label: string | undefined): HandChoice | null {
  if (label === 'Left') return 'left';
  if (label === 'Right') return 'right';
  return null;
}

function GetHandCursorPoint(landmarks: NormalizedLandmark[], width: number, height: number): { x: number; y: number } {
  const points = [landmarks[0], landmarks[5], landmarks[9], landmarks[13], landmarks[17]].filter(Boolean);
  const average = points.reduce((sum, point) => ({ x: sum.x + point.x, y: sum.y + point.y }), { x: 0, y: 0 });
  return {
    x: (1 - average.x / points.length) * width,
    y: (average.y / points.length) * height,
  };
}

function DrawHandLandmarks(
  canvas: HTMLCanvasElement | null,
  video: HTMLVideoElement,
  landmarks: NormalizedLandmark[] | undefined,
) {
  if (!canvas) return;
  if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
  }
  const context = canvas.getContext('2d');
  if (!context) return;
  context.clearRect(0, 0, canvas.width, canvas.height);
  if (!landmarks) return;
  context.save();
  context.translate(canvas.width, 0);
  context.scale(-1, 1);
  context.strokeStyle = '#7dd3fc';
  context.fillStyle = '#fef08a';
  context.lineWidth = Math.max(2, canvas.width / 320);
  HandLandmarker.HAND_CONNECTIONS.forEach(({ start, end }) => {
    const from = landmarks[start];
    const to = landmarks[end];
    context.beginPath();
    context.moveTo(from.x * canvas.width, from.y * canvas.height);
    context.lineTo(to.x * canvas.width, to.y * canvas.height);
    context.stroke();
  });
  landmarks.forEach((point) => {
    context.beginPath();
    context.arc(point.x * canvas.width, point.y * canvas.height, Math.max(3, canvas.width / 180), 0, Math.PI * 2);
    context.fill();
  });
  context.restore();
}

function NormalizeVector(x: number, y: number): { x: number; y: number } {
  const length = Math.max(1e-6, Math.hypot(x, y));
  return { x: x / length, y: y / length };
}

function RandomBetween(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

function FormatHandChoice(handChoice: HandChoice, labels: (typeof copy)['zh'] | (typeof copy)['en']): string {
  if (handChoice === 'left') return labels.handLeft;
  if (handChoice === 'right') return labels.handRight;
  return labels.handAny;
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

function BuildAsteroidShieldCsv(result: SessionRecord): string {
  const rows = [
    [
      'Test_Date',
      'Participant_ID',
      'Difficulty',
      'Duration_Seconds',
      'Starting_HP',
      'Shield_Size_Percent',
      'Hand_Control_Enabled',
      'Tracking_Hand',
      'Total_Duration_Seconds',
      'Final_HP',
      'Score',
      'Objects_Spawned',
      'Objects_Blocked',
      'Ship_Hits',
      'Energy_Collected',
      'Final_Speed_Level',
      'Game_Result',
      'Object_Number',
      'Object_Type',
      'Object_Outcome',
      'Spawn_Time_Seconds',
      'Response_Time_Seconds',
      'Damage',
      'HP_After',
      'Score_After',
      'Speed_Level',
      'Control_Source',
    ],
    ...(result.Object_Records.length > 0 ? result.Object_Records : [undefined]).map((record) => [
      result.Test_Date,
      result.Participant_ID,
      result.Difficulty,
      result.Duration_Seconds,
      result.Starting_HP,
      result.Shield_Size_Percent,
      result.Hand_Control_Enabled,
      result.Tracking_Hand,
      result.Total_Duration_Seconds,
      result.Final_HP,
      result.Score,
      result.Objects_Spawned,
      result.Objects_Blocked,
      result.Ship_Hits,
      result.Energy_Collected,
      result.Final_Speed_Level,
      result.Game_Result,
      record?.Object_Number ?? '',
      record?.Type ?? '',
      record?.Outcome ?? '',
      record?.Spawn_Time_Seconds ?? '',
      record?.Response_Time_Seconds ?? '',
      record?.Damage ?? '',
      record?.HP_After ?? '',
      record?.Score_After ?? '',
      record?.Speed_Level ?? '',
      record?.Control_Source ?? '',
    ]),
  ];
  return rows.map((row) => row.map(csvCell).join(',')).join('\n');
}

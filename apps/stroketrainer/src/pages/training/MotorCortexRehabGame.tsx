import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import {
  FilesetResolver,
  HandLandmarker,
  type Category,
  type NormalizedLandmark,
} from '@mediapipe/tasks-vision';
import { initJsPsych } from 'jspsych';
import { StartTrainingButton } from '@rehab-trainer/ui/components/StartTrainingButton';
import { TrainingConfigPanel } from '@rehab-trainer/ui/components/TrainingConfigPanel';
import { TrainingResultActions } from '@rehab-trainer/ui/components/TrainingResultActions';
import { useFullscreenTrainingRoot } from '@rehab-trainer/ui/hooks/useFullscreenTrainingRoot';
import { useTrainingAbort } from '@rehab-trainer/ui/hooks/useTrainingAbort';
import { useT } from '../../i18n';
import { InlineAlert } from '../../components/InlineAlert';
import { MediaDeviceErrorDialog } from '../../components/MediaDeviceErrorDialog';
import { DownloadCsvFile } from '../../utils/downloadFile';
import { getActiveUser } from '../../utils/settings';
import { PlayGameEndSound, PlaySuccessSound, PrepareAudioFeedback } from '../../utils/soundManager';
import { SaveTrainingSessionRecord } from '../../utils/trainingRecords';
import { Clamp, csvCell, FormatTestDate, WriteJsPsychData } from './gameUtils';
import { VerifySelectedTrainingUser } from './selectedUserGuard';
import { StrokeTrainingRulesPanel } from './StrokeTrainingRulesPanel';
import { TrainingPrivacyNotice } from './TrainingPrivacyNotice';

type DrillId = 'bounce' | 'vertical' | 'horizontal' | 'random';
type DifficultyId = 'beginner' | 'intermediate' | 'advanced';
type HandChoice = 'any' | 'left' | 'right';
type GamePhase = 'menu' | 'rules' | 'initializing' | 'playing' | 'results';

interface MotorCortexRehabGameProps {
  onExit: () => void;
}

interface DrillDefinition {
  id: DrillId;
  referenceName: string;
  accent: string;
}

interface DifficultyDefinition {
  id: DifficultyId;
  radius: number;
  speed: number;
  holdMs: number;
}

interface TargetState {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  level: number;
  holdTargetMs: number;
}

interface HandState {
  x: number;
  y: number;
  visible: boolean;
  handedness: HandChoice | null;
  lastSeenAt: number;
}

interface SessionMetrics {
  startedAt: number;
  lastTickAt: number;
  handVisibleMs: number;
  inTargetMs: number;
  successes: number;
  misses: number;
  currentHoldMs: number;
  bestHoldMs: number;
  streak: number;
  events: DrillEventRecord[];
}

interface DrillEventRecord {
  Event_Number: number;
  Drill: string;
  Result: 'success' | 'interrupted';
  Time_Seconds: number;
  Hold_Seconds: number;
  Accuracy_Percent: number;
  Target_Size_Px: number;
  Adaptive_Level: number;
}

interface SessionRecord {
  Test_Date: string;
  Participant_ID: string;
  Drill: string;
  Reference_Module: string;
  Difficulty: DifficultyId;
  Duration_Seconds: number;
  Tracking_Hand: HandChoice;
  Target_Size_Scale: number;
  Speed_Scale: number;
  Adaptive_Level: number;
  Accuracy_Percent: number;
  Hand_Visible_Percent: number;
  Successful_Reps: number;
  Interrupted_Holds: number;
  Best_Hold_Seconds: number;
  Event_Records: DrillEventRecord[];
}

interface LiveState {
  timeRemaining: number;
  accuracy: number;
  visibility: number;
  successes: number;
  misses: number;
  currentHoldPercent: number;
  level: number;
  targetX: number;
  targetY: number;
  targetRadius: number;
  handX: number;
  handY: number;
  handVisible: boolean;
  insideTarget: boolean;
}

const mediapipeWasmUrl = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35/wasm';
const handModelUrl = 'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task';
const detectionIntervalMs = 66;
const trackingGraceMs = 240;
const liveStateIntervalMs = 45;
const handCursorRadius = 18;

const drills: readonly DrillDefinition[] = [
  { id: 'bounce', referenceName: 'Therapy Module 1', accent: '#2f855a' },
  { id: 'vertical', referenceName: 'Therapy Module 2', accent: '#0f766e' },
  { id: 'horizontal', referenceName: 'Therapy Module 3', accent: '#b45309' },
  { id: 'random', referenceName: 'Therapy Module 4', accent: '#be123c' },
];

const difficulties: readonly DifficultyDefinition[] = [
  { id: 'beginner', radius: 82, speed: 120, holdMs: 560 },
  { id: 'intermediate', radius: 66, speed: 165, holdMs: 760 },
  { id: 'advanced', radius: 54, speed: 220, holdMs: 980 },
];

const durationOptions = [45, 60, 90] as const;

const copy = {
  zh: {
    title: '動作皮質復健訓練',
    configLabel: '攝影機動作訓練設定',
    drill: '訓練模組',
    drillDesc: '選擇這次要練習的手部追蹤任務。',
    difficulty: '自適應起始難度',
    difficultyDesc: '系統會依命中表現逐步調整速度與目標大小。',
    duration: '訓練時間',
    durationDesc: '設定本次訓練總秒數。',
    hand: '追蹤手',
    handDesc: '可指定左手、右手，或接受畫面中第一隻手。',
    targetSize: '目標大小',
    targetSizeDesc: '放大目標可降低初期負荷。',
    speed: '移動速度',
    speedDesc: '提高速度可增加追蹤與反應需求。',
    privacyTitle: '攝影機畫面只在此裝置分析',
    privacyDesc: '系統不錄影、不上傳畫面；只保存訓練設定與統計結果。',
    loadingTitle: '正在準備手部追蹤',
    loadingCamera: '正在啟動攝影機，請允許瀏覽器使用鏡頭。',
    loadingModel: '正在載入 MediaPipe 手部模型。',
    unsupported: '此瀏覽器不支援攝影機存取，請使用新版 Chrome、Edge 或 Safari。',
    permission: '無法使用攝影機。請允許攝影機權限後再試一次。',
    disconnected: '攝影機已中斷，請確認鏡頭連線後重新開始訓練。',
    initialization: '手部追蹤無法啟動，請確認網路連線後再試一次。',
    errorTitle: '無法開始動作皮質復健訓練',
    openDetails: '開啟錯誤細節',
    cameraPreview: '即時手部攝影機預覽',
    tracking: '已追蹤手部',
    finding: '請把手放入畫面',
    followTarget: '讓手部游標停在目標內',
    target: '目標',
    handCursor: '手部位置',
    timeLeft: '剩餘時間',
    accuracy: '命中率',
    visible: '可追蹤率',
    reps: '完成次數',
    level: '自適應等級',
    hold: '維持',
    resultsTitle: '動作皮質復健訓練完成',
    participant: '訓練使用者',
    interrupted: '中斷維持',
    bestHold: '最佳維持',
    event: '事件',
    result: '結果',
    time: '時間',
    size: '目標大小',
    handAny: '任一手',
    handLeft: '左手',
    handRight: '右手',
    drillNames: {
      bounce: '彈跳球追蹤',
      vertical: '垂直活動範圍',
      horizontal: '水平活動範圍',
      random: '隨機觸達',
    },
    drillDescriptions: {
      bounce: '追蹤在畫面中反彈的球，訓練連續手眼協調。',
      vertical: '沿垂直路徑上下追蹤目標，練習肩肘控制與垂直活動範圍。',
      horizontal: '沿水平路徑左右追蹤目標，練習跨中線與側向控制。',
      random: '快速移到隨機位置並維持，訓練觸達、停止與穩定控制。',
    },
    difficultyNames: {
      beginner: '初階',
      intermediate: '中階',
      advanced: '進階',
    },
    success: '成功',
    interruptedLabel: '中斷',
  },
  en: {
    title: 'Motor Cortex Rehab',
    configLabel: 'Camera Motor Training Settings',
    drill: 'Training Module',
    drillDesc: 'Choose the hand-tracking task for this session.',
    difficulty: 'Adaptive Start Level',
    difficultyDesc: 'The system adjusts speed and target size based on hit quality.',
    duration: 'Training Duration',
    durationDesc: 'Set the total seconds for this session.',
    hand: 'Tracking Hand',
    handDesc: 'Use the left hand, right hand, or the first visible hand.',
    targetSize: 'Target Size',
    targetSizeDesc: 'Larger targets reduce the initial load.',
    speed: 'Movement Speed',
    speedDesc: 'Higher speed increases tracking and reaction demand.',
    privacyTitle: 'Camera video is analyzed on this device',
    privacyDesc: 'Video is not recorded or uploaded. Only training settings and statistics are saved.',
    loadingTitle: 'Preparing Hand Tracking',
    loadingCamera: 'Starting the camera. Allow browser camera access when prompted.',
    loadingModel: 'Loading the MediaPipe hand model.',
    unsupported: 'This browser does not support camera access. Use a current version of Chrome, Edge, or Safari.',
    permission: 'The camera is unavailable. Allow camera permission and try again.',
    disconnected: 'The camera was disconnected. Check the camera connection and start the training again.',
    initialization: 'Hand tracking could not start. Check the network connection and try again.',
    errorTitle: 'Unable to Start Motor Cortex Rehab',
    openDetails: 'Open error details',
    cameraPreview: 'Live hand camera preview',
    tracking: 'Hand tracked',
    finding: 'Place your hand in the frame',
    followTarget: 'Keep the hand cursor inside the target',
    target: 'Target',
    handCursor: 'Hand position',
    timeLeft: 'Time Left',
    accuracy: 'Accuracy',
    visible: 'Tracking',
    reps: 'Reps',
    level: 'Adaptive Level',
    hold: 'Hold',
    resultsTitle: 'Motor Cortex Rehab Complete',
    participant: 'Participant',
    interrupted: 'Interrupted Holds',
    bestHold: 'Best Hold',
    event: 'Event',
    result: 'Result',
    time: 'Time',
    size: 'Target Size',
    handAny: 'Any Hand',
    handLeft: 'Left Hand',
    handRight: 'Right Hand',
    drillNames: {
      bounce: 'Bouncing Ball Tracking',
      vertical: 'Vertical Range',
      horizontal: 'Horizontal Range',
      random: 'Random Reach',
    },
    drillDescriptions: {
      bounce: 'Track a ball as it rebounds around the play field for continuous hand-eye coordination.',
      vertical: 'Follow a target up and down to practice shoulder, elbow, and vertical range control.',
      horizontal: 'Follow a target left and right to practice crossing midline and lateral control.',
      random: 'Move quickly to random target locations and hold steady to train reach, stop, and stabilization.',
    },
    difficultyNames: {
      beginner: 'Beginner',
      intermediate: 'Intermediate',
      advanced: 'Advanced',
    },
    success: 'Success',
    interruptedLabel: 'Interrupted',
  },
} as const;

const handLabels: readonly HandChoice[] = ['any', 'left', 'right'];

export function MotorCortexRehabGame({ onExit }: MotorCortexRehabGameProps) {
  const { lang, t } = useT();
  const labels = copy[lang];
  const { fullscreenRootRef, enterTrainingFullscreen } = useFullscreenTrainingRoot<HTMLDivElement>();
  const stageRef = useRef<HTMLDivElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const handCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const handLandmarkerRef = useRef<HandLandmarker | null>(null);
  const cameraStreamRef = useRef<MediaStream | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const lastDetectionAtRef = useRef(0);
  const lastVideoTimeRef = useRef(-1);
  const lastLiveStateAtRef = useRef(0);
  const phaseRef = useRef<GamePhase>('menu');
  const mountedRef = useRef(true);
  const targetRef = useRef<TargetState | null>(null);
  const handRef = useRef<HandState>({ x: 0, y: 0, visible: false, handedness: null, lastSeenAt: 0 });
  const metricsRef = useRef<SessionMetrics>(CreateEmptyMetrics());
  const jsPsychRef = useRef<ReturnType<typeof initJsPsych> | null>(null);
  const [phase, setPhaseState] = useState<GamePhase>('menu');
  const [drill, setDrill] = useState<DrillId>('bounce');
  const [difficulty, setDifficulty] = useState<DifficultyId>('beginner');
  const [durationSec, setDurationSec] = useState<(typeof durationOptions)[number]>(60);
  const [handChoice, setHandChoice] = useState<HandChoice>('any');
  const [targetSizeScale, setTargetSizeScale] = useState(1);
  const [speedScale, setSpeedScale] = useState(1);
  const [statusMessage, setStatusMessage] = useState('');
  const [visionError, setVisionError] = useState('');
  const [showVisionError, setShowVisionError] = useState(false);
  const [result, setResult] = useState<SessionRecord | null>(null);
  const [liveState, setLiveState] = useState<LiveState>({
    timeRemaining: durationSec,
    accuracy: 0,
    visibility: 0,
    successes: 0,
    misses: 0,
    currentHoldPercent: 0,
    level: 1,
    targetX: 50,
    targetY: 50,
    targetRadius: 70,
    handX: 50,
    handY: 50,
    handVisible: false,
    insideTarget: false,
  });

  const setPhase = useCallback((nextPhase: GamePhase) => {
    phaseRef.current = nextPhase;
    setPhaseState(nextPhase);
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
    const canvas = handCanvasRef.current;
    canvas?.getContext('2d')?.clearRect(0, 0, canvas.width, canvas.height);
  }, []);

  useEffect(() => {
    jsPsychRef.current = initJsPsych();
  }, []);

  useEffect(() => () => {
    mountedRef.current = false;
    stopVision();
  }, [stopVision]);

  const activeDrill = useMemo(() => drills.find((item) => item.id === drill) ?? drills[0], [drill]);
  const activeDifficulty = useMemo(
    () => difficulties.find((item) => item.id === difficulty) ?? difficulties[0],
    [difficulty],
  );

  const summaryItems = useMemo(() => [
    { label: labels.drill, value: labels.drillNames[drill] },
    { label: labels.difficulty, value: labels.difficultyNames[difficulty] },
    { label: labels.duration, value: `${durationSec}s` },
    { label: labels.hand, value: FormatHandChoice(handChoice, labels) },
  ], [difficulty, drill, durationSec, handChoice, labels]);

  const resetGameState = useCallback(() => {
    targetRef.current = null;
    handRef.current = { x: 0, y: 0, visible: false, handedness: null, lastSeenAt: 0 };
    metricsRef.current = CreateEmptyMetrics();
    lastDetectionAtRef.current = 0;
    lastVideoTimeRef.current = -1;
    lastLiveStateAtRef.current = 0;
    setLiveState((current) => ({
      ...current,
      timeRemaining: durationSec,
      accuracy: 0,
      visibility: 0,
      successes: 0,
      misses: 0,
      currentHoldPercent: 0,
      level: 1,
      targetX: 50,
      targetY: 50,
      targetRadius: activeDifficulty.radius * targetSizeScale,
      handVisible: false,
      insideTarget: false,
    }));
  }, [activeDifficulty.radius, durationSec, targetSizeScale]);

  const completeSession = useCallback((completedAt: number) => {
    if (!mountedRef.current || phaseRef.current === 'results' || phaseRef.current === 'menu') return;
    const metrics = metricsRef.current;
    const target = targetRef.current;
    const participantId = getActiveUser() || 'Unknown';
    const elapsedMs = Math.max(1, completedAt - metrics.startedAt);
    const accuracy = metrics.handVisibleMs > 0 ? metrics.inTargetMs / metrics.handVisibleMs : 0;
    const visibility = metrics.handVisibleMs / elapsedMs;
    const session: SessionRecord = {
      Test_Date: FormatTestDate(new Date()),
      Participant_ID: participantId,
      Drill: labels.drillNames[drill],
      Reference_Module: activeDrill.referenceName,
      Difficulty: difficulty,
      Duration_Seconds: Number((elapsedMs / 1000).toFixed(1)),
      Tracking_Hand: handChoice,
      Target_Size_Scale: Number(targetSizeScale.toFixed(2)),
      Speed_Scale: Number(speedScale.toFixed(2)),
      Adaptive_Level: target?.level ?? 1,
      Accuracy_Percent: ToPercent(accuracy),
      Hand_Visible_Percent: ToPercent(visibility),
      Successful_Reps: metrics.successes,
      Interrupted_Holds: metrics.misses,
      Best_Hold_Seconds: Number((metrics.bestHoldMs / 1000).toFixed(2)),
      Event_Records: metrics.events.map((event) => ({ ...event })),
    };

    PlayGameEndSound('Victory', jsPsychRef);
    setResult(session);
    setPhase('results');
    stopVision();
    void SaveTrainingSessionRecord({
      userName: participantId,
      moduleId: 'motor-training',
      gameId: 'motor-cortex-rehab',
      gameTitle: labels.title,
      difficulty,
      trainingDate: session.Test_Date,
      details: {
        Drill: session.Drill,
        Reference_Module: session.Reference_Module,
        Duration_Seconds: session.Duration_Seconds,
        Tracking_Hand: session.Tracking_Hand,
        Target_Size_Scale: session.Target_Size_Scale,
        Speed_Scale: session.Speed_Scale,
        Adaptive_Level: session.Adaptive_Level,
        Accuracy_Percent: session.Accuracy_Percent,
        Hand_Visible_Percent: session.Hand_Visible_Percent,
        Successful_Reps: session.Successful_Reps,
        Interrupted_Holds: session.Interrupted_Holds,
        Best_Hold_Seconds: session.Best_Hold_Seconds,
      },
      detailRows: session.Event_Records.map((event) => ({ ...event }) as Record<string, unknown>),
    });
    WriteJsPsychData(
      jsPsychRef,
      session as unknown as Record<string, unknown>,
      'Unable to write motor cortex rehab result to jsPsych data.',
    );
  }, [activeDrill.referenceName, difficulty, drill, handChoice, labels, setPhase, speedScale, stopVision, targetSizeScale]);

  const processFrame = useCallback((now: number) => {
    animationFrameRef.current = window.requestAnimationFrame(processFrame);
    if (phaseRef.current !== 'playing') return;
    const stage = stageRef.current;
    const video = videoRef.current;
    const landmarker = handLandmarkerRef.current;
    const rect = stage?.getBoundingClientRect();
    if (!stage || !rect || rect.width <= 0 || rect.height <= 0) return;

    if (!targetRef.current) {
      targetRef.current = CreateInitialTarget(
        drill,
        activeDifficulty,
        targetSizeScale,
        speedScale,
        rect.width,
        rect.height,
      );
    }

    if (now - lastDetectionAtRef.current >= detectionIntervalMs && video && landmarker && video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
      if (video.currentTime !== lastVideoTimeRef.current) {
        lastVideoTimeRef.current = video.currentTime;
        lastDetectionAtRef.current = now;
        try {
          const detection = landmarker.detectForVideo(video, now);
          const selection = SelectHand(detection.landmarks, detection.handedness ?? detection.handednesses, handChoice);
          DrawHandLandmarks(handCanvasRef.current, video, selection?.landmarks);
          if (selection) {
            const point = GetHandCursorPoint(selection.landmarks, rect.width, rect.height);
            handRef.current = {
              x: point.x,
              y: point.y,
              visible: true,
              handedness: selection.handedness,
              lastSeenAt: now,
            };
          } else if (now - handRef.current.lastSeenAt > trackingGraceMs) {
            handRef.current = { ...handRef.current, visible: false };
          }
        } catch (error) {
          console.warn('Hand landmark detection failed.', error);
          setVisionError(labels.initialization);
          setShowVisionError(true);
          stopVision();
          setPhase('menu');
          return;
        }
      }
    }

    UpdateTrainingLoop({
      now,
      rect,
      drill,
      activeDifficulty,
      durationSec,
      targetSizeScale,
      speedScale,
      target: targetRef.current,
      hand: handRef.current,
      metrics: metricsRef.current,
      labels,
      onSuccess: () => PlaySuccessSound(jsPsychRef),
      onComplete: completeSession,
    });

    if (now - lastLiveStateAtRef.current >= liveStateIntervalMs && targetRef.current) {
      lastLiveStateAtRef.current = now;
      setLiveState(BuildLiveState(
        now,
        durationSec,
        rect,
        targetRef.current,
        handRef.current,
        metricsRef.current,
      ));
    }
  }, [
    activeDifficulty,
    completeSession,
    drill,
    durationSec,
    handChoice,
    labels,
    setPhase,
    speedScale,
    stopVision,
    targetSizeScale,
  ]);

  const startTraining = useCallback(async () => {
    if (!VerifySelectedTrainingUser()) return;
    if (!navigator.mediaDevices?.getUserMedia) {
      setVisionError(labels.unsupported);
      setShowVisionError(true);
      return;
    }

    PrepareAudioFeedback(jsPsychRef);
    await enterTrainingFullscreen();
    stopVision();
    resetGameState();
    setResult(null);
    setVisionError('');
    setShowVisionError(false);
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
        setPhase('menu');
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
        numHands: handChoice === 'any' ? 1 : 2,
        minHandDetectionConfidence: 0.5,
        minHandPresenceConfidence: 0.5,
        minTrackingConfidence: 0.5,
      });
      if (!mountedRef.current) {
        landmarker.close();
        return;
      }
      handLandmarkerRef.current = landmarker;
      metricsRef.current = {
        ...CreateEmptyMetrics(),
        startedAt: performance.now(),
        lastTickAt: performance.now(),
      };
      setPhase('playing');
      animationFrameRef.current = window.requestAnimationFrame(processFrame);
    } catch (error) {
      console.warn('Unable to initialize motor cortex rehab.', error);
      setVisionError(error instanceof DOMException && error.name === 'NotAllowedError'
        ? labels.permission
        : labels.initialization);
      setShowVisionError(true);
      setPhase('menu');
      stopVision();
    }
  }, [enterTrainingFullscreen, handChoice, labels, processFrame, resetGameState, setPhase, stopVision]);

  const returnToMenu = useCallback(() => {
    stopVision();
    resetGameState();
    setResult(null);
    setVisionError('');
    setShowVisionError(false);
    setPhase('menu');
  }, [resetGameState, setPhase, stopVision]);

  const exitGame = useCallback(() => {
    stopVision();
    onExit();
  }, [onExit, stopVision]);

  const downloadResult = useCallback(() => {
    if (!result) return;
    DownloadCsvFile(BuildMotorCortexCsv(result), `motor_cortex_rehab_${result.Test_Date}.csv`);
  }, [result]);

  useTrainingAbort({
    active: phase === 'rules' || phase === 'initializing' || phase === 'playing',
    onAbort: returnToMenu,
  });

  const stageStyle = {
    '--motor-cortex-accent': activeDrill.accent,
    '--motor-cortex-target-x': `${liveState.targetX}%`,
    '--motor-cortex-target-y': `${liveState.targetY}%`,
    '--motor-cortex-target-size': `${liveState.targetRadius * 2}px`,
    '--motor-cortex-hand-x': `${liveState.handX}%`,
    '--motor-cortex-hand-y': `${liveState.handY}%`,
    '--motor-cortex-hold-progress': `${liveState.currentHoldPercent * 100}%`,
  } as CSSProperties;

  const resultRows = result?.Event_Records.slice(-8) ?? [];

  return (
    <div
      ref={fullscreenRootRef}
      className={`motor-cortex-game motor-cortex-phase-${phase} motor-cortex-drill-${drill}`}
      style={stageStyle}
    >
      <div className={`motor-cortex-camera ${phase === 'playing' || phase === 'initializing' ? '' : 'motor-cortex-camera-hidden'}`}>
        <video ref={videoRef} muted playsInline aria-label={labels.cameraPreview} />
        <canvas ref={handCanvasRef} aria-hidden="true" />
        <span>{liveState.handVisible ? labels.tracking : labels.finding}</span>
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
                    tone="error"
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
            <section className="training-setting training-setting-wide">
              <div className="training-setting-header">
                <div>
                  <h2>{labels.drill}</h2>
                  <p>{labels.drillDesc}</p>
                </div>
                <span>{labels.drillNames[drill]}</span>
              </div>
              <div className="training-option-grid motor-cortex-drill-grid">
                {drills.map((item) => (
                  <button
                    className={`training-option ${drill === item.id ? 'active' : ''}`}
                    key={item.id}
                    type="button"
                    onClick={() => setDrill(item.id)}
                  >
                    <span className="training-option-title">{labels.drillNames[item.id]}</span>
                    <span className="training-option-meta">{labels.drillDescriptions[item.id]}</span>
                    <span className="motor-cortex-reference-name">{item.referenceName}</span>
                  </button>
                ))}
              </div>
            </section>

            <section className="training-setting">
              <div className="training-setting-header">
                <div>
                  <h2>{labels.difficulty}</h2>
                  <p>{labels.difficultyDesc}</p>
                </div>
                <span>{labels.difficultyNames[difficulty]}</span>
              </div>
              <div className="training-option-grid training-option-grid-three">
                {difficulties.map((item) => (
                  <button
                    className={`training-option ${difficulty === item.id ? 'active' : ''}`}
                    key={item.id}
                    type="button"
                    onClick={() => setDifficulty(item.id)}
                  >
                    <span className="training-option-title">{labels.difficultyNames[item.id]}</span>
                    <span className="training-option-meta">{Math.round(item.speed * speedScale)} px/s</span>
                  </button>
                ))}
              </div>
            </section>

            <section className="training-setting">
              <div className="training-setting-header">
                <div>
                  <h2>{labels.duration}</h2>
                  <p>{labels.durationDesc}</p>
                </div>
                <span>{durationSec}s</span>
              </div>
              <div className="training-option-grid training-option-grid-three">
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
              </div>
            </section>

            <section className="training-setting">
              <div className="training-setting-header">
                <div>
                  <h2>{labels.hand}</h2>
                  <p>{labels.handDesc}</p>
                </div>
                <span>{FormatHandChoice(handChoice, labels)}</span>
              </div>
              <div className="training-option-grid training-option-grid-three">
                {handLabels.map((value) => (
                  <button
                    className={`training-option ${handChoice === value ? 'active' : ''}`}
                    key={value}
                    type="button"
                    onClick={() => setHandChoice(value)}
                  >
                    <span className="training-option-title">{FormatHandChoice(value, labels)}</span>
                  </button>
                ))}
              </div>
            </section>

            <section className="training-setting">
              <div className="training-setting-header">
                <div>
                  <h2>{labels.targetSize}</h2>
                  <p>{labels.targetSizeDesc}</p>
                </div>
                <span>{Math.round(targetSizeScale * 100)}%</span>
              </div>
              <input
                className="training-slider"
                type="range"
                min="75"
                max="130"
                step="5"
                value={targetSizeScale * 100}
                onChange={(event) => setTargetSizeScale(Number(event.target.value) / 100)}
                aria-label={labels.targetSize}
              />
            </section>

            <section className="training-setting">
              <div className="training-setting-header">
                <div>
                  <h2>{labels.speed}</h2>
                  <p>{labels.speedDesc}</p>
                </div>
                <span>{Math.round(speedScale * 100)}%</span>
              </div>
              <input
                className="training-slider"
                type="range"
                min="70"
                max="140"
                step="5"
                value={speedScale * 100}
                onChange={(event) => setSpeedScale(Number(event.target.value) / 100)}
                aria-label={labels.speed}
              />
            </section>

            <TrainingPrivacyNotice
              title={labels.privacyTitle}
              description={labels.privacyDesc}
            />
          </TrainingConfigPanel>
        </div>
      )}

      {phase === 'rules' && (
        <div className="training-panel">
          <StrokeTrainingRulesPanel
            gameId="motor-cortex-rehab"
            title={labels.title}
            summaryTitle={labels.title}
            summaryItems={summaryItems}
            onStart={() => void startTraining()}
            onBack={() => setPhase('menu')}
          />
        </div>
      )}

      {phase === 'initializing' && (
        <div className="motor-cortex-loading-overlay">
          <div className="gesture-loading-card">
            <div className="gesture-loader" />
            <h1>{labels.loadingTitle}</h1>
            <p>{statusMessage}</p>
          </div>
        </div>
      )}

      {phase === 'playing' && (
        <div className="motor-cortex-play">
          <div className="motor-cortex-hud">
            <span>
              <small>{labels.timeLeft}</small>
              <strong>{Math.max(0, Math.ceil(liveState.timeRemaining))}s</strong>
            </span>
            <span>
              <small>{labels.accuracy}</small>
              <strong>{ToPercent(liveState.accuracy)}%</strong>
            </span>
            <span>
              <small>{labels.visible}</small>
              <strong>{ToPercent(liveState.visibility)}%</strong>
            </span>
            <span>
              <small>{labels.reps}</small>
              <strong>{liveState.successes}</strong>
            </span>
            <span>
              <small>{labels.level}</small>
              <strong>{liveState.level}</strong>
            </span>
          </div>

          <div ref={stageRef} className="motor-cortex-stage" aria-label={labels.followTarget}>
            <div className="motor-cortex-path motor-cortex-path-vertical" />
            <div className="motor-cortex-path motor-cortex-path-horizontal" />
            <div className={`motor-cortex-target ${liveState.insideTarget ? 'is-hit' : ''}`}>
              <span>{labels.target}</span>
              <i />
            </div>
            <div className={`motor-cortex-hand-cursor ${liveState.handVisible ? 'is-visible' : ''} ${liveState.insideTarget ? 'is-hit' : ''}`}>
              <span>{labels.handCursor}</span>
            </div>
          </div>

          <div className="motor-cortex-instruction">
            <strong>{labels.drillNames[drill]}</strong>
            <span>{labels.followTarget}</span>
            <div className="motor-cortex-hold-meter">
              <i />
            </div>
            <small>{labels.hold}</small>
          </div>
        </div>
      )}

      {phase === 'results' && result && (
        <div className="experiment-container experiment-container-scrollable motor-cortex-results-container">
          <div className="experiment-results">
            <h1>{labels.resultsTitle}</h1>
            <div className="training-result-summary motor-cortex-result-summary">
              <span>
                <small>{labels.participant}</small>
                <strong>{result.Participant_ID}</strong>
              </span>
              <span>
                <small>{labels.accuracy}</small>
                <strong>{result.Accuracy_Percent}%</strong>
              </span>
              <span>
                <small>{labels.reps}</small>
                <strong>{result.Successful_Reps}</strong>
              </span>
              <span>
                <small>{labels.interrupted}</small>
                <strong>{result.Interrupted_Holds}</strong>
              </span>
              <span>
                <small>{labels.bestHold}</small>
                <strong>{result.Best_Hold_Seconds}s</strong>
              </span>
              <span>
                <small>{labels.level}</small>
                <strong>{result.Adaptive_Level}</strong>
              </span>
            </div>

            {resultRows.length > 0 && (
              <table className="results-table">
                <thead>
                  <tr>
                    <th>{labels.event}</th>
                    <th>{labels.result}</th>
                    <th>{labels.time}</th>
                    <th>{labels.hold}</th>
                    <th>{labels.accuracy}</th>
                    <th>{labels.size}</th>
                  </tr>
                </thead>
                <tbody>
                  {resultRows.map((event) => (
                    <tr key={event.Event_Number}>
                      <td>{event.Event_Number}</td>
                      <td>{event.Result === 'success' ? labels.success : labels.interruptedLabel}</td>
                      <td>{event.Time_Seconds}s</td>
                      <td>{event.Hold_Seconds}s</td>
                      <td>{event.Accuracy_Percent}%</td>
                      <td>{Math.round(event.Target_Size_Px)}px</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

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
          titleId="motor-cortex-error-modal-title"
          message={visionError}
          onClose={() => setShowVisionError(false)}
        />
      )}
    </div>
  );
}

function CreateEmptyMetrics(): SessionMetrics {
  return {
    startedAt: 0,
    lastTickAt: 0,
    handVisibleMs: 0,
    inTargetMs: 0,
    successes: 0,
    misses: 0,
    currentHoldMs: 0,
    bestHoldMs: 0,
    streak: 0,
    events: [],
  };
}

function CreateInitialTarget(
  drill: DrillId,
  difficulty: DifficultyDefinition,
  targetSizeScale: number,
  speedScale: number,
  width: number,
  height: number,
): TargetState {
  const radius = difficulty.radius * targetSizeScale;
  const speed = difficulty.speed * speedScale;
  const center = { x: width / 2, y: height / 2 };
  if (drill === 'vertical') {
    return { x: center.x, y: radius + 24, vx: 0, vy: speed, radius, level: 1, holdTargetMs: difficulty.holdMs };
  }
  if (drill === 'horizontal') {
    return { x: radius + 24, y: center.y, vx: speed, vy: 0, radius, level: 1, holdTargetMs: difficulty.holdMs };
  }
  if (drill === 'random') {
    return {
      ...PlaceRandomTarget({ x: center.x, y: center.y, vx: 0, vy: 0, radius, level: 1, holdTargetMs: difficulty.holdMs }, width, height),
      holdTargetMs: difficulty.holdMs + 240,
    };
  }
  return {
    x: width * 0.28,
    y: height * 0.34,
    vx: speed,
    vy: speed * 0.78,
    radius,
    level: 1,
    holdTargetMs: difficulty.holdMs,
  };
}

function UpdateTrainingLoop({
  now,
  rect,
  drill,
  activeDifficulty,
  durationSec,
  targetSizeScale,
  speedScale,
  target,
  hand,
  metrics,
  labels,
  onSuccess,
  onComplete,
}: {
  now: number;
  rect: DOMRect;
  drill: DrillId;
  activeDifficulty: DifficultyDefinition;
  durationSec: number;
  targetSizeScale: number;
  speedScale: number;
  target: TargetState;
  hand: HandState;
  metrics: SessionMetrics;
  labels: (typeof copy)['zh'] | (typeof copy)['en'];
  onSuccess: () => void;
  onComplete: (completedAt: number) => void;
}) {
  if (!metrics.startedAt) {
    metrics.startedAt = now;
    metrics.lastTickAt = now;
  }
  const elapsedMs = now - metrics.startedAt;
  if (elapsedMs >= durationSec * 1000) {
    onComplete(now);
    return;
  }

  const deltaMs = Math.min(90, Math.max(0, now - metrics.lastTickAt));
  metrics.lastTickAt = now;
  MoveTarget(drill, target, rect.width, rect.height, deltaMs);

  const handVisible = hand.visible && now - hand.lastSeenAt <= trackingGraceMs;
  if (handVisible) metrics.handVisibleMs += deltaMs;
  const insideTarget = handVisible && Distance2d(hand, target) <= target.radius + handCursorRadius;
  if (insideTarget) {
    metrics.inTargetMs += deltaMs;
    metrics.currentHoldMs += deltaMs;
    metrics.bestHoldMs = Math.max(metrics.bestHoldMs, metrics.currentHoldMs);
  } else if (metrics.currentHoldMs > 180) {
    metrics.misses += 1;
    metrics.streak = 0;
    metrics.events.push(ToEventRecord({
      metrics,
      drillName: labels.drillNames[drill],
      result: 'interrupted',
      target,
      elapsedMs,
    }));
    metrics.currentHoldMs = 0;
  } else {
    metrics.currentHoldMs = 0;
  }

  if (metrics.currentHoldMs >= target.holdTargetMs) {
    metrics.successes += 1;
    metrics.streak += 1;
    metrics.events.push(ToEventRecord({
      metrics,
      drillName: labels.drillNames[drill],
      result: 'success',
      target,
      elapsedMs,
    }));
    metrics.currentHoldMs = 0;
    onSuccess();
    AdaptTarget(target, activeDifficulty, targetSizeScale, speedScale, metrics);
    if (drill === 'random') {
      PlaceRandomTarget(target, rect.width, rect.height);
    }
  }
}

function MoveTarget(drill: DrillId, target: TargetState, width: number, height: number, deltaMs: number) {
  const deltaSec = deltaMs / 1000;
  const padding = target.radius + 24;
  if (drill === 'random') return;
  target.x += target.vx * deltaSec;
  target.y += target.vy * deltaSec;

  if (drill === 'vertical') {
    target.x = width / 2 + Math.sin(performance.now() * 0.0012) * width * 0.08;
  } else if (drill === 'horizontal') {
    target.y = height / 2 + Math.sin(performance.now() * 0.0012) * height * 0.08;
  }

  if (target.x < padding || target.x > width - padding) {
    target.x = Clamp(target.x, padding, width - padding);
    target.vx *= -1;
  }
  if (target.y < padding || target.y > height - padding) {
    target.y = Clamp(target.y, padding, height - padding);
    target.vy *= -1;
  }
}

function AdaptTarget(
  target: TargetState,
  difficulty: DifficultyDefinition,
  targetSizeScale: number,
  speedScale: number,
  metrics: SessionMetrics,
) {
  const accuracy = metrics.handVisibleMs > 0 ? metrics.inTargetMs / metrics.handVisibleMs : 0;
  if (metrics.streak > 0 && metrics.streak % 4 === 0 && accuracy >= 0.58) {
    target.level += 1;
  } else if (metrics.misses > 0 && metrics.misses % 5 === 0 && accuracy < 0.28) {
    target.level = Math.max(1, target.level - 1);
  }
  const levelScale = 1 + (target.level - 1) * 0.08;
  const speed = difficulty.speed * speedScale * levelScale;
  const directionX = Math.sign(target.vx || 1);
  const directionY = Math.sign(target.vy || 1);
  target.vx = directionX * speed;
  target.vy = directionY * speed * 0.78;
  target.radius = Clamp(difficulty.radius * targetSizeScale * (1 - (target.level - 1) * 0.035), 38, 110);
  target.holdTargetMs = Clamp(difficulty.holdMs + (target.level - 1) * 40, 420, 1400);
}

function PlaceRandomTarget(target: TargetState, width: number, height: number): TargetState {
  const padding = target.radius + 28;
  target.x = padding + Math.random() * Math.max(1, width - padding * 2);
  target.y = padding + Math.random() * Math.max(1, height - padding * 2);
  return target;
}

function ToEventRecord({
  metrics,
  drillName,
  result,
  target,
  elapsedMs,
}: {
  metrics: SessionMetrics;
  drillName: string;
  result: 'success' | 'interrupted';
  target: TargetState;
  elapsedMs: number;
}): DrillEventRecord {
  const accuracy = metrics.handVisibleMs > 0 ? metrics.inTargetMs / metrics.handVisibleMs : 0;
  return {
    Event_Number: metrics.events.length + 1,
    Drill: drillName,
    Result: result,
    Time_Seconds: Number((elapsedMs / 1000).toFixed(2)),
    Hold_Seconds: Number((metrics.currentHoldMs / 1000).toFixed(2)),
    Accuracy_Percent: ToPercent(accuracy),
    Target_Size_Px: Number((target.radius * 2).toFixed(1)),
    Adaptive_Level: target.level,
  };
}

function BuildLiveState(
  now: number,
  durationSec: number,
  rect: DOMRect,
  target: TargetState,
  hand: HandState,
  metrics: SessionMetrics,
) {
  const elapsedMs = metrics.startedAt ? now - metrics.startedAt : 0;
  const accuracy = metrics.handVisibleMs > 0 ? metrics.inTargetMs / metrics.handVisibleMs : 0;
  const visibility = elapsedMs > 0 ? metrics.handVisibleMs / elapsedMs : 0;
  const handVisible = hand.visible && now - hand.lastSeenAt <= trackingGraceMs;
  const insideTarget = handVisible && Distance2d(hand, target) <= target.radius + handCursorRadius;
  return {
    timeRemaining: Math.max(0, durationSec - elapsedMs / 1000),
    accuracy,
    visibility,
    successes: metrics.successes,
    misses: metrics.misses,
    currentHoldPercent: Clamp(metrics.currentHoldMs / target.holdTargetMs, 0, 1),
    level: target.level,
    targetX: (target.x / rect.width) * 100,
    targetY: (target.y / rect.height) * 100,
    targetRadius: target.radius,
    handX: (hand.x / rect.width) * 100,
    handY: (hand.y / rect.height) * 100,
    handVisible,
    insideTarget,
  };
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
  context.strokeStyle = '#5eead4';
  context.fillStyle = '#fde68a';
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

function Distance2d(left: Pick<HandState, 'x' | 'y'>, right: Pick<TargetState, 'x' | 'y'>): number {
  return Math.hypot(left.x - right.x, left.y - right.y);
}

function ToPercent(value: number): number {
  return Number((Clamp(value, 0, 1) * 100).toFixed(1));
}

function FormatHandChoice(handChoice: HandChoice, labels: (typeof copy)['zh'] | (typeof copy)['en']): string {
  if (handChoice === 'left') return labels.handLeft;
  if (handChoice === 'right') return labels.handRight;
  return labels.handAny;
}

function BuildMotorCortexCsv(result: SessionRecord): string {
  const rows = [
    [
      'Test_Date',
      'Participant_ID',
      'Drill',
      'Reference_Module',
      'Difficulty',
      'Duration_Seconds',
      'Tracking_Hand',
      'Target_Size_Scale',
      'Speed_Scale',
      'Adaptive_Level',
      'Accuracy_Percent',
      'Hand_Visible_Percent',
      'Successful_Reps',
      'Interrupted_Holds',
      'Best_Hold_Seconds',
      'Event_Number',
      'Event_Result',
      'Event_Time_Seconds',
      'Event_Hold_Seconds',
      'Event_Target_Size_Px',
    ],
    ...(result.Event_Records.length > 0 ? result.Event_Records : [undefined]).map((event) => [
      result.Test_Date,
      result.Participant_ID,
      result.Drill,
      result.Reference_Module,
      result.Difficulty,
      result.Duration_Seconds,
      result.Tracking_Hand,
      result.Target_Size_Scale,
      result.Speed_Scale,
      result.Adaptive_Level,
      result.Accuracy_Percent,
      result.Hand_Visible_Percent,
      result.Successful_Reps,
      result.Interrupted_Holds,
      result.Best_Hold_Seconds,
      event?.Event_Number ?? '',
      event?.Result ?? '',
      event?.Time_Seconds ?? '',
      event?.Hold_Seconds ?? '',
      event?.Target_Size_Px ?? '',
    ]),
  ];
  return rows.map((row) => row.map(csvCell).join(',')).join('\n');
}

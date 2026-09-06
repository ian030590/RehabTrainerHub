// Canonical Hub-owned motor module; bundled by the motor runtime.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Application, Container, Graphics, type Ticker } from 'pixi.js';
import {
  FilesetResolver,
  HandLandmarker,
  type NormalizedLandmark,
} from '@mediapipe/tasks-vision';
import { initJsPsych } from 'jspsych';
import {
  CreateMediaPipeAssetUrlCandidates,
  LoadMediaPipeWithFallback,
} from '@rehab-trainer/ui/aiAssets';
import { useT, type TranslationKey } from '../../i18n';
import { getActiveUser } from '../../utils/settings';
import { PlayGameEndSound, PlaySuccessSound, PrepareAudioFeedback } from '../../utils/soundManager';
import { SaveTrainingSessionRecord } from '../../utils/trainingRecords';
import { Clamp, FormatTestDate } from './gameUtils';
import { VerifySelectedTrainingUser } from './selectedUserGuard';
import { TrainingConfigNavigationActions } from '@rehab-trainer/ui/components/TrainingConfigNavigationActions';
import {
  TrainingConfigNotice,
  TrainingConfigOptionGroup,
  TrainingConfigPanel,
  TrainingConfigSection,
} from '@rehab-trainer/ui/components/TrainingConfigPanel';
import { TrainingResultActions } from '@rehab-trainer/ui/components/TrainingResultActions';
import {
  IsEmbeddedHubTraining,
  RequestHubTrainingConfiguration,
} from '@rehab-trainer/ui/embeddedTraining';
import { useFullscreenTrainingRoot } from '@rehab-trainer/ui/hooks/useFullscreenTrainingRoot';
import {
  CanRetryMediaPermission,
  GetMediaPermissionRetryLabel,
  useMediaPermissionPreflight,
} from '@rehab-trainer/ui/hooks/useMediaPermissionPreflight';
import { useTrainingConfigReady } from '@rehab-trainer/ui/hooks/useTrainingConfigReady';
import { useHostedGameSettings } from '@rehab-trainer/ui/hooks/useHostedGameSettings';
import { useTrainingAbort } from '@rehab-trainer/ui/hooks/useTrainingAbort';
import { JsPsychExternalLifecycle } from '@rehab-trainer/ui/jsPsychLifecycle';
import { InlineAlert } from '../../components/InlineAlert';
import { MediaDeviceErrorDialog } from '../../components/MediaDeviceErrorDialog';
import { MotorTrainingRulesPanel } from './MotorTrainingRulesPanel';

type GestureId = 1 | 2 | 3 | 4 | 5;
type TargetMode = 'free' | 'directed';
type GamePhase = 'menu' | 'rules' | 'initializing' | 'calibration' | 'combat' | 'results';
type CalibrationKind = 'rom-closed' | 'rom-open' | 'gesture';

interface GestureBattlerGameProps {
  onExit: () => void;
}

interface GestureConfig {
  enemyMaxHp: number;
  holdDuration: number;
  strictnessThreshold: number;
  targetMode: TargetMode;
}

interface CalibrationStep {
  kind: CalibrationKind;
  gesture: 0 | GestureId;
  titleKey: TranslationKey;
  instructionKey: TranslationKey;
}

interface RomProfile {
  closed: number[] | null;
  open: number[] | null;
}

interface CastRecord {
  Cast_Number: number;
  Gesture: GestureId;
  Target_Gesture: GestureId | null;
  Similarity_Percent: number;
  Cast_Time_Seconds: number;
  Enemy_HP_After: number;
}

interface GestureStat {
  attempts: number;
  successes: number;
  interruptions: number;
  similarityTotal: number;
  similaritySamples: number;
}

interface SessionRecord {
  Test_Date: string;
  Participant_ID: string;
  Enemy_Max_HP: number;
  Hold_Duration_Seconds: number;
  Strictness_Threshold: number;
  Target_Mode: TargetMode;
  Total_Duration_Seconds: number;
  Successful_Casts: number;
  Interrupted_Holds: number;
  Gesture_Stats: Array<{
    Gesture: GestureId;
    Attempts: number;
    Successful_Casts: number;
    Interrupted_Holds: number;
    Success_Rate_Percent: number;
    Average_Similarity_Percent: number;
  }>;
  Cast_Records: CastRecord[];
}

interface BattleScene {
  enemy: Container;
  player: Container;
  effects: Container;
  width: number;
  height: number;
  enemyBaseY: number;
  playerBaseY: number;
}

interface HoldState {
  gesture: GestureId | null;
  progressMs: number;
  lastTickAt: number;
  lastValidAt: number;
  attemptRecorded: boolean;
}

const mediaPipeAssetCandidates = CreateMediaPipeAssetUrlCandidates(
  import.meta.env.VITE_AI_ASSET_BASE_URL,
);
const calibrationHoldMs = 2200;
const calibrationChangeThreshold = 0.22;
const calibrationMinStableSamples = 5;
const trackingGraceMs = 180;
const detectionIntervalMs = 66;
const defaultEnemyHp = 10;
const defaultHoldDuration = 2;
const defaultStrictness = 0.7;
const gestures: readonly GestureId[] = [1, 2, 3, 4, 5];
const moveColors = [0x38bdf8, 0xf8fafc, 0x4ade80, 0xfb923c, 0xfacc15] as const;
const moveNameKeys: Record<GestureId, TranslationKey> = {
  1: 'gesture.move.water',
  2: 'gesture.move.strike',
  3: 'gesture.move.leaf',
  4: 'gesture.move.spark',
  5: 'gesture.move.thunder',
};
const mobileGameMediaQuery = typeof window === 'undefined' || !window.matchMedia
  ? null
  : window.matchMedia('(any-pointer: coarse) and (max-width: 1024px)');
const coarsePortraitMediaQuery = typeof window === 'undefined' || !window.matchMedia
  ? null
  : window.matchMedia('(orientation: portrait) and (pointer: coarse)');
const calibrationSteps: readonly CalibrationStep[] = [
  {
    kind: 'rom-closed',
    gesture: 0,
    titleKey: 'gesture.calibration.closedTitle',
    instructionKey: 'gesture.calibration.closedInstruction',
  },
  {
    kind: 'rom-open',
    gesture: 5,
    titleKey: 'gesture.calibration.openTitle',
    instructionKey: 'gesture.calibration.openInstruction',
  },
  ...gestures.map((gesture) => ({
    kind: 'gesture' as const,
    gesture,
    titleKey: 'gesture.calibration.gestureTitle' as TranslationKey,
    instructionKey: 'gesture.calibration.gestureInstruction' as TranslationKey,
  })),
];

function CreateEmptyGestureStats(): Record<GestureId, GestureStat> {
  return {
    1: { attempts: 0, successes: 0, interruptions: 0, similarityTotal: 0, similaritySamples: 0 },
    2: { attempts: 0, successes: 0, interruptions: 0, similarityTotal: 0, similaritySamples: 0 },
    3: { attempts: 0, successes: 0, interruptions: 0, similarityTotal: 0, similaritySamples: 0 },
    4: { attempts: 0, successes: 0, interruptions: 0, similarityTotal: 0, similaritySamples: 0 },
    5: { attempts: 0, successes: 0, interruptions: 0, similarityTotal: 0, similaritySamples: 0 },
  };
}

export function GestureBattlerGame({ onExit }: GestureBattlerGameProps) {
  const { lang, t } = useT();
  const { fullscreenRootRef, enterTrainingFullscreen } = useFullscreenTrainingRoot<HTMLDivElement>();
  const pixiHostRef = useRef<HTMLDivElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const handCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const appRef = useRef<Application | null>(null);
  const sceneRef = useRef<BattleScene | null>(null);
  const handLandmarkerRef = useRef<HandLandmarker | null>(null);
  const cameraStreamRef = useRef<MediaStream | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const lastDetectionAtRef = useRef(0);
  const lastVideoTimeRef = useRef(-1);
  const phaseRef = useRef<GamePhase>('menu');
  const calibrationIndexRef = useRef(0);
  const calibrationCapturingRef = useRef(false);
  const calibrationHoldStartRef = useRef<number | null>(null);
  const calibrationSamplesRef = useRef<number[][]>([]);
  const lastHandSeenAtRef = useRef(0);
  const romRef = useRef<RomProfile>({ closed: null, open: null });
  const gestureProfilesRef = useRef<Partial<Record<GestureId, number[]>>>({});
  const holdRef = useRef<HoldState>({
    gesture: null,
    progressMs: 0,
    lastTickAt: 0,
    lastValidAt: 0,
    attemptRecorded: false,
  });
  const enemyHpRef = useRef(defaultEnemyHp);
  const targetGestureRef = useRef<GestureId>(1);
  const attackActiveRef = useRef(false);
  const mountedRef = useRef(true);
  const jsPsychHostRef = useRef<HTMLDivElement | null>(null);
  const jsPsychRef = useRef<ReturnType<typeof initJsPsych> | null>(null);
  const jsPsychLifecycleRef = useRef<JsPsychExternalLifecycle | null>(null);
  const configRef = useRef<GestureConfig>({
    enemyMaxHp: defaultEnemyHp,
    holdDuration: defaultHoldDuration,
    strictnessThreshold: defaultStrictness,
    targetMode: 'free',
  });
  const metricsRef = useRef({
    startedAt: 0,
    successfulCasts: 0,
    interruptedHolds: 0,
    stats: CreateEmptyGestureStats(),
    casts: [] as CastRecord[],
  });

  const [phase, setPhaseState] = useState<GamePhase>('menu');
  const isEmbeddedHubTraining = IsEmbeddedHubTraining();
  const hostedSettings = useHostedGameSettings();
  const hostedSettingsAppliedRef = useRef(false);
  useTrainingConfigReady(phase === 'menu');
  const [enemyMaxHp, setEnemyMaxHp] = useState(defaultEnemyHp);
  const [holdDuration, setHoldDuration] = useState(defaultHoldDuration);
  const [strictnessThreshold, setStrictnessThreshold] = useState(defaultStrictness);
  const [targetMode, setTargetMode] = useState<TargetMode>('free');
  const [calibrationIndex, setCalibrationIndex] = useState(0);
  const [isCalibrationCapturing, setIsCalibrationCapturing] = useState(false);
  const [calibrationProgress, setCalibrationProgress] = useState(0);
  const [calibrationNotice, setCalibrationNotice] = useState('');
  const [handVisible, setHandVisible] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const [visionError, setVisionError] = useState('');
  const [showVisionError, setShowVisionError] = useState(false);
  const [result, setResult] = useState<SessionRecord | null>(null);
  const [combatEnemyHp, setCombatEnemyHp] = useState(defaultEnemyHp);
  const [combatTargetGesture, setCombatTargetGesture] = useState<GestureId>(1);
  const [combatGesture, setCombatGesture] = useState<GestureId | null>(null);
  const [combatHoldProgress, setCombatHoldProgress] = useState(0);
  const cameraPermission = useMediaPermissionPreflight({
    active: phase === 'menu',
    video: true,
  });
  const canRetryCameraPermission = CanRetryMediaPermission(cameraPermission.status);
  const retryPermissionLabel = GetMediaPermissionRetryLabel(lang);

  const setPhase = useCallback((nextPhase: GamePhase) => {
    phaseRef.current = nextPhase;
    setPhaseState(nextPhase);
  }, []);

  const showConfiguration = useCallback(() => {
    if (!RequestHubTrainingConfiguration()) setPhase('menu');
  }, [setPhase]);

  useEffect(() => {
    if (!hostedSettings || hostedSettingsAppliedRef.current) return;
    hostedSettingsAppliedRef.current = true;
    if (typeof hostedSettings.enemyMaxHp === 'number') setEnemyMaxHp(hostedSettings.enemyMaxHp);
    if (typeof hostedSettings.holdDurationSec === 'number') setHoldDuration(hostedSettings.holdDurationSec);
    if (typeof hostedSettings.strictnessPercent === 'number') {
      setStrictnessThreshold(hostedSettings.strictnessPercent / 100);
    }
    if (hostedSettings.targetMode === 'free' || hostedSettings.targetMode === 'directed') {
      setTargetMode(hostedSettings.targetMode);
    }
    setPhase('rules');
  }, [hostedSettings, setPhase]);

  useEffect(() => {
    configRef.current = { enemyMaxHp, holdDuration, strictnessThreshold, targetMode };
  }, [enemyMaxHp, holdDuration, strictnessThreshold, targetMode]);

  useEffect(() => {
    if (cameraPermission.status === 'unsupported') {
      setVisionError(t('gesture.error.unsupported'));
    } else if (cameraPermission.status === 'denied' || cameraPermission.status === 'error') {
      setVisionError(t('gesture.error.permission'));
    }
  }, [cameraPermission.status, t]);

  useEffect(() => {
    const host = jsPsychHostRef.current;
    if (!host) return;

    const jsPsych = initJsPsych({ display_element: host });
    const lifecycle = new JsPsychExternalLifecycle(jsPsych);
    jsPsychRef.current = jsPsych;
    jsPsychLifecycleRef.current = lifecycle;

    return () => {
      lifecycle.dispose();
      if (jsPsychRef.current === jsPsych) jsPsychRef.current = null;
      if (jsPsychLifecycleRef.current === lifecycle) jsPsychLifecycleRef.current = null;
    };
  }, []);

  const clearHandCanvas = useCallback(() => {
    const canvas = handCanvasRef.current;
    canvas?.getContext('2d')?.clearRect(0, 0, canvas.width, canvas.height);
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
    clearHandCanvas();
  }, [clearHandCanvas]);

  useEffect(() => () => {
    mountedRef.current = false;
    stopVision();
  }, [stopVision]);

  const resetHold = useCallback((countInterruption: boolean) => {
    const current = holdRef.current;
    if (countInterruption && current.gesture && current.progressMs >= 120) {
      metricsRef.current.interruptedHolds += 1;
      metricsRef.current.stats[current.gesture].interruptions += 1;
    }
    holdRef.current = {
      gesture: null,
      progressMs: 0,
      lastTickAt: 0,
      lastValidAt: 0,
      attemptRecorded: false,
    };
    setCombatGesture(null);
    setCombatHoldProgress(0);
  }, []);

  const completeSession = useCallback((completedAt: number) => {
    if (!mountedRef.current || phaseRef.current === 'results' || phaseRef.current === 'menu') return;
    const config = configRef.current;
    const metrics = metricsRef.current;
    const participantId = getActiveUser() || 'Unknown';
    const gestureStats = gestures.map((gesture) => {
      const stat = metrics.stats[gesture];
      return {
        Gesture: gesture,
        Attempts: stat.attempts,
        Successful_Casts: stat.successes,
        Interrupted_Holds: stat.interruptions,
        Success_Rate_Percent: stat.attempts > 0 ? Number(((stat.successes / stat.attempts) * 100).toFixed(1)) : 0,
        Average_Similarity_Percent: stat.similaritySamples > 0
          ? Number(((stat.similarityTotal / stat.similaritySamples) * 100).toFixed(1))
          : 0,
      };
    });
    const session: SessionRecord = {
      Test_Date: FormatTestDate(new Date()),
      Participant_ID: participantId,
      Enemy_Max_HP: config.enemyMaxHp,
      Hold_Duration_Seconds: config.holdDuration,
      Strictness_Threshold: config.strictnessThreshold,
      Target_Mode: config.targetMode,
      Total_Duration_Seconds: Number(((completedAt - metrics.startedAt) / 1000).toFixed(1)),
      Successful_Casts: metrics.successfulCasts,
      Interrupted_Holds: metrics.interruptedHolds,
      Gesture_Stats: gestureStats,
      Cast_Records: metrics.casts.map((cast) => ({ ...cast })),
    };
    PlayGameEndSound('Victory', jsPsychRef);
    jsPsychLifecycleRef.current?.finish(session as unknown as Record<string, unknown>);
    setResult(session);
    setPhase('results');
    stopVision();
    void SaveTrainingSessionRecord({
      userName: participantId,
      moduleId: 'upper-limb-training',
      gameId: 'gesture-battler',
      gameTitle: t('training.gesture.title'),
      difficulty: config.targetMode,
      trainingDate: session.Test_Date,
      details: {
        Enemy_Max_HP: session.Enemy_Max_HP,
        Hold_Duration_Seconds: session.Hold_Duration_Seconds,
        Strictness_Threshold: session.Strictness_Threshold,
        Target_Mode: session.Target_Mode,
        Total_Duration_Seconds: session.Total_Duration_Seconds,
        Successful_Casts: session.Successful_Casts,
        Interrupted_Holds: session.Interrupted_Holds,
      },
      detailRows: gestureStats.map((stat) => ({ ...stat })),
    });
  }, [setPhase, stopVision, t]);

  const triggerAttack = useCallback(async (gesture: GestureId, similarity: number) => {
    if (attackActiveRef.current || phaseRef.current !== 'combat') return;
    attackActiveRef.current = true;
    const targetAtCast = configRef.current.targetMode === 'directed' ? targetGestureRef.current : null;
    PlaySuccessSound(jsPsychRef);
    await AnimateAttack(appRef.current, sceneRef.current, gesture);
    if (!mountedRef.current || phaseRef.current !== 'combat') {
      attackActiveRef.current = false;
      return;
    }

    const nextHp = Math.max(0, enemyHpRef.current - 1);
    enemyHpRef.current = nextHp;
    setCombatEnemyHp(nextHp);
    const stats = metricsRef.current.stats[gesture];
    stats.successes += 1;
    metricsRef.current.successfulCasts += 1;
    metricsRef.current.casts.push({
      Cast_Number: metricsRef.current.successfulCasts,
      Gesture: gesture,
      Target_Gesture: targetAtCast,
      Similarity_Percent: Number((similarity * 100).toFixed(1)),
      Cast_Time_Seconds: Number(((performance.now() - metricsRef.current.startedAt) / 1000).toFixed(2)),
      Enemy_HP_After: nextHp,
    });
    resetHold(false);

    if (nextHp <= 0) {
      window.setTimeout(() => completeSession(performance.now()), 650);
      return;
    }

    if (configRef.current.targetMode === 'directed') {
      const nextTarget = ChooseNextGesture(targetGestureRef.current);
      targetGestureRef.current = nextTarget;
      setCombatTargetGesture(nextTarget);
    }
    attackActiveRef.current = false;
  }, [completeSession, resetHold]);

  const handleCombatHand = useCallback((landmarks: NormalizedLandmark[], now: number) => {
    if (attackActiveRef.current) return;
    const rom = romRef.current;
    const currentFeatures = NormalizeFeatures(ExtractHandFeatures(landmarks), rom);
    const match = ClassifyGesture(currentFeatures, gestureProfilesRef.current);
    const threshold = configRef.current.strictnessThreshold;
    const isEligible = Boolean(
      match.gesture &&
      match.similarity >= threshold &&
      (configRef.current.targetMode === 'free' || match.gesture === targetGestureRef.current),
    );

    setHandVisible(true);

    if (match.gesture) {
      const stat = metricsRef.current.stats[match.gesture];
      stat.similarityTotal += match.similarity;
      stat.similaritySamples += 1;
    }

    if (!isEligible || !match.gesture) {
      setCombatGesture(match.gesture);
      setCombatHoldProgress(0);
      const withinGrace = now - holdRef.current.lastValidAt <= trackingGraceMs;
      if (!withinGrace) resetHold(true);
      return;
    }

    const hold = holdRef.current;
    if (hold.gesture !== match.gesture) {
      resetHold(hold.gesture !== null);
      holdRef.current = {
        gesture: match.gesture,
        progressMs: 0,
        lastTickAt: now,
        lastValidAt: now,
        attemptRecorded: true,
      };
      metricsRef.current.stats[match.gesture].attempts += 1;
    } else {
      const delta = hold.lastTickAt > 0 ? Math.min(120, now - hold.lastTickAt) : 0;
      hold.progressMs += delta;
      hold.lastTickAt = now;
      hold.lastValidAt = now;
    }

    const durationMs = configRef.current.holdDuration * 1000;
    const progress = Clamp(holdRef.current.progressMs / durationMs, 0, 1);
    setCombatGesture(match.gesture);
    setCombatHoldProgress(progress);
    if (progress >= 1) void triggerAttack(match.gesture, match.similarity);
  }, [resetHold, triggerAttack]);

  const beginCombat = useCallback(() => {
    const config = configRef.current;
    const firstTarget = RandomGesture();
    targetGestureRef.current = firstTarget;
    enemyHpRef.current = config.enemyMaxHp;
    setCombatEnemyHp(config.enemyMaxHp);
    setCombatTargetGesture(firstTarget);
    setCombatGesture(null);
    setCombatHoldProgress(0);
    metricsRef.current = {
      startedAt: performance.now(),
      successfulCasts: 0,
      interruptedHolds: 0,
      stats: CreateEmptyGestureStats(),
      casts: [],
    };
    attackActiveRef.current = false;
    setHandVisible(false);
    resetHold(false);
    setPhase('combat');
  }, [resetHold, setPhase]);

  const advanceCalibration = useCallback((features: number[], step: CalibrationStep, notice = '') => {
    if (step.kind === 'rom-closed') {
      romRef.current.closed = features;
    } else if (step.kind === 'rom-open') {
      romRef.current.open = features;
    } else {
      gestureProfilesRef.current[step.gesture as GestureId] = NormalizeFeatures(features, romRef.current);
    }

    const nextIndex = calibrationIndexRef.current + 1;
    calibrationCapturingRef.current = false;
    calibrationHoldStartRef.current = null;
    calibrationSamplesRef.current = [];
    setIsCalibrationCapturing(false);
    setCalibrationProgress(0);
    if (nextIndex >= calibrationSteps.length) {
      beginCombat();
      return;
    }
    calibrationIndexRef.current = nextIndex;
    setCalibrationIndex(nextIndex);
    setCalibrationNotice(notice);
  }, [beginCombat]);

  const handleCalibrationHand = useCallback((landmarks: NormalizedLandmark[], now: number) => {
    const step = calibrationSteps[calibrationIndexRef.current];
    if (!step) return;
    setHandVisible(true);
    if (!calibrationCapturingRef.current) return;

    const rawFeatures = ExtractHandFeatures(landmarks);
    if (calibrationHoldStartRef.current === null) {
      calibrationHoldStartRef.current = now;
      calibrationSamplesRef.current = [];
    }

    if (calibrationSamplesRef.current.length >= calibrationMinStableSamples) {
      const previousFeatures = AverageVectors(calibrationSamplesRef.current);
      if (CalibrationFeatureDifference(previousFeatures, rawFeatures) >= calibrationChangeThreshold) {
        advanceCalibration(
          previousFeatures,
          step,
          t('gesture.calibration.changeStopped'),
        );
        return;
      }
    }

    calibrationSamplesRef.current.push(rawFeatures);
    const elapsed = now - calibrationHoldStartRef.current;
    setCalibrationProgress(Clamp(elapsed / calibrationHoldMs, 0, 1));
    if (elapsed >= calibrationHoldMs) {
      advanceCalibration(AverageVectors(calibrationSamplesRef.current), step);
    }
  }, [advanceCalibration, t]);

  const handleNoHand = useCallback((now: number) => {
    setHandVisible(false);
    setCombatGesture(null);
    if (now - lastHandSeenAtRef.current <= trackingGraceMs) return;
    if (phaseRef.current === 'calibration') {
      if (!calibrationCapturingRef.current) return;
      if (calibrationSamplesRef.current.length === 0) return;
      const step = calibrationSteps[calibrationIndexRef.current];
      if (step && calibrationSamplesRef.current.length >= calibrationMinStableSamples) {
        advanceCalibration(
          AverageVectors(calibrationSamplesRef.current),
          step,
          t('gesture.calibration.changeStopped'),
        );
        return;
      }
      calibrationCapturingRef.current = false;
      calibrationHoldStartRef.current = null;
      calibrationSamplesRef.current = [];
      setIsCalibrationCapturing(false);
      setCalibrationProgress(0);
      setCalibrationNotice(t('gesture.calibration.insufficient'));
    } else if (phaseRef.current === 'combat') {
      resetHold(true);
    }
  }, [advanceCalibration, resetHold, t]);

  const startCurrentCalibration = useCallback(() => {
    calibrationCapturingRef.current = true;
    calibrationHoldStartRef.current = null;
    calibrationSamplesRef.current = [];
    setIsCalibrationCapturing(true);
    setCalibrationProgress(0);
    setCalibrationNotice('');
  }, []);

  const processFrame = useCallback((now: number) => {
    animationFrameRef.current = window.requestAnimationFrame(processFrame);
    const currentPhase = phaseRef.current;
    if (currentPhase !== 'calibration' && currentPhase !== 'combat') return;
    if (IsCoarsePointerPortrait()) {
      if (
        currentPhase === 'calibration'
        && (calibrationHoldStartRef.current !== null || calibrationSamplesRef.current.length > 0)
      ) {
        calibrationHoldStartRef.current = null;
        calibrationSamplesRef.current = [];
        setCalibrationProgress(0);
      } else if (
        currentPhase === 'combat'
        && (holdRef.current.gesture !== null || holdRef.current.progressMs > 0)
      ) {
        resetHold(false);
      }
      return;
    }
    if (now - lastDetectionAtRef.current < detectionIntervalMs) return;
    const video = videoRef.current;
    const landmarker = handLandmarkerRef.current;
    if (!video || !landmarker || video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) return;
    if (video.currentTime === lastVideoTimeRef.current) return;
    lastVideoTimeRef.current = video.currentTime;
    lastDetectionAtRef.current = now;

    try {
      const detection = landmarker.detectForVideo(video, now);
      const landmarks = detection.landmarks[0];
      DrawHandLandmarks(handCanvasRef.current, video, landmarks);
      if (!landmarks) {
        handleNoHand(now);
        return;
      }
      lastHandSeenAtRef.current = now;
      if (currentPhase === 'calibration') handleCalibrationHand(landmarks, now);
      else handleCombatHand(landmarks, now);
    } catch (error) {
      console.warn('Hand landmark detection failed.', error);
      setVisionError(t('gesture.error.initialization'));
      setShowVisionError(true);
      stopVision();
      showConfiguration();
    }
  }, [handleCalibrationHand, handleCombatHand, handleNoHand, resetHold, showConfiguration, stopVision, t]);

  const startCalibration = useCallback(async () => {
    if (!VerifySelectedTrainingUser()) return;
    if (!navigator.mediaDevices?.getUserMedia) {
      setVisionError(t('gesture.error.unsupported'));
      setShowVisionError(true);
      showConfiguration();
      return;
    }
    PrepareAudioFeedback(jsPsychRef);
    // Mobile browser fullscreen suppresses native page zoom on several browsers.
    // Keep the fixed game surface in the normal document so two-finger pinch zoom
    // remains available, while desktop retains the immersive fullscreen flow.
    if (!IsMobileGameViewport()) await enterTrainingFullscreen();
    await jsPsychLifecycleRef.current?.start({
      moduleId: 'motor:gesture-battler',
      onStart: async () => {
        if (appRef.current) ResizePixiAppToElement(appRef.current, pixiHostRef.current);
        stopVision();
        setVisionError('');
        setShowVisionError(false);
        setStatusMessage(t('gesture.loading.camera'));
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
            setVisionError(t('gesture.error.disconnected'));
            setShowVisionError(true);
            stopVision();
            jsPsychLifecycleRef.current?.abort({ abort_reason: 'camera-disconnected' });
            showConfiguration();
          }, { once: true });
          const video = videoRef.current;
          if (!video) throw new Error('Camera preview is unavailable.');
          video.srcObject = stream;
          await video.play();

          setStatusMessage(t('gesture.loading.model'));
          const landmarker = await LoadMediaPipeWithFallback(
            mediaPipeAssetCandidates,
            async ({ wasmUrl, handLandmarkerModelUrl }) => {
              const vision = await FilesetResolver.forVisionTasks(wasmUrl);
              return HandLandmarker.createFromOptions(vision, {
                baseOptions: { modelAssetPath: handLandmarkerModelUrl },
                runningMode: 'VIDEO',
                numHands: 1,
                minHandDetectionConfidence: 0.5,
                minHandPresenceConfidence: 0.5,
                minTrackingConfidence: 0.5,
              });
            },
          );
          if (!mountedRef.current) {
            landmarker.close();
            return;
          }
          handLandmarkerRef.current = landmarker;
          romRef.current = { closed: null, open: null };
          gestureProfilesRef.current = {};
          calibrationIndexRef.current = 0;
          calibrationCapturingRef.current = false;
          calibrationHoldStartRef.current = null;
          calibrationSamplesRef.current = [];
          lastHandSeenAtRef.current = 0;
          lastDetectionAtRef.current = 0;
          lastVideoTimeRef.current = -1;
          setCalibrationIndex(0);
          setIsCalibrationCapturing(false);
          setCalibrationProgress(0);
          setCalibrationNotice('');
          setResult(null);
          setPhase('calibration');
          animationFrameRef.current = window.requestAnimationFrame(processFrame);
        } catch (error) {
          console.error('Unable to initialize gesture recognition.', error);
          stopVision();
          setVisionError(error instanceof DOMException && error.name === 'NotAllowedError'
            ? t('gesture.error.permission')
            : t('gesture.error.initialization'));
          setShowVisionError(true);
          jsPsychLifecycleRef.current?.abort({ abort_reason: 'initialization-error' });
          showConfiguration();
        }
      },
    });
  }, [enterTrainingFullscreen, processFrame, setPhase, showConfiguration, stopVision, t]);

  const returnToMenu = useCallback(() => {
    jsPsychLifecycleRef.current?.abort({ abort_reason: 'return-to-menu' });
    stopVision();
    resetHold(false);
    calibrationCapturingRef.current = false;
    setIsCalibrationCapturing(false);
    setResult(null);
    setVisionError('');
    showConfiguration();
  }, [resetHold, showConfiguration, stopVision]);

  const exitGame = useCallback(() => {
    jsPsychLifecycleRef.current?.abort({ abort_reason: 'exit-training' });
    stopVision();
    onExit();
  }, [onExit, stopVision]);

  useTrainingAbort({
    active: ['initializing', 'calibration', 'combat'].includes(phase),
    onAbort: returnToMenu,
  });

  useEffect(() => {
    let cancelled = false;
    let initialized = false;
    const app = new Application();
    appRef.current = app;
    const host = pixiHostRef.current;

    const initialize = async () => {
      if (!host) return;
      await app.init({
        background: '#d9e6c3',
        antialias: false,
        autoDensity: true,
        resolution: Math.min(window.devicePixelRatio || 1, 2),
        resizeTo: host,
      });
      if (cancelled) return;
      initialized = true;
      host.appendChild(app.canvas);
      app.canvas.className = 'gesture-battler-canvas';
      app.ticker.add((ticker: Ticker) => {
        const scene = sceneRef.current;
        if (!scene || phaseRef.current !== 'combat') return;
        const time = ticker.lastTime / 520;
        scene.enemy.y = scene.enemyBaseY + Math.sin(time) * 3;
        scene.player.y = scene.playerBaseY + Math.sin(time * 0.8) * 2;
      });
      if (phaseRef.current === 'combat') {
        sceneRef.current = DrawBattleScene(app);
      }
    };
    void initialize();

    const onResize = () => {
      const currentApp = appRef.current;
      if (!initialized || !currentApp || !host) return;
      ResizePixiAppToElement(currentApp, host);
      if (phaseRef.current === 'combat') sceneRef.current = DrawBattleScene(currentApp);
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
      sceneRef.current = null;
    };
  }, []);

  useEffect(() => {
    const app = appRef.current;
    if (!app || phase !== 'combat') return;
    sceneRef.current = DrawBattleScene(app);
  }, [phase]);

  const activeCalibrationStep = calibrationSteps[calibrationIndex];
  const targetModeLabel = targetMode === 'free' ? t('gesture.config.free') : t('gesture.config.directed');
  const combatEnemyHpPercent = Clamp((combatEnemyHp / enemyMaxHp) * 100, 0, 100);
  const resultRows = useMemo(() => result?.Gesture_Stats ?? [], [result]);

  return (
    <div ref={fullscreenRootRef} className={`gesture-battler gesture-battler-phase-${phase}`}>
      <div ref={jsPsychHostRef} style={{ display: 'none' }} aria-hidden="true" />
      <div ref={pixiHostRef} className="gesture-battler-stage" />

      <button
        className="gesture-mobile-back"
        type="button"
        onClick={exitGame}
        aria-label={t('gesture.mobile.backLobby')}
        title={t('gesture.mobile.backLobby')}
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M14.5 5 7.5 12l7 7" />
        </svg>
      </button>

      <div className={`gesture-camera ${phase === 'menu' || phase === 'rules' || phase === 'initializing' || phase === 'results' ? 'gesture-camera-hidden' : ''}`}>
        <video ref={videoRef} muted playsInline aria-label={t('gesture.camera.preview')} />
        <canvas ref={handCanvasRef} aria-hidden="true" />
        <span>{handVisible ? t('gesture.camera.tracking') : t('gesture.camera.finding')}</span>
      </div>

      {['rules', 'initializing', 'calibration', 'combat'].includes(phase) && (
        <div className="gesture-orientation-gate" role="status" aria-live="polite">
          <span className="gesture-orientation-phone" aria-hidden="true" />
          <strong>{t('gesture.orientation.title')}</strong>
          <span>{t('gesture.orientation.description')}</span>
        </div>
      )}

      {phase === 'combat' && (
        <div className="gesture-combat-hud">
          <section className="gesture-enemy-status" aria-label={t('gesture.combat.enemyHp')}>
            <div>
              <strong>{t('gesture.enemy.name')}</strong>
              <span>Lv. 12</span>
            </div>
            <div
              className="gesture-hp-row"
              role="progressbar"
              aria-label={t('gesture.combat.enemyHp')}
              aria-valuemin={0}
              aria-valuemax={enemyMaxHp}
              aria-valuenow={combatEnemyHp}
            >
              <span>HP</span>
              <div aria-hidden="true">
                <i style={{ width: `${combatEnemyHpPercent}%` }} />
              </div>
              <strong>{combatEnemyHp}/{enemyMaxHp}</strong>
            </div>
          </section>

          <section className="gesture-move-menu" aria-label={t('gesture.combat.moves')}>
            <header>
              <span>{t('gesture.combat.moves')}</span>
              {targetMode === 'directed' && (
                <strong>{t('gesture.combat.target', { gesture: combatTargetGesture })}</strong>
              )}
            </header>
            <div className="gesture-move-list">
              {gestures.map((gesture) => {
                const selected = gesture === combatGesture;
                const eligible = targetMode === 'free' || gesture === combatTargetGesture;
                return (
                  <div
                    key={gesture}
                    className={`gesture-move ${selected ? 'selected' : ''} ${eligible ? '' : 'disabled'}`.trim()}
                  >
                    <span className="gesture-pointer" aria-hidden="true">{selected ? '▶' : ''}</span>
                    <b>{gesture}</b>
                    <span>{t(moveNameKeys[gesture])}</span>
                    {selected && eligible && (
                      <i
                        className="gesture-cast-ring"
                        style={{ '--gesture-progress': `${combatHoldProgress * 360}deg` } as React.CSSProperties}
                        aria-hidden="true"
                      />
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        </div>
      )}

      {phase === 'menu' && !isEmbeddedHubTraining && (
        <div className="training-panel gesture-menu-panel">
          <TrainingConfigPanel
            label={t('gesture.config.label')}
            title={t('training.gesture.title')}
            summaryTitle={t('training.gesture.title')}
            summaryItems={[
              { label: t('gesture.config.enemyHp'), value: enemyMaxHp },
              { label: t('gesture.config.holdDuration'), value: `${holdDuration}s` },
              { label: t('gesture.config.strictness'), value: `${Math.round(strictnessThreshold * 100)}%` },
              { label: t('gesture.config.targetMode'), value: targetModeLabel },
            ]}
            actions={(
              <TrainingConfigNavigationActions
                cancelLabel={t('training.cancel')}
                disabled={cameraPermission.status !== 'granted'}
                loading={cameraPermission.status === 'idle' || cameraPermission.status === 'requesting'}
                nextLabel={t('training.rules')}
                onCancel={exitGame}
                onNext={() => setPhase('rules')}
              >
                {visionError && (
                  <InlineAlert
                    tone="error"
                    className="training-start-alert"
                    onClick={canRetryCameraPermission
                      ? () => {
                        setVisionError('');
                        setShowVisionError(false);
                        cameraPermission.retry();
                      }
                      : () => setShowVisionError(true)}
                    aria-label={canRetryCameraPermission
                      ? retryPermissionLabel
                      : t('gesture.error.openDetails')}
                  >
                    {canRetryCameraPermission
                      ? `${visionError} ${retryPermissionLabel}`
                      : visionError}
                  </InlineAlert>
                )}
              </TrainingConfigNavigationActions>
            )}
          >
              <TrainingConfigSection
                title={t('gesture.config.enemyHp')}
                description={t('gesture.config.enemyHpDesc')}
                value={enemyMaxHp}
              >
                <input className="training-slider" type="range" min="1" max="100" step="1" value={enemyMaxHp}
                  aria-label={t('gesture.config.enemyHp')} onChange={(event) => setEnemyMaxHp(Clamp(Number(event.target.value), 1, 100))} />
              </TrainingConfigSection>

              <TrainingConfigSection
                title={t('gesture.config.holdDuration')}
                description={t('gesture.config.holdDurationDesc')}
                value={`${holdDuration}s`}
              >
                <input className="training-slider" type="range" min="0.5" max="10" step="0.1" value={holdDuration}
                  aria-label={t('gesture.config.holdDuration')} onChange={(event) => setHoldDuration(Clamp(Number(event.target.value), 0.5, 10))} />
              </TrainingConfigSection>

              <TrainingConfigSection
                title={t('gesture.config.strictness')}
                description={t('gesture.config.strictnessDesc')}
                value={`${Math.round(strictnessThreshold * 100)}%`}
              >
                <input
                  className="training-slider"
                  type="range"
                  min="50"
                  max="90"
                  step="5"
                  value={strictnessThreshold * 100}
                  onChange={(event) => setStrictnessThreshold(Number(event.target.value) / 100)}
                  aria-label={t('gesture.config.strictness')}
                />
              </TrainingConfigSection>

              <TrainingConfigSection
                title={t('gesture.config.targetMode')}
                description={t('gesture.config.targetModeDesc')}
                value={targetModeLabel}
              >
                <TrainingConfigOptionGroup columns={2}>
                  <button
                    type="button"
                    className={`training-option ${targetMode === 'free' ? 'active' : ''}`}
                    onClick={() => setTargetMode('free')}
                  >
                    <span className="training-option-title">{t('gesture.config.free')}</span>
                    <span className="training-option-meta">{t('gesture.config.freeDesc')}</span>
                  </button>
                  <button
                    type="button"
                    className={`training-option ${targetMode === 'directed' ? 'active' : ''}`}
                    onClick={() => setTargetMode('directed')}
                  >
                    <span className="training-option-title">{t('gesture.config.directed')}</span>
                    <span className="training-option-meta">{t('gesture.config.directedDesc')}</span>
                  </button>
                </TrainingConfigOptionGroup>
              </TrainingConfigSection>

              <TrainingConfigNotice
                title={t('gesture.privacy.title')}
                description={t('gesture.privacy.desc')}
              />
          </TrainingConfigPanel>
        </div>
      )}

      {phase === 'rules' && (
        <div className="training-panel gesture-menu-panel">
          <MotorTrainingRulesPanel
            gameId="gesture-battler"
            title={t('training.gesture.title')}
            summaryTitle={t('training.gesture.title')}
            summaryItems={[
              { label: t('gesture.config.enemyHp'), value: enemyMaxHp },
              { label: t('gesture.config.holdDuration'), value: `${holdDuration}s` },
              { label: t('gesture.config.strictness'), value: `${Math.round(strictnessThreshold * 100)}%` },
              { label: t('gesture.config.targetMode'), value: targetModeLabel },
            ]}
            onStart={() => void startCalibration()}
            onBack={showConfiguration}
          />
        </div>
      )}

      {phase === 'initializing' && (
        <div className="gesture-calibration-overlay">
          <div
            aria-label={statusMessage || t('gesture.loading.title')}
            aria-live="polite"
            className="gesture-loading-card"
            role="status"
          >
            <div className="gesture-loader" aria-hidden="true" />
          </div>
        </div>
      )}

      {phase === 'calibration' && activeCalibrationStep && (
        <div className="gesture-calibration-overlay">
          <div className="gesture-calibration-card">
            <div className="gesture-calibration-copy">
              <span className="gesture-step-count">
                {t('gesture.calibration.step', { current: calibrationIndex + 1, total: calibrationSteps.length })}
              </span>
              <h1>
                {t(activeCalibrationStep.titleKey, { gesture: activeCalibrationStep.gesture })}
              </h1>
              <p>
                {t(activeCalibrationStep.instructionKey, { gesture: activeCalibrationStep.gesture })}
              </p>
              <div className="gesture-calibration-progress">
                <span style={{ width: `${calibrationProgress * 100}%` }} />
              </div>
              <strong>
                {isCalibrationCapturing && calibrationProgress > 0
                  ? t('gesture.calibration.hold')
                  : isCalibrationCapturing
                    ? t('gesture.calibration.waitingForHand')
                    : t('gesture.calibration.ready')}
              </strong>
              {calibrationNotice && (
                <span className="gesture-calibration-notice">{calibrationNotice}</span>
              )}
            </div>
            <GestureCue gesture={activeCalibrationStep.gesture} />
            <div className="gesture-calibration-actions">
              <button
                className="btn btn-primary btn-lg"
                type="button"
                onClick={startCurrentCalibration}
                disabled={isCalibrationCapturing}
              >
                {isCalibrationCapturing
                  ? t('gesture.calibration.capturing')
                  : t('gesture.calibration.start')}
              </button>
              <button className="btn btn-ghost btn-lg" onClick={returnToMenu}>{t('training.cancel')}</button>
            </div>
          </div>
        </div>
      )}

      {phase === 'results' && result && (
        <div className="experiment-container experiment-container-scrollable gesture-results-container">
          <div className="experiment-results">
            <h1>{t('gesture.results.title')}</h1>
            <div className="training-result-summary gesture-result-summary">
              <span>
                <small>{t('gesture.results.user')}</small>
                <strong>{result.Participant_ID}</strong>
              </span>
              <span>
                <small>{t('gesture.results.casts')}</small>
                <strong>{result.Successful_Casts}</strong>
              </span>
              <span>
                <small>{t('gesture.results.interruptions')}</small>
                <strong>{result.Interrupted_Holds}</strong>
              </span>
              <span>
                <small>{t('gesture.results.duration')}</small>
                <strong>{result.Total_Duration_Seconds}s</strong>
              </span>
            </div>

            <table className="results-table">
              <thead>
                <tr>
                  <th>{t('gesture.results.gesture')}</th>
                  <th>{t('gesture.results.attempts')}</th>
                  <th>{t('gesture.results.successes')}</th>
                  <th>{t('gesture.results.successRate')}</th>
                  <th>{t('gesture.results.similarity')}</th>
                </tr>
              </thead>
              <tbody>
                {resultRows.map((stat) => (
                  <tr key={stat.Gesture}>
                    <td>{stat.Gesture}</td>
                    <td>{stat.Attempts}</td>
                    <td>{stat.Successful_Casts}</td>
                    <td>{stat.Success_Rate_Percent}%</td>
                    <td>{stat.Average_Similarity_Percent}%</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <TrainingResultActions
              backLabel={t('training.returnHome')}
              onBackHome={exitGame}
              hubLabel={t('training.returnLobby')}
            />
          </div>
        </div>
      )}

      {showVisionError && visionError && (
        <MediaDeviceErrorDialog
          title={t('gesture.error.title')}
          titleId="gesture-error-modal-title"
          message={visionError}
          onClose={() => setShowVisionError(false)}
        />
      )}
    </div>
  );
}

function GestureCue({ gesture }: { gesture: 0 | GestureId }) {
  const extendedCount = gesture;
  return (
    <div className="gesture-cue" aria-hidden="true">
      <svg viewBox="0 0 180 220">
        <rect x="58" y="92" width="72" height="92" rx="30" />
        {[0, 1, 2, 3].map((finger) => {
          const extended = finger < Math.min(extendedCount, 4);
          const x = 57 + finger * 24;
          const heights = [92, 104, 92, 72];
          const height = extended ? heights[finger] : 36;
          return (
            <rect
              key={finger}
              className={extended ? 'extended' : ''}
              x={x}
              y={95 - height}
              width="18"
              height={height}
              rx="9"
            />
          );
        })}
        <path className={extendedCount === 5 ? 'extended' : ''} d="M62 118 C30 96, 18 116, 33 137 L64 164 Z" />
      </svg>
      <strong>{gesture}</strong>
    </div>
  );
}

function ExtractHandFeatures(landmarks: NormalizedLandmark[]): number[] {
  const palmCenter = AveragePoints([landmarks[0], landmarks[5], landmarks[9], landmarks[13], landmarks[17]]);
  const palmWidth = Math.max(Distance3d(landmarks[5], landmarks[17]), 0.025);
  const tips = [4, 8, 12, 16, 20];
  const mcps = [2, 5, 9, 13, 17];
  const joints = [
    [1, 2, 3, 4],
    [5, 6, 7, 8],
    [9, 10, 11, 12],
    [13, 14, 15, 16],
    [17, 18, 19, 20],
  ];
  const features: number[] = [];

  tips.forEach((tip) => features.push(Distance3d(landmarks[tip], palmCenter) / palmWidth));
  tips.forEach((tip, index) => features.push(Distance3d(landmarks[tip], landmarks[mcps[index]]) / palmWidth));
  joints.forEach(([base, firstJoint, secondJoint, tip]) => {
    features.push(JointAngle(landmarks[base], landmarks[firstJoint], landmarks[secondJoint]) / 180);
    features.push(JointAngle(landmarks[firstJoint], landmarks[secondJoint], landmarks[tip]) / 180);
  });
  return features.map((value) => Number.isFinite(value) ? value : 0);
}

function NormalizeFeatures(features: number[], rom: RomProfile): number[] {
  if (!rom.closed || !rom.open) return [...features];
  return features.map((value, index) => {
    if (index >= 5) return value;
    const closed = rom.closed?.[index] ?? 0;
    const open = rom.open?.[index] ?? 1;
    const span = Math.max(Math.abs(open - closed), 0.08);
    return Clamp((value - closed) / span, -0.25, 1.25);
  });
}

function ClassifyGesture(
  features: number[],
  profiles: Partial<Record<GestureId, number[]>>,
): { gesture: GestureId | null; similarity: number } {
  let bestGesture: GestureId | null = null;
  let bestSimilarity = 0;
  gestures.forEach((gesture) => {
    const profile = profiles[gesture];
    if (!profile || profile.length !== features.length) return;
    let weightedDifference = 0;
    let totalWeight = 0;
    for (let index = 0; index < features.length; index += 1) {
      const weight = index < 5 ? 2.2 : index < 10 ? 1.35 : 1;
      weightedDifference += Math.min(Math.abs(features[index] - profile[index]), 1) * weight;
      totalWeight += weight;
    }
    const similarity = Clamp(1 - weightedDifference / totalWeight / 0.42, 0, 1);
    if (similarity > bestSimilarity) {
      bestSimilarity = similarity;
      bestGesture = gesture;
    }
  });
  return { gesture: bestGesture, similarity: bestSimilarity };
}

function AverageVectors(vectors: number[][]): number[] {
  if (vectors.length === 0) return [];
  const average = new Array(vectors[0].length).fill(0);
  vectors.forEach((vector) => vector.forEach((value, index) => {
    average[index] += value / vectors.length;
  }));
  return average;
}

function CalibrationFeatureDifference(previous: number[], current: number[]): number {
  if (previous.length === 0 || previous.length !== current.length) return 1;
  const total = previous.reduce((sum, value, index) => {
    const scale = index < 10 ? 1.5 : 1;
    return sum + Math.min(Math.abs(value - current[index]) / scale, 1);
  }, 0);
  return total / previous.length;
}

function AveragePoints(points: NormalizedLandmark[]): NormalizedLandmark {
  const total = points.reduce(
    (sum, point) => ({ x: sum.x + point.x, y: sum.y + point.y, z: sum.z + point.z }),
    { x: 0, y: 0, z: 0 },
  );
  return {
    x: total.x / points.length,
    y: total.y / points.length,
    z: total.z / points.length,
    visibility: 1,
  };
}

function Distance3d(left: Pick<NormalizedLandmark, 'x' | 'y' | 'z'>, right: Pick<NormalizedLandmark, 'x' | 'y' | 'z'>): number {
  return Math.hypot(left.x - right.x, left.y - right.y, left.z - right.z);
}

function JointAngle(
  first: NormalizedLandmark,
  middle: NormalizedLandmark,
  last: NormalizedLandmark,
): number {
  const left = { x: first.x - middle.x, y: first.y - middle.y, z: first.z - middle.z };
  const right = { x: last.x - middle.x, y: last.y - middle.y, z: last.z - middle.z };
  const denominator = Math.max(Math.hypot(left.x, left.y, left.z) * Math.hypot(right.x, right.y, right.z), 1e-6);
  const cosine = Clamp((left.x * right.x + left.y * right.y + left.z * right.z) / denominator, -1, 1);
  return Math.acos(cosine) * (180 / Math.PI);
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
  context.strokeStyle = '#67e8f9';
  context.fillStyle = '#fef08a';
  context.lineWidth = Math.max(2, canvas.width / 300);
  const connections = HandLandmarker.HAND_CONNECTIONS;
  connections.forEach(({ start, end }) => {
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
}

function RandomGesture(): GestureId {
  return gestures[Math.floor(Math.random() * gestures.length)];
}

function ChooseNextGesture(previous: GestureId): GestureId {
  const options = gestures.filter((gesture) => gesture !== previous);
  return options[Math.floor(Math.random() * options.length)];
}

function IsCoarsePointerPortrait(): boolean {
  return coarsePortraitMediaQuery?.matches ?? false;
}

function IsMobileGameViewport(): boolean {
  return mobileGameMediaQuery?.matches ?? false;
}

function ResizePixiAppToElement(app: Application, element: HTMLElement | null): void {
  const rect = element?.getBoundingClientRect();
  const width = Math.max(1, Math.round(rect?.width || window.innerWidth));
  const height = Math.max(1, Math.round(rect?.height || window.innerHeight));
  app.renderer.resize(width, height);
}

function DrawBattleScene(app: Application): BattleScene {
  app.stage.removeChildren().forEach((child) => child.destroy({ children: true }));
  const width = app.renderer.width;
  const height = app.renderer.height;
  const stage = app.stage;

  const background = new Graphics();
  background.rect(0, 0, width, height).fill(0xdce9c8);
  for (let y = 0; y < height; y += 8) {
    background.rect(0, y, width, 1).fill({ color: 0x79936b, alpha: 0.08 });
  }
  background.rect(0, height * 0.52, width, height * 0.48).fill(0xc3d6a8);
  background.ellipse(width * 0.73, height * 0.37, width * 0.18, height * 0.055).fill({ color: 0x62745b, alpha: 0.3 });
  background.ellipse(width * 0.24, height * 0.72, width * 0.2, height * 0.065).fill({ color: 0x62745b, alpha: 0.28 });
  stage.addChild(background);

  const enemy = CreatePixelEnemy();
  enemy.x = width * 0.73;
  const enemyBaseY = Clamp(height * 0.32, 130, height * 0.4);
  enemy.y = enemyBaseY;
  enemy.scale.set(Clamp(width / 1050, 0.7, 1.2));
  stage.addChild(enemy);

  const player = CreatePixelHero();
  player.x = width * 0.23;
  const playerBaseY = Clamp(height * 0.54, 220, height * 0.6);
  player.y = playerBaseY;
  player.scale.set(Clamp(width / 1100, 0.68, 1.15));
  stage.addChild(player);

  const effects = new Container();
  stage.addChild(effects);
  return { enemy, player, effects, width, height, enemyBaseY, playerBaseY };
}

function CreatePixelEnemy(): Container {
  const enemy = new Container();
  const body = new Graphics();
  body.rect(-72, -16, 144, 70).fill(0x5c86a3);
  body.rect(-56, -42, 112, 30).fill(0x75a5bf);
  body.rect(-42, -58, 84, 18).fill(0x94c4d6);
  body.rect(-76, 20, 18, 48).fill(0x3e617c);
  body.rect(58, 20, 18, 48).fill(0x3e617c);
  body.rect(-42, 50, 30, 20).fill(0x314b62);
  body.rect(12, 50, 30, 20).fill(0x314b62);
  body.rect(-32, -12, 20, 22).fill(0xf8fafc);
  body.rect(12, -12, 20, 22).fill(0xf8fafc);
  body.rect(-24, -4, 10, 14).fill(0x172554);
  body.rect(14, -4, 10, 14).fill(0x172554);
  body.rect(-18, 24, 36, 8).fill(0x263947);
  body.rect(-52, -50, 104, 8).fill(0xc7d9e2);
  enemy.addChild(body);
  return enemy;
}

function CreatePixelHero(): Container {
  const hero = new Container();
  const body = new Graphics();
  body.rect(-46, -12, 92, 88).fill(0x1f4f78);
  body.rect(-34, -34, 68, 26).fill(0xf2c79f);
  body.rect(-44, -50, 88, 20).fill(0x162d45);
  body.rect(-52, -42, 18, 44).fill(0x162d45);
  body.rect(-44, 72, 30, 24).fill(0x243447);
  body.rect(14, 72, 30, 24).fill(0x243447);
  body.rect(38, 0, 46, 18).fill(0xf2c79f);
  body.rect(72, -38, 16, 52).fill(0xf2c79f);
  body.rect(68, -54, 8, 22).fill(0xf2c79f);
  body.rect(79, -60, 8, 28).fill(0xf2c79f);
  body.rect(90, -54, 8, 22).fill(0xf2c79f);
  hero.addChild(body);
  return hero;
}

function AnimateAttack(
  app: Application | null,
  scene: BattleScene | null,
  gesture: GestureId,
): Promise<void> {
  if (!app || !scene) return Promise.resolve();
  const color = moveColors[gesture - 1];
  const projectile = new Graphics();
  projectile.rect(-10, -10, 20, 20).fill(color);
  projectile.rect(-4, -18, 8, 8).fill(0xffffff);
  const startX = scene.player.x + 72 * scene.player.scale.x;
  const startY = scene.playerBaseY - 18 * scene.player.scale.y;
  const endX = scene.enemy.x;
  const endY = scene.enemyBaseY;
  projectile.x = startX;
  projectile.y = startY;
  scene.effects.addChild(projectile);

  return new Promise((resolve) => {
    let elapsed = 0;
    const duration = 620;
    const tick = (ticker: Ticker) => {
      elapsed += ticker.deltaMS;
      const progress = Clamp(elapsed / duration, 0, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      projectile.x = startX + (endX - startX) * eased;
      projectile.y = startY + (endY - startY) * eased - Math.sin(progress * Math.PI) * 80;
      projectile.rotation += ticker.deltaMS * 0.012;
      if (progress < 1) return;
      app.ticker.remove(tick);
      projectile.destroy();
      const burst = new Graphics();
      for (let index = 0; index < 10; index += 1) {
        const angle = (Math.PI * 2 * index) / 10;
        burst.rect(Math.cos(angle) * 28 - 4, Math.sin(angle) * 28 - 4, 8, 8).fill(color);
      }
      burst.x = endX;
      burst.y = endY;
      scene.effects.addChild(burst);
      scene.enemy.alpha = 0.28;
      scene.enemy.x += 12;
      window.setTimeout(() => {
        if (!burst.destroyed) burst.destroy();
        if (!scene.enemy.destroyed) {
          scene.enemy.alpha = 1;
          scene.enemy.x -= 12;
        }
        resolve();
      }, 260);
    };
    app.ticker.add(tick);
  });
}

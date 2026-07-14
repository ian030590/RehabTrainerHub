import { useCallback, useEffect, useRef, useState } from 'react';
import { FaceLandmarker, FilesetResolver, type NormalizedLandmark } from '@mediapipe/tasks-vision';
import * as knnClassifier from '@tensorflow-models/knn-classifier';
import type { KNNClassifier } from '@tensorflow-models/knn-classifier';
import * as tf from '@tensorflow/tfjs';
import {
  Application,
  Assets,
  Container,
  MeshRope,
  Point,
  Sprite,
  Texture,
  type Ticker,
} from 'pixi.js';
import { initJsPsych } from 'jspsych';
import { useT, type TranslationKey } from '../../i18n';
import { downloadCsvFile } from '../../utils/downloadFile';
import { getActiveUser } from '../../utils/settings';
import {
  playFailureSound,
  playGameEndSound,
  playSuccessSound,
  prepareAudioFeedback,
} from '../../utils/soundManager';
import {
  DEFAULT_TONGUE_SETTINGS,
  getTongueTrainingSettings,
  saveTongueTrainingSettings,
  type TongueTrainingSettings,
} from '../../utils/tongueRehabStorage';
import { saveTrainingSessionRecord } from '../../utils/trainingRecords';
import { clamp, csvCell, formatTestDate, writeJsPsychData } from './gameUtils';
import { verifySelectedTrainingUser } from './selectedUserGuard';
import { StartTrainingButton } from '@rehab-trainer/ui/components/StartTrainingButton';
import { TrainingConfigPanel } from '@rehab-trainer/ui/components/TrainingConfigPanel';
import { TrainingResultActions } from '@rehab-trainer/ui/components/TrainingResultActions';
import { useFullscreenTrainingRoot } from '@rehab-trainer/ui/hooks/useFullscreenTrainingRoot';
import { useTrainingAbort } from '@rehab-trainer/ui/hooks/useTrainingAbort';
import { TrainingPrivacyNotice } from './TrainingPrivacyNotice';
import { InlineAlert } from '../../components/InlineAlert';
import { MediaDeviceErrorDialog } from '../../components/MediaDeviceErrorDialog';

type TongueClass = 'Rest' | 'Tongue_Left' | 'Tongue_Right';
type GamePhase = 'menu' | 'initializing' | 'calibration' | 'playing' | 'results';

interface TongueCatchGameProps {
  onExit: () => void;
}

interface CalibrationStep {
  label: TongueClass;
  titleKey: TranslationKey;
  instructionKey: TranslationKey;
}

interface AppleSprite {
  view: Container;
  size: number;
  resultIndex: number;
  baseX: number;
  fallElapsed: number;
  swayAmplitude: number;
  swayPhase: number;
  swaySpeed: number;
}

interface AppleResult {
  horizontalPositionPercent: number;
  caught: boolean;
}

interface TongueScene {
  root: Container;
  tongue: MeshRope;
  tongueTexture: Texture;
  appleTexture: Texture;
  points: Point[];
  apples: AppleSprite[];
  mouthX: number;
  mouthY: number;
  tongueLength: number;
  tongueDirection: -1 | 0 | 1;
  spawnElapsed: number;
}

interface RecognitionState {
  label: TongueClass;
  confidence: number;
  faceVisible: boolean;
}

interface SessionMetrics {
  startedAt: number;
  elapsed: number;
  score: number;
  missed: number;
  appleResults: AppleResult[];
  holdStartedAt: number | null;
  holdDirection: TongueClass | null;
  holdDurations: number[];
}

interface SessionResult {
  Test_Date: string;
  Participant_ID: string;
  Duration_Seconds: number;
  Score: number;
  Missed: number;
  Average_Hold_Seconds: number;
  Sensitivity: number;
  Growth_Rate_PX_Per_Second: number;
  Apple_Speed_PX_Per_Second: number;
  Spawn_Interval_Seconds: number;
  Edge_Chance_Percent: number;
  Apple_Results: AppleResult[];
}

const MEDIAPIPE_WASM_URL = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35/wasm';
const FACE_MODEL_URL = 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task';
const DETECTION_INTERVAL_MS = 72;
const CALIBRATION_CAPTURE_MS = 1900;
const MIN_CLASS_EXAMPLES = 10;
const MOUTH_FEATURE_WIDTH = 32;
const MOUTH_FEATURE_HEIGHT = 24;
const MAX_TONGUE_SEGMENTS = 10;
const TONGUE_WIDTH = 28;
const TONGUE_COLLISION_RADIUS = TONGUE_WIDTH / 2;
const APPLE_TEXTURE_URL = `${import.meta.env.BASE_URL}assets/tongue-apple.webp`;
const CALIBRATION_STEPS: readonly CalibrationStep[] = [
  {
    label: 'Rest',
    titleKey: 'tongue.calibration.restTitle',
    instructionKey: 'tongue.calibration.restInstruction',
  },
  {
    label: 'Tongue_Left',
    titleKey: 'tongue.calibration.leftTitle',
    instructionKey: 'tongue.calibration.leftInstruction',
  },
  {
    label: 'Tongue_Right',
    titleKey: 'tongue.calibration.rightTitle',
    instructionKey: 'tongue.calibration.rightInstruction',
  },
];
const LIP_LANDMARK_INDICES = Array.from(new Set(
  FaceLandmarker.FACE_LANDMARKS_LIPS.flatMap((connection) => [connection.start, connection.end]),
));

export function TongueCatchGame({ onExit }: TongueCatchGameProps) {
  const { t } = useT();
  const { fullscreenRootRef, enterTrainingFullscreen } = useFullscreenTrainingRoot<HTMLDivElement>();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const featureCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const pixiHostRef = useRef<HTMLDivElement | null>(null);
  const appRef = useRef<Application | null>(null);
  const sceneRef = useRef<TongueScene | null>(null);
  const appleTextureRef = useRef<Texture | null>(null);
  const faceLandmarkerRef = useRef<FaceLandmarker | null>(null);
  const cameraStreamRef = useRef<MediaStream | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const lastDetectionAtRef = useRef(0);
  const lastVideoTimeRef = useRef(-1);
  const classifierRef = useRef<KNNClassifier | null>(null);
  const predictionBusyRef = useRef(false);
  const mountedRef = useRef(true);
  const phaseRef = useRef<GamePhase>('menu');
  const calibrationIndexRef = useRef(0);
  const calibrationCaptureRef = useRef({
    active: false,
    startedAt: 0,
    samples: 0,
  });
  const lastMouthRef = useRef<{ x: number; y: number; visible: boolean }>({
    x: 0.5,
    y: 0.64,
    visible: false,
  });
  const recognitionRef = useRef<RecognitionState>({
    label: 'Rest',
    confidence: 0,
    faceVisible: false,
  });
  const configRef = useRef<TongueTrainingSettings>({ ...DEFAULT_TONGUE_SETTINGS });
  const metricsRef = useRef<SessionMetrics>(createSessionMetrics());
  const jsPsychRef = useRef<ReturnType<typeof initJsPsych> | null>(null);
  const finishSessionRef = useRef<() => void>(() => undefined);

  const activeUser = getActiveUser() || '';
  const [phase, setPhaseState] = useState<GamePhase>('menu');
  const [config, setConfig] = useState<TongueTrainingSettings>(() => (
    activeUser ? getTongueTrainingSettings(activeUser) : { ...DEFAULT_TONGUE_SETTINGS }
  ));
  const [calibrationIndex, setCalibrationIndex] = useState(0);
  const [calibrationProgress, setCalibrationProgress] = useState(0);
  const [isCapturing, setIsCapturing] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const [visionError, setVisionError] = useState('');
  const [showVisionError, setShowVisionError] = useState(false);
  const [recognition, setRecognition] = useState<RecognitionState>(recognitionRef.current);
  const [result, setResult] = useState<SessionResult | null>(null);

  const setPhase = useCallback((next: GamePhase) => {
    phaseRef.current = next;
    setPhaseState(next);
  }, []);

  useEffect(() => {
    configRef.current = config;
    if (activeUser) saveTongueTrainingSettings(activeUser, config);
  }, [activeUser, config]);

  useEffect(() => {
    jsPsychRef.current = initJsPsych();
  }, []);

  useEffect(() => {
    if (activeUser) setConfig(getTongueTrainingSettings(activeUser));
  }, [activeUser]);

  const stopVision = useCallback(() => {
    if (animationFrameRef.current !== null) {
      window.cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    cameraStreamRef.current?.getTracks().forEach((track) => track.stop());
    cameraStreamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    faceLandmarkerRef.current?.close();
    faceLandmarkerRef.current = null;
    predictionBusyRef.current = false;
    lastMouthRef.current.visible = false;
  }, []);

  useEffect(() => () => {
    mountedRef.current = false;
    stopVision();
    classifierRef.current?.dispose();
    classifierRef.current = null;
  }, [stopVision]);

  const syncRecognition = useCallback((next: RecognitionState) => {
    recognitionRef.current = next;
    setRecognition(next);
  }, []);

  const beginGame = useCallback(() => {
    const app = appRef.current;
    const appleTexture = appleTextureRef.current;
    if (!app || !appleTexture) return;
    resetTongueScene(app, sceneRef, appleTexture);
    metricsRef.current = {
      ...createSessionMetrics(),
      startedAt: performance.now(),
    };
    recognitionRef.current = { label: 'Rest', confidence: 0, faceVisible: false };
    setRecognition(recognitionRef.current);
    setResult(null);
    setPhase('playing');
  }, [setPhase]);

  const finishCalibrationStep = useCallback(() => {
    if (!calibrationCaptureRef.current.active) return;
    calibrationCaptureRef.current.active = false;
    setIsCapturing(false);
    setCalibrationProgress(1);
    const currentStep = CALIBRATION_STEPS[calibrationIndexRef.current];
    writeJsPsychData(jsPsychRef, {
      trial_type: 'tongue-calibration',
      class_label: currentStep.label,
      sample_count: calibrationCaptureRef.current.samples,
      participant_id: getActiveUser() || 'Unknown',
    }, 'Unable to write tongue calibration data to jsPsych.');

    const nextIndex = calibrationIndexRef.current + 1;
    if (nextIndex < CALIBRATION_STEPS.length) {
      calibrationIndexRef.current = nextIndex;
      setCalibrationIndex(nextIndex);
      window.setTimeout(() => setCalibrationProgress(0), 180);
      return;
    }

    beginGame();
  }, [beginGame]);

  const classifyFeature = useCallback(async (feature: tf.Tensor) => {
    const classifier = classifierRef.current;
    if (!classifier || predictionBusyRef.current) {
      feature.dispose();
      return;
    }
    predictionBusyRef.current = true;
    try {
      const prediction = await classifier.predictClass(feature, 3);
      if (!mountedRef.current || phaseRef.current !== 'playing') return;
      const label = isTongueClass(prediction.label) ? prediction.label : 'Rest';
      const confidence = prediction.confidences[prediction.label] ?? 0;
      const acceptedLabel = confidence >= configRef.current.sensitivity ? label : 'Rest';
      syncRecognition({
        label: acceptedLabel,
        confidence,
        faceVisible: true,
      });
    } catch (error) {
      console.warn('Tongue KNN prediction failed.', error);
    } finally {
      feature.dispose();
      predictionBusyRef.current = false;
    }
  }, [syncRecognition]);

  const processFrame = useCallback((now: number) => {
    animationFrameRef.current = window.requestAnimationFrame(processFrame);
    if (phaseRef.current !== 'calibration' && phaseRef.current !== 'playing') return;
    if (now - lastDetectionAtRef.current < DETECTION_INTERVAL_MS) return;
    const video = videoRef.current;
    const landmarker = faceLandmarkerRef.current;
    const featureCanvas = featureCanvasRef.current;
    if (!video || !landmarker || !featureCanvas || video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) return;
    if (video.currentTime === lastVideoTimeRef.current) return;
    lastVideoTimeRef.current = video.currentTime;
    lastDetectionAtRef.current = now;

    try {
      const detection = landmarker.detectForVideo(video, now);
      const landmarks = detection.faceLandmarks[0];
      if (!landmarks) {
        lastMouthRef.current.visible = false;
        if (phaseRef.current === 'playing') {
          syncRecognition({ label: 'Rest', confidence: 0, faceVisible: false });
        }
        return;
      }

      const mouth = calculateMouthAnchor(landmarks);
      lastMouthRef.current = { ...mouth, visible: true };
      const feature = extractMouthFeature(video, featureCanvas, landmarks);
      if (phaseRef.current === 'calibration') {
        if (!calibrationCaptureRef.current.active) {
          feature.dispose();
          return;
        }
        const step = CALIBRATION_STEPS[calibrationIndexRef.current];
        classifierRef.current?.addExample(feature, step.label);
        feature.dispose();
        calibrationCaptureRef.current.samples += 1;
        const progress = clamp((now - calibrationCaptureRef.current.startedAt) / CALIBRATION_CAPTURE_MS, 0, 1);
        setCalibrationProgress(progress);
        if (progress >= 1 && calibrationCaptureRef.current.samples >= MIN_CLASS_EXAMPLES) {
          void finishCalibrationStep();
        }
        return;
      }

      void classifyFeature(feature);
    } catch (error) {
      console.warn('Face landmark detection failed.', error);
      setVisionError(t('tongue.error.initialization'));
      setShowVisionError(true);
      stopVision();
      setPhase('menu');
    }
  }, [classifyFeature, finishCalibrationStep, setPhase, stopVision, syncRecognition, t]);

  const startSession = useCallback(async () => {
    if (!verifySelectedTrainingUser()) return;
    if (!navigator.mediaDevices?.getUserMedia) {
      setVisionError(t('tongue.error.unsupported'));
      setShowVisionError(true);
      return;
    }
    prepareAudioFeedback(jsPsychRef);
    await enterTrainingFullscreen();
    if (appRef.current) resizePixiAppToElement(appRef.current, pixiHostRef.current);
    stopVision();
    setVisionError('');
    setShowVisionError(false);
    setStatusMessage(t('tongue.loading.camera'));
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
        setVisionError(t('tongue.error.disconnected'));
        setShowVisionError(true);
        stopVision();
        setPhase('menu');
      }, { once: true });
      const video = videoRef.current;
      if (!video) throw new Error('Camera preview is unavailable.');
      video.srcObject = stream;
      await video.play();

      setStatusMessage(t('tongue.loading.model'));
      await tf.ready();
      const vision = await FilesetResolver.forVisionTasks(MEDIAPIPE_WASM_URL);
      const landmarker = await FaceLandmarker.createFromOptions(vision, {
        baseOptions: { modelAssetPath: FACE_MODEL_URL },
        runningMode: 'VIDEO',
        numFaces: 1,
        minFaceDetectionConfidence: 0.5,
        minFacePresenceConfidence: 0.5,
        minTrackingConfidence: 0.5,
      });
      if (!mountedRef.current) {
        landmarker.close();
        return;
      }
      faceLandmarkerRef.current = landmarker;

      classifierRef.current?.dispose();
      const classifier = knnClassifier.create();
      classifierRef.current = classifier;

      lastDetectionAtRef.current = 0;
      lastVideoTimeRef.current = -1;
      animationFrameRef.current = window.requestAnimationFrame(processFrame);
      classifier.clearAllClasses();
      calibrationIndexRef.current = 0;
      calibrationCaptureRef.current = { active: false, startedAt: 0, samples: 0 };
      setCalibrationIndex(0);
      setCalibrationProgress(0);
      setIsCapturing(false);
      setPhase('calibration');
    } catch (error) {
      console.error('Unable to initialize tongue training.', error);
      stopVision();
      setVisionError(error instanceof DOMException && error.name === 'NotAllowedError'
        ? t('tongue.error.permission')
        : t('tongue.error.initialization'));
      setShowVisionError(true);
      setPhase('menu');
    }
  }, [enterTrainingFullscreen, processFrame, setPhase, stopVision, t]);

  const startCalibrationCapture = useCallback(() => {
    const classifier = classifierRef.current;
    const step = CALIBRATION_STEPS[calibrationIndexRef.current];
    if (!classifier || !step) return;
    if ((classifier.getClassExampleCount()[step.label] ?? 0) > 0) {
      classifier.clearClass(step.label);
    }
    calibrationCaptureRef.current = {
      active: true,
      startedAt: performance.now(),
      samples: 0,
    };
    setCalibrationProgress(0);
    setIsCapturing(true);
  }, []);

  const finishSession = useCallback(() => {
    if (phaseRef.current !== 'playing') return;
    const metrics = metricsRef.current;
    closeActiveHold(metrics, performance.now());
    const configSnapshot = configRef.current;
    const participantId = getActiveUser() || 'Unknown';
    const averageHold = metrics.holdDurations.length > 0
      ? metrics.holdDurations.reduce((total, value) => total + value, 0) / metrics.holdDurations.length
      : 0;
    const session: SessionResult = {
      Test_Date: formatTestDate(new Date()),
      Participant_ID: participantId,
      Duration_Seconds: Number(metrics.elapsed.toFixed(1)),
      Score: metrics.score,
      Missed: metrics.missed,
      Average_Hold_Seconds: Number(averageHold.toFixed(2)),
      Sensitivity: configSnapshot.sensitivity,
      Growth_Rate_PX_Per_Second: configSnapshot.growthRate,
      Apple_Speed_PX_Per_Second: configSnapshot.appleSpeed,
      Spawn_Interval_Seconds: configSnapshot.spawnIntervalSec,
      Edge_Chance_Percent: Math.round(configSnapshot.edgeChance * 100),
      Apple_Results: metrics.appleResults.map((apple) => ({ ...apple })),
    };
    setResult(session);
    setPhase('results');
    stopVision();
    playGameEndSound('Victory', jsPsychRef);
    void saveTrainingSessionRecord({
      userName: participantId,
      moduleId: 'speech-training',
      moduleName: t('home.module.speech.title'),
      gameId: 'tongue-catch',
      gameTitle: t('tongue.title'),
      difficulty: difficultyLabel(configSnapshot),
      trainingDate: session.Test_Date,
      details: {
        Duration_Seconds: session.Duration_Seconds,
        Score: session.Score,
        Missed: session.Missed,
        Average_Hold_Seconds: session.Average_Hold_Seconds,
        Sensitivity: session.Sensitivity,
        Growth_Rate_PX_Per_Second: session.Growth_Rate_PX_Per_Second,
        Apple_Speed_PX_Per_Second: session.Apple_Speed_PX_Per_Second,
        Spawn_Interval_Seconds: session.Spawn_Interval_Seconds,
        Edge_Chance_Percent: session.Edge_Chance_Percent,
      },
      detailRows: session.Apple_Results.map((apple, index) => ({
        Apple_Index: index + 1,
        Apple_Horizontal_Position_Percent: apple.horizontalPositionPercent,
        Apple_Caught: apple.caught,
      })),
    });
    writeJsPsychData(
      jsPsychRef,
      session as unknown as Record<string, unknown>,
      'Unable to write tongue training result to jsPsych data.',
    );
  }, [setPhase, stopVision, t]);

  finishSessionRef.current = finishSession;

  useEffect(() => {
    let cancelled = false;
    let initialized = false;
    const app = new Application();

    const initialize = async () => {
      const host = pixiHostRef.current;
      if (!host) return;
      await app.init({
        backgroundAlpha: 0,
        antialias: true,
        autoDensity: true,
        resolution: Math.min(window.devicePixelRatio || 1, 2),
        resizeTo: host,
      });
      initialized = true;
      const appleTexture = await Assets.load<Texture>(APPLE_TEXTURE_URL);
      if (cancelled) {
        app.destroy(true, { children: true });
        return;
      }
      appRef.current = app;
      appleTextureRef.current = appleTexture;
      host.appendChild(app.canvas);
      app.canvas.className = 'tongue-catch-canvas';
      resetTongueScene(app, sceneRef, appleTexture);
      app.ticker.add((ticker: Ticker) => {
        if (phaseRef.current !== 'playing') return;
        updateTongueGame({
          app,
          ticker,
          sceneRef,
          recognition: recognitionRef.current,
          mouth: lastMouthRef.current,
          config: configRef.current,
          metrics: metricsRef.current,
          onCatch: () => {
            playSuccessSound(jsPsychRef);
          },
          onMiss: () => {
            playFailureSound(jsPsychRef);
          },
        });
        if (metricsRef.current.elapsed >= configRef.current.durationSec) {
          finishSessionRef.current();
        }
      });
    };
    void initialize();

    const handleResize = () => {
      const currentApp = appRef.current;
      const appleTexture = appleTextureRef.current;
      if (currentApp && appleTexture) resetTongueScene(currentApp, sceneRef, appleTexture);
    };
    window.addEventListener('resize', handleResize);
    return () => {
      cancelled = true;
      window.removeEventListener('resize', handleResize);
      if (sceneRef.current) destroyTongueScene(sceneRef.current);
      sceneRef.current = null;
      appRef.current = null;
      appleTextureRef.current = null;
      if (initialized) app.destroy(true, { children: true });
    };
  }, []);

  const returnToMenu = useCallback(() => {
    stopVision();
    setPhase('menu');
    setResult(null);
    setRecognition({ label: 'Rest', confidence: 0, faceVisible: false });
    recognitionRef.current = { label: 'Rest', confidence: 0, faceVisible: false };
    const app = appRef.current;
    const appleTexture = appleTextureRef.current;
    if (app && appleTexture) resetTongueScene(app, sceneRef, appleTexture);
  }, [setPhase, stopVision]);

  const exitGame = useCallback(() => {
    stopVision();
    onExit();
  }, [onExit, stopVision]);

  const downloadResult = useCallback(() => {
    if (!result) return;
    const summaryEntries = Object.entries(result)
      .filter(([key]) => key !== 'Apple_Results');
    const appleResults: Array<AppleResult | null> = result.Apple_Results.length > 0
      ? result.Apple_Results
      : [null];
    const rows = [
      [
        ...summaryEntries.map(([key]) => key),
        'Apple_Index',
        'Apple_Horizontal_Position_Percent',
        'Apple_Caught',
      ],
      ...appleResults.map((apple, index) => [
        ...summaryEntries.map(([, value]) => value),
        apple === null ? '' : index + 1,
        apple?.horizontalPositionPercent ?? '',
        apple?.caught ?? '',
      ]),
    ];
    downloadCsvFile(
      rows.map((row) => row.map(csvCell).join(',')).join('\n'),
      `tongue_catch_${Date.now()}.csv`,
    );
  }, [result]);

  useTrainingAbort({
    active: ['initializing', 'calibration', 'playing'].includes(phase),
    onAbort: returnToMenu,
  });

  const activeCalibrationStep = CALIBRATION_STEPS[calibrationIndex];

  return (
    <div ref={fullscreenRootRef} className={`tongue-catch tongue-catch-phase-${phase}`}>
      <video
        ref={videoRef}
        className="tongue-catch-video"
        style={{ opacity: config.cameraOpacity }}
        muted
        playsInline
        aria-label={t('tongue.camera.preview')}
      />
      <div ref={pixiHostRef} className="tongue-catch-stage" />
      <canvas
        ref={featureCanvasRef}
        className="tongue-feature-canvas"
        width={MOUTH_FEATURE_WIDTH}
        height={MOUTH_FEATURE_HEIGHT}
        aria-hidden="true"
      />

      {phase === 'menu' && (
        <div className="training-panel tongue-menu-panel">
          <TrainingConfigPanel
            className="tongue-config"
            label={t('tongue.config.label')}
            title={t('tongue.title')}
            summaryTitle={t('tongue.title')}
            summaryItems={[
              { label: t('tongue.config.sensitivity'), value: `${Math.round(config.sensitivity * 100)}%` },
              { label: t('tongue.config.growthRate'), value: `${config.growthRate} px/s` },
              {
                label: t('tongue.config.duration'),
                value: t('training.secondsShort', { value: config.durationSec }),
              },
              { label: t('tongue.config.appleSpeed'), value: `${config.appleSpeed} px/s` },
              { label: t('tongue.config.spawnRate'), value: `${config.spawnIntervalSec.toFixed(1)}s` },
              { label: t('tongue.config.edgeChance'), value: `${Math.round(config.edgeChance * 100)}%` },
            ]}
            actions={(
              <>
                {visionError && (
                  <InlineAlert
                    tone="error"
                    className="training-start-alert"
                    onClick={() => setShowVisionError(true)}
                    aria-label={t('tongue.error.openDetails')}
                  >
                    {visionError}
                  </InlineAlert>
                )}
                <StartTrainingButton onClick={() => void startSession()}>
                  {t('tongue.calibration.start')}
                </StartTrainingButton>
                <button className="btn btn-ghost btn-lg" onClick={exitGame}>{t('training.cancel')}</button>
              </>
            )}
          >
              <section className="training-setting">
                <div className="training-setting-header">
                  <div>
                    <h2>{t('tongue.config.sensitivity')}</h2>
                    <p>{t('tongue.config.sensitivityDesc')}</p>
                  </div>
                  <span>{Math.round(config.sensitivity * 100)}%</span>
                </div>
                <input
                  className="training-slider"
                  type="range"
                  min="45"
                  max="90"
                  step="5"
                  value={config.sensitivity * 100}
                  onChange={(event) => setConfig((current) => ({
                    ...current,
                    sensitivity: Number(event.target.value) / 100,
                  }))}
                />
              </section>

              <section className="training-setting">
                <div className="training-setting-header">
                  <div>
                    <h2>{t('tongue.config.growthRate')}</h2>
                    <p>{t('tongue.config.growthRateDesc')}</p>
                  </div>
                  <span>{config.growthRate} px/s</span>
                </div>
                <input
                  className="training-slider"
                  type="range"
                  min="80"
                  max="360"
                  step="20"
                  value={config.growthRate}
                  onChange={(event) => setConfig((current) => ({
                    ...current,
                    growthRate: Number(event.target.value),
                  }))}
                />
              </section>

              <section className="training-setting">
                <div className="training-setting-header">
                  <div>
                    <h2>{t('tongue.config.duration')}</h2>
                    <p>{t('tongue.config.durationDesc')}</p>
                  </div>
                  <span>{t('training.secondsShort', { value: config.durationSec })}</span>
                </div>
                <div className="training-option-grid training-option-grid-three">
                  {[60, 90, 120].map((value) => (
                    <button
                      key={value}
                      type="button"
                      className={`training-option ${config.durationSec === value ? 'active' : ''}`}
                      onClick={() => setConfig((current) => ({ ...current, durationSec: value }))}
                    >
                      <span className="training-option-title">{t('training.secondsShort', { value })}</span>
                    </button>
                  ))}
                </div>
              </section>

              <section className="training-setting">
                <div className="training-setting-header">
                  <div>
                    <h2>{t('tongue.config.appleSpeed')}</h2>
                    <p>{t('tongue.config.appleSpeedDesc')}</p>
                  </div>
                  <span>{config.appleSpeed} px/s</span>
                </div>
                <input
                  className="training-slider"
                  type="range"
                  min="60"
                  max="260"
                  step="10"
                  value={config.appleSpeed}
                  onChange={(event) => setConfig((current) => ({
                    ...current,
                    appleSpeed: Number(event.target.value),
                  }))}
                />
              </section>

              <section className="training-setting">
                <div className="training-setting-header">
                  <div>
                    <h2>{t('tongue.config.spawnRate')}</h2>
                    <p>{t('tongue.config.spawnRateDesc')}</p>
                  </div>
                  <span>{config.spawnIntervalSec.toFixed(1)}s</span>
                </div>
                <input
                  className="training-slider"
                  type="range"
                  min="0.6"
                  max="3.5"
                  step="0.1"
                  value={config.spawnIntervalSec}
                  onChange={(event) => setConfig((current) => ({
                    ...current,
                    spawnIntervalSec: Number(event.target.value),
                  }))}
                />
              </section>

              <section className="training-setting">
                <div className="training-setting-header">
                  <div>
                    <h2>{t('tongue.config.edgeChance')}</h2>
                    <p>{t('tongue.config.edgeChanceDesc')}</p>
                  </div>
                  <span>{Math.round(config.edgeChance * 100)}%</span>
                </div>
                <input
                  className="training-slider"
                  type="range"
                  min="0"
                  max="90"
                  step="10"
                  value={config.edgeChance * 100}
                  onChange={(event) => setConfig((current) => ({
                    ...current,
                    edgeChance: Number(event.target.value) / 100,
                  }))}
                />
              </section>

              <TrainingPrivacyNotice
                title={t('tongue.privacy.title')}
                description={t('tongue.privacy.desc')}
              />
          </TrainingConfigPanel>
        </div>
      )}

      {phase === 'initializing' && (
        <div className="gesture-calibration-overlay">
          <div className="gesture-loading-card">
            <div className="gesture-loader" />
            <h1>{t('tongue.loading.title')}</h1>
            <p>{statusMessage}</p>
          </div>
        </div>
      )}

      {phase === 'calibration' && activeCalibrationStep && (
        <div className="tongue-calibration-overlay">
          <div className="tongue-calibration-camera-space" aria-hidden="true">
            <div className="tongue-camera-guide" />
          </div>
          <div className="tongue-calibration-card">
            <span className="gesture-step-count">
              {t('tongue.calibration.step', { current: calibrationIndex + 1, total: CALIBRATION_STEPS.length })}
            </span>
            <div className={`tongue-direction-cue tongue-direction-${activeCalibrationStep.label.toLowerCase()}`}>
              <TongueCue label={activeCalibrationStep.label} />
            </div>
            <h1>{t(activeCalibrationStep.titleKey)}</h1>
            <p>{t(activeCalibrationStep.instructionKey)}</p>
            <div className="gesture-calibration-progress">
              <span style={{ width: `${calibrationProgress * 100}%` }} />
            </div>
            <strong>
              {isCapturing
                ? t('tongue.calibration.capturing')
                : t('tongue.calibration.capturePrompt')}
            </strong>
            <div className="gesture-calibration-actions">
              <button
                className="btn btn-primary btn-lg"
                onClick={startCalibrationCapture}
                disabled={isCapturing}
              >
                {isCapturing ? t('tongue.calibration.capturing') : t('tongue.calibration.capture')}
              </button>
              <button className="btn btn-ghost btn-lg" onClick={returnToMenu}>{t('training.cancel')}</button>
            </div>
          </div>
        </div>
      )}

      {phase === 'playing' && !recognition.faceVisible && (
        <div className="tongue-face-warning">{t('tongue.game.findFace')}</div>
      )}

      {phase === 'results' && result && (
        <div className="experiment-container experiment-container-scrollable tongue-results-container">
          <div className="experiment-results">
            <h1>{t('tongue.results.title')}</h1>
            <div className="training-result-summary">
              <span>
                <small>{t('tongue.results.score')}</small>
                <strong>{result.Score}</strong>
              </span>
              <span>
                <small>{t('tongue.results.missed')}</small>
                <strong>{result.Missed}</strong>
              </span>
              <span>
                <small>{t('tongue.results.duration')}</small>
                <strong>{result.Duration_Seconds}s</strong>
              </span>
              <span>
                <small>{t('tongue.results.avgHold')}</small>
                <strong>{result.Average_Hold_Seconds}s</strong>
              </span>
            </div>
            <dl className="tongue-result-details">
              <div><dt>{t('tongue.results.user')}</dt><dd>{result.Participant_ID}</dd></div>
              <div><dt>{t('tongue.results.date')}</dt><dd>{result.Test_Date}</dd></div>
              <div><dt>{t('tongue.config.sensitivity')}</dt><dd>{Math.round(result.Sensitivity * 100)}%</dd></div>
              <div><dt>{t('tongue.config.growthRate')}</dt><dd>{result.Growth_Rate_PX_Per_Second} px/s</dd></div>
              <div><dt>{t('tongue.config.appleSpeed')}</dt><dd>{result.Apple_Speed_PX_Per_Second} px/s</dd></div>
              <div><dt>{t('tongue.config.spawnRate')}</dt><dd>{result.Spawn_Interval_Seconds}s</dd></div>
              <div><dt>{t('tongue.config.edgeChance')}</dt><dd>{result.Edge_Chance_Percent}%</dd></div>
            </dl>
            <table className="results-table">
              <thead>
                <tr>
                  <th>{t('tongue.results.appleIndex')}</th>
                  <th>{t('tongue.results.appleHorizontalPosition')}</th>
                  <th>{t('tongue.results.appleCaught')}</th>
                </tr>
              </thead>
              <tbody>
                {result.Apple_Results.map((apple, index) => (
                  <tr key={`${index}-${apple.horizontalPositionPercent}`}>
                    <td>{index + 1}</td>
                    <td>{apple.horizontalPositionPercent}%</td>
                    <td className={apple.caught ? 'result-success' : 'result-fail'}>
                      {t(apple.caught ? 'tongue.results.caughtYes' : 'tongue.results.caughtNo')}
                    </td>
                  </tr>
                ))}
                {result.Apple_Results.length === 0 && (
                  <tr>
                    <td colSpan={3}>{t('tongue.results.noApples')}</td>
                  </tr>
                )}
              </tbody>
            </table>
            <TrainingResultActions
              downloadLabel={t('training.downloadCsvRecord')}
              restartLabel={t('training.restart')}
              backLabel={t('training.returnHome')}
              onDownloadCsv={downloadResult}
              onRestart={() => void startSession()}
              onBackHome={returnToMenu}
            />
          </div>
        </div>
      )}

      {showVisionError && visionError && (
        <MediaDeviceErrorDialog
          title={t('tongue.error.title')}
          titleId="tongue-error-modal-title"
          message={visionError}
          onClose={() => setShowVisionError(false)}
        />
      )}
    </div>
  );
}

function TongueCue({ label }: { label: TongueClass }) {
  const tongueX = label === 'Tongue_Left' ? 35 : label === 'Tongue_Right' ? 105 : 70;
  const tongueWidth = label === 'Rest' ? 18 : 54;
  return (
    <svg viewBox="0 0 140 100" aria-hidden="true">
      <path d="M25 52 C33 24 107 24 115 52 C105 77 35 77 25 52Z" fill="#fff" stroke="currentColor" strokeWidth="5" />
      <path d="M38 51 C52 63 88 63 102 51" fill="none" stroke="#7f1d1d" strokeWidth="5" strokeLinecap="round" />
      <rect
        x={tongueX - tongueWidth / 2}
        y="50"
        width={tongueWidth}
        height="22"
        rx="11"
        fill="#fb7185"
        stroke="#be123c"
        strokeWidth="3"
      />
    </svg>
  );
}

function createSessionMetrics(): SessionMetrics {
  return {
    startedAt: 0,
    elapsed: 0,
    score: 0,
    missed: 0,
    appleResults: [],
    holdStartedAt: null,
    holdDirection: null,
    holdDurations: [],
  };
}

function resizePixiAppToElement(app: Application, element: HTMLElement | null): void {
  const rect = element?.getBoundingClientRect();
  const width = Math.max(1, Math.round(rect?.width || window.innerWidth));
  const height = Math.max(1, Math.round(rect?.height || window.innerHeight));
  app.renderer.resize(width, height);
}

function resetTongueScene(
  app: Application,
  sceneRef: { current: TongueScene | null },
  appleTexture: Texture,
): void {
  if (sceneRef.current) destroyTongueScene(sceneRef.current);
  const root = new Container();
  const points = Array.from({ length: MAX_TONGUE_SEGMENTS }, () => new Point(app.screen.width / 2, app.screen.height * 0.66));
  const tongueTexture = createTongueTexture();
  const tongue = new MeshRope({
    texture: tongueTexture,
    points,
    width: TONGUE_WIDTH,
  });
  root.addChild(tongue);
  app.stage.addChild(root);
  sceneRef.current = {
    root,
    tongue,
    tongueTexture,
    appleTexture,
    points,
    apples: [],
    mouthX: app.screen.width / 2,
    mouthY: app.screen.height * 0.66,
    tongueLength: 0,
    tongueDirection: 0,
    spawnElapsed: 0,
  };
}

function destroyTongueScene(scene: TongueScene): void {
  scene.apples.forEach((apple) => apple.view.destroy({ children: true }));
  scene.apples = [];
  scene.root.removeFromParent();
  scene.root.destroy({ children: true });
  scene.tongueTexture.destroy(true);
}

function createTongueTexture(): Texture {
  const canvas = document.createElement('canvas');
  canvas.width = 96;
  canvas.height = 32;
  const context = canvas.getContext('2d');
  if (context) {
    const gradient = context.createLinearGradient(0, 0, 0, canvas.height);
    gradient.addColorStop(0, '#fda4af');
    gradient.addColorStop(1, '#e11d48');
    context.fillStyle = gradient;
    context.beginPath();
    context.roundRect(1, 2, 94, 28, 14);
    context.fill();
    context.strokeStyle = '#9f1239';
    context.lineWidth = 2;
    context.stroke();
    context.beginPath();
    context.moveTo(10, 11);
    context.lineTo(84, 11);
    context.strokeStyle = 'rgba(255,255,255,0.45)';
    context.lineWidth = 3;
    context.lineCap = 'round';
    context.stroke();
  }
  return Texture.from(canvas);
}

function updateTongueGame(args: {
  app: Application;
  ticker: Ticker;
  sceneRef: { current: TongueScene | null };
  recognition: RecognitionState;
  mouth: { x: number; y: number; visible: boolean };
  config: TongueTrainingSettings;
  metrics: SessionMetrics;
  onCatch: () => void;
  onMiss: () => void;
}) {
  const scene = args.sceneRef.current;
  if (!scene) return;
  const dt = Math.min(args.ticker.deltaMS / 1000, 0.05);
  args.metrics.elapsed += dt;

  const mappedMouth = mapVideoPointToStage(
    args.mouth.x,
    args.mouth.y,
    args.app.screen.width,
    args.app.screen.height,
  );
  if (args.mouth.visible) {
    scene.mouthX += (mappedMouth.x - scene.mouthX) * Math.min(1, dt * 9);
    scene.mouthY += (mappedMouth.y - scene.mouthY) * Math.min(1, dt * 9);
  }

  const direction = args.recognition.faceVisible && args.recognition.confidence >= args.config.sensitivity
    ? args.recognition.label === 'Tongue_Left'
      ? -1
      : args.recognition.label === 'Tongue_Right'
        ? 1
        : 0
    : 0;
  if (direction === 0) {
    scene.tongueLength = Math.max(0, scene.tongueLength - args.config.growthRate * 1.7 * dt);
    closeActiveHold(args.metrics, performance.now());
  } else {
    if (args.metrics.holdDirection !== args.recognition.label) {
      closeActiveHold(args.metrics, performance.now());
      args.metrics.holdStartedAt = performance.now();
      args.metrics.holdDirection = args.recognition.label;
    }
    if (scene.tongueDirection !== 0 && scene.tongueDirection !== direction) {
      scene.tongueLength = 0;
    }
    scene.tongueDirection = direction;
    const maxLength = direction < 0
      ? Math.max(0, scene.mouthX)
      : Math.max(0, args.app.screen.width - scene.mouthX);
    scene.tongueLength = Math.min(maxLength, scene.tongueLength + args.config.growthRate * dt);
  }
  if (scene.tongueLength <= 1) scene.tongueDirection = direction;
  updateTonguePoints(scene);

  scene.spawnElapsed += dt;
  if (scene.spawnElapsed >= args.config.spawnIntervalSec) {
    scene.spawnElapsed = 0;
    const resultIndex = args.metrics.appleResults.length;
    const position = spawnApple(scene, args.app.screen.width, args.config.edgeChance, resultIndex);
    args.metrics.appleResults.push({
      horizontalPositionPercent: position,
      caught: false,
    });
  }

  for (let index = scene.apples.length - 1; index >= 0; index -= 1) {
    const apple = scene.apples[index];
    apple.fallElapsed += dt;
    apple.view.y += args.config.appleSpeed * dt;
    const sway = Math.sin(apple.swayPhase + apple.fallElapsed * apple.swaySpeed);
    const half = apple.size / 2;
    apple.view.x = clamp(
      apple.baseX + sway * apple.swayAmplitude,
      half,
      args.app.screen.width - half,
    );
    apple.view.rotation = sway * 0.09;
    const caught = scene.tongueLength > 20
      && tongueIntersectsApple(scene.points, apple);
    if (caught) {
      const appleResult = args.metrics.appleResults[apple.resultIndex];
      if (appleResult) appleResult.caught = true;
      removeApple(scene, index);
      args.metrics.score += 1;
      args.onCatch();
      continue;
    }
    if (apple.view.y - half > args.app.screen.height) {
      removeApple(scene, index);
      args.metrics.missed += 1;
      args.onMiss();
    }
  }
}

function updateTonguePoints(scene: TongueScene): void {
  const direction = scene.tongueDirection || 1;
  scene.points.forEach((point, index) => {
    const progress = index / (scene.points.length - 1);
    point.x = scene.mouthX + direction * scene.tongueLength * progress;
    point.y = scene.mouthY;
  });
  scene.tongue.visible = scene.tongueLength > 2;
}

function tongueIntersectsApple(points: Point[], apple: AppleSprite): boolean {
  const collisionRadius = apple.size / 2 + TONGUE_COLLISION_RADIUS;
  const collisionRadiusSquared = collisionRadius * collisionRadius;
  for (let index = 1; index < points.length; index += 1) {
    if (distanceToSegmentSquared(
      apple.view.x,
      apple.view.y,
      points[index - 1].x,
      points[index - 1].y,
      points[index].x,
      points[index].y,
    ) <= collisionRadiusSquared) {
      return true;
    }
  }
  return false;
}

function distanceToSegmentSquared(
  pointX: number,
  pointY: number,
  startX: number,
  startY: number,
  endX: number,
  endY: number,
): number {
  const segmentX = endX - startX;
  const segmentY = endY - startY;
  const segmentLengthSquared = segmentX * segmentX + segmentY * segmentY;
  if (segmentLengthSquared === 0) {
    const dx = pointX - startX;
    const dy = pointY - startY;
    return dx * dx + dy * dy;
  }

  const projection = clamp(
    ((pointX - startX) * segmentX + (pointY - startY) * segmentY) / segmentLengthSquared,
    0,
    1,
  );
  const closestX = startX + segmentX * projection;
  const closestY = startY + segmentY * projection;
  const dx = pointX - closestX;
  const dy = pointY - closestY;
  return dx * dx + dy * dy;
}

function spawnApple(
  scene: TongueScene,
  width: number,
  edgeChance: number,
  resultIndex: number,
): number {
  const useEdge = Math.random() < edgeChance;
  const side = Math.random() < 0.5 ? -1 : 1;
  const normalizedX = useEdge
    ? side < 0
      ? randomBetween(0.1, 0.28)
      : randomBetween(0.72, 0.9)
    : randomBetween(0.27, 0.73);
  const size = randomBetween(95, 120);
  const apple = createAppleSprite(size, scene.appleTexture, resultIndex);
  apple.baseX = width * normalizedX;
  apple.view.x = apple.baseX;
  apple.view.y = -size;
  scene.apples.push(apple);
  scene.root.addChild(apple.view);
  return Number((normalizedX * 200 - 100).toFixed(1));
}

function createAppleSprite(size: number, texture: Texture, resultIndex: number): AppleSprite {
  const view = new Container();
  const sprite = new Sprite({
    texture,
    anchor: 0.5,
    width: size,
    height: size,
  });
  view.addChild(sprite);
  return {
    view,
    size,
    resultIndex,
    baseX: 0,
    fallElapsed: 0,
    swayAmplitude: randomBetween(5, 9),
    swayPhase: randomBetween(0, Math.PI * 2),
    swaySpeed: randomBetween(1.7, 2.3),
  };
}

function removeApple(scene: TongueScene, index: number): void {
  const [apple] = scene.apples.splice(index, 1);
  if (!apple) return;
  apple.view.removeFromParent();
  apple.view.destroy({ children: true });
}

function closeActiveHold(metrics: SessionMetrics, now: number): void {
  if (metrics.holdStartedAt !== null) {
    const duration = Math.max(0, (now - metrics.holdStartedAt) / 1000);
    if (duration >= 0.12) metrics.holdDurations.push(duration);
  }
  metrics.holdStartedAt = null;
  metrics.holdDirection = null;
}

function calculateMouthAnchor(landmarks: NormalizedLandmark[]): { x: number; y: number } {
  const points = LIP_LANDMARK_INDICES.map((index) => landmarks[index]).filter(Boolean);
  if (points.length === 0) return { x: 0.5, y: 0.64 };
  return {
    x: points.reduce((total, point) => total + point.x, 0) / points.length,
    y: points.reduce((total, point) => total + point.y, 0) / points.length,
  };
}

function extractMouthFeature(
  video: HTMLVideoElement,
  canvas: HTMLCanvasElement,
  landmarks: NormalizedLandmark[],
): tf.Tensor {
  const points = LIP_LANDMARK_INDICES.map((index) => landmarks[index]).filter(Boolean);
  const minX = Math.min(...points.map((point) => point.x));
  const maxX = Math.max(...points.map((point) => point.x));
  const minY = Math.min(...points.map((point) => point.y));
  const maxY = Math.max(...points.map((point) => point.y));
  const mouthWidth = Math.max(maxX - minX, 0.04);
  const mouthHeight = Math.max(maxY - minY, 0.025);
  const centerX = (minX + maxX) / 2;
  const centerY = (minY + maxY) / 2 + mouthHeight * 0.55;
  const cropWidth = mouthWidth * 1.65;
  const cropHeight = Math.max(mouthHeight * 3.2, cropWidth * 0.7);
  const sourceX = clamp((centerX - cropWidth / 2) * video.videoWidth, 0, video.videoWidth - 1);
  const sourceY = clamp((centerY - cropHeight / 2) * video.videoHeight, 0, video.videoHeight - 1);
  const sourceWidth = Math.min(cropWidth * video.videoWidth, video.videoWidth - sourceX);
  const sourceHeight = Math.min(cropHeight * video.videoHeight, video.videoHeight - sourceY);
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) return tf.zeros([MOUTH_FEATURE_WIDTH * MOUTH_FEATURE_HEIGHT]);
  context.save();
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.translate(canvas.width, 0);
  context.scale(-1, 1);
  context.drawImage(
    video,
    sourceX,
    sourceY,
    sourceWidth,
    sourceHeight,
    0,
    0,
    canvas.width,
    canvas.height,
  );
  context.restore();
  return tf.tidy(() => {
    const image = tf.browser.fromPixels(canvas, 1).toFloat().div(255);
    const moments = tf.moments(image);
    return image.sub(moments.mean).div(moments.variance.sqrt().add(0.05)).flatten();
  });
}

function mapVideoPointToStage(
  normalizedX: number,
  normalizedY: number,
  stageWidth: number,
  stageHeight: number,
): { x: number; y: number } {
  const video = document.querySelector<HTMLVideoElement>('.tongue-catch-video');
  const videoWidth = video?.videoWidth || 4;
  const videoHeight = video?.videoHeight || 3;
  const scale = Math.max(stageWidth / videoWidth, stageHeight / videoHeight);
  const renderedWidth = videoWidth * scale;
  const renderedHeight = videoHeight * scale;
  const offsetX = (stageWidth - renderedWidth) / 2;
  const offsetY = (stageHeight - renderedHeight) / 2;
  return {
    x: offsetX + (1 - normalizedX) * renderedWidth,
    y: offsetY + normalizedY * renderedHeight,
  };
}

function isTongueClass(value: string): value is TongueClass {
  return value === 'Rest' || value === 'Tongue_Left' || value === 'Tongue_Right';
}

function difficultyLabel(config: TongueTrainingSettings): string {
  const pressure = config.appleSpeed / 120 + 1.5 / config.spawnIntervalSec + config.edgeChance;
  if (pressure < 2.15) return 'beginner';
  if (pressure < 3) return 'intermediate';
  return 'advanced';
}

function randomBetween(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

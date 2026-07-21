import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  FilesetResolver,
  HandLandmarker,
  PoseLandmarker,
  type NormalizedLandmark,
} from '@mediapipe/tasks-vision';
import { GetAuthUserNameFromToken } from '@rehab-trainer/ui/auth/authClient';
import { ResultSummary } from '@rehab-trainer/ui/components/ResultSummary';
import { StartTrainingButton } from '@rehab-trainer/ui/components/StartTrainingButton';
import { TrainingConfigPanel } from '@rehab-trainer/ui/components/TrainingConfigPanel';
import { TrainingResultActions } from '@rehab-trainer/ui/components/TrainingResultActions';
import { TrainingRulesPanel } from '@rehab-trainer/ui/components/TrainingRulesPanel';
import { CreateCsvContent } from '@rehab-trainer/ui/csv';
import { DownloadCsvFile } from '@rehab-trainer/ui/downloadFile';
import { useFullscreenTrainingRoot } from '@rehab-trainer/ui/hooks/useFullscreenTrainingRoot';
import { useTrainingAbort } from '@rehab-trainer/ui/hooks/useTrainingAbort';
import { Application, Container, Graphics, Text } from 'pixi.js';
import { initJsPsych, JsPsych, ParameterType } from 'jspsych';
import type { JsPsychPlugin, TrialType } from 'jspsych';
import { useNavigate } from 'react-router-dom';
import { useT } from '../i18n';
import { SaveTrainingRecord, type BrainTrainingRecord } from '../utils/trainingRecords';
import './EveryBallResponsePage.css';

type Phase = 'menu' | 'rules' | 'initializing' | 'playing' | 'results';
type InputMode = 'camera' | 'microphone';
type FixationStyle = 'cross' | 'blank';
type BallId = 'basketball' | 'soccer' | 'tennis' | 'beach';
type ResponseAction = 'clap' | 'thigh';
type ExpectedAction = ResponseAction | 'none';
type ResponseSource = InputMode | 'keyboard';
type TrialOutcome = 'hit' | 'correct_reject' | 'miss' | 'false_alarm' | 'wrong_action';

interface LevelDefinition {
  id: 1 | 2 | 3;
  trialCount: number;
  passAccuracy: number;
}

interface GameConfig {
  levelId: LevelDefinition['id'];
  inputMode: InputMode;
  fixationStyle: FixationStyle;
  trialCount: number;
  microphoneSensitivity: number;
}

interface TrialPlan {
  trialNumber: number;
  levelId: LevelDefinition['id'];
  ball: BallId;
  expectedAction: ExpectedAction;
  fixationMs: number;
  xRatio: number;
  yRatio: number;
}

interface ActionResponse {
  action: ResponseAction;
  rtMs: number;
  source: ResponseSource;
}

interface TrialRecord {
  Trial_Number: number;
  Level: number;
  Ball: string;
  Expected_Action: string;
  Response_Action: string;
  Response_Source: string;
  Outcome: TrialOutcome;
  Correct: boolean;
  Reaction_Time_ms: number | null;
  Fixation_ms: number;
}

interface SessionSummary {
  date: string;
  participant: string;
  levelTitle: string;
  inputMode: string;
  total: number;
  correct: number;
  accuracy: number;
  averageRtMs: number | null;
  misses: number;
  falseAlarms: number;
  wrongActions: number;
  passed: boolean;
  trials: TrialRecord[];
}

interface VisualState {
  phase: 'idle' | 'fixation' | 'stimulus' | 'blank' | 'feedback';
  trialNumber?: number;
  totalTrials?: number;
  ball?: BallId;
  expectedAction?: ExpectedAction;
  fixationStyle?: FixationStyle;
  xRatio?: number;
  yRatio?: number;
  feedbackCorrect?: boolean;
}

interface InputRuntime {
  stop: () => void | Promise<void>;
}

interface CameraRuntimeOptions {
  video: HTMLVideoElement;
  overlay: HTMLCanvasElement;
  controller: ResponseInputController;
  onStatus: (status: string) => void;
}

interface MicrophoneRuntimeOptions {
  sensitivity: number;
  controller: ResponseInputController;
  onLevel: (level: number) => void;
  onStatus: (status: string) => void;
}

interface EveryBallLabels {
  title: string;
  configLabel: string;
  rulesLabel: string;
  trainingFocus: string;
  trainingFocusDesc: string;
  level: string;
  inputMode: string;
  trials: string;
  fixation: string;
  sensitivity: string;
  camera: string;
  microphone: string;
  cross: string;
  blank: string;
  rules: string;
  start: string;
  cancel: string;
  backSettings: string;
  restart: string;
  returnHome: string;
  downloadCsv: string;
  initializingCamera: string;
  initializingMicrophone: string;
  cameraTracking: string;
  cameraFinding: string;
  microphoneReady: string;
  microphoneLevel: string;
  permissionPrivacy: string;
  localProcessing: string;
  resultTitle: string;
  score: string;
  accuracy: string;
  averageRt: string;
  falseAlarms: string;
  misses: string;
  wrongActions: string;
  passed: string;
  notPassed: string;
  noResponse: string;
  none: string;
  actionClap: string;
  actionThigh: string;
  actionNone: string;
  keyboardHint: string;
  balls: Record<BallId, string>;
  levels: Record<LevelDefinition['id'], {
    title: string;
    shortTitle: string;
    description: string;
    ruleItems: string[];
  }>;
  inputDescriptions: Record<InputMode, string>;
  fixationDescriptions: Record<FixationStyle, string>;
  error: {
    cameraUnsupported: string;
    microphoneUnsupported: string;
    cameraPermission: string;
    microphonePermission: string;
    cameraInitialization: string;
    microphoneInitialization: string;
  };
}

interface EveryBallExperimentData {
  trials: TrialRecord[];
  aborted: boolean;
  level_id: LevelDefinition['id'];
  input_mode: InputMode;
  fixation_style: FixationStyle;
  trial_count: number;
}

const levels: readonly LevelDefinition[] = [
  { id: 1, trialCount: 8, passAccuracy: 100 },
  { id: 2, trialCount: 16, passAccuracy: 85 },
  { id: 3, trialCount: 20, passAccuracy: 80 },
];
const trialCountOptions = [8, 16, 20, 24, 32] as const;
const distractorBalls: readonly BallId[] = ['soccer', 'tennis', 'beach'];
const feedbackMs = 550;
const stimulusMs = 900;
const responseWindowMs = 1800;
const fixationMinMs = 1000;
const fixationMaxMs = 3000;
const mediapipeWasmUrl = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35/wasm';
const handModelUrl = 'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task';
const poseModelUrl = 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task';
const cameraDetectionIntervalMs = 70;
const cameraGestureCooldownMs = 480;
const clapCloseDistance = 0.12;
const clapOpenDistance = 0.2;
const microphoneCooldownMs = 320;

const everyBallInfo = {
  name: 'every-ball-response',
  parameters: {
    trials: {
      type: ParameterType.COMPLEX,
      default: [] as TrialPlan[],
    },
    input_controller: {
      type: ParameterType.COMPLEX,
      default: null,
    },
    labels: {
      type: ParameterType.COMPLEX,
      default: null,
    },
    config: {
      type: ParameterType.COMPLEX,
      default: null,
    },
    on_visual_change: {
      type: ParameterType.FUNCTION,
      default: null,
    },
  },
  data: {
    trials: { type: ParameterType.COMPLEX },
    aborted: { type: ParameterType.BOOL },
    level_id: { type: ParameterType.INT },
    input_mode: { type: ParameterType.STRING },
    fixation_style: { type: ParameterType.STRING },
    trial_count: { type: ParameterType.INT },
  },
} as const;

type EveryBallInfo = typeof everyBallInfo;

class EveryBallExperimentPlugin implements JsPsychPlugin<EveryBallInfo> {
  static info = everyBallInfo;

  constructor(private jsPsych: JsPsych) {}

  trial(_displayElement: HTMLElement, trial: TrialType<EveryBallInfo>) {
    void this.runExperiment(trial);
  }

  private async runExperiment(trial: TrialType<EveryBallInfo>) {
    const plans = trial.trials as unknown as TrialPlan[];
    const config = trial.config as unknown as GameConfig;
    const labels = trial.labels as unknown as EveryBallLabels;
    const controller = trial.input_controller as unknown as ResponseInputController;
    const notify = trial.on_visual_change as unknown as ((visual: VisualState) => void) | null;
    const records: TrialRecord[] = [];
    let aborted = false;

    try {
      for (const plan of plans) {
        notify?.({
          phase: 'fixation',
          trialNumber: plan.trialNumber,
          totalTrials: plans.length,
          fixationStyle: config.fixationStyle,
        });
        await WaitMs(this.jsPsych, plan.fixationMs);

        notify?.({
          phase: 'stimulus',
          trialNumber: plan.trialNumber,
          totalTrials: plans.length,
          ball: plan.ball,
          expectedAction: plan.expectedAction,
          xRatio: plan.xRatio,
          yRatio: plan.yRatio,
        });

        const hideStimulus = WaitMs(this.jsPsych, stimulusMs).then(() => {
          notify?.({
            phase: 'blank',
            trialNumber: plan.trialNumber,
            totalTrials: plans.length,
          });
        });
        const response = await controller.waitForResponse(responseWindowMs);
        await hideStimulus;

        const record = BuildTrialRecord(plan, response, labels);
        records.push(record);
        WriteJsPsychData(this.jsPsych, record as unknown as Record<string, unknown>);
        notify?.({
          phase: 'feedback',
          trialNumber: plan.trialNumber,
          totalTrials: plans.length,
          feedbackCorrect: record.Correct,
        });
        await WaitMs(this.jsPsych, feedbackMs);
      }
    } catch (error) {
      aborted = true;
      console.warn('Every Ball Response experiment ended early.', error);
    }

    controller.cancelWaiting();
    notify?.({ phase: 'idle' });
    this.jsPsych.finishTrial({
      trials: records,
      aborted,
      level_id: config.levelId,
      input_mode: config.inputMode,
      fixation_style: config.fixationStyle,
      trial_count: plans.length,
    } satisfies EveryBallExperimentData);
  }
}

class ResponseInputController {
  private pending: {
    startedAt: number;
    timer: number;
    resolve: (response: ActionResponse | null) => void;
  } | null = null;

  waitForResponse(windowMs: number): Promise<ActionResponse | null> {
    this.cancelWaiting();
    return new Promise((resolve) => {
      const startedAt = performance.now();
      const timer = window.setTimeout(() => {
        if (!this.pending) return;
        this.pending = null;
        resolve(null);
      }, windowMs);
      this.pending = { startedAt, timer, resolve };
    });
  }

  emit(action: ResponseAction, source: ResponseSource): void {
    const pending = this.pending;
    if (!pending) return;
    window.clearTimeout(pending.timer);
    this.pending = null;
    pending.resolve({
      action,
      source,
      rtMs: Math.max(0, performance.now() - pending.startedAt),
    });
  }

  cancelWaiting(): void {
    if (!this.pending) return;
    window.clearTimeout(this.pending.timer);
    const resolve = this.pending.resolve;
    this.pending = null;
    resolve(null);
  }
}

const copy: Record<'zh' | 'en', EveryBallLabels> = {
  zh: {
    title: '有球必應',
    configLabel: '注意力訓練設定',
    rulesLabel: '遊戲規則',
    trainingFocus: '訓練重點',
    trainingFocusDesc: '看見目標球後做出指定動作，遇到干擾球時抑制反應。',
    level: '關卡',
    inputMode: '偵測模式',
    trials: '題數',
    fixation: '準備期畫面',
    sensitivity: '麥克風靈敏度',
    camera: '相機偵測',
    microphone: '麥克風偵測',
    cross: '十字',
    blank: '空白',
    rules: '規則',
    start: '開始訓練',
    cancel: '取消',
    backSettings: '返回設定',
    restart: '再玩一次',
    returnHome: '返回注意訓練',
    downloadCsv: '下載 CSV 紀錄',
    initializingCamera: '正在開啟相機並載入 MediaPipe 模型...',
    initializingMicrophone: '正在開啟麥克風...',
    cameraTracking: '相機正在追蹤動作',
    cameraFinding: '請讓上半身與雙手進入畫面',
    microphoneReady: '麥克風收音中',
    microphoneLevel: '收音強度',
    permissionPrivacy: '相機與麥克風只在本機用於偵測動作，不會錄影、錄音或上傳。',
    localProcessing: '相機模式使用 MediaPipe Hands/Pose；麥克風模式使用 Web Audio 分析拍擊聲峰值。',
    resultTitle: '有球必應訓練完成',
    score: '正確',
    accuracy: '正確率',
    averageRt: '平均反應時間',
    falseAlarms: '誤拍',
    misses: '漏拍',
    wrongActions: '動作錯誤',
    passed: '通過',
    notPassed: '未通過',
    noResponse: '未反應',
    none: '無',
    actionClap: '拍手',
    actionThigh: '拍大腿',
    actionNone: '不動作',
    keyboardHint: '測試鍵盤可用空白鍵代表拍手、方向下鍵代表拍大腿。',
    balls: {
      basketball: '籃球',
      soccer: '足球',
      tennis: '網球',
      beach: '海灘球',
    },
    levels: {
      1: {
        title: '第一關：單一目標反應',
        shortTitle: '第一關',
        description: '只會出現籃球，看見籃球時盡快拍手。',
        ruleItems: ['畫面出現籃球時拍手。', '越快且越穩定越好。', '完成指定次數的正確拍手反應即可通過。'],
      },
      2: {
        title: '第二關：干擾物抑制',
        shortTitle: '第二關',
        description: '籃球要拍手，其他球出現時不做動作。',
        ruleItems: ['看到籃球時拍手。', '看到足球、網球或海灘球時不要拍。', '目標反應與干擾抑制都會納入正確率。'],
      },
      3: {
        title: '第三關：交替性注意力',
        shortTitle: '第三關',
        description: '籃球拍手，足球拍大腿，網球與海灘球不動作。',
        ruleItems: ['籃球出現時拍手。', '足球出現時拍大腿。', '網球與海灘球是干擾物，請抑制反應。'],
      },
    },
    inputDescriptions: {
      camera: '使用相機辨識拍手與拍大腿，需要瀏覽器相機權限。',
      microphone: '使用麥克風偵測短促拍擊聲並依聲音特徵分類，需要瀏覽器麥克風權限。',
    },
    fixationDescriptions: {
      cross: '每題開始前顯示十字，時間隨機。',
      blank: '每題開始前保持空白白底，時間隨機。',
    },
    error: {
      cameraUnsupported: '此瀏覽器不支援相機存取。',
      microphoneUnsupported: '此瀏覽器不支援麥克風存取。',
      cameraPermission: '無法使用相機，請允許瀏覽器相機權限後再試一次。',
      microphonePermission: '無法使用麥克風，請允許瀏覽器麥克風權限後再試一次。',
      cameraInitialization: '相機或 MediaPipe 初始化失敗，請重新整理後再試。',
      microphoneInitialization: '麥克風初始化失敗，請確認裝置可用後再試。',
    },
  },
  en: {
    title: 'Every Ball Gets a Response',
    configLabel: 'Attention Training Settings',
    rulesLabel: 'Game Rules',
    trainingFocus: 'Training Focus',
    trainingFocusDesc: 'Respond to target balls and inhibit responses to distractor balls.',
    level: 'Level',
    inputMode: 'Detection Mode',
    trials: 'Trials',
    fixation: 'Fixation Display',
    sensitivity: 'Microphone Sensitivity',
    camera: 'Camera Detection',
    microphone: 'Microphone Detection',
    cross: 'Crosshair',
    blank: 'Blank',
    rules: 'Rules',
    start: 'Start Training',
    cancel: 'Cancel',
    backSettings: 'Back to Settings',
    restart: 'Restart',
    returnHome: 'Back to Attention',
    downloadCsv: 'Download CSV Record',
    initializingCamera: 'Opening camera and loading MediaPipe models...',
    initializingMicrophone: 'Opening microphone...',
    cameraTracking: 'Camera is tracking movement',
    cameraFinding: 'Place your upper body and hands in view',
    microphoneReady: 'Microphone is listening',
    microphoneLevel: 'Input level',
    permissionPrivacy: 'Camera and microphone input is processed on this device only. Nothing is recorded or uploaded.',
    localProcessing: 'Camera mode uses MediaPipe Hands/Pose; microphone mode uses Web Audio peak analysis.',
    resultTitle: 'Every Ball Training Complete',
    score: 'Correct',
    accuracy: 'Accuracy',
    averageRt: 'Average RT',
    falseAlarms: 'False Alarms',
    misses: 'Misses',
    wrongActions: 'Wrong Actions',
    passed: 'Passed',
    notPassed: 'Not Passed',
    noResponse: 'No response',
    none: 'None',
    actionClap: 'Clap',
    actionThigh: 'Tap thigh',
    actionNone: 'No action',
    keyboardHint: 'For testing, Space triggers clap and ArrowDown triggers thigh.',
    balls: {
      basketball: 'Basketball',
      soccer: 'Soccer ball',
      tennis: 'Tennis ball',
      beach: 'Beach ball',
    },
    levels: {
      1: {
        title: 'Level 1: Single Target Response',
        shortTitle: 'Level 1',
        description: 'Only basketballs appear. Clap as soon as you see one.',
        ruleItems: ['Clap when a basketball appears.', 'Respond as quickly and consistently as possible.', 'Pass by completing the required correct clap responses.'],
      },
      2: {
        title: 'Level 2: Go/No-Go Inhibition',
        shortTitle: 'Level 2',
        description: 'Clap for basketballs and do nothing for other balls.',
        ruleItems: ['Clap when a basketball appears.', 'Do not respond to soccer balls, tennis balls, or beach balls.', 'Target responses and distractor inhibition both count toward accuracy.'],
      },
      3: {
        title: 'Level 3: Alternating Attention',
        shortTitle: 'Level 3',
        description: 'Clap for basketballs, tap thigh for soccer balls, and ignore tennis or beach balls.',
        ruleItems: ['Clap when a basketball appears.', 'Tap your thigh when a soccer ball appears.', 'Tennis balls and beach balls are distractors; inhibit your response.'],
      },
    },
    inputDescriptions: {
      camera: 'Use camera-based movement recognition for claps and thigh taps. Browser camera permission is required.',
      microphone: 'Use microphone peak detection and sound features for short impact sounds. Browser microphone permission is required.',
    },
    fixationDescriptions: {
      cross: 'Show a crosshair before each trial for a random interval.',
      blank: 'Keep the white screen blank before each trial for a random interval.',
    },
    error: {
      cameraUnsupported: 'This browser does not support camera access.',
      microphoneUnsupported: 'This browser does not support microphone access.',
      cameraPermission: 'Camera access is unavailable. Allow browser camera permission and try again.',
      microphonePermission: 'Microphone access is unavailable. Allow browser microphone permission and try again.',
      cameraInitialization: 'Unable to initialize the camera or MediaPipe. Refresh and try again.',
      microphoneInitialization: 'Unable to initialize the microphone. Check the device and try again.',
    },
  },
};

export function EveryBallResponsePage() {
  const { lang } = useT();
  const labels = copy[lang];
  const navigate = useNavigate();
  const { fullscreenRootRef, enterTrainingFullscreen } = useFullscreenTrainingRoot<HTMLDivElement>();
  const stageHostRef = useRef<HTMLDivElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const cameraOverlayRef = useRef<HTMLCanvasElement | null>(null);
  const appRef = useRef<Application | null>(null);
  const inputControllerRef = useRef(new ResponseInputController());
  const inputRuntimeRef = useRef<InputRuntime | null>(null);
  const jsPsychRef = useRef<ReturnType<typeof initJsPsych> | null>(null);
  const mountedRef = useRef(true);
  const phaseRef = useRef<Phase>('menu');
  const visualRef = useRef<VisualState>({ phase: 'idle' });

  const [phase, setPhaseState] = useState<Phase>('menu');
  const [levelId, setLevelId] = useState<LevelDefinition['id']>(1);
  const [inputMode, setInputMode] = useState<InputMode>('camera');
  const [fixationStyle, setFixationStyle] = useState<FixationStyle>('cross');
  const [trialCount, setTrialCount] = useState(levels[0].trialCount);
  const [microphoneSensitivity, setMicrophoneSensitivity] = useState(0.65);
  const [statusMessage, setStatusMessage] = useState('');
  const [inputLevel, setInputLevel] = useState(0);
  const [errorMessage, setErrorMessage] = useState('');
  const [summary, setSummary] = useState<SessionSummary | null>(null);
  const [visual, setVisual] = useState<VisualState>({ phase: 'idle' });

  const activeLevel = GetLevel(levelId);
  const selectedLevelLabels = labels.levels[levelId];
  const inputModeLabel = inputMode === 'camera' ? labels.camera : labels.microphone;
  const fixationLabel = fixationStyle === 'cross' ? labels.cross : labels.blank;

  const setPhase = useCallback((nextPhase: Phase) => {
    phaseRef.current = nextPhase;
    setPhaseState(nextPhase);
  }, []);

  const stopInput = useCallback(async () => {
    inputControllerRef.current.cancelWaiting();
    const runtime = inputRuntimeRef.current;
    inputRuntimeRef.current = null;
    if (runtime) await runtime.stop();
    setInputLevel(0);
  }, []);

  const drawVisual = useCallback((nextVisual: VisualState) => {
    visualRef.current = nextVisual;
    setVisual(nextVisual);
    const app = GetInitializedPixiApp(appRef.current);
    if (app) DrawEveryBallScene(app, nextVisual, labels);
  }, [labels]);

  useEffect(() => {
    mountedRef.current = true;
    let cancelled = false;
    let initialized = false;
    const app = new Application();

    const destroyApp = () => {
      if (!initialized) return;
      try {
        app.destroy(true, { children: true, texture: true });
      } catch (error) {
        console.warn('Unable to destroy Every Ball Response Pixi stage.', error);
      }
    };

    const initialize = async () => {
      const host = stageHostRef.current;
      if (!host) return;
      try {
        await app.init({
          background: '#ffffff',
          antialias: true,
          autoDensity: true,
          resolution: Math.min(window.devicePixelRatio || 1, 2),
          resizeTo: host,
        });
        initialized = true;
        if (cancelled) {
          destroyApp();
          return;
        }
        appRef.current = app;
        host.appendChild(app.canvas);
        app.canvas.className = 'every-ball-canvas';
        DrawEveryBallScene(app, visualRef.current, labels);
      } catch (error) {
        console.warn('Unable to initialize Every Ball Response Pixi stage.', error);
      }
    };
    void initialize();

    const onResize = () => {
      const currentApp = GetInitializedPixiApp(appRef.current);
      if (!currentApp) return;
      DrawEveryBallScene(currentApp, visualRef.current, labels);
    };
    window.addEventListener('resize', onResize);
    return () => {
      cancelled = true;
      mountedRef.current = false;
      window.removeEventListener('resize', onResize);
      void stopInput();
      jsPsychRef.current?.abortExperiment();
      if (appRef.current === app) {
        appRef.current = null;
      }
      destroyApp();
    };
  }, [labels, stopInput]);

  useEffect(() => {
    const app = GetInitializedPixiApp(appRef.current);
    if (!app) return;
    DrawEveryBallScene(app, visualRef.current, labels);
  }, [labels]);

  useEffect(() => {
    if (phase !== 'playing') return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.code === 'Space') {
        event.preventDefault();
        inputControllerRef.current.emit('clap', 'keyboard');
      } else if (event.key === 'ArrowDown') {
        event.preventDefault();
        inputControllerRef.current.emit('thigh', 'keyboard');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [phase]);

  useTrainingAbort({
    active: phase === 'rules' || phase === 'initializing' || phase === 'playing',
    onAbort: () => {
      void returnToMenu();
    },
  });

  const chooseLevel = (nextLevel: LevelDefinition['id']) => {
    setLevelId(nextLevel);
    setTrialCount(GetLevel(nextLevel).trialCount);
  };

  const returnToMenu = useCallback(async () => {
    jsPsychRef.current?.abortExperiment();
    jsPsychRef.current = null;
    await stopInput();
    setSummary(null);
    setErrorMessage('');
    setStatusMessage('');
    drawVisual({ phase: 'idle' });
    setPhase('menu');
  }, [drawVisual, setPhase, stopInput]);

  const exitToAttentionTraining = useCallback(async () => {
    await stopInput();
    jsPsychRef.current?.abortExperiment();
    navigate('/attention-training');
  }, [navigate, stopInput]);

  const completeSession = useCallback((
    data: EveryBallExperimentData,
    activeLabels: EveryBallLabels,
    level: LevelDefinition,
    modeLabel: string,
  ) => {
    void stopInput();
    const now = new Date();
    const nextSummary = BuildSessionSummary(data.trials, activeLabels, level, modeLabel, now);
    setSummary(nextSummary);
    setStatusMessage('');
    setPhase('results');
    drawVisual({ phase: 'idle' });
    const record: BrainTrainingRecord = {
      id: `every_ball_${now.getTime().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
      savedAt: now.toISOString(),
      trainingDate: nextSummary.date,
      userName: nextSummary.participant,
      moduleId: 'attention-training',
      gameId: 'every-ball-response',
      gameTitle: activeLabels.title,
      difficulty: nextSummary.levelTitle,
      details: {
        Level: nextSummary.levelTitle,
        Input_Mode: nextSummary.inputMode,
        Trial_Count: nextSummary.total,
        Correct_Count: nextSummary.correct,
        Accuracy_Percent: nextSummary.accuracy,
        Average_RT_ms: nextSummary.averageRtMs ?? '',
        Misses: nextSummary.misses,
        False_Alarms: nextSummary.falseAlarms,
        Wrong_Actions: nextSummary.wrongActions,
        Passed: nextSummary.passed,
      },
      detailRows: nextSummary.trials.map((trial) => ({ ...trial })),
    };
    void SaveTrainingRecord(record);
  }, [drawVisual, setPhase, stopInput]);

  const startSession = useCallback(async () => {
    await enterTrainingFullscreen();
    await stopInput();
    jsPsychRef.current?.abortExperiment();
    inputControllerRef.current.cancelWaiting();
    setErrorMessage('');
    setSummary(null);
    setStatusMessage(inputMode === 'camera' ? labels.initializingCamera : labels.initializingMicrophone);
    setPhase('initializing');

    try {
      inputRuntimeRef.current = inputMode === 'camera'
        ? await CreateCameraRuntime({
            video: RequireElement(videoRef.current),
            overlay: RequireElement(cameraOverlayRef.current),
            controller: inputControllerRef.current,
            onStatus: (status) => {
              if (mountedRef.current) setStatusMessage(status);
            },
          }, labels)
        : await CreateMicrophoneRuntime({
            sensitivity: microphoneSensitivity,
            controller: inputControllerRef.current,
            onLevel: (level) => {
              if (mountedRef.current) setInputLevel(level);
            },
            onStatus: (status) => {
              if (mountedRef.current) setStatusMessage(status);
            },
          }, labels);

      if (!mountedRef.current) return;
      const plans = CreateTrialPlans(levelId, trialCount);
      const jsPsych = initJsPsych();
      jsPsychRef.current = jsPsych;
      setPhase('playing');
      drawVisual({ phase: 'idle' });
      void jsPsych.run([{
        type: EveryBallExperimentPlugin,
        trials: plans,
        input_controller: inputControllerRef.current,
        labels,
        config: {
          levelId,
          inputMode,
          fixationStyle,
          trialCount,
          microphoneSensitivity,
        } satisfies GameConfig,
        on_visual_change: drawVisual,
      }]).then(() => {
        if (!mountedRef.current || phaseRef.current !== 'playing') return;
        const values = jsPsych.data.get().last(1).values();
        const data = values[0] as EveryBallExperimentData | undefined;
        if (data) completeSession(data, labels, activeLevel, inputModeLabel);
      });
    } catch (error) {
      console.warn('Unable to start Every Ball Response.', error);
      await stopInput();
      setErrorMessage(GetStartErrorMessage(error, inputMode, labels));
      setStatusMessage('');
      drawVisual({ phase: 'idle' });
      setPhase('menu');
    }
  }, [
    activeLevel,
    completeSession,
    drawVisual,
    enterTrainingFullscreen,
    fixationStyle,
    inputMode,
    inputModeLabel,
    labels,
    levelId,
    microphoneSensitivity,
    setPhase,
    stopInput,
    trialCount,
  ]);

  const downloadResult = () => {
    if (!summary) return;
    DownloadCsvFile(ToCsv(summary), `every_ball_response_${summary.date}_${Date.now()}.csv`);
  };

  const summaryItems = useMemo(() => [
    { label: labels.level, value: selectedLevelLabels.shortTitle },
    { label: labels.inputMode, value: inputModeLabel },
    { label: labels.trials, value: trialCount },
    { label: labels.fixation, value: fixationLabel },
  ], [fixationLabel, inputModeLabel, labels, selectedLevelLabels.shortTitle, trialCount]);

  return (
    <div ref={fullscreenRootRef} className={`every-ball every-ball-phase-${phase}`}>
      <div ref={stageHostRef} className="every-ball-stage" aria-hidden={phase !== 'playing'} />
      <div className={`every-ball-camera ${inputMode === 'camera' && (phase === 'initializing' || phase === 'playing') ? '' : 'every-ball-camera-hidden'}`}>
        <video ref={videoRef} muted playsInline aria-label={statusMessage || labels.cameraFinding} />
        <canvas ref={cameraOverlayRef} aria-hidden="true" />
      </div>

      {phase === 'menu' && (
        <div className="training-panel every-ball-panel">
          <TrainingConfigPanel
            className="every-ball-config"
            label={labels.configLabel}
            title={labels.title}
            summaryTitle={labels.title}
            summaryItems={summaryItems}
            actions={(
              <>
                {errorMessage && <div className="every-ball-error" role="alert">{errorMessage}</div>}
                <StartTrainingButton onClick={() => setPhase('rules')}>
                  {labels.rules}
                </StartTrainingButton>
                <button className="btn btn-ghost btn-lg" type="button" onClick={() => void exitToAttentionTraining()}>
                  {labels.cancel}
                </button>
              </>
            )}
          >
            <section className="training-setting training-setting-wide">
              <div className="training-setting-header">
                <div>
                  <h2>{labels.level}</h2>
                  <p>{selectedLevelLabels.description}</p>
                </div>
                <span>{selectedLevelLabels.shortTitle}</span>
              </div>
              <div className="training-option-grid training-option-grid-three">
                {levels.map((level) => (
                  <button
                    className={`training-option ${levelId === level.id ? 'active' : ''}`}
                    key={level.id}
                    type="button"
                    onClick={() => chooseLevel(level.id)}
                  >
                    <span className="training-option-title">{labels.levels[level.id].shortTitle}</span>
                    <span className="training-option-meta">{labels.levels[level.id].description}</span>
                  </button>
                ))}
              </div>
            </section>

            <section className="training-setting training-setting-wide">
              <div className="training-setting-header">
                <div>
                  <h2>{labels.inputMode}</h2>
                  <p>{labels.permissionPrivacy}</p>
                </div>
                <span>{inputModeLabel}</span>
              </div>
              <div className="training-option-grid training-option-grid-two">
                {(['camera', 'microphone'] as const).map((mode) => (
                  <button
                    className={`training-option ${inputMode === mode ? 'active' : ''}`}
                    key={mode}
                    type="button"
                    onClick={() => setInputMode(mode)}
                  >
                    <span className="training-option-title">{mode === 'camera' ? labels.camera : labels.microphone}</span>
                    <span className="training-option-meta">{labels.inputDescriptions[mode]}</span>
                  </button>
                ))}
              </div>
            </section>

            <section className="training-setting training-setting-wide">
              <div className="training-setting-header">
                <div>
                  <h2>{labels.trials}</h2>
                  <p>{labels.trainingFocusDesc}</p>
                </div>
                <span>{trialCount}</span>
              </div>
              <div className="training-option-grid training-option-grid-five">
                {trialCountOptions.map((count) => (
                  <button
                    className={`training-option ${trialCount === count ? 'active' : ''}`}
                    key={count}
                    type="button"
                    onClick={() => setTrialCount(count)}
                  >
                    <span className="training-option-title">{count}</span>
                  </button>
                ))}
              </div>
            </section>

            <section className="training-setting">
              <div className="training-setting-header">
                <div>
                  <h2>{labels.fixation}</h2>
                  <p>{labels.fixationDescriptions[fixationStyle]}</p>
                </div>
                <span>{fixationLabel}</span>
              </div>
              <div className="training-option-grid training-option-grid-two">
                {(['cross', 'blank'] as const).map((style) => (
                  <button
                    className={`training-option ${fixationStyle === style ? 'active' : ''}`}
                    key={style}
                    type="button"
                    onClick={() => setFixationStyle(style)}
                  >
                    <span className="training-option-title">{style === 'cross' ? labels.cross : labels.blank}</span>
                    <span className="training-option-meta">{labels.fixationDescriptions[style]}</span>
                  </button>
                ))}
              </div>
            </section>

            <section className={`training-setting ${inputMode === 'microphone' ? '' : 'every-ball-setting-muted'}`}>
              <div className="training-setting-header">
                <div>
                  <h2>{labels.sensitivity}</h2>
                  <p>{labels.localProcessing}</p>
                </div>
                <span>{Math.round(microphoneSensitivity * 100)}%</span>
              </div>
              <input
                className="every-ball-slider"
                type="range"
                min="0.35"
                max="0.9"
                step="0.05"
                value={microphoneSensitivity}
                disabled={inputMode !== 'microphone'}
                aria-label={labels.sensitivity}
                onChange={(event) => setMicrophoneSensitivity(Number(event.target.value))}
              />
            </section>
          </TrainingConfigPanel>
        </div>
      )}

      {phase === 'rules' && (
        <div className="training-panel every-ball-panel">
          <TrainingRulesPanel
            className="every-ball-config"
            label={labels.rulesLabel}
            title={selectedLevelLabels.title}
            summaryTitle={labels.title}
            summaryItems={summaryItems}
            sections={[
              {
                title: labels.trainingFocus,
                description: labels.trainingFocusDesc,
                meta: inputModeLabel,
                items: selectedLevelLabels.ruleItems,
              },
              {
                title: labels.inputMode,
                description: labels.permissionPrivacy,
                meta: inputModeLabel,
                items: [labels.inputDescriptions[inputMode], labels.localProcessing, labels.keyboardHint],
              },
            ]}
            startLabel={labels.start}
            backLabel={labels.backSettings}
            onStart={() => void startSession()}
            onBack={() => setPhase('menu')}
          />
        </div>
      )}

      {phase === 'initializing' && (
        <div className="every-ball-status-panel" role="status">
          <strong>{statusMessage}</strong>
          <span>{labels.permissionPrivacy}</span>
        </div>
      )}

      {phase === 'playing' && (
        <div className="every-ball-hud">
          <div>
            <span>{selectedLevelLabels.shortTitle}</span>
            <strong>{labels.title}</strong>
          </div>
          <div>
            <span>{visual.trialNumber ?? 0} / {visual.totalTrials ?? trialCount}</span>
            <strong>{GetExpectedActionLabel(visual.expectedAction ?? 'none', labels)}</strong>
          </div>
          <div>
            <span>{inputModeLabel}</span>
            <strong>{statusMessage || (inputMode === 'camera' ? labels.cameraFinding : labels.microphoneReady)}</strong>
          </div>
          {inputMode === 'microphone' && (
            <div className="every-ball-meter" aria-label={labels.microphoneLevel}>
              <span style={{ width: `${Math.round(inputLevel * 100)}%` }} />
            </div>
          )}
          <button className="btn btn-ghost btn-sm" type="button" onClick={() => void returnToMenu()}>
            {labels.cancel}
          </button>
        </div>
      )}

      {phase === 'results' && summary && (
        <div className="experiment-container experiment-container-scrollable every-ball-results-container">
          <div className="experiment-results every-ball-results">
            <h1>{labels.resultTitle}</h1>
            <ResultSummary
              items={[
                { label: labels.score, value: `${summary.correct} / ${summary.total}` },
                { label: labels.accuracy, value: `${summary.accuracy}%` },
                { label: labels.averageRt, value: summary.averageRtMs === null ? labels.none : `${summary.averageRtMs} ms` },
                { label: summary.passed ? labels.passed : labels.notPassed, value: summary.levelTitle },
              ]}
            />
            <div className="training-result-summary">
              <span><small>{labels.falseAlarms}</small><strong>{summary.falseAlarms}</strong></span>
              <span><small>{labels.misses}</small><strong>{summary.misses}</strong></span>
              <span><small>{labels.wrongActions}</small><strong>{summary.wrongActions}</strong></span>
            </div>

            <table className="results-table every-ball-results-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>{labels.balls.basketball}</th>
                  <th>{labels.inputMode}</th>
                  <th>{labels.accuracy}</th>
                  <th>RT</th>
                </tr>
              </thead>
              <tbody>
                {summary.trials.map((trial) => (
                  <tr key={trial.Trial_Number}>
                    <td>{trial.Trial_Number}</td>
                    <td>{trial.Ball}</td>
                    <td>{trial.Response_Action || labels.noResponse}</td>
                    <td className={trial.Correct ? 'result-success' : 'result-fail'}>
                      {trial.Correct ? labels.passed : labels.notPassed}
                    </td>
                    <td>{trial.Reaction_Time_ms ?? labels.none}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <TrainingResultActions
              downloadLabel={labels.downloadCsv}
              restartLabel={labels.restart}
              backLabel={labels.returnHome}
              onDownloadCsv={downloadResult}
              onRestart={() => setPhase('rules')}
              onBackHome={() => void exitToAttentionTraining()}
            />
          </div>
        </div>
      )}
    </div>
  );
}

function CreateTrialPlans(levelId: LevelDefinition['id'], trialCount: number): TrialPlan[] {
  const balls = CreateBallSequence(levelId, trialCount);
  return Shuffle(balls).map((ball, index) => ({
    trialNumber: index + 1,
    levelId,
    ball,
    expectedAction: GetExpectedAction(levelId, ball),
    fixationMs: RandomInt(fixationMinMs, fixationMaxMs),
    xRatio: 0.28 + Math.random() * 0.44,
    yRatio: 0.3 + Math.random() * 0.34,
  }));
}

function CreateBallSequence(levelId: LevelDefinition['id'], trialCount: number): BallId[] {
  if (levelId === 1) return Array.from({ length: trialCount }, () => 'basketball');
  const sequence: BallId[] = [];
  const targetCount = Math.max(1, Math.round(trialCount * (levelId === 2 ? 0.56 : 0.62)));
  for (let index = 0; index < targetCount; index += 1) {
    if (levelId === 3 && index % 2 === 1) sequence.push('soccer');
    else sequence.push('basketball');
  }
  while (sequence.length < trialCount) {
    const distractor = levelId === 2
      ? distractorBalls[sequence.length % distractorBalls.length]
      : (['tennis', 'beach'] as const)[sequence.length % 2];
    sequence.push(distractor);
  }
  return sequence;
}

function GetExpectedAction(levelId: LevelDefinition['id'], ball: BallId): ExpectedAction {
  if (ball === 'basketball') return 'clap';
  if (levelId === 3 && ball === 'soccer') return 'thigh';
  return 'none';
}

function BuildTrialRecord(plan: TrialPlan, response: ActionResponse | null, labels: EveryBallLabels): TrialRecord {
  const correct = plan.expectedAction === 'none'
    ? response === null
    : response?.action === plan.expectedAction;
  const outcome = GetOutcome(plan.expectedAction, response, correct);
  return {
    Trial_Number: plan.trialNumber,
    Level: plan.levelId,
    Ball: labels.balls[plan.ball],
    Expected_Action: GetExpectedActionLabel(plan.expectedAction, labels),
    Response_Action: response ? GetResponseActionLabel(response.action, labels) : '',
    Response_Source: response?.source ?? '',
    Outcome: outcome,
    Correct: correct,
    Reaction_Time_ms: response ? Math.round(response.rtMs) : null,
    Fixation_ms: plan.fixationMs,
  };
}

function GetOutcome(expected: ExpectedAction, response: ActionResponse | null, correct: boolean): TrialOutcome {
  if (correct && expected === 'none') return 'correct_reject';
  if (correct) return 'hit';
  if (!response) return 'miss';
  if (expected === 'none') return 'false_alarm';
  return 'wrong_action';
}

function BuildSessionSummary(
  trials: TrialRecord[],
  labels: EveryBallLabels,
  level: LevelDefinition,
  inputMode: string,
  date: Date,
): SessionSummary {
  const total = Math.max(1, trials.length);
  const correct = trials.filter((trial) => trial.Correct).length;
  const correctActionTrials = trials.filter((trial) => trial.Correct && trial.Reaction_Time_ms !== null);
  const averageRtMs = correctActionTrials.length > 0
    ? Math.round(correctActionTrials.reduce((sum, trial) => sum + (trial.Reaction_Time_ms ?? 0), 0) / correctActionTrials.length)
    : null;
  const accuracy = Math.round((correct / total) * 100);
  return {
    date: FormatTestDate(date),
    participant: GetAuthUserNameFromToken() || 'Guest',
    levelTitle: labels.levels[level.id].title,
    inputMode,
    total,
    correct,
    accuracy,
    averageRtMs,
    misses: trials.filter((trial) => trial.Outcome === 'miss').length,
    falseAlarms: trials.filter((trial) => trial.Outcome === 'false_alarm').length,
    wrongActions: trials.filter((trial) => trial.Outcome === 'wrong_action').length,
    passed: accuracy >= level.passAccuracy,
    trials,
  };
}

function ToCsv(summary: SessionSummary): string {
  const columns = [
    'Training_Date',
    'Participant_ID',
    'Level',
    'Input_Mode',
    'Total_Trials',
    'Correct_Count',
    'Accuracy_Percent',
    'Average_RT_ms',
    'Misses',
    'False_Alarms',
    'Wrong_Actions',
    'Passed',
    'Trial_Number',
    'Ball',
    'Expected_Action',
    'Response_Action',
    'Response_Source',
    'Outcome',
    'Correct',
    'Reaction_Time_ms',
    'Fixation_ms',
  ];
  const rows = summary.trials.map((trial) => ({
    ...trial,
    Training_Date: summary.date,
    Participant_ID: summary.participant,
    Level: summary.levelTitle,
    Input_Mode: summary.inputMode,
    Total_Trials: summary.total,
    Correct_Count: summary.correct,
    Accuracy_Percent: summary.accuracy,
    Average_RT_ms: summary.averageRtMs ?? '',
    Misses: summary.misses,
    False_Alarms: summary.falseAlarms,
    Wrong_Actions: summary.wrongActions,
    Passed: summary.passed,
  }));
  return CreateCsvContent([
    columns,
    ...rows.map((row) => columns.map((column) => row[column as keyof typeof row])),
  ]);
}

async function CreateCameraRuntime(options: CameraRuntimeOptions, labels: EveryBallLabels): Promise<InputRuntime> {
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error(labels.error.cameraUnsupported);
  }

  const stream = await navigator.mediaDevices.getUserMedia({
    audio: false,
    video: {
      facingMode: 'user',
      width: { ideal: 960 },
      height: { ideal: 720 },
    },
  });
  const video = options.video;
  video.srcObject = stream;
  await video.play();

  options.onStatus(labels.initializingCamera);
  const vision = await FilesetResolver.forVisionTasks(mediapipeWasmUrl);
  const [handLandmarker, poseLandmarker] = await Promise.all([
    HandLandmarker.createFromOptions(vision, {
      baseOptions: { modelAssetPath: handModelUrl },
      runningMode: 'VIDEO',
      numHands: 2,
      minHandDetectionConfidence: 0.48,
      minHandPresenceConfidence: 0.48,
      minTrackingConfidence: 0.48,
    }),
    PoseLandmarker.createFromOptions(vision, {
      baseOptions: { modelAssetPath: poseModelUrl },
      runningMode: 'VIDEO',
      numPoses: 1,
      minPoseDetectionConfidence: 0.45,
      minPosePresenceConfidence: 0.45,
      minTrackingConfidence: 0.45,
    }),
  ]);

  let animationFrame = 0;
  let stopped = false;
  let lastDetectionAt = 0;
  let lastVideoTime = -1;
  let lastClapDistance = Number.POSITIVE_INFINITY;
  let lastThighContact = false;
  let lastGestureAt = 0;
  let lastStatus = '';

  const updateStatus = (status: string) => {
    if (status === lastStatus) return;
    lastStatus = status;
    options.onStatus(status);
  };

  const processFrame = (now: number) => {
    animationFrame = window.requestAnimationFrame(processFrame);
    if (stopped || now - lastDetectionAt < cameraDetectionIntervalMs) return;
    if (video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA || video.currentTime === lastVideoTime) return;
    lastVideoTime = video.currentTime;
    lastDetectionAt = now;

    const handResult = handLandmarker.detectForVideo(video, now);
    const poseResult = poseLandmarker.detectForVideo(video, now);
    const handLandmarks = handResult.landmarks;
    const poseLandmarks = poseResult.landmarks[0];
    DrawCameraOverlay(options.overlay, video, handLandmarks, poseLandmarks);

    const handCenters = handLandmarks.map(GetPalmCenter);
    if (handCenters.length === 0) {
      updateStatus(labels.cameraFinding);
      lastClapDistance = Number.POSITIVE_INFINITY;
      lastThighContact = false;
      return;
    }

    updateStatus(labels.cameraTracking);
    let emitted = false;
    if (handCenters.length >= 2) {
      const distance = GetDistance(handCenters[0], handCenters[1]);
      if (
        distance <= clapCloseDistance
        && lastClapDistance >= clapOpenDistance
        && now - lastGestureAt >= cameraGestureCooldownMs
      ) {
        options.controller.emit('clap', 'camera');
        lastGestureAt = now;
        emitted = true;
      }
      lastClapDistance = distance;
    }

    const thighContact = IsThighContact(handCenters, poseLandmarks);
    if (
      !emitted
      && thighContact
      && !lastThighContact
      && now - lastGestureAt >= cameraGestureCooldownMs
    ) {
      options.controller.emit('thigh', 'camera');
      lastGestureAt = now;
    }
    lastThighContact = thighContact;
  };
  animationFrame = window.requestAnimationFrame(processFrame);

  return {
    stop: () => {
      stopped = true;
      window.cancelAnimationFrame(animationFrame);
      stream.getTracks().forEach((track) => track.stop());
      video.srcObject = null;
      handLandmarker.close();
      poseLandmarker.close();
      ClearCameraOverlay(options.overlay);
    },
  };
}

async function CreateMicrophoneRuntime(options: MicrophoneRuntimeOptions, labels: EveryBallLabels): Promise<InputRuntime> {
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error(labels.error.microphoneUnsupported);
  }
  const audioContextConstructor = GetAudioContextConstructor();
  if (!audioContextConstructor) {
    throw new Error(labels.error.microphoneUnsupported);
  }

  const stream = await navigator.mediaDevices.getUserMedia({
    audio: {
      echoCancellation: false,
      noiseSuppression: false,
      autoGainControl: false,
    },
    video: false,
  });
  const audioContext = new audioContextConstructor();
  await audioContext.resume();
  const source = audioContext.createMediaStreamSource(stream);
  const analyser = audioContext.createAnalyser();
  analyser.fftSize = 1024;
  analyser.smoothingTimeConstant = 0.45;
  source.connect(analyser);

  const timeSamples = new Float32Array(analyser.fftSize);
  const freqSamples = new Uint8Array(analyser.frequencyBinCount);
  let animationFrame = 0;
  let stopped = false;
  let lastTriggerAt = 0;
  let belowThreshold = true;
  const threshold = MicrophoneThreshold(options.sensitivity);
  options.onStatus(labels.microphoneReady);

  const tick = (now: number) => {
    animationFrame = window.requestAnimationFrame(tick);
    if (stopped) return;
    analyser.getFloatTimeDomainData(timeSamples);
    const rms = CalculateRms(timeSamples);
    options.onLevel(ToMeterLevel(rms));
    if (rms < threshold * 0.62) {
      belowThreshold = true;
      return;
    }
    if (!belowThreshold || rms < threshold || now - lastTriggerAt < microphoneCooldownMs) return;
    belowThreshold = false;
    lastTriggerAt = now;
    analyser.getByteFrequencyData(freqSamples);
    options.controller.emit(ClassifyTapSound(freqSamples), 'microphone');
  };
  animationFrame = window.requestAnimationFrame(tick);

  return {
    stop: async () => {
      stopped = true;
      window.cancelAnimationFrame(animationFrame);
      stream.getTracks().forEach((track) => track.stop());
      source.disconnect();
      analyser.disconnect();
      if (audioContext.state !== 'closed') {
        await audioContext.close().catch(() => undefined);
      }
      options.onLevel(0);
    },
  };
}

function DrawEveryBallScene(app: Application, visual: VisualState, labels: EveryBallLabels): void {
  const width = app.renderer.width;
  const height = app.renderer.height;
  app.stage.removeChildren();
  const background = new Graphics();
  background.rect(0, 0, width, height).fill({ color: 0xffffff });
  app.stage.addChild(background);

  if (visual.phase === 'fixation' && visual.fixationStyle === 'cross') {
    DrawCrosshair(app.stage, width, height);
  }

  if (visual.phase === 'stimulus' && visual.ball) {
    const x = width * (visual.xRatio ?? 0.5);
    const y = height * (visual.yRatio ?? 0.5);
    DrawBall(app.stage, visual.ball, x, y, Math.min(width, height) * 0.13, labels);
  }

  if (visual.phase === 'feedback') {
    DrawFeedback(app.stage, width, height, Boolean(visual.feedbackCorrect));
  }
}

function DrawCrosshair(stage: Container, width: number, height: number): void {
  const size = Math.max(28, Math.min(width, height) * 0.04);
  const line = new Graphics();
  line.moveTo(width / 2 - size, height / 2).lineTo(width / 2 + size, height / 2);
  line.moveTo(width / 2, height / 2 - size).lineTo(width / 2, height / 2 + size);
  line.stroke({ color: 0x111827, width: Math.max(4, size * 0.14), cap: 'round' });
  stage.addChild(line);
}

function DrawBall(stage: Container, ball: BallId, x: number, y: number, radius: number, labels: EveryBallLabels): void {
  const container = new Container();
  container.x = x;
  container.y = y;
  stage.addChild(container);

  if (ball === 'basketball') DrawBasketball(container, radius);
  else if (ball === 'soccer') DrawSoccerBall(container, radius);
  else if (ball === 'tennis') DrawTennisBall(container, radius);
  else DrawBeachBall(container, radius);

  const text = new Text({
    text: labels.balls[ball],
    style: {
      fill: '#111827',
      fontFamily: 'Arial, sans-serif',
      fontSize: Math.max(18, radius * 0.22),
      fontWeight: '700',
    },
  });
  text.anchor.set(0.5);
  text.y = radius + Math.max(22, radius * 0.34);
  container.addChild(text);
}

function DrawBasketball(container: Container, radius: number): void {
  const ball = new Graphics();
  ball.circle(0, 0, radius).fill({ color: 0xf97316 });
  ball.circle(0, 0, radius).stroke({ color: 0x7c2d12, width: Math.max(4, radius * 0.06) });
  ball.moveTo(-radius, 0).quadraticCurveTo(0, -radius * 0.18, radius, 0);
  ball.moveTo(-radius, 0).quadraticCurveTo(0, radius * 0.18, radius, 0);
  ball.moveTo(0, -radius).lineTo(0, radius);
  ball.moveTo(-radius * 0.72, -radius * 0.72).quadraticCurveTo(-radius * 0.25, 0, -radius * 0.72, radius * 0.72);
  ball.moveTo(radius * 0.72, -radius * 0.72).quadraticCurveTo(radius * 0.25, 0, radius * 0.72, radius * 0.72);
  ball.stroke({ color: 0x111827, width: Math.max(3, radius * 0.035), cap: 'round' });
  container.addChild(ball);
}

function DrawSoccerBall(container: Container, radius: number): void {
  const ball = new Graphics();
  ball.circle(0, 0, radius).fill({ color: 0xf8fafc });
  ball.circle(0, 0, radius).stroke({ color: 0x111827, width: Math.max(4, radius * 0.05) });
  DrawPentagon(ball, 0, 0, radius * 0.32, 0x111827);
  for (let index = 0; index < 5; index += 1) {
    const angle = -Math.PI / 2 + index * ((Math.PI * 2) / 5);
    const px = Math.cos(angle) * radius * 0.62;
    const py = Math.sin(angle) * radius * 0.62;
    DrawPentagon(ball, px, py, radius * 0.16, 0x111827);
    ball.moveTo(Math.cos(angle) * radius * 0.32, Math.sin(angle) * radius * 0.32);
    ball.lineTo(px, py);
  }
  ball.stroke({ color: 0x111827, width: Math.max(2, radius * 0.025), cap: 'round' });
  container.addChild(ball);
}

function DrawTennisBall(container: Container, radius: number): void {
  const ball = new Graphics();
  ball.circle(0, 0, radius).fill({ color: 0xa3e635 });
  ball.circle(0, 0, radius).stroke({ color: 0x3f6212, width: Math.max(4, radius * 0.05) });
  ball.moveTo(-radius * 0.68, -radius * 0.82).bezierCurveTo(-radius * 0.1, -radius * 0.28, -radius * 0.1, radius * 0.28, -radius * 0.68, radius * 0.82);
  ball.moveTo(radius * 0.68, -radius * 0.82).bezierCurveTo(radius * 0.1, -radius * 0.28, radius * 0.1, radius * 0.28, radius * 0.68, radius * 0.82);
  ball.stroke({ color: 0xffffff, width: Math.max(5, radius * 0.07), cap: 'round' });
  container.addChild(ball);
}

function DrawBeachBall(container: Container, radius: number): void {
  const colors = [0x38bdf8, 0xfacc15, 0xfb7185, 0xffffff];
  const ball = new Graphics();
  for (let index = 0; index < colors.length; index += 1) {
    const start = -Math.PI / 2 + index * (Math.PI / 2);
    const end = start + Math.PI / 2;
    ball.moveTo(0, 0);
    ball.arc(0, 0, radius, start, end);
    ball.lineTo(0, 0);
    ball.fill({ color: colors[index] });
  }
  ball.circle(0, 0, radius).stroke({ color: 0x0f172a, width: Math.max(4, radius * 0.05) });
  ball.circle(0, 0, radius * 0.18).fill({ color: 0xffffff }).stroke({ color: 0x0f172a, width: Math.max(2, radius * 0.025) });
  container.addChild(ball);
}

function DrawFeedback(stage: Container, width: number, height: number, correct: boolean): void {
  const graphics = new Graphics();
  const size = Math.min(width, height) * 0.14;
  const x = width / 2;
  const y = height / 2;
  if (correct) {
    graphics.moveTo(x - size * 0.75, y);
    graphics.lineTo(x - size * 0.22, y + size * 0.5);
    graphics.lineTo(x + size * 0.75, y - size * 0.62);
    graphics.stroke({ color: 0x16a34a, width: Math.max(10, size * 0.14), cap: 'round', join: 'round' });
  } else {
    graphics.moveTo(x - size * 0.56, y - size * 0.56).lineTo(x + size * 0.56, y + size * 0.56);
    graphics.moveTo(x + size * 0.56, y - size * 0.56).lineTo(x - size * 0.56, y + size * 0.56);
    graphics.stroke({ color: 0xdc2626, width: Math.max(10, size * 0.14), cap: 'round' });
  }
  stage.addChild(graphics);
}

function DrawPentagon(graphics: Graphics, x: number, y: number, radius: number, color: number): void {
  for (let index = 0; index < 5; index += 1) {
    const angle = -Math.PI / 2 + index * ((Math.PI * 2) / 5);
    const px = x + Math.cos(angle) * radius;
    const py = y + Math.sin(angle) * radius;
    if (index === 0) graphics.moveTo(px, py);
    else graphics.lineTo(px, py);
  }
  graphics.closePath();
  graphics.fill({ color });
}

function DrawCameraOverlay(
  canvas: HTMLCanvasElement,
  video: HTMLVideoElement,
  handLandmarks: NormalizedLandmark[][],
  poseLandmarks?: NormalizedLandmark[],
): void {
  const width = video.videoWidth || 640;
  const height = video.videoHeight || 480;
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  }
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.clearRect(0, 0, width, height);
  ctx.lineWidth = Math.max(3, width * 0.004);
  ctx.strokeStyle = 'rgba(14, 165, 233, 0.86)';
  ctx.fillStyle = 'rgba(14, 165, 233, 0.72)';
  handLandmarks.forEach((hand) => {
    hand.forEach((point) => {
      ctx.beginPath();
      ctx.arc(point.x * width, point.y * height, Math.max(3, width * 0.006), 0, Math.PI * 2);
      ctx.fill();
    });
  });
  if (!poseLandmarks) return;
  ctx.strokeStyle = 'rgba(22, 163, 74, 0.84)';
  [23, 24, 25, 26].forEach((index) => {
    const point = poseLandmarks[index];
    if (!point) return;
    ctx.beginPath();
    ctx.arc(point.x * width, point.y * height, Math.max(4, width * 0.008), 0, Math.PI * 2);
    ctx.stroke();
  });
}

function ClearCameraOverlay(canvas: HTMLCanvasElement): void {
  canvas.getContext('2d')?.clearRect(0, 0, canvas.width, canvas.height);
}

function GetPalmCenter(landmarks: NormalizedLandmark[]): NormalizedLandmark {
  const indexes = [0, 5, 9, 13, 17];
  const total = indexes.reduce((sum, index) => ({
    x: sum.x + (landmarks[index]?.x ?? 0),
    y: sum.y + (landmarks[index]?.y ?? 0),
    z: sum.z + (landmarks[index]?.z ?? 0),
    visibility: 1,
  }), { x: 0, y: 0, z: 0, visibility: 1 });
  return {
    x: total.x / indexes.length,
    y: total.y / indexes.length,
    z: total.z / indexes.length,
    visibility: 1,
  };
}

function IsThighContact(handCenters: NormalizedLandmark[], pose?: NormalizedLandmark[]): boolean {
  if (!pose) return handCenters.some((hand) => hand.y > 0.62);
  const zones = [
    { hip: pose[23], knee: pose[25] },
    { hip: pose[24], knee: pose[26] },
  ].filter((zone) => zone.hip && zone.knee);
  if (zones.length === 0) return handCenters.some((hand) => hand.y > 0.62);
  return handCenters.some((hand) => zones.some((zone) => {
    const xMin = Math.min(zone.hip.x, zone.knee.x) - 0.18;
    const xMax = Math.max(zone.hip.x, zone.knee.x) + 0.18;
    const yMin = Math.min(zone.hip.y, zone.knee.y) - 0.08;
    const yMax = Math.max(zone.hip.y, zone.knee.y) + 0.1;
    return hand.x >= xMin && hand.x <= xMax && hand.y >= yMin && hand.y <= yMax;
  }));
}

function ClassifyTapSound(freqSamples: Uint8Array): ResponseAction {
  const split = Math.floor(freqSamples.length * 0.38);
  let low = 0;
  let high = 0;
  for (let index = 0; index < freqSamples.length; index += 1) {
    if (index < split) low += freqSamples[index];
    else high += freqSamples[index];
  }
  const ratio = high / Math.max(1, high + low);
  return ratio >= 0.34 ? 'clap' : 'thigh';
}

function CalculateRms(samples: Float32Array): number {
  let total = 0;
  for (const sample of samples) total += sample * sample;
  return Math.sqrt(total / samples.length);
}

function ToMeterLevel(rms: number): number {
  return Clamp(rms * 8.5, 0, 1);
}

function MicrophoneThreshold(sensitivity: number): number {
  return 0.085 - Clamp(sensitivity, 0.35, 0.9) * 0.06;
}

function GetAudioContextConstructor(): typeof AudioContext | null {
  if (typeof window === 'undefined') return null;
  const audioWindow = window as Window & typeof globalThis & { webkitAudioContext?: typeof AudioContext };
  return audioWindow.AudioContext ?? audioWindow.webkitAudioContext ?? null;
}

function GetStartErrorMessage(error: unknown, inputMode: InputMode, labels: EveryBallLabels): string {
  if (error instanceof DOMException && error.name === 'NotAllowedError') {
    return inputMode === 'camera' ? labels.error.cameraPermission : labels.error.microphonePermission;
  }
  if (error instanceof Error && error.message) return error.message;
  return inputMode === 'camera' ? labels.error.cameraInitialization : labels.error.microphoneInitialization;
}

function GetExpectedActionLabel(action: ExpectedAction, labels: EveryBallLabels): string {
  if (action === 'clap') return labels.actionClap;
  if (action === 'thigh') return labels.actionThigh;
  return labels.actionNone;
}

function GetResponseActionLabel(action: ResponseAction, labels: EveryBallLabels): string {
  return action === 'clap' ? labels.actionClap : labels.actionThigh;
}

function GetLevel(levelId: LevelDefinition['id']): LevelDefinition {
  return levels.find((level) => level.id === levelId) ?? levels[0];
}

function GetInitializedPixiApp(app: Application | null): Application | null {
  return app && (app as { renderer?: unknown }).renderer ? app : null;
}

function RequireElement<T>(element: T | null): T {
  if (!element) throw new Error('Required browser element is unavailable.');
  return element;
}

function WaitMs(jsPsych: JsPsych, durationMs: number): Promise<void> {
  return new Promise((resolve) => {
    jsPsych.pluginAPI.setTimeout(resolve, durationMs);
  });
}

function WriteJsPsychData(jsPsych: JsPsych, record: Record<string, unknown>): void {
  try {
    const writer = jsPsych.data as unknown as { write?: (data: unknown) => void };
    writer.write?.call(writer, record);
  } catch (error) {
    console.warn('Unable to write Every Ball Response trial to jsPsych data.', error);
  }
}

function RandomInt(min: number, max: number): number {
  return Math.round(min + Math.random() * (max - min));
}

function Shuffle<T>(items: readonly T[]): T[] {
  const next = [...items];
  for (let index = next.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [next[index], next[swapIndex]] = [next[swapIndex], next[index]];
  }
  return next;
}

function GetDistance(left: NormalizedLandmark, right: NormalizedLandmark): number {
  return Math.hypot(left.x - right.x, left.y - right.y);
}

function Clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}

function FormatTestDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

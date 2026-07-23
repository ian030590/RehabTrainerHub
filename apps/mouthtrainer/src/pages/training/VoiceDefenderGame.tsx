import {
  type ChangeEvent,
  type CSSProperties,
  type FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Application, Container, Graphics, Text, type Ticker } from 'pixi.js';
import { initJsPsych } from 'jspsych';
import { useT, type TranslationKey } from '../../i18n';
import { DownloadCsvFile } from '../../utils/downloadFile';
import { defaultUiFontSizePx, getActiveUser, GetSetting } from '../../utils/settings';
import { PlayFailureSound, PlayGameEndSound, PlaySuccessSound, PrepareAudioFeedback } from '../../utils/soundManager';
import { SaveTrainingSessionRecord } from '../../utils/trainingRecords';
import { Clamp, csvCell, FormatTestDate, WriteJsPsychData } from './gameUtils';
import { VerifySelectedTrainingUser } from './selectedUserGuard';
import { StartTrainingButton } from '@rehab-trainer/ui/components/StartTrainingButton';
import {
  TrainingConfigOptionGroup,
  TrainingConfigPanel,
  TrainingConfigSection,
} from '@rehab-trainer/ui/components/TrainingConfigPanel';
import { TrainingResultActions } from '@rehab-trainer/ui/components/TrainingResultActions';
import { useFullscreenTrainingRoot } from '@rehab-trainer/ui/hooks/useFullscreenTrainingRoot';
import { useTrainingAbort } from '@rehab-trainer/ui/hooks/useTrainingAbort';
import { typography } from '@rehab-trainer/ui/trainerTheme';
import { AppDialog } from '../../components/AppDialog';
import { InlineAlert } from '../../components/InlineAlert';
import { MediaDeviceErrorDialog } from '../../components/MediaDeviceErrorDialog';
import type { TFunction } from './types';
import { MouthTrainingRulesPanel } from './MouthTrainingRulesPanel';
import {
  CreateDefaultVoiceVocabulary,
  CreateVoiceVocabularyItems,
  LoadVoiceVocabulary,
  SaveVoiceVocabulary,
  SplitVoiceVocabularyInput,
  type VoiceLanguage,
  type VoiceVocabularyItem,
} from './voiceDefenderVocabulary';
import {
  CalculateBestSpeechSimilarity,
  NormalizeSpeechText,
  voiceMatchSimilarityThreshold,
} from './voiceDefenderSpeechMatching';

export { CalculateSimilarity, LevenshteinDistance } from './voiceDefenderSpeechMatching';

type Difficulty = 'Beginner' | 'Intermediate' | 'Advanced';
type GamePhase = 'editor' | 'rules' | 'playing' | 'results';
type RecognitionStatus = 'idle' | 'connecting' | 'ready' | 'fallback' | 'error';
type GameResult = 'Victory' | 'Defeat';
type MicrophoneStatus = 'pending' | 'testing' | 'ready' | 'silent' | 'muted' | 'disconnected' | 'denied';
type RecognitionEngine = 'azure' | 'web-speech';
type BackgroundMode = 'stars' | 'color' | 'image';
type GameDurationSeconds = number | null;
type StartRequirement = 'recognition' | 'vocabulary' | 'microphone';
type AzureSpeechSdk = typeof import('microsoft-cognitiveservices-speech-sdk');
type AzureSpeechRecognizer = InstanceType<AzureSpeechSdk['SpeechRecognizer']>;

interface VoiceDefenderGameProps {
  onExit: () => void;
}

interface DifficultyConfig {
  labelKey: TranslationKey;
  descriptionKey: TranslationKey;
  spawnMode: 'after-clear-delay' | 'after-clear' | 'fixed-interval';
  spawnIntervalSec: number;
}

interface Enemy {
  id: number;
  word: string;
  x: number;
  y: number;
  node: Container;
  spawnedAtSec: number;
  resultIndex: number;
}

interface EnemyResult {
  Enemy_Number: number;
  Word: string;
  Recognized_Text: string;
  Similarity_Percent: number | null;
  Reaction_Time_Seconds: number | null;
  Defeated: boolean;
}

interface SessionRecord {
  Test_Date: string;
  Participant_ID: string;
  Language: VoiceLanguage;
  Recognition_Engine: RecognitionEngine;
  Difficulty: Difficulty;
  Game_Time_Seconds: GameDurationSeconds;
  Starting_HP: number;
  Enemy_Speed: number;
  Total_Duration_Seconds: number;
  Enemies_Spawned: number;
  Enemies_Defeated: number;
  HP_Remaining: number;
  Score: number;
  Most_Difficult_Word: string;
  Game_Result: GameResult;
  Enemy_Results: EnemyResult[];
}

interface WebSpeechRecognitionAlternative {
  transcript: string;
  confidence: number;
}

interface WebSpeechRecognitionResult {
  readonly isFinal: boolean;
  readonly length: number;
  [index: number]: WebSpeechRecognitionAlternative;
}

interface WebSpeechRecognitionResultList {
  readonly length: number;
  [index: number]: WebSpeechRecognitionResult;
}

interface WebSpeechRecognitionEvent extends Event {
  readonly resultIndex: number;
  readonly results: WebSpeechRecognitionResultList;
}

interface WebSpeechRecognitionErrorEvent extends Event {
  readonly error: string;
  readonly message: string;
}

interface WebSpeechRecognition {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  maxAlternatives: number;
  onaudiostart: (() => void) | null;
  onsoundstart: (() => void) | null;
  onspeechstart: (() => void) | null;
  onresult: ((event: WebSpeechRecognitionEvent) => void) | null;
  onerror: ((event: WebSpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
}

interface WebSpeechRecognitionConstructor {
  new (): WebSpeechRecognition;
}

interface WebSpeechRuntime {
  kind: 'web-speech';
  recognition: WebSpeechRecognition;
  shouldRestart: boolean;
  restartTimer: number | null;
}

interface AzureSpeechToken {
  token: string;
  region: string;
  expiresInSeconds: number;
  fetchedAtMs: number;
}

interface AzureSpeechRuntime {
  kind: 'azure';
  recognizer: AzureSpeechRecognizer;
  shouldRefreshToken: boolean;
  tokenRefreshTimer: number | null;
}

type SpeechRuntime = AzureSpeechRuntime | WebSpeechRuntime;

interface MicrophoneTestRuntime {
  stream: MediaStream;
  audioContext: AudioContext;
  source: MediaStreamAudioSourceNode;
  analyser: AnalyserNode;
  animationFrame: number;
  removeTrackListeners: () => void;
}

interface StartIssue {
  requirement: StartRequirement;
  message: string;
}

const azureSpeechTokenEndpoint = '/api/azure-speech-token';

const difficulties: Record<Difficulty, DifficultyConfig> = {
  Beginner: {
    labelKey: 'voice.diff.beginner',
    descriptionKey: 'voice.diff.beginnerDesc',
    spawnMode: 'after-clear-delay',
    spawnIntervalSec: 2,
  },
  Intermediate: {
    labelKey: 'voice.diff.intermediate',
    descriptionKey: 'voice.diff.intermediateDesc',
    spawnMode: 'after-clear',
    spawnIntervalSec: 0,
  },
  Advanced: {
    labelKey: 'voice.diff.advanced',
    descriptionKey: 'voice.diff.advancedDesc',
    spawnMode: 'fixed-interval',
    spawnIntervalSec: 3,
  },
};

const hpOptions = [1, 3, 5] as const;
const gameDurationOptions = [30, 60, 300, null] as const;
const enemySpeedOptions = [5, 15, 30] as const;
const defaultHp = 3;
const defaultEnemySpeed = 5;
const defaultGameDurationSeconds: GameDurationSeconds = 30;
const defaultCustomGameDurationSeconds = 120;
const enemyVisualHeight = 98;
const enemySpawnY = -enemyVisualHeight - 8;
const defaultBackgroundColor = '#005EB8';
const microphoneSignalThreshold = 0.006;
const microphoneSilenceDelayMs = 1600;
const iosMicrophonePermissionTimeoutMs = 15_000;
const azureSpeechTokenRefreshLeadMs = 60_000;
const azureSpeechTokenDefaultExpiresInSeconds = 600;
const microphoneMediaConstraints: MediaStreamConstraints = {
  video: false,
  audio: {
    echoCancellation: true,
    noiseSuppression: true,
    channelCount: 1,
  },
};
const starSkyBackgroundImage = 'radial-gradient(circle at 30% 20%, #397fc4 0 2px, transparent 3px), radial-gradient(circle at 72% 66%, #6aaee6 0 2px, transparent 3px), linear-gradient(180deg, #043d75, #005eb8)';
const azureSpeechTokenTimeoutMs = GetPositiveNumber(
  import.meta.env.VITE_AZURE_SPEECH_TOKEN_TIMEOUT_MS,
  10_000,
);

export function VoiceDefenderGame({ onExit }: VoiceDefenderGameProps) {
  const { t } = useT();
  const { fullscreenRootRef, enterTrainingFullscreen } = useFullscreenTrainingRoot<HTMLDivElement>();
  const pixiHostRef = useRef<HTMLDivElement | null>(null);
  const appRef = useRef<Application | null>(null);
  const azureSpeechTokenRef = useRef<AzureSpeechToken | null>(null);
  const speechRuntimeRef = useRef<SpeechRuntime | null>(null);
  const recognitionEngineRef = useRef<RecognitionEngine | null>(null);
  const uploadedBackgroundUrlRef = useRef<string | null>(null);
  const recognitionSettingRef = useRef<HTMLElement | null>(null);
  const vocabularySettingRef = useRef<HTMLElement | null>(null);
  const microphoneSettingRef = useRef<HTMLElement | null>(null);
  const microphoneTestRuntimeRef = useRef<MicrophoneTestRuntime | null>(null);
  const enemiesRef = useRef<Enemy[]>([]);
  const enemyResultsRef = useRef<EnemyResult[]>([]);
  const wordMissesRef = useRef<Record<string, number>>({});
  const phaseRef = useRef<GamePhase>('editor');
  const loadGenerationRef = useRef(0);
  const lastRecognitionRef = useRef({ text: '', at: 0 });
  const metricsRef = useRef({
    elapsed: 0,
    hp: defaultHp,
    score: 0,
    spawned: 0,
    defeated: 0,
    spawnTimer: 0,
    nextId: 1,
  });
  const configRef = useRef({
    language: 'zh' as VoiceLanguage,
    difficulty: 'Beginner' as Difficulty,
    gameDurationSec: defaultGameDurationSeconds,
    maxHp: defaultHp,
    speed: defaultEnemySpeed,
    activeWords: [] as string[],
  });
  const jsPsychRef = useRef<ReturnType<typeof initJsPsych> | null>(null);

  const [phase, setPhaseState] = useState<GamePhase>('editor');
  const [language, setLanguage] = useState<VoiceLanguage>('zh');
  const [difficulty, setDifficulty] = useState<Difficulty>('Beginner');
  const [gameDurationSec, setGameDurationSec] = useState<GameDurationSeconds>(defaultGameDurationSeconds);
  const [customGameDurationSec, setCustomGameDurationSec] = useState(defaultCustomGameDurationSeconds);
  const [maxHp, setMaxHp] = useState(defaultHp);
  const [customHp, setCustomHp] = useState(defaultHp);
  const [speed, setSpeed] = useState(defaultEnemySpeed);
  const [customSpeed, setCustomSpeed] = useState(defaultEnemySpeed);
  const [backgroundMode, setBackgroundMode] = useState<BackgroundMode>('stars');
  const [backgroundColor, setBackgroundColor] = useState(defaultBackgroundColor);
  const [uploadedBackgroundUrl, setUploadedBackgroundUrl] = useState<string | null>(null);
  const [uploadedBackgroundName, setUploadedBackgroundName] = useState(() => t('drawing.upload.noImage'));
  const [vocabulary, setVocabulary] = useState<VoiceVocabularyItem[]>(LoadVoiceVocabulary);
  const [newWord, setNewWord] = useState('');
  const [vocabularyWarning, setVocabularyWarning] = useState('');
  const [recognitionStatus, setRecognitionStatus] = useState<RecognitionStatus>('idle');
  const [recognitionError, setRecognitionError] = useState('');
  const [recognitionEngine, setRecognitionEngine] = useState<RecognitionEngine | null>(null);
  const [showInAppBrowserNotice, setShowInAppBrowserNotice] = useState(
    () => typeof navigator !== 'undefined' && IsLineOrFacebookInAppBrowser(navigator.userAgent),
  );
  const [microphoneStatus, setMicrophoneStatus] = useState<MicrophoneStatus>('pending');
  const [microphoneLevel, setMicrophoneLevel] = useState(0);
  const [microphoneError, setMicrophoneError] = useState('');
  const [showMicrophoneError, setShowMicrophoneError] = useState(false);
  const [result, setResult] = useState<SessionRecord | null>(null);
  const [showStartValidation, setShowStartValidation] = useState(false);

  const activeConfig = difficulties[difficulty];
  const languageVocabulary = useMemo(
    () => vocabulary.filter((item) => item.language === language),
    [language, vocabulary],
  );
  const activeWords = useMemo(
    () => languageVocabulary.filter((item) => item.isActive).map((item) => item.word),
    [languageVocabulary],
  );
  const microphoneReady = microphoneStatus === 'ready';
  const recognitionReady = recognitionStatus === 'ready' || recognitionStatus === 'fallback';
  const startIssues = useMemo<StartIssue[]>(() => {
    const issues: StartIssue[] = [];
    if (!recognitionReady) {
      issues.push({
        requirement: 'recognition',
        message: recognitionStatus === 'connecting'
          ? t('voice.startBlocked.recognitionConnecting')
          : recognitionError || t('voice.startBlocked.recognitionUnavailable'),
      });
    }
    if (activeWords.length === 0) {
      issues.push({
        requirement: 'vocabulary',
        message: t('voice.startBlocked.vocabulary'),
      });
    }
    if (!microphoneReady) {
      issues.push({
        requirement: 'microphone',
        message: GetMicrophoneStartIssue(microphoneStatus, microphoneError, t),
      });
    }
    return issues;
  }, [
    activeWords.length,
    microphoneError,
    microphoneReady,
    microphoneStatus,
    recognitionError,
    recognitionStatus,
    recognitionReady,
    t,
  ]);
  const invalidStartRequirements = useMemo(
    () => new Set(startIssues.map((issue) => issue.requirement)),
    [startIssues],
  );
  const isPresetGameDuration = gameDurationOptions.includes(gameDurationSec as typeof gameDurationOptions[number]);
  const isCustomHp = !hpOptions.includes(maxHp as typeof hpOptions[number]);
  const isCustomSpeed = !enemySpeedOptions.includes(speed as typeof enemySpeedOptions[number]);
  const gameDurationLabel = FormatGameDuration(gameDurationSec, t);
  const backgroundSummary =
    backgroundMode === 'stars'
      ? t('drawing.background.stars')
      : backgroundMode === 'color'
        ? backgroundColor
        : t('drawing.background.customImage');
  const voiceSummaryItems = [
    { label: t('cognitive.config.difficulty'), value: t(activeConfig.labelKey) },
    { label: t('drawing.config.gameDuration'), value: gameDurationLabel },
    { label: t('voice.config.hp'), value: maxHp },
    {
      label: t('voice.config.language'),
      value: t(language === 'zh' ? 'voice.language.zh' : 'voice.language.en'),
    },
    ...(recognitionEngine
      ? [{
          label: t('voice.config.engine'),
          value: GetRecognitionEngineLabel(recognitionEngine, t),
        }]
      : []),
    { label: t('voice.config.enemySpeed'), value: t('voice.config.speedValue', { value: speed }) },
    {
      label: t('voice.vocabulary.title'),
      value: t('voice.vocabulary.activeCount', {
        active: activeWords.length,
        total: languageVocabulary.length,
      }),
    },
    { label: t('drawing.config.background'), value: backgroundSummary },
  ];
  const backgroundModeLabel =
    backgroundMode === 'stars'
      ? t('drawing.background.image')
      : backgroundMode === 'color'
        ? t('drawing.background.color')
        : t('drawing.background.customImage');
  const backgroundStyle = useMemo<CSSProperties>(() => {
    if (backgroundMode === 'stars') return { backgroundImage: starSkyBackgroundImage };
    if (backgroundMode === 'image' && uploadedBackgroundUrl) {
      return { backgroundImage: `url("${uploadedBackgroundUrl}")` };
    }
    return { backgroundImage: 'none', backgroundColor };
  }, [backgroundColor, backgroundMode, uploadedBackgroundUrl]);
  const recognitionStatusText = GetRecognitionStatusText(recognitionStatus, t);

  const setPhase = useCallback((next: GamePhase) => {
    phaseRef.current = next;
    setPhaseState(next);
  }, []);

  const scrollToStartRequirement = useCallback((requirement: StartRequirement) => {
    const target =
      requirement === 'recognition'
        ? recognitionSettingRef.current
        : requirement === 'vocabulary'
          ? vocabularySettingRef.current
          : microphoneSettingRef.current;
    target?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, []);

  useEffect(() => {
    if (showStartValidation && startIssues.length === 0) {
      setShowStartValidation(false);
    }
  }, [showStartValidation, startIssues.length]);

  useEffect(() => {
    if (!microphoneError) {
      setShowMicrophoneError(false);
      return;
    }
    setShowMicrophoneError(true);
    setShowStartValidation(true);
  }, [microphoneError]);

  useEffect(() => {
    if (recognitionStatus === 'error') setShowStartValidation(true);
  }, [recognitionStatus]);

  useEffect(() => {
    configRef.current = { language, difficulty, gameDurationSec, maxHp, speed, activeWords };
  }, [activeWords, difficulty, gameDurationSec, language, maxHp, speed]);

  useEffect(() => {
    SaveVoiceVocabulary(vocabulary);
  }, [vocabulary]);

  useEffect(() => {
    jsPsychRef.current = initJsPsych();
  }, []);

  useEffect(() => () => {
    if (uploadedBackgroundUrlRef.current) {
      URL.revokeObjectURL(uploadedBackgroundUrlRef.current);
    }
  }, []);

  const addMicrophoneTrackListeners = useCallback((track: MediaStreamTrack) => {
    const handleEnded = () => {
      setMicrophoneLevel(0);
      setMicrophoneStatus('disconnected');
      setMicrophoneError(t('voice.startBlocked.microphoneDisconnected'));
    };
    const handleMute = () => {
      setMicrophoneLevel(0);
      setMicrophoneStatus('muted');
      setMicrophoneError(t('voice.startBlocked.microphoneMuted'));
    };
    const handleUnmute = () => {
      setMicrophoneStatus('testing');
      setMicrophoneError('');
    };
    track.addEventListener('ended', handleEnded);
    track.addEventListener('mute', handleMute);
    track.addEventListener('unmute', handleUnmute);
    return () => {
      track.removeEventListener('ended', handleEnded);
      track.removeEventListener('mute', handleMute);
      track.removeEventListener('unmute', handleUnmute);
    };
  }, [t]);

  const stopMicrophoneTest = useCallback(async (resetStatus = true) => {
    const runtime = microphoneTestRuntimeRef.current;
    microphoneTestRuntimeRef.current = null;
    if (runtime) {
      window.cancelAnimationFrame(runtime.animationFrame);
      runtime.removeTrackListeners();
      runtime.source.disconnect();
      runtime.stream.getTracks().forEach((track) => track.stop());
      if (runtime.audioContext.state !== 'closed') {
        await runtime.audioContext.close().catch(() => undefined);
      }
    }
    setMicrophoneLevel(0);
    if (resetStatus) setMicrophoneStatus('disconnected');
  }, []);

  const stopListening = useCallback(async (resetStatus = true) => {
    const runtime = speechRuntimeRef.current;
    speechRuntimeRef.current = null;
    if (runtime?.kind === 'azure') {
      runtime.shouldRefreshToken = false;
      if (runtime.tokenRefreshTimer !== null) {
        window.clearTimeout(runtime.tokenRefreshTimer);
      }
      await StopAzureContinuousRecognition(runtime.recognizer);
      runtime.recognizer.close();
    } else if (runtime?.kind === 'web-speech') {
      runtime.shouldRestart = false;
      if (runtime.restartTimer !== null) {
        window.clearTimeout(runtime.restartTimer);
      }
      runtime.recognition.onend = null;
      runtime.recognition.abort();
    }
    setMicrophoneLevel(0);
    if (resetStatus) setMicrophoneStatus('disconnected');
  }, []);

  useEffect(() => {
    const engineWindow = window as Window & { STT_Engine?: { stopListening: () => Promise<void> } };
    engineWindow.STT_Engine = { stopListening };
    return () => {
      delete engineWindow.STT_Engine;
    };
  }, [stopListening]);

  const connectRecognitionEngine = useCallback(async (targetLanguage: VoiceLanguage) => {
    const generation = loadGenerationRef.current + 1;
    loadGenerationRef.current = generation;
    azureSpeechTokenRef.current = null;
    recognitionEngineRef.current = null;
    setRecognitionEngine(null);
    setRecognitionStatus('connecting');
    setRecognitionError('');
    setVocabularyWarning('');

    try {
      const token = await FetchAzureSpeechToken(
        azureSpeechTokenEndpoint,
        azureSpeechTokenTimeoutMs,
        targetLanguage,
      );
      if (loadGenerationRef.current !== generation) return;

      azureSpeechTokenRef.current = token;
      recognitionEngineRef.current = 'azure';
      setRecognitionEngine('azure');
      setRecognitionStatus('ready');
    } catch (error) {
      if (loadGenerationRef.current !== generation) return;

      console.warn('Unable to initialize Azure Speech; attempting Web Speech API fallback.', error);
      const errorMessage = GetErrorMessage(error) || t('voice.recognition.error');
      if (GetWebSpeechRecognitionConstructor()) {
        recognitionEngineRef.current = 'web-speech';
        setRecognitionEngine('web-speech');
        setRecognitionStatus('fallback');
        setRecognitionError(`${errorMessage} ${t('voice.recognition.fallbackHint')}`);
      } else {
        setRecognitionStatus('error');
        setRecognitionError(`${errorMessage} ${t('voice.recognition.webSpeechUnavailable')}`);
      }
    }
  }, [t]);

  useEffect(() => {
    void stopListening(false);
    void stopMicrophoneTest(false);
    setMicrophoneStatus('pending');
    setMicrophoneLevel(0);
    setMicrophoneError('');
    void connectRecognitionEngine(language);
  }, [language, connectRecognitionEngine, stopListening, stopMicrophoneTest]);

  useEffect(() => () => {
    loadGenerationRef.current += 1;
    void stopListening(false);
    void stopMicrophoneTest(false);
    enemiesRef.current.forEach((enemy) => enemy.node.destroy({ children: true }));
    enemiesRef.current = [];
  }, [stopListening, stopMicrophoneTest]);

  const testMicrophone = useCallback(async () => {
    await stopListening(false);
    await stopMicrophoneTest(false);
    setMicrophoneError('');
    setMicrophoneLevel(0);
    setMicrophoneStatus('testing');
    let pendingStream: MediaStream | null = null;
    let pendingAudioContext: AudioContext | null = null;
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new MicrophoneAccessError(t('voice.microphone.denied'), 'denied');
      }
      const stream = await RequestMicrophoneStream(microphoneMediaConstraints);
      pendingStream = stream;
      const track = stream.getAudioTracks()[0];
      if (!track || track.readyState !== 'live') {
        throw new MicrophoneAccessError(t('voice.microphone.denied'), 'denied');
      }

      const audioContext = new AudioContext();
      pendingAudioContext = audioContext;
      await audioContext.resume();
      const source = audioContext.createMediaStreamSource(stream);
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 512;
      analyser.smoothingTimeConstant = 0.72;
      source.connect(analyser);

      const removeTrackListeners = addMicrophoneTrackListeners(track);
      const samples = new Uint8Array(analyser.fftSize);
      const startedAt = performance.now();
      let lastSignalAt = 0;
      let lastRenderAt = 0;
      const runtime: MicrophoneTestRuntime = {
        stream,
        audioContext,
        source,
        analyser,
        animationFrame: 0,
        removeTrackListeners,
      };
      microphoneTestRuntimeRef.current = runtime;
      pendingStream = null;
      pendingAudioContext = null;

      const updateMeter = (now: number) => {
        if (microphoneTestRuntimeRef.current !== runtime) return;
        analyser.getByteTimeDomainData(samples);
        const rms = CalculateByteRms(samples);
        if (now - lastRenderAt >= 70) {
          setMicrophoneLevel(ToMeterLevel(rms));
          lastRenderAt = now;
        }

        if (track.readyState !== 'live') {
          setMicrophoneStatus('disconnected');
          setMicrophoneError(t('voice.startBlocked.microphoneDisconnected'));
        } else if (!track.enabled || track.muted) {
          setMicrophoneStatus('muted');
          setMicrophoneError(t('voice.startBlocked.microphoneMuted'));
        } else if (rms >= microphoneSignalThreshold) {
          lastSignalAt = now;
          setMicrophoneStatus('ready');
          setMicrophoneError('');
        } else if (
          now - startedAt >= microphoneSilenceDelayMs
          && (lastSignalAt === 0 || now - lastSignalAt >= microphoneSilenceDelayMs)
        ) {
          setMicrophoneStatus('silent');
          setMicrophoneError(t('voice.startBlocked.microphoneSilent'));
        }

        runtime.animationFrame = window.requestAnimationFrame(updateMeter);
      };
      runtime.animationFrame = window.requestAnimationFrame(updateMeter);
    } catch (error) {
      console.warn('Microphone permission was not granted.', error);
      pendingStream?.getTracks().forEach((track) => track.stop());
      if (pendingAudioContext && pendingAudioContext.state !== 'closed') {
        await pendingAudioContext.close().catch(() => undefined);
      }
      await stopMicrophoneTest(false);
      const accessError = GetMicrophoneAccessError(error, t);
      setMicrophoneStatus(accessError.microphoneStatus);
      setMicrophoneError(accessError.message);
    }
  }, [addMicrophoneTrackListeners, stopListening, stopMicrophoneTest, t]);

  const clearEnemies = useCallback(() => {
    enemiesRef.current.forEach((enemy) => enemy.node.destroy({ children: true }));
    enemiesRef.current = [];
  }, []);

  const drawStage = useCallback((app: Application) => {
    app.stage.removeChildren();
    const width = app.renderer.width;
    const height = app.renderer.height;
    const background = new Graphics();
    background.rect(0, 0, width, height).fill({ color: 0x050816, alpha: 0.22 });
    app.stage.addChild(background);
  }, []);

  const recordEnemyOutcome = useCallback((
    enemy: Enemy,
    defeatedEnemy: boolean,
    transcript = '',
    similarity: number | null = null,
  ) => {
    const outcome = enemyResultsRef.current[enemy.resultIndex];
    if (!outcome || outcome.Reaction_Time_Seconds !== null) return;
    outcome.Recognized_Text = transcript;
    outcome.Similarity_Percent = similarity === null ? null : Math.round(similarity * 100);
    outcome.Reaction_Time_Seconds = Number((metricsRef.current.elapsed - enemy.spawnedAtSec).toFixed(2));
    outcome.Defeated = defeatedEnemy;
  }, []);

  const finishGame = useCallback((gameResult: GameResult) => {
    if (phaseRef.current === 'results') return;
    PlayGameEndSound(gameResult, jsPsychRef);
    void stopListening();
    enemiesRef.current.forEach((enemy) => recordEnemyOutcome(enemy, false));
    clearEnemies();
    const metrics = metricsRef.current;
    const troubleWord = GetMostDifficultWord(wordMissesRef.current);
    const record: SessionRecord = {
      Test_Date: FormatTestDate(new Date()),
      Participant_ID: getActiveUser() || 'Unknown',
      Language: configRef.current.language,
      Recognition_Engine: recognitionEngineRef.current ?? 'web-speech',
      Difficulty: configRef.current.difficulty,
      Game_Time_Seconds: configRef.current.gameDurationSec,
      Starting_HP: configRef.current.maxHp,
      Enemy_Speed: configRef.current.speed,
      Total_Duration_Seconds: Number(metrics.elapsed.toFixed(1)),
      Enemies_Spawned: metrics.spawned,
      Enemies_Defeated: metrics.defeated,
      HP_Remaining: metrics.hp,
      Score: metrics.score,
      Most_Difficult_Word: troubleWord,
      Game_Result: gameResult,
      Enemy_Results: enemyResultsRef.current.map((item) => ({ ...item })),
    };
    setResult(record);
    setPhase('results');
    void SaveTrainingSessionRecord({
      userName: record.Participant_ID,
      moduleId: 'speech-training',
      gameId: 'voice-defender',
      gameTitle: t('voice.title'),
      difficulty: record.Difficulty,
      trainingDate: record.Test_Date,
      details: {
        Language: record.Language,
        Recognition_Engine: record.Recognition_Engine,
        Game_Time_Seconds: record.Game_Time_Seconds ?? t('training.infinite'),
        Starting_HP: record.Starting_HP,
        Enemy_Speed: record.Enemy_Speed,
        Total_Duration_Seconds: record.Total_Duration_Seconds,
        Enemies_Spawned: record.Enemies_Spawned,
        Enemies_Defeated: record.Enemies_Defeated,
        HP_Remaining: record.HP_Remaining,
        Score: record.Score,
        Most_Difficult_Word: record.Most_Difficult_Word,
        Game_Result: record.Game_Result,
      },
      detailRows: record.Enemy_Results.map((item) => ({ ...item }) as Record<string, unknown>),
    });
    WriteJsPsychData(
      jsPsychRef,
      record as unknown as Record<string, unknown>,
      'Unable to write voice defender result to jsPsych data.',
    );
  }, [clearEnemies, recordEnemyOutcome, setPhase, stopListening, t]);

  const handleRecognition = useCallback((transcripts: string[]) => {
    if (phaseRef.current !== 'playing') return;
    const usableTranscripts = transcripts
      .map((transcript) => transcript.trim())
      .filter((transcript) => NormalizeSpeechText(transcript));
    if (usableTranscripts.length === 0) return;

    const now = performance.now();
    const recognitionKey = usableTranscripts.map(NormalizeSpeechText).join('|');
    if (
      lastRecognitionRef.current.text === recognitionKey
      && now - lastRecognitionRef.current.at < 650
    ) {
      return;
    }

    const matched = enemiesRef.current
      .flatMap((enemy) => usableTranscripts.map((transcript) => ({
        enemy,
        transcript,
        similarity: CalculateBestSpeechSimilarity(transcript, enemy.word),
      })))
      .filter((candidate) => candidate.similarity >= voiceMatchSimilarityThreshold)
      .sort((a, b) => b.enemy.y - a.enemy.y || b.similarity - a.similarity)[0];

    if (!matched) return;
    lastRecognitionRef.current = { text: recognitionKey, at: now };
    PlaySuccessSound(jsPsychRef);
    recordEnemyOutcome(matched.enemy, true, matched.transcript, matched.similarity);
    matched.enemy.node.destroy({ children: true });
    enemiesRef.current = enemiesRef.current.filter((enemy) => enemy.id !== matched.enemy.id);
    metricsRef.current.defeated += 1;
    metricsRef.current.score += Math.max(10, Math.round(100 * matched.similarity));
  }, [recordEnemyOutcome]);

  const getAzureSpeechToken = useCallback(async (
    currentToken: AzureSpeechToken | null,
    tokenLanguage: VoiceLanguage,
  ) => {
    if (currentToken && IsAzureSpeechTokenFresh(currentToken)) {
      return currentToken;
    }
    const token = await FetchAzureSpeechToken(
      azureSpeechTokenEndpoint,
      azureSpeechTokenTimeoutMs,
      tokenLanguage,
    );
    azureSpeechTokenRef.current = token;
    return token;
  }, []);

  const scheduleAzureSpeechTokenRefresh = useCallback((
    runtime: AzureSpeechRuntime,
    currentToken: AzureSpeechToken,
    tokenLanguage: VoiceLanguage,
  ) => {
    if (runtime.tokenRefreshTimer !== null) {
      window.clearTimeout(runtime.tokenRefreshTimer);
    }
    const refreshDelayMs = Math.max(
      30_000,
      currentToken.expiresInSeconds * 1000 - azureSpeechTokenRefreshLeadMs,
    );
    runtime.tokenRefreshTimer = window.setTimeout(() => {
      if (speechRuntimeRef.current !== runtime || !runtime.shouldRefreshToken) return;
      void getAzureSpeechToken(null, tokenLanguage)
        .then((token) => {
          if (speechRuntimeRef.current !== runtime || !runtime.shouldRefreshToken) return;
          runtime.recognizer.authorizationToken = token.token;
          scheduleAzureSpeechTokenRefresh(runtime, token, tokenLanguage);
        })
        .catch((error) => {
          if (speechRuntimeRef.current !== runtime || !runtime.shouldRefreshToken) return;
          setMicrophoneError(GetErrorMessage(error) || t('voice.recognition.error'));
        });
    }, refreshDelayMs);
  }, [getAzureSpeechToken, t]);

  const startListening = useCallback(async () => {
    await stopMicrophoneTest(false);
    await stopListening(false);
    setMicrophoneLevel(0);
    setMicrophoneStatus('testing');

    const engine = recognitionEngineRef.current;
    if (engine === 'web-speech') {
      const speechRecognitionConstructor = GetWebSpeechRecognitionConstructor();
      if (!speechRecognitionConstructor) {
        throw new Error(t('voice.recognition.webSpeechUnavailable'));
      }

      const recognition = new speechRecognitionConstructor();
      const runtime: WebSpeechRuntime = {
        kind: 'web-speech',
        recognition,
        shouldRestart: true,
        restartTimer: null,
      };
      recognition.lang = configRef.current.language === 'zh' ? 'zh-TW' : 'en-US';
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.maxAlternatives = 5;
      recognition.onaudiostart = () => {
        setMicrophoneStatus('testing');
        setMicrophoneError('');
      };
      recognition.onsoundstart = () => {
        setMicrophoneStatus('ready');
        setMicrophoneError('');
      };
      recognition.onspeechstart = () => {
        setMicrophoneStatus('ready');
        setMicrophoneError('');
      };
      recognition.onresult = (event) => {
        const transcripts = new Set<string>();
        for (let resultIndex = event.resultIndex; resultIndex < event.results.length; resultIndex += 1) {
          const result = event.results[resultIndex];
          for (let alternativeIndex = 0; alternativeIndex < result.length; alternativeIndex += 1) {
            transcripts.add(result[alternativeIndex].transcript);
          }
        }
        setMicrophoneStatus('ready');
        setMicrophoneError('');
        handleRecognition([...transcripts]);
      };
      recognition.onerror = (event) => {
        if (event.error === 'aborted' || event.error === 'no-speech') return;
        if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
          runtime.shouldRestart = false;
          const accessError = GetMicrophoneAccessError(event.error, t);
          setMicrophoneStatus(accessError.microphoneStatus);
          setMicrophoneError(accessError.message);
          return;
        }
        setMicrophoneError(event.message || event.error);
      };
      recognition.onend = () => {
        if (speechRuntimeRef.current !== runtime || !runtime.shouldRestart) return;
        runtime.restartTimer = window.setTimeout(() => {
          if (speechRuntimeRef.current !== runtime || !runtime.shouldRestart) return;
          try {
            recognition.start();
          } catch (error) {
            console.warn('Unable to restart Web Speech recognition.', error);
          }
        }, 250);
      };

      speechRuntimeRef.current = runtime;
      try {
        recognition.start();
      } catch (error) {
        speechRuntimeRef.current = null;
        runtime.shouldRestart = false;
        throw error;
      }
      return;
    }

    if (engine !== 'azure') throw new Error(t('voice.recognition.notReady'));
    if (!navigator.mediaDevices?.getUserMedia) {
      throw new MicrophoneAccessError(t('voice.microphone.denied'), 'denied');
    }

    const sdk = await import('microsoft-cognitiveservices-speech-sdk');
    sdk.SpeechRecognizer.enableTelemetry(false);
    const azureToken = await getAzureSpeechToken(azureSpeechTokenRef.current, configRef.current.language);
    const speechConfig = sdk.SpeechConfig.fromAuthorizationToken(azureToken.token, azureToken.region);
    speechConfig.speechRecognitionLanguage = configRef.current.language === 'zh' ? 'zh-TW' : 'en-US';
    const audioConfig = sdk.AudioConfig.fromDefaultMicrophoneInput();
    const recognizer = new sdk.SpeechRecognizer(speechConfig, audioConfig);
    const runtime: AzureSpeechRuntime = {
      kind: 'azure',
      recognizer,
      shouldRefreshToken: true,
      tokenRefreshTimer: null,
    };

    recognizer.sessionStarted = () => {
      setMicrophoneStatus('ready');
      setMicrophoneError('');
    };
    recognizer.speechStartDetected = () => {
      setMicrophoneStatus('ready');
      setMicrophoneError('');
    };
    recognizer.recognizing = (_, event) => {
      const text = event.result?.text?.trim();
      if (!text) return;
      setMicrophoneStatus('ready');
      setMicrophoneError('');
      handleRecognition([text]);
    };
    recognizer.recognized = (_, event) => {
      const text = event.result?.text?.trim();
      if (!text) return;
      setMicrophoneStatus('ready');
      setMicrophoneError('');
      handleRecognition([text]);
    };
    recognizer.canceled = (_, event) => {
      const message = event.errorDetails || String(event.reason || t('voice.recognition.error'));
      if (message) setMicrophoneError(message);
      if (IsMicrophonePermissionDeniedMessage(message)) {
        setMicrophoneStatus('denied');
      } else {
        setMicrophoneStatus('disconnected');
      }
    };
    recognizer.sessionStopped = () => {
      if (speechRuntimeRef.current === runtime) {
        setMicrophoneStatus('disconnected');
      }
    };

    speechRuntimeRef.current = runtime;
    scheduleAzureSpeechTokenRefresh(runtime, azureToken, configRef.current.language);
    try {
      await StartAzureContinuousRecognition(recognizer);
    } catch (error) {
      speechRuntimeRef.current = null;
      runtime.shouldRefreshToken = false;
      if (runtime.tokenRefreshTimer !== null) {
        window.clearTimeout(runtime.tokenRefreshTimer);
      }
      recognizer.close();
      throw error;
    }
  }, [getAzureSpeechToken, handleRecognition, scheduleAzureSpeechTokenRefresh, stopListening, stopMicrophoneTest, t]);

  const spawnEnemy = useCallback((app: Application) => {
    const words = configRef.current.activeWords;
    if (words.length === 0) return;
    const word = words[Math.floor(Math.random() * words.length)];
    const enemyNumber = metricsRef.current.spawned + 1;
    const resultIndex = enemyResultsRef.current.length;
    const cardTypography = GetVoiceCardTypography(word);
    const boardWidth = Clamp(cardTypography.estimatedWidth + 32, 88, Math.min(280, app.renderer.width - 24));
    const boardHeight = Clamp(cardTypography.fontSize + 28, 50, 74);
    const boardY = 48;
    const x = boardWidth / 2 + 12 + Math.random() * Math.max(1, app.renderer.width - boardWidth - 24);
    const node = new Container();
    const monster = new Text({ text: '👾', style: { fontSize: 42 } });
    monster.anchor.set(0.5);
    monster.x = 0;
    monster.y = 24;
    const board = new Graphics();
    board.roundRect(-boardWidth / 2, boardY, boardWidth, boardHeight, 6)
      .fill(0xffffff)
      .stroke({ color: 0xc2c6d4, width: 2 });
    const label = new Text({
      text: word,
      style: {
        fill: 0x1a1c1e,
        fontFamily: typography.fontFamily,
        fontSize: cardTypography.fontSize,
        fontWeight: cardTypography.fontWeight,
        align: 'center',
      },
    });
    label.anchor.set(0.5);
    label.y = boardY + boardHeight / 2;
    node.addChild(monster, board, label);
    node.x = x;
    node.y = enemySpawnY;
    app.stage.addChild(node);

    const enemy: Enemy = {
      id: metricsRef.current.nextId++,
      word,
      x,
      y: enemySpawnY,
      node,
      spawnedAtSec: metricsRef.current.elapsed,
      resultIndex,
    };
    enemiesRef.current.push(enemy);
    enemyResultsRef.current.push({
      Enemy_Number: enemyNumber,
      Word: word,
      Recognized_Text: '',
      Similarity_Percent: null,
      Reaction_Time_Seconds: null,
      Defeated: false,
    });
    metricsRef.current.spawned += 1;
  }, []);

  const startGame = useCallback(async () => {
    if (!VerifySelectedTrainingUser()) return;
    PrepareAudioFeedback(jsPsychRef);
    if (!recognitionReady || activeWords.length === 0) return;
    if (phaseRef.current === 'editor' && !microphoneReady) return;
    const app = appRef.current;
    if (!app) return;
    await enterTrainingFullscreen();
    ResizePixiAppToElement(app, pixiHostRef.current);

    setMicrophoneError('');
    configRef.current = { language, difficulty, gameDurationSec, maxHp, speed, activeWords };
    try {
      await startListening();
    } catch (error) {
      console.error('Unable to start voice recognition.', error);
      const accessError = GetMicrophoneAccessError(error, t);
      setMicrophoneError(accessError.message);
      setMicrophoneStatus(accessError.microphoneStatus);
      setShowStartValidation(true);
      window.requestAnimationFrame(() => scrollToStartRequirement('microphone'));
      return;
    }

    clearEnemies();
    drawStage(app);
    metricsRef.current = {
      elapsed: 0,
      hp: maxHp,
      score: 0,
      spawned: 0,
      defeated: 0,
      spawnTimer: 0,
      nextId: 1,
    };
    enemyResultsRef.current = [];
    wordMissesRef.current = {};
    lastRecognitionRef.current = { text: '', at: 0 };
    setResult(null);
    setPhase('playing');
    setShowStartValidation(false);
  }, [
    activeWords,
    clearEnemies,
    difficulty,
    drawStage,
    enterTrainingFullscreen,
    gameDurationSec,
    language,
    maxHp,
    microphoneReady,
    recognitionReady,
    scrollToStartRequirement,
    setPhase,
    speed,
    startListening,
    t,
  ]);

  const handleStartGame = useCallback(() => {
    setShowStartValidation(true);
    if (startIssues.length > 0) {
      window.requestAnimationFrame(() => scrollToStartRequirement(startIssues[0].requirement));
      return;
    }
    setShowStartValidation(false);
    setPhase('rules');
  }, [scrollToStartRequirement, setPhase, startIssues]);

  const returnToEditor = useCallback(() => {
    void stopListening();
    clearEnemies();
    const app = appRef.current;
    if (app) drawStage(app);
    setPhase('editor');
  }, [clearEnemies, drawStage, setPhase, stopListening]);

  useTrainingAbort({
    active: phase === 'rules' || phase === 'playing',
    onAbort: returnToEditor,
  });

  const handleExit = useCallback(() => {
    void stopListening();
    onExit();
  }, [onExit, stopListening]);

  const handleBackgroundImageUpload = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !file.type.startsWith('image/')) return;
    if (uploadedBackgroundUrlRef.current) {
      URL.revokeObjectURL(uploadedBackgroundUrlRef.current);
    }
    const imageUrl = URL.createObjectURL(file);
    uploadedBackgroundUrlRef.current = imageUrl;
    setUploadedBackgroundUrl(imageUrl);
    setUploadedBackgroundName(file.name);
    setBackgroundMode('image');
    event.target.value = '';
  }, []);

  useEffect(() => {
    let cancelled = false;
    const app = new Application();
    appRef.current = app;

    const init = async () => {
      const host = pixiHostRef.current;
      if (!host) return;
      await app.init({
        backgroundAlpha: 0,
        antialias: true,
        autoDensity: true,
        resolution: window.devicePixelRatio || 1,
        resizeTo: host,
      });
      if (cancelled) return;
      host.appendChild(app.canvas);
      app.canvas.className = 'drawing-defense-canvas voice-defender-canvas';
      drawStage(app);
      app.ticker.add((ticker: Ticker) => {
        if (phaseRef.current !== 'playing') return;
        const dt = Math.min(ticker.deltaMS / 1000, 0.05);
        const metrics = metricsRef.current;
        const config = difficulties[configRef.current.difficulty];
        const targetGameDurationSec = configRef.current.gameDurationSec;
        const isTimeUnlimited = targetGameDurationSec === null;
        metrics.elapsed += dt;

        const noActiveEnemies = enemiesRef.current.length === 0;
        if (config.spawnMode === 'fixed-interval' || noActiveEnemies) {
          metrics.spawnTimer += dt;
        } else {
          metrics.spawnTimer = 0;
        }
        if (isTimeUnlimited || metrics.elapsed < targetGameDurationSec) {
          const shouldSpawn =
            metrics.spawned === 0
            || (config.spawnMode === 'after-clear-delay' && noActiveEnemies && metrics.spawnTimer >= config.spawnIntervalSec)
            || (config.spawnMode === 'after-clear' && noActiveEnemies)
            || (config.spawnMode === 'fixed-interval' && metrics.spawnTimer >= config.spawnIntervalSec);
          if (shouldSpawn) {
            metrics.spawnTimer = 0;
            spawnEnemy(app);
          }
        }

        const defenseY = app.renderer.height - enemyVisualHeight;
        for (const enemy of [...enemiesRef.current]) {
          enemy.y += configRef.current.speed * dt;
          enemy.node.y = enemy.y;
          if (enemy.y <= defenseY) continue;
          PlayFailureSound(jsPsychRef);
          recordEnemyOutcome(enemy, false);
          enemy.node.destroy({ children: true });
          enemiesRef.current = enemiesRef.current.filter((item) => item.id !== enemy.id);
          wordMissesRef.current[enemy.word] = (wordMissesRef.current[enemy.word] ?? 0) + 1;
          metrics.hp = Math.max(0, metrics.hp - 1);
        }

        if (metrics.hp <= 0) {
          finishGame('Defeat');
          return;
        }
        if (!isTimeUnlimited && metrics.elapsed >= targetGameDurationSec && metrics.hp > 0) {
          finishGame('Victory');
        }
      });
    };

    void init();
    return () => {
      cancelled = true;
      app.destroy(true, { children: true, texture: true });
      appRef.current = null;
    };
  }, [drawStage, finishGame, recordEnemyOutcome, spawnEnemy]);

  const updateVocabulary = useCallback((updater: (items: VoiceVocabularyItem[]) => VoiceVocabularyItem[]) => {
    setVocabulary((current) => updater(current));
  }, []);

  const addWord = useCallback((event: FormEvent) => {
    event.preventDefault();
    const word = newWord.trim();
    if (!word) return;
    setVocabularyWarning('');
    const entries = SplitVoiceVocabularyInput(word, language);
    const newEntries = entries.filter((entry) => (
      !vocabulary.some((item) => (
        item.language === language
        && NormalizeSpeechText(item.word) === NormalizeSpeechText(entry)
      ))
    ));
    if (newEntries.length === 0) {
      setNewWord('');
      return;
    }
    updateVocabulary((items) => [
      ...items,
      ...newEntries.flatMap((entry) => CreateVoiceVocabularyItems(entry, language)),
    ]);
    setNewWord('');
  }, [language, newWord, updateVocabulary, vocabulary]);

  const downloadResult = useCallback(() => {
    if (!result) return;
    DownloadCsvFile(ToCsv(result), `voice_defender_${Date.now()}.csv`);
  }, [result]);

  return (
    <div
      ref={fullscreenRootRef}
      className={`drawing-defense voice-defender drawing-defense-phase-${phase === 'editor' ? 'menu' : phase} voice-defender-phase-${phase}`}
      style={backgroundStyle}
    >
      <div ref={pixiHostRef} className="drawing-defense-stage voice-defender-stage" />

      {showInAppBrowserNotice && (
        <AppDialog
          title={t('voice.browserNotice.title')}
          titleId="voice-browser-notice-title"
          actions={(
            <button className="btn btn-primary btn-lg" type="button" onClick={() => setShowInAppBrowserNotice(false)}>
              {t('btn.confirm')}
            </button>
          )}
        >
            <p>{t('voice.browserNotice.desc')}</p>
        </AppDialog>
      )}

      {phase === 'editor' && (
        <div className="training-panel">
          <TrainingConfigPanel
            label={t('voice.configLabel')}
            title={t('voice.title')}
            headerEnd={recognitionStatus !== 'error' && (
              <div className={`voice-recognition-status voice-recognition-status-${recognitionStatus}`} aria-live="polite">
                <span>{recognitionStatusText}</span>
                {recognitionStatus === 'connecting' && (
                  <progress aria-label={recognitionStatusText} />
                )}
              </div>
            )}
            summaryTitle={t('voice.title')}
            summaryItems={voiceSummaryItems}
            actions={(
              <>
                {showStartValidation && startIssues.length > 0 && (
                  <InlineAlert
                    tone="error"
                    className="training-start-alert training-start-alert-list"
                    onClick={() => {
                      if (microphoneError) {
                        setShowMicrophoneError(true);
                        return;
                      }
                      scrollToStartRequirement(startIssues[0].requirement);
                    }}
                    aria-label={microphoneError
                      ? t('voice.microphone.openErrorDetails')
                      : t('voice.startBlocked.title')}
                  >
                    <strong>{t('voice.startBlocked.title')}</strong>
                    <span className="training-start-alert-details">
                      {startIssues.map((issue) => (
                        <span key={issue.requirement}>{issue.message}</span>
                      ))}
                    </span>
                  </InlineAlert>
                )}
                <StartTrainingButton onClick={() => void handleStartGame()}>
                  {t('training.rules')}
                </StartTrainingButton>
                <button className="btn btn-ghost btn-lg" onClick={handleExit}>{t('training.cancel')}</button>
              </>
            )}
          >
              <TrainingConfigSection
                title={t('cognitive.config.difficulty')}
                description={t(activeConfig.descriptionKey)}
                value={t(activeConfig.labelKey)}
              >
                <TrainingConfigOptionGroup columns={3}>
                  {Object.entries(difficulties).map(([key, value]) => (
                    <button
                      key={key}
                      type="button"
                      className={`training-option ${difficulty === key ? 'active' : ''}`}
                      onClick={() => setDifficulty(key as Difficulty)}
                    >
                      <span className="training-option-title">{t(value.labelKey)}</span>
                      <span className="training-option-meta">{t(value.descriptionKey)}</span>
                    </button>
                  ))}
                </TrainingConfigOptionGroup>
              </TrainingConfigSection>

              <TrainingConfigSection
                title={t('voice.config.hp')}
                description={t('voice.config.hpDesc')}
                value={maxHp}
              >
                <TrainingConfigOptionGroup columns={4}>
                  {hpOptions.map((option) => (
                    <button
                      key={option}
                      type="button"
                      className={`training-option ${maxHp === option ? 'active' : ''}`}
                      onClick={() => setMaxHp(option)}
                    >
                      <span className="training-option-title">{t('voice.hpValue', { value: option })}</span>
                    </button>
                  ))}
                  <label
                    className={`training-option training-option-custom ${isCustomHp ? 'active' : ''}`}
                    onClick={() => setMaxHp(customHp)}
                  >
                    <span className="training-option-title">{t('training.custom')}</span>
                    <input
                      className="training-number-input"
                      type="number"
                      min="1"
                      max="20"
                      step="1"
                      value={customHp}
                      onChange={(event) => {
                        const value = Clamp(Number(event.target.value), 1, 20);
                        setCustomHp(value);
                        setMaxHp(value);
                      }}
                      onFocus={() => setMaxHp(customHp)}
                      aria-label={t('drawing.config.customHp')}
                    />
                  </label>
                </TrainingConfigOptionGroup>
              </TrainingConfigSection>

              <TrainingConfigSection
                title={t('drawing.config.gameDuration')}
                description={gameDurationLabel}
                value={gameDurationSec === defaultGameDurationSeconds
                  ? t('training.default')
                  : isPresetGameDuration
                    ? t('training.optional')
                    : t('training.custom')}
                wide
              >
                <TrainingConfigOptionGroup className="training-duration-grid">
                  {gameDurationOptions.filter((option) => option !== null).map((option) => (
                    <button
                      key={option}
                      type="button"
                      className={`training-option ${gameDurationSec === option ? 'active' : ''}`}
                      onClick={() => setGameDurationSec(option)}
                    >
                      <span className="training-option-title">{FormatGameDuration(option, t)}</span>
                    </button>
                  ))}
                  <label
                    className={`training-option training-option-custom ${!isPresetGameDuration ? 'active' : ''}`}
                    onClick={() => setGameDurationSec(customGameDurationSec)}
                  >
                    <span className="training-option-title">{t('training.custom')}</span>
                    <input
                      className="training-number-input"
                      type="number"
                      min="1"
                      max="1800"
                      step="1"
                      value={customGameDurationSec}
                      onChange={(event) => {
                        const value = Clamp(Number(event.target.value), 1, 1800);
                        setCustomGameDurationSec(value);
                        setGameDurationSec(value);
                      }}
                      onFocus={() => setGameDurationSec(customGameDurationSec)}
                      aria-label={t('drawing.config.customDuration')}
                    />
                  </label>
                  <button
                    type="button"
                    className={`training-option ${gameDurationSec === null ? 'active' : ''}`}
                    onClick={() => setGameDurationSec(null)}
                  >
                    <span className="training-option-title">{t('drawing.config.infiniteMode')}</span>
                  </button>
                </TrainingConfigOptionGroup>
              </TrainingConfigSection>

              <TrainingConfigSection
                title={t('voice.config.enemySpeed')}
                description={t('voice.config.speedValue', { value: speed })}
                value={isCustomSpeed ? t('training.custom') : t('training.default')}
              >
                <TrainingConfigOptionGroup className="training-speed-grid">
                  {enemySpeedOptions.map((option) => (
                    <button
                      key={option}
                      type="button"
                      className={`training-option ${speed === option ? 'active' : ''}`}
                      onClick={() => setSpeed(option)}
                    >
                      <span className="training-option-title">{option}</span>
                      <span className="training-option-meta">{t('voice.config.speedUnit')}</span>
                    </button>
                  ))}
                  <label
                    className={`training-option training-option-custom ${isCustomSpeed ? 'active' : ''}`}
                    onClick={() => setSpeed(customSpeed)}
                  >
                    <span className="training-option-title">{t('training.custom')}</span>
                    <input
                      className="training-number-input"
                      type="number"
                      min="1"
                      max="170"
                      step="1"
                      value={customSpeed}
                      onChange={(event) => {
                        const value = Clamp(Number(event.target.value), 1, 170);
                        setCustomSpeed(value);
                        setSpeed(value);
                      }}
                      onFocus={() => setSpeed(customSpeed)}
                      aria-label={t('voice.config.customEnemySpeed')}
                    />
                  </label>
                </TrainingConfigOptionGroup>
              </TrainingConfigSection>

              <TrainingConfigSection
                ref={recognitionSettingRef}
                className={showStartValidation && invalidStartRequirements.has('recognition')
                  ? 'voice-start-invalid'
                  : undefined}
                aria-invalid={showStartValidation && invalidStartRequirements.has('recognition')}
                title={t('voice.config.language')}
                description={t('voice.config.languageDesc')}
                value={t(language === 'zh' ? 'voice.language.zh' : 'voice.language.en')}
                wide
              >
                <TrainingConfigOptionGroup columns={3}>
                  {(['zh', 'en'] as const).map((option) => (
                    <button
                      key={option}
                      type="button"
                      className={`training-option ${language === option ? 'active' : ''}`}
                      onClick={() => setLanguage(option)}
                    >
                      <span className="training-option-title">
                        {t(option === 'zh' ? 'voice.language.zh' : 'voice.language.en')}
                      </span>
                      <span className="training-option-meta">
                        {t(option === 'zh' ? 'voice.language.zhModel' : 'voice.language.enModel')}
                      </span>
                    </button>
                  ))}
                  <button
                    type="button"
                    className="training-option"
                    onClick={() => void connectRecognitionEngine(language)}
                  >
                    <span className="training-option-title">{t('voice.recognition.reconnect')}</span>
                    <span className="training-option-meta">{t('voice.recognition.azureHint')}</span>
                  </button>
                </TrainingConfigOptionGroup>
              </TrainingConfigSection>

              <TrainingConfigSection
                ref={vocabularySettingRef}
                className={`voice-vocabulary-setting ${
                  showStartValidation && invalidStartRequirements.has('vocabulary') ? 'voice-start-invalid' : ''
                }`}
                aria-invalid={showStartValidation && invalidStartRequirements.has('vocabulary')}
                title={t('voice.vocabulary.title')}
                description={t('voice.vocabulary.desc')}
                value={t('voice.vocabulary.activeCount', { active: activeWords.length, total: languageVocabulary.length })}
                wide
              >
                <div className="voice-vocabulary-editor">
                  <div className="voice-vocabulary-list">
                    {languageVocabulary.length === 0 ? (
                      <p className="voice-vocabulary-empty">{t('voice.vocabulary.empty')}</p>
                    ) : languageVocabulary.map((item) => (
                      <div className={`voice-vocabulary-row ${item.isActive ? 'active' : ''}`} key={item.id}>
                        <label>
                          <input
                            type="checkbox"
                            checked={item.isActive}
                            onChange={() => updateVocabulary((items) => items.map((candidate) => (
                              candidate.id === item.id
                                ? { ...candidate, isActive: !candidate.isActive }
                                : candidate
                            )))}
                          />
                          <span>{item.word}</span>
                        </label>
                        <button
                          type="button"
                          className="btn btn-ghost btn-sm"
                          onClick={() => updateVocabulary((items) => items.filter((candidate) => candidate.id !== item.id))}
                        >
                          {t('voice.vocabulary.delete')}
                        </button>
                      </div>
                    ))}
                  </div>
                  <div className="voice-vocabulary-tools">
                    <form onSubmit={addWord}>
                      <label htmlFor="voice-new-word">{t('voice.vocabulary.add')}</label>
                      <input
                        id="voice-new-word"
                        value={newWord}
                        onChange={(event) => {
                          setNewWord(event.target.value);
                          setVocabularyWarning('');
                        }}
                        placeholder={t('voice.vocabulary.placeholder')}
                        aria-invalid={Boolean(vocabularyWarning)}
                        aria-describedby={vocabularyWarning ? 'voice-vocabulary-warning' : undefined}
                      />
                      <button className="btn btn-primary" type="submit">{t('voice.vocabulary.addButton')}</button>
                      {vocabularyWarning && (
                        <p id="voice-vocabulary-warning" className="voice-vocabulary-warning" role="alert">
                          {vocabularyWarning}
                        </p>
                      )}
                    </form>
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={() => updateVocabulary((items) => items.map((item) => (
                        item.language === language ? { ...item, isActive: true } : item
                      )))}
                    >
                      {t('voice.vocabulary.enableAll')}
                    </button>
                    <button
                      type="button"
                      className="btn btn-danger"
                      onClick={() => updateVocabulary((items) => items.filter((item) => item.language !== language))}
                    >
                      {t('voice.vocabulary.clear')}
                    </button>
                    <button
                      type="button"
                      className="btn btn-ghost"
                      onClick={() => updateVocabulary((items) => [
                        ...items.filter((item) => item.language !== language),
                        ...CreateDefaultVoiceVocabulary().filter((item) => item.language === language),
                      ])}
                    >
                      {t('voice.vocabulary.reset')}
                    </button>
                  </div>
                </div>
              </TrainingConfigSection>

              <TrainingConfigSection
                ref={microphoneSettingRef}
                className={`voice-microphone-setting voice-microphone-${microphoneStatus} ${
                  showStartValidation && invalidStartRequirements.has('microphone') ? 'voice-start-invalid' : ''
                }`}
                aria-invalid={showStartValidation && invalidStartRequirements.has('microphone')}
                title={t('voice.microphone.title')}
                description={t('voice.microphone.desc')}
                value={GetMicrophoneStatusText(microphoneStatus, t)}
                wide
              >
                <div className="voice-microphone-controls">
                  <div className="voice-volume-meter-group">
                    <div className="voice-volume-meter-label">
                      <span>{t('voice.microphone.level')}</span>
                      <strong>{Math.round(microphoneLevel * 100)}%</strong>
                    </div>
                    <div
                      className="voice-volume-meter"
                      role="progressbar"
                      aria-label={t('voice.microphone.level')}
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-valuenow={Math.round(microphoneLevel * 100)}
                    >
                      <span style={{ width: `${Math.round(microphoneLevel * 100)}%` }} />
                    </div>
                  </div>
                  <button className="btn btn-secondary" type="button" onClick={() => void testMicrophone()}>
                    {t('voice.microphone.test')}
                  </button>
                </div>
              </TrainingConfigSection>

              <TrainingConfigSection
                title={t('drawing.config.background')}
                description={backgroundSummary}
                value={backgroundModeLabel}
                wide
              >
                <div className="drawing-defense-background-controls">
                  <button
                    type="button"
                    className={`training-option ${backgroundMode === 'stars' ? 'active' : ''}`}
                    onClick={() => setBackgroundMode('stars')}
                  >
                    <span className="training-option-title">{t('drawing.config.starBackground')}</span>
                    <span className="training-option-meta">{t('drawing.config.currentTexture')}</span>
                  </button>
                  <div
                    className={`drawing-defense-background-card ${backgroundMode === 'color' ? 'active' : ''}`}
                    onClick={() => setBackgroundMode('color')}
                  >
                    <div className="drawing-defense-background-card-header">
                      <span>{t('drawing.config.backgroundColor')}</span>
                      <label
                        className="voice-background-color-picker"
                        onClick={(event) => event.stopPropagation()}
                      >
                        <input
                          type="color"
                          value={backgroundColor}
                          onChange={(event) => {
                            setBackgroundColor(event.target.value);
                            setBackgroundMode('color');
                          }}
                          aria-label={t('voice.config.backgroundColorAria')}
                        />
                        <strong>{backgroundColor.toUpperCase()}</strong>
                      </label>
                    </div>
                    <span className="training-option-meta">{t('voice.config.backgroundColorHint')}</span>
                  </div>
                  <label
                    className={`drawing-defense-background-card ${backgroundMode === 'image' ? 'active' : ''}`}
                    onClick={() => {
                      if (uploadedBackgroundUrl) setBackgroundMode('image');
                    }}
                  >
                    <div className="drawing-defense-background-card-header">
                      <span>{t('drawing.background.customImage')}</span>
                      <strong>
                        {uploadedBackgroundUrl ? t('drawing.config.uploaded') : t('drawing.config.notUploaded')}
                      </strong>
                    </div>
                    <span className="training-option-meta">{uploadedBackgroundName}</span>
                    <span className="drawing-defense-upload-action">{t('drawing.config.selectImage')}</span>
                    <input
                      type="file"
                      accept="image/*"
                      hidden
                      onChange={handleBackgroundImageUpload}
                      aria-label={t('drawing.config.uploadAria')}
                    />
                  </label>
                </div>
              </TrainingConfigSection>
          </TrainingConfigPanel>
        </div>
      )}

      {phase === 'rules' && (
        <div className="training-panel">
          <MouthTrainingRulesPanel
            gameId="voice-defender"
            title={t('voice.title')}
            summaryTitle={t('voice.title')}
            summaryItems={voiceSummaryItems}
            onStart={() => void startGame()}
            onBack={returnToEditor}
          />
        </div>
      )}

      {phase === 'results' && result && (
        <div className="experiment-container experiment-container-scrollable drawing-defense-results-container voice-defender-results-container">
          <div className="experiment-results">
            <h1>{t('voice.results.title')}</h1>
            <div className="training-result-summary">
              <span><small>{t('drawing.results.user')}</small><strong>{result.Participant_ID}</strong></span>
              <span>
                <small>{t('drawing.results.defeatedEnemies')}</small>
                <strong>{result.Enemies_Defeated}/{result.Enemies_Spawned}</strong>
              </span>
              <span><small>{t('voice.results.survival')}</small><strong>{result.Total_Duration_Seconds}s</strong></span>
              <span><small>{t('voice.results.score')}</small><strong>{result.Score}</strong></span>
            </div>
            <table className="results-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>{t('voice.results.word')}</th>
                  <th>{t('voice.results.recognized')}</th>
                  <th>{t('voice.results.similarity')}</th>
                  <th>{t('drawing.results.reactionTime')}</th>
                  <th>{t('drawing.results.defeated')}</th>
                </tr>
              </thead>
              <tbody>
                {result.Enemy_Results.map((enemyResult) => (
                  <tr key={enemyResult.Enemy_Number}>
                    <td>{enemyResult.Enemy_Number}</td>
                    <td>{enemyResult.Word}</td>
                    <td>{enemyResult.Recognized_Text || '-'}</td>
                    <td>{enemyResult.Similarity_Percent === null ? '-' : `${enemyResult.Similarity_Percent}%`}</td>
                    <td>
                      {enemyResult.Reaction_Time_Seconds === null ? '-' : `${enemyResult.Reaction_Time_Seconds}s`}
                    </td>
                    <td className={enemyResult.Defeated ? 'result-success' : 'result-fail'}>
                      {enemyResult.Defeated ? t('drawing.results.success') : t('drawing.results.notDefeated')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <TrainingResultActions
              downloadLabel={t('training.downloadCsvScores')}
              restartLabel={t('training.restart')}
              backLabel={t('training.returnHome')}
              onDownloadCsv={downloadResult}
              onRestart={() => setPhase('rules')}
              onBackHome={returnToEditor}
            />
          </div>
        </div>
      )}

      {showMicrophoneError && microphoneError && (
        <MediaDeviceErrorDialog
          title={t('voice.microphone.errorTitle')}
          titleId="voice-microphone-error-title"
          message={microphoneError}
          onClose={() => setShowMicrophoneError(false)}
        />
      )}
    </div>
  );
}

function GetVoiceCardTypography(word: string): {
  estimatedWidth: number;
  fontSize: number;
  fontWeight: '700' | '900';
} {
  const characters = [...word];
  const baseFontSize = characters.length > 10 ? 15 : characters.length > 6 ? 18 : 22;
  const fontScale = GetSetting('uiFontSizePx') / defaultUiFontSizePx;
  const fontSize = Math.round(Clamp(baseFontSize * fontScale, 12, 38));
  const estimatedWidth = Math.ceil(characters.reduce((totalWidth, character) => (
    totalWidth + fontSize * GetVoiceCardCharacterWidthFactor(character)
  ), 0));

  return {
    estimatedWidth,
    fontSize,
    fontWeight: GetSetting('uiFontBold') ? '900' : '700',
  };
}

function GetVoiceCardCharacterWidthFactor(character: string): number {
  if (/[\u0000-\u007f]/.test(character)) return 0.62;
  return 1;
}

function GetRecognitionStatusText(
  status: RecognitionStatus,
  t: TFunction,
): string {
  if (status === 'ready') return t('voice.recognition.ready');
  if (status === 'fallback') return t('voice.recognition.fallback');
  if (status === 'error') return t('voice.recognition.error');
  if (status === 'connecting') return t('voice.recognition.connecting');
  return t('voice.recognition.waiting');
}

function GetRecognitionEngineLabel(engine: RecognitionEngine, t: TFunction): string {
  return t(engine === 'azure' ? 'voice.engine.azure' : 'voice.engine.webSpeech');
}

async function FetchAzureSpeechToken(
  endpoint: string,
  timeoutMs: number,
  language: VoiceLanguage,
): Promise<AzureSpeechToken> {
  const url = new URL(endpoint, window.location.href);
  url.searchParams.set('language', language);
  const abortController = new AbortController();
  const timeoutId = window.setTimeout(() => abortController.abort(), timeoutMs);

  try {
    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: { accept: 'application/json' },
      signal: abortController.signal,
    });
    if (!response.ok) {
      const errorText = await response.text().catch(() => '');
      throw new Error(errorText || `Azure Speech token request failed (${response.status}).`);
    }

    const payload: unknown = await response.json();
    if (!payload || typeof payload !== 'object') {
      throw new Error('Azure Speech token response is invalid.');
    }
    const data = payload as Record<string, unknown>;
    const token = typeof data.token === 'string' ? data.token.trim() : '';
    const region = typeof data.region === 'string' ? data.region.trim() : '';
    const expiresInSeconds = Number(data.expiresInSeconds);
    if (!token || !region) {
      throw new Error('Azure Speech token response is missing token or region.');
    }

    return {
      token,
      region,
      expiresInSeconds: Number.isFinite(expiresInSeconds) && expiresInSeconds > 0
        ? expiresInSeconds
        : azureSpeechTokenDefaultExpiresInSeconds,
      fetchedAtMs: Date.now(),
    };
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new Error('Azure Speech token request timed out.');
    }
    throw error;
  } finally {
    window.clearTimeout(timeoutId);
  }
}

function IsAzureSpeechTokenFresh(token: AzureSpeechToken): boolean {
  const refreshAfterMs = Math.max(
    0,
    token.expiresInSeconds * 1000 - azureSpeechTokenRefreshLeadMs,
  );
  return Date.now() - token.fetchedAtMs < refreshAfterMs;
}

function StartAzureContinuousRecognition(recognizer: AzureSpeechRecognizer): Promise<void> {
  return new Promise((resolve, reject) => {
    recognizer.startContinuousRecognitionAsync(resolve, reject);
  });
}

function StopAzureContinuousRecognition(recognizer: AzureSpeechRecognizer): Promise<void> {
  return new Promise((resolve) => {
    try {
      recognizer.stopContinuousRecognitionAsync(
        () => resolve(),
        () => resolve(),
      );
    } catch {
      resolve();
    }
  });
}

export function IsLineOrFacebookInAppBrowser(userAgent: string): boolean {
  return /\bLine\/[\d.]+/i.test(userAgent)
    || /(FBAN|FBAV|FB_IAB|FBIOS|FB4A|MESSENGER)/i.test(userAgent);
}

class MicrophoneAccessError extends Error {
  readonly microphoneStatus: MicrophoneStatus;

  constructor(message: string, microphoneStatus: MicrophoneStatus) {
    super(message);
    this.name = 'MicrophoneAccessError';
    this.microphoneStatus = microphoneStatus;
    Object.setPrototypeOf(this, MicrophoneAccessError.prototype);
  }
}

class MicrophonePermissionTimeoutError extends Error {
  constructor() {
    super('Microphone permission request did not respond.');
    this.name = 'MicrophonePermissionTimeoutError';
    Object.setPrototypeOf(this, MicrophonePermissionTimeoutError.prototype);
  }
}

function RequestMicrophoneStream(constraints: MediaStreamConstraints): Promise<MediaStream> {
  const request = navigator.mediaDevices.getUserMedia(constraints);
  if (!IsLikelyIosDevice()) return request;

  let isSettled = false;
  let timeoutId = 0;
  return new Promise((resolve, reject) => {
    timeoutId = window.setTimeout(() => {
      if (isSettled) return;
      isSettled = true;
      reject(new MicrophonePermissionTimeoutError());
    }, iosMicrophonePermissionTimeoutMs);

    request.then(
      (stream) => {
        if (isSettled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        isSettled = true;
        window.clearTimeout(timeoutId);
        resolve(stream);
      },
      (error: unknown) => {
        if (isSettled) return;
        isSettled = true;
        window.clearTimeout(timeoutId);
        reject(error);
      },
    );
  });
}

function GetMicrophoneAccessError(error: unknown, t: TFunction): MicrophoneAccessError {
  if (error instanceof MicrophoneAccessError) return error;

  const isDenied = IsMicrophonePermissionDeniedError(error) || error instanceof MicrophonePermissionTimeoutError;
  if (isDenied) {
    const message = IsLikelyIosDevice()
      ? t('voice.microphone.iosSettings', { browser: GetCurrentBrowserDisplayName(t) })
      : t('voice.microphone.denied');
    return new MicrophoneAccessError(message, 'denied');
  }

  return new MicrophoneAccessError(GetErrorMessage(error) || t('voice.microphone.denied'), 'disconnected');
}

function IsLikelyIosDevice(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /iPad|iPhone|iPod/i.test(navigator.userAgent)
    || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

function GetCurrentBrowserDisplayName(t: TFunction): string {
  if (typeof navigator === 'undefined') return t('voice.microphone.browserFallback');
  const userAgent = navigator.userAgent;
  if (/\bLine\/[\d.]+/i.test(userAgent)) return 'LINE';
  if (/(FBAN|FBAV|FB_IAB|FBIOS|FB4A)/i.test(userAgent)) return 'Facebook';
  if (/MESSENGER/i.test(userAgent)) return 'Messenger';
  if (/EdgiOS/i.test(userAgent)) return 'Edge';
  if (/CriOS/i.test(userAgent)) return 'Chrome';
  if (/FxiOS/i.test(userAgent)) return 'Firefox';
  if (/OPiOS/i.test(userAgent)) return 'Opera';
  if (/DuckDuckGo/i.test(userAgent)) return 'DuckDuckGo';
  if (/Safari/i.test(userAgent)) return 'Safari';
  return t('voice.microphone.browserFallback');
}

function IsMicrophonePermissionDeniedError(error: unknown): boolean {
  const errorName = GetErrorName(error);
  const normalizedError = `${errorName} ${GetErrorMessage(error)}`.toLowerCase();
  return errorName === 'NotAllowedError'
    || errorName === 'SecurityError'
    || errorName === 'PermissionDeniedError'
    || normalizedError.includes('not-allowed')
    || normalizedError.includes('service-not-allowed')
    || normalizedError.includes('permission denied');
}

function IsMicrophonePermissionDeniedMessage(message: string): boolean {
  const normalizedMessage = message.toLowerCase();
  return normalizedMessage.includes('permission denied')
    || normalizedMessage.includes('notallowed')
    || normalizedMessage.includes('not allowed')
    || normalizedMessage.includes('microphone');
}

function GetErrorName(error: unknown): string {
  if (!error || typeof error !== 'object' || !('name' in error)) return '';
  const value = (error as { name?: unknown }).name;
  return typeof value === 'string' ? value : '';
}

function GetErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  if (!error || typeof error !== 'object' || !('message' in error)) return '';
  const value = (error as { message?: unknown }).message;
  return typeof value === 'string' ? value : '';
}

function GetMicrophoneStatusText(status: MicrophoneStatus, t: TFunction): string {
  if (status === 'testing') return t('voice.microphone.testing');
  if (status === 'ready') return t('voice.microphone.ready');
  if (status === 'silent') return t('voice.microphone.silent');
  if (status === 'muted') return t('voice.microphone.muted');
  if (status === 'disconnected') return t('voice.microphone.disconnected');
  if (status === 'denied') return t('voice.microphone.deniedStatus');
  return t('voice.microphone.pending');
}

function GetMicrophoneStartIssue(
  status: MicrophoneStatus,
  error: string,
  t: TFunction,
): string {
  if (status === 'testing') return t('voice.startBlocked.microphoneTesting');
  if (status === 'silent') return t('voice.startBlocked.microphoneSilent');
  if (status === 'muted') return t('voice.startBlocked.microphoneMuted');
  if (status === 'disconnected') return error || t('voice.startBlocked.microphoneDisconnected');
  if (status === 'denied') return error || t('voice.startBlocked.microphoneDenied');
  return t('voice.startBlocked.microphonePending');
}

function CalculateByteRms(samples: Uint8Array): number {
  let sumSquares = 0;
  for (const sample of samples) {
    const normalized = (sample - 128) / 128;
    sumSquares += normalized * normalized;
  }
  return Math.sqrt(sumSquares / samples.length);
}

function ToMeterLevel(rms: number): number {
  return Clamp(Math.sqrt(rms) * 2.2, 0, 1);
}

function ResizePixiAppToElement(app: Application, element: HTMLElement | null): void {
  const rect = element?.getBoundingClientRect();
  const width = Math.max(1, Math.round(rect?.width || window.innerWidth));
  const height = Math.max(1, Math.round(rect?.height || window.innerHeight));
  app.renderer.resize(width, height);
}

function GetWebSpeechRecognitionConstructor(): WebSpeechRecognitionConstructor | null {
  if (typeof window === 'undefined') return null;
  const browserWindow = window as Window & {
    SpeechRecognition?: WebSpeechRecognitionConstructor;
    webkitSpeechRecognition?: WebSpeechRecognitionConstructor;
  };
  return browserWindow.SpeechRecognition ?? browserWindow.webkitSpeechRecognition ?? null;
}

function GetPositiveNumber(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function GetMostDifficultWord(misses: Record<string, number>): string {
  return Object.entries(misses).sort((a, b) => b[1] - a[1])[0]?.[0] ?? '';
}

function FormatGameDuration(duration: GameDurationSeconds, t: TFunction): string {
  return duration === null ? t('drawing.config.infiniteMode') : t('training.secondsShort', { value: duration });
}

function ToCsv(record: SessionRecord): string {
  const columns = [
    'Test_Date',
    'Participant_ID',
    'Language',
    'Recognition_Engine',
    'Difficulty',
    'Game_Time_Seconds',
    'Starting_HP',
    'Enemy_Speed',
    'Total_Duration_Seconds',
    'Enemies_Spawned',
    'Enemies_Defeated',
    'HP_Remaining',
    'Score',
    'Most_Difficult_Word',
    'Game_Result',
    'Enemy_Number',
    'Word',
    'Recognized_Text',
    'Similarity_Percent',
    'Reaction_Time_Seconds',
    'Defeated',
  ];
  const outcomes = record.Enemy_Results.length > 0 ? record.Enemy_Results : [null];
  const rows = outcomes.map((outcome) => [
    record.Test_Date,
    record.Participant_ID,
    record.Language,
    record.Recognition_Engine,
    record.Difficulty,
    record.Game_Time_Seconds ?? 'Infinite',
    record.Starting_HP,
    record.Enemy_Speed,
    record.Total_Duration_Seconds,
    record.Enemies_Spawned,
    record.Enemies_Defeated,
    record.HP_Remaining,
    record.Score,
    record.Most_Difficult_Word,
    record.Game_Result,
    outcome?.Enemy_Number,
    outcome?.Word,
    outcome?.Recognized_Text,
    outcome?.Similarity_Percent,
    outcome?.Reaction_Time_Seconds,
    outcome?.Defeated,
  ]);
  return [columns, ...rows].map((row) => row.map(csvCell).join(',')).join('\n');
}

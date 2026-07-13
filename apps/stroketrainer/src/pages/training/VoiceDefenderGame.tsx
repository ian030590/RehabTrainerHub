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
import type { KaldiRecognizer, Model } from 'vosk-browser';
import { useT, type TranslationKey } from '../../i18n';
import { downloadCsvFile } from '../../utils/downloadFile';
import { DEFAULT_UI_FONT_SIZE_PX, getActiveUser, getSetting } from '../../utils/settings';
import { playFailureSound, playGameEndSound, playSuccessSound, prepareAudioFeedback } from '../../utils/soundManager';
import { saveTrainingSessionRecord } from '../../utils/trainingRecords';
import { clamp, csvCell, formatTestDate, writeJsPsychData } from './gameUtils';
import { verifySelectedTrainingUser } from './selectedUserGuard';
import { StartTrainingButton } from '@rehab-trainer/ui/components/StartTrainingButton';
import { TrainingConfigSummary } from '@rehab-trainer/ui/components/TrainingConfigSummary';
import { TrainingResultActions } from '@rehab-trainer/ui/components/TrainingResultActions';
import { AppDialog } from '../../components/AppDialog';
import { InlineAlert } from '../../components/InlineAlert';
import { MediaDeviceErrorDialog } from '../../components/MediaDeviceErrorDialog';
import type { TFunction } from './types';
import {
  createDefaultVoiceVocabulary,
  createVoiceVocabularyItems,
  loadVoiceVocabulary,
  saveVoiceVocabulary,
  splitVoiceVocabularyInput,
  type VoiceLanguage,
  type VoiceVocabularyItem,
} from './voiceDefenderVocabulary';
import {
  buildVoskGrammar,
  calculateBestSpeechSimilarity,
  normalizeSpeechText,
  VOICE_MATCH_SIMILARITY_THRESHOLD,
} from './voiceDefenderSpeechMatching';
import {
  deleteCachedModel,
  getCachedModelUrl,
  startVoskModelBackgroundDownload,
  type CachedModelUrl,
  type VoskModelLoadStage,
} from './voskModelCache';
import {
  hasVoskVocabularyWord,
  loadVoskVocabularyIndex,
  type VoskVocabularyIndex,
} from './voskVocabularyIndex';

declare const __BUNDLED_ZH_VOSK_MODEL_ENABLED__: boolean;

export { calculateSimilarity, levenshteinDistance } from './voiceDefenderSpeechMatching';

type Difficulty = 'Beginner' | 'Intermediate' | 'Advanced';
type GamePhase = 'editor' | 'playing' | 'paused' | 'results';
type ModelStatus = 'idle' | 'loading' | 'ready' | 'fallback' | 'error';
type ModelLoadStage = VoskModelLoadStage | 'initializing';
type GameResult = 'Victory' | 'Defeat' | 'Stopped';
type MicrophoneStatus = 'pending' | 'testing' | 'ready' | 'silent' | 'muted' | 'disconnected' | 'denied';
type RecognitionEngine = 'vosk' | 'web-speech';
type BackgroundMode = 'stars' | 'color' | 'image';
type GameDurationSeconds = number | null;
type StartRequirement = 'recognition' | 'vocabulary' | 'microphone';

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

interface VoskSpeechRuntime {
  kind: 'vosk';
  stream: MediaStream;
  audioContext: AudioContext;
  source: MediaStreamAudioSourceNode;
  processor: ScriptProcessorNode;
  mute: GainNode;
  recognizer: KaldiRecognizer;
  removeTrackListeners: () => void;
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

type SpeechRuntime = VoskSpeechRuntime | WebSpeechRuntime;

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

const DEFAULT_MODEL_URLS: Record<VoiceLanguage, string> = {
  zh: __BUNDLED_ZH_VOSK_MODEL_ENABLED__
    ? `${import.meta.env.BASE_URL}models/vosk-model-small-zh-tw-0.3.tar.gz`
    : '',
  en: 'https://ccoreilly.github.io/vosk-browser/models/vosk-model-small-en-us-0.15.tar.gz',
};

const DEFAULT_MODEL_BYTES: Record<VoiceLanguage, number> = {
  zh: 33_368_542,
  en: 41_184_862,
};

const MODEL_URLS: Record<VoiceLanguage, string> = {
  zh: import.meta.env.VITE_VOSK_MODEL_ZH_URL?.trim()
    || DEFAULT_MODEL_URLS.zh,
  en: import.meta.env.VITE_VOSK_MODEL_EN_URL?.trim()
    || DEFAULT_MODEL_URLS.en,
};

const MODEL_VOCABULARY_URLS: Record<VoiceLanguage, string> = {
  zh: import.meta.env.VITE_VOSK_MODEL_ZH_VOCAB_URL?.trim()
    || (MODEL_URLS.zh === DEFAULT_MODEL_URLS.zh
      ? `${import.meta.env.BASE_URL}models/vosk-model-small-zh-tw-0.3-vocabulary.txt`
      : ''),
  en: import.meta.env.VITE_VOSK_MODEL_EN_VOCAB_URL?.trim()
    || (MODEL_URLS.en === DEFAULT_MODEL_URLS.en
      ? `${import.meta.env.BASE_URL}models/vosk-model-small-en-us-0.15-vocabulary.txt`
      : ''),
};

const DIFFICULTIES: Record<Difficulty, DifficultyConfig> = {
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

const HP_OPTIONS = [1, 3, 5] as const;
const GAME_DURATION_OPTIONS = [30, 60, 300, null] as const;
const ENEMY_SPEED_OPTIONS = [5, 15, 30] as const;
const DEFAULT_HP = 3;
const DEFAULT_ENEMY_SPEED = 5;
const DEFAULT_GAME_DURATION_SECONDS: GameDurationSeconds = 30;
const DEFAULT_CUSTOM_GAME_DURATION_SECONDS = 120;
const ENEMY_VISUAL_HEIGHT = 98;
const ENEMY_SPAWN_Y = -ENEMY_VISUAL_HEIGHT - 8;
const DEFAULT_BACKGROUND_COLOR = '#005EB8';
const MICROPHONE_SIGNAL_THRESHOLD = 0.006;
const MICROPHONE_SILENCE_DELAY_MS = 1600;
const IOS_MICROPHONE_PERMISSION_TIMEOUT_MS = 15_000;
const MICROPHONE_MEDIA_CONSTRAINTS: MediaStreamConstraints = {
  video: false,
  audio: {
    echoCancellation: true,
    noiseSuppression: true,
    channelCount: 1,
  },
};
const starSkyBackgroundImage = `url(${import.meta.env.BASE_URL}assets/StarSky.png)`;
const VOSK_MODEL_DOWNLOAD_TIMEOUT_MS = getPositiveNumber(
  import.meta.env.VITE_VOSK_MODEL_TIMEOUT_MS,
  90_000,
);
const VOSK_MODEL_RETRY_DELAY_MS = getPositiveNumber(
  import.meta.env.VITE_VOSK_MODEL_RETRY_MS,
  10_000,
);
const VOSK_MODEL_MIN_BYTES = getPositiveNumber(
  import.meta.env.VITE_VOSK_MODEL_MIN_BYTES,
  1_048_576,
);

export function VoiceDefenderGame({ onExit }: VoiceDefenderGameProps) {
  const { t } = useT();
  const pixiHostRef = useRef<HTMLDivElement | null>(null);
  const appRef = useRef<Application | null>(null);
  const modelRef = useRef<Model | null>(null);
  const cachedModelUrlRef = useRef<CachedModelUrl | null>(null);
  const speechRuntimeRef = useRef<SpeechRuntime | null>(null);
  const recognitionEngineRef = useRef<RecognitionEngine | null>(null);
  const backgroundDownloadUnsubscribeRef = useRef<(() => void) | null>(null);
  const uploadedBackgroundUrlRef = useRef<string | null>(null);
  const modelVocabularyIndexesRef = useRef<Partial<Record<VoiceLanguage, VoskVocabularyIndex>>>({});
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
    hp: DEFAULT_HP,
    score: 0,
    spawned: 0,
    defeated: 0,
    spawnTimer: 0,
    nextId: 1,
  });
  const configRef = useRef({
    language: 'zh' as VoiceLanguage,
    difficulty: 'Beginner' as Difficulty,
    gameDurationSec: DEFAULT_GAME_DURATION_SECONDS,
    maxHp: DEFAULT_HP,
    speed: DEFAULT_ENEMY_SPEED,
    activeWords: [] as string[],
  });
  const jsPsychRef = useRef<ReturnType<typeof initJsPsych> | null>(null);

  const [phase, setPhaseState] = useState<GamePhase>('editor');
  const [language, setLanguage] = useState<VoiceLanguage>('zh');
  const [difficulty, setDifficulty] = useState<Difficulty>('Beginner');
  const [gameDurationSec, setGameDurationSec] = useState<GameDurationSeconds>(DEFAULT_GAME_DURATION_SECONDS);
  const [customGameDurationSec, setCustomGameDurationSec] = useState(DEFAULT_CUSTOM_GAME_DURATION_SECONDS);
  const [maxHp, setMaxHp] = useState(DEFAULT_HP);
  const [customHp, setCustomHp] = useState(DEFAULT_HP);
  const [speed, setSpeed] = useState(DEFAULT_ENEMY_SPEED);
  const [customSpeed, setCustomSpeed] = useState(DEFAULT_ENEMY_SPEED);
  const [backgroundMode, setBackgroundMode] = useState<BackgroundMode>('stars');
  const [backgroundColor, setBackgroundColor] = useState(DEFAULT_BACKGROUND_COLOR);
  const [uploadedBackgroundUrl, setUploadedBackgroundUrl] = useState<string | null>(null);
  const [uploadedBackgroundName, setUploadedBackgroundName] = useState(() => t('drawing.upload.noImage'));
  const [vocabulary, setVocabulary] = useState<VoiceVocabularyItem[]>(loadVoiceVocabulary);
  const [newWord, setNewWord] = useState('');
  const [vocabularyWarning, setVocabularyWarning] = useState('');
  const [vocabularyIndexStatus, setVocabularyIndexStatus] = useState<
    Partial<Record<VoiceLanguage, 'loading' | 'ready' | 'error'>>
  >({});
  const [modelStatus, setModelStatus] = useState<ModelStatus>('idle');
  const [modelLoadStage, setModelLoadStage] = useState<ModelLoadStage>('checking-cache');
  const [modelProgress, setModelProgress] = useState(0);
  const [modelError, setModelError] = useState('');
  const [recognitionEngine, setRecognitionEngine] = useState<RecognitionEngine | null>(null);
  const [backgroundReadyLanguage, setBackgroundReadyLanguage] = useState<VoiceLanguage | null>(null);
  const [showInAppBrowserNotice, setShowInAppBrowserNotice] = useState(
    () => typeof navigator !== 'undefined' && isLineOrFacebookInAppBrowser(navigator.userAgent),
  );
  const [microphoneStatus, setMicrophoneStatus] = useState<MicrophoneStatus>('pending');
  const [microphoneLevel, setMicrophoneLevel] = useState(0);
  const [microphoneError, setMicrophoneError] = useState('');
  const [showMicrophoneError, setShowMicrophoneError] = useState(false);
  const [hp, setHp] = useState(DEFAULT_HP);
  const [defeated, setDefeated] = useState(0);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [recognizedText, setRecognizedText] = useState('');
  const [result, setResult] = useState<SessionRecord | null>(null);
  const [showStartValidation, setShowStartValidation] = useState(false);

  const activeConfig = DIFFICULTIES[difficulty];
  const languageVocabulary = useMemo(
    () => vocabulary.filter((item) => item.language === language),
    [language, vocabulary],
  );
  const activeWords = useMemo(
    () => languageVocabulary.filter((item) => item.isActive).map((item) => item.word),
    [languageVocabulary],
  );
  const microphoneReady = microphoneStatus === 'ready';
  const recognitionReady = modelStatus === 'ready' || modelStatus === 'fallback';
  const startIssues = useMemo<StartIssue[]>(() => {
    const issues: StartIssue[] = [];
    if (!recognitionReady) {
      issues.push({
        requirement: 'recognition',
        message: modelStatus === 'loading'
          ? t('voice.startBlocked.modelLoading')
          : modelError || t('voice.startBlocked.modelUnavailable'),
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
        message: getMicrophoneStartIssue(microphoneStatus, microphoneError, t),
      });
    }
    return issues;
  }, [
    activeWords.length,
    microphoneError,
    microphoneReady,
    microphoneStatus,
    modelError,
    modelStatus,
    recognitionReady,
    t,
  ]);
  const invalidStartRequirements = useMemo(
    () => new Set(startIssues.map((issue) => issue.requirement)),
    [startIssues],
  );
  const isPresetGameDuration = GAME_DURATION_OPTIONS.includes(gameDurationSec as typeof GAME_DURATION_OPTIONS[number]);
  const isCustomHp = !HP_OPTIONS.includes(maxHp as typeof HP_OPTIONS[number]);
  const isCustomSpeed = !ENEMY_SPEED_OPTIONS.includes(speed as typeof ENEMY_SPEED_OPTIONS[number]);
  const gameDurationLabel = formatGameDuration(gameDurationSec, t);
  const backgroundSummary =
    backgroundMode === 'stars'
      ? t('drawing.background.stars')
      : backgroundMode === 'color'
        ? backgroundColor
        : t('drawing.background.customImage');
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
  const modelStatusText = getModelStatusText(modelStatus, modelLoadStage, modelProgress, t);

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
    if (modelStatus === 'error') setShowStartValidation(true);
  }, [modelStatus]);

  useEffect(() => {
    configRef.current = { language, difficulty, gameDurationSec, maxHp, speed, activeWords };
  }, [activeWords, difficulty, gameDurationSec, language, maxHp, speed]);

  useEffect(() => {
    saveVoiceVocabulary(vocabulary);
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
    if (runtime?.kind === 'vosk') {
      runtime.processor.onaudioprocess = null;
      runtime.removeTrackListeners();
      runtime.source.disconnect();
      runtime.processor.disconnect();
      runtime.mute.disconnect();
      runtime.stream.getTracks().forEach((track) => track.stop());
      runtime.recognizer.remove();
      if (runtime.audioContext.state !== 'closed') {
        await runtime.audioContext.close().catch(() => undefined);
      }
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

  const loadModel = useCallback(async (targetLanguage: VoiceLanguage) => {
    const generation = loadGenerationRef.current + 1;
    loadGenerationRef.current = generation;
    backgroundDownloadUnsubscribeRef.current?.();
    backgroundDownloadUnsubscribeRef.current = null;
    modelRef.current?.terminate();
    modelRef.current = null;
    cachedModelUrlRef.current?.revoke();
    cachedModelUrlRef.current = null;
    recognitionEngineRef.current = null;
    setRecognitionEngine(null);
    setModelStatus('loading');
    setModelLoadStage('checking-cache');
    setModelProgress(0);
    setModelError('');
    setBackgroundReadyLanguage(null);
    setVocabularyWarning('');
    const vocabularyUrl = MODEL_VOCABULARY_URLS[targetLanguage];
    if (vocabularyUrl && !modelVocabularyIndexesRef.current[targetLanguage]) {
      setVocabularyIndexStatus((current) => ({ ...current, [targetLanguage]: 'loading' }));
      void loadVoskVocabularyIndex(vocabularyUrl)
        .then((index) => {
          modelVocabularyIndexesRef.current[targetLanguage] = index;
          setVocabularyIndexStatus((current) => ({ ...current, [targetLanguage]: 'ready' }));
        })
        .catch((error) => {
          console.warn('Unable to load Vosk vocabulary index.', error);
          setVocabularyIndexStatus((current) => ({ ...current, [targetLanguage]: 'error' }));
        });
    }
    const cacheKey = targetLanguage === 'zh'
      ? 'voice-defender-zh-tw-v2'
      : `voice-defender-${targetLanguage}`;
    const modelUrl = MODEL_URLS[targetLanguage];
    if (!modelUrl) {
      if (getWebSpeechRecognitionConstructor()) {
        recognitionEngineRef.current = 'web-speech';
        setRecognitionEngine('web-speech');
        setModelProgress(100);
        setModelStatus('fallback');
        setModelError(`${t('voice.model.externalModelRequired')} ${t('voice.model.fallbackHint')}`);
      } else {
        setModelStatus('error');
        setModelError(`${t('voice.model.externalModelRequired')} ${t('voice.model.webSpeechUnavailable')}`);
      }
      return;
    }
    const expectedModelBytes = MODEL_URLS[targetLanguage] === DEFAULT_MODEL_URLS[targetLanguage]
      ? DEFAULT_MODEL_BYTES[targetLanguage]
      : 0;
    let cachedUrl: CachedModelUrl | null = null;
    const subscribeToBackgroundDownload = () => startVoskModelBackgroundDownload(
      cacheKey,
      MODEL_URLS[targetLanguage],
      (snapshot) => {
        if (loadGenerationRef.current !== generation) return;
        setModelLoadStage(snapshot.stage);
        setModelProgress(snapshot.progress);
        if (snapshot.status === 'ready') {
          setModelError(t('voice.model.backgroundReady'));
          setBackgroundReadyLanguage(targetLanguage);
        } else if (snapshot.status === 'retrying') {
          setModelError(t('voice.model.backgroundRetry', {
            attempt: snapshot.attempt,
            error: snapshot.error,
          }));
        }
      },
      VOSK_MODEL_DOWNLOAD_TIMEOUT_MS,
      VOSK_MODEL_RETRY_DELAY_MS,
      VOSK_MODEL_MIN_BYTES,
      expectedModelBytes,
    );
    backgroundDownloadUnsubscribeRef.current = subscribeToBackgroundDownload();

    try {
      cachedUrl = await getCachedModelUrl(
        cacheKey,
        MODEL_URLS[targetLanguage],
        (progress) => {
          if (loadGenerationRef.current === generation) {
            setModelProgress(progress);
          }
        },
        (stage) => {
          if (loadGenerationRef.current === generation) {
            setModelLoadStage(stage);
          }
        },
        VOSK_MODEL_DOWNLOAD_TIMEOUT_MS,
        VOSK_MODEL_MIN_BYTES,
        expectedModelBytes,
      );
      if (loadGenerationRef.current !== generation) {
        cachedUrl.revoke();
        return;
      }
      cachedModelUrlRef.current = cachedUrl;
      setModelLoadStage('initializing');
      const { createModel } = await import('vosk-browser');
      const model = await createModel(cachedUrl.url, -1);
      if (loadGenerationRef.current !== generation) {
        model.terminate();
        cachedUrl.revoke();
        if (cachedModelUrlRef.current === cachedUrl) {
          cachedModelUrlRef.current = null;
        }
        return;
      }
      modelRef.current = model;
      setBackgroundReadyLanguage(null);
      recognitionEngineRef.current = 'vosk';
      setRecognitionEngine('vosk');
      setModelProgress(100);
      setModelStatus('ready');
    } catch (error) {
      if (loadGenerationRef.current !== generation) return;
      console.warn('Unable to load Vosk model; attempting Web Speech API fallback.', error);
      const errorMessage = error instanceof Error ? error.message : t('voice.model.error');
      if (cachedUrl) {
        if (cachedModelUrlRef.current === cachedUrl) {
          cachedModelUrlRef.current = null;
        }
        cachedUrl.revoke();
        await deleteCachedModel(cacheKey);
        setBackgroundReadyLanguage(null);
        backgroundDownloadUnsubscribeRef.current?.();
        backgroundDownloadUnsubscribeRef.current = subscribeToBackgroundDownload();
      }
      if (getWebSpeechRecognitionConstructor()) {
        recognitionEngineRef.current = 'web-speech';
        setRecognitionEngine('web-speech');
        setModelProgress(100);
        setModelStatus('fallback');
        setModelError(`${errorMessage} ${t('voice.model.fallbackHint')}`);
      } else {
        setModelStatus('error');
        setModelError(`${errorMessage} ${t('voice.model.webSpeechUnavailable')}`);
      }
    }
  }, [t]);

  useEffect(() => {
    void stopListening(false);
    void stopMicrophoneTest(false);
    setMicrophoneStatus('pending');
    setMicrophoneLevel(0);
    setMicrophoneError('');
    void loadModel(language);
  }, [language, loadModel, stopListening, stopMicrophoneTest]);

  useEffect(() => {
    if (
      backgroundReadyLanguage !== language
      || (phase !== 'editor' && phase !== 'results')
      || (modelStatus !== 'fallback' && modelStatus !== 'error')
    ) {
      return;
    }
    setBackgroundReadyLanguage(null);
    void loadModel(language);
  }, [backgroundReadyLanguage, language, loadModel, modelStatus, phase]);

  useEffect(() => () => {
    loadGenerationRef.current += 1;
    backgroundDownloadUnsubscribeRef.current?.();
    backgroundDownloadUnsubscribeRef.current = null;
    void stopListening(false);
    void stopMicrophoneTest(false);
    modelRef.current?.terminate();
    cachedModelUrlRef.current?.revoke();
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
      const stream = await requestMicrophoneStream(MICROPHONE_MEDIA_CONSTRAINTS);
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
        const rms = calculateByteRms(samples);
        if (now - lastRenderAt >= 70) {
          setMicrophoneLevel(toMeterLevel(rms));
          lastRenderAt = now;
        }

        if (track.readyState !== 'live') {
          setMicrophoneStatus('disconnected');
          setMicrophoneError(t('voice.startBlocked.microphoneDisconnected'));
        } else if (!track.enabled || track.muted) {
          setMicrophoneStatus('muted');
          setMicrophoneError(t('voice.startBlocked.microphoneMuted'));
        } else if (rms >= MICROPHONE_SIGNAL_THRESHOLD) {
          lastSignalAt = now;
          setMicrophoneStatus('ready');
          setMicrophoneError('');
        } else if (
          now - startedAt >= MICROPHONE_SILENCE_DELAY_MS
          && (lastSignalAt === 0 || now - lastSignalAt >= MICROPHONE_SILENCE_DELAY_MS)
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
      const accessError = getMicrophoneAccessError(error, t);
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
    playGameEndSound(gameResult, jsPsychRef);
    void stopListening();
    enemiesRef.current.forEach((enemy) => recordEnemyOutcome(enemy, false));
    clearEnemies();
    const metrics = metricsRef.current;
    const troubleWord = getMostDifficultWord(wordMissesRef.current);
    const record: SessionRecord = {
      Test_Date: formatTestDate(new Date()),
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
    setDefeated(metrics.defeated);
    setPhase('results');
    void saveTrainingSessionRecord({
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
    writeJsPsychData(
      jsPsychRef,
      record as unknown as Record<string, unknown>,
      'Unable to write voice defender result to jsPsych data.',
    );
  }, [clearEnemies, recordEnemyOutcome, setPhase, stopListening, t]);

  const handleRecognition = useCallback((transcripts: string[]) => {
    if (phaseRef.current !== 'playing') return;
    const usableTranscripts = transcripts
      .map((transcript) => transcript.trim())
      .filter((transcript) => normalizeSpeechText(transcript));
    if (usableTranscripts.length === 0) return;
    setRecognizedText(usableTranscripts[0]);

    const now = performance.now();
    const recognitionKey = usableTranscripts.map(normalizeSpeechText).join('|');
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
        similarity: calculateBestSpeechSimilarity(transcript, enemy.word),
      })))
      .filter((candidate) => candidate.similarity >= VOICE_MATCH_SIMILARITY_THRESHOLD)
      .sort((a, b) => b.enemy.y - a.enemy.y || b.similarity - a.similarity)[0];

    if (!matched) return;
    lastRecognitionRef.current = { text: recognitionKey, at: now };
    playSuccessSound(jsPsychRef);
    recordEnemyOutcome(matched.enemy, true, matched.transcript, matched.similarity);
    matched.enemy.node.destroy({ children: true });
    enemiesRef.current = enemiesRef.current.filter((enemy) => enemy.id !== matched.enemy.id);
    metricsRef.current.defeated += 1;
    metricsRef.current.score += Math.max(10, Math.round(100 * matched.similarity));
    setDefeated(metricsRef.current.defeated);
  }, [recordEnemyOutcome]);

  const startListening = useCallback(async () => {
    await stopMicrophoneTest(false);
    await stopListening(false);
    setMicrophoneLevel(0);
    setMicrophoneStatus('testing');

    const engine = recognitionEngineRef.current;
    if (engine === 'web-speech') {
      const SpeechRecognitionConstructor = getWebSpeechRecognitionConstructor();
      if (!SpeechRecognitionConstructor) {
        throw new Error(t('voice.model.webSpeechUnavailable'));
      }

      const recognition = new SpeechRecognitionConstructor();
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
          const accessError = getMicrophoneAccessError(event.error, t);
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

    const model = modelRef.current;
    if (!model || engine !== 'vosk') throw new Error(t('voice.model.notReady'));
    if (!navigator.mediaDevices?.getUserMedia) {
      throw new MicrophoneAccessError(t('voice.microphone.denied'), 'denied');
    }
    const stream = await requestMicrophoneStream(MICROPHONE_MEDIA_CONSTRAINTS);
    const track = stream.getAudioTracks()[0];
    if (!track || track.readyState !== 'live') {
      stream.getTracks().forEach((streamTrack) => streamTrack.stop());
      throw new MicrophoneAccessError(t('voice.microphone.denied'), 'denied');
    }
    const audioContext = new AudioContext();
    await audioContext.resume();
    const grammar = buildVoskGrammar(
      configRef.current.activeWords,
      configRef.current.language,
    );
    const recognizer = new model.KaldiRecognizer(audioContext.sampleRate, grammar);
    recognizer.on('partialresult', (message) => {
      if ('result' in message && 'partial' in message.result) {
        handleRecognition([message.result.partial]);
      }
    });
    recognizer.on('result', (message) => {
      if ('result' in message && 'text' in message.result) {
        handleRecognition([message.result.text]);
      }
    });
    recognizer.on('error', (message) => {
      if (!('error' in message)) return;
      console.error('Vosk recognizer error.', message.error);
      setMicrophoneError(message.error);
    });

    const source = audioContext.createMediaStreamSource(stream);
    const processor = audioContext.createScriptProcessor(4096, 1, 1);
    const mute = audioContext.createGain();
    const removeTrackListeners = addMicrophoneTrackListeners(track);
    const startedAt = performance.now();
    let lastSignalAt = 0;
    mute.gain.value = 0;
    processor.onaudioprocess = (event) => {
      try {
        const samples = event.inputBuffer.getChannelData(0);
        const rms = calculateFloatRms(samples);
        const now = performance.now();
        setMicrophoneLevel(toMeterLevel(rms));
        if (track.readyState !== 'live') {
          setMicrophoneStatus('disconnected');
          setMicrophoneError(t('voice.startBlocked.microphoneDisconnected'));
        } else if (!track.enabled || track.muted) {
          setMicrophoneStatus('muted');
          setMicrophoneError(t('voice.startBlocked.microphoneMuted'));
        } else if (rms >= MICROPHONE_SIGNAL_THRESHOLD) {
          lastSignalAt = now;
          setMicrophoneStatus('ready');
          setMicrophoneError('');
        } else if (
          now - startedAt >= MICROPHONE_SILENCE_DELAY_MS
          && (lastSignalAt === 0 || now - lastSignalAt >= MICROPHONE_SILENCE_DELAY_MS)
        ) {
          setMicrophoneStatus('silent');
          setMicrophoneError(t('voice.startBlocked.microphoneSilent'));
        }
        recognizer.acceptWaveform(event.inputBuffer);
      } catch (error) {
        console.warn('Unable to process microphone audio.', error);
        processor.onaudioprocess = null;
        setMicrophoneStatus('disconnected');
        setMicrophoneError(getErrorMessage(error) || t('voice.startBlocked.microphoneDisconnected'));
      }
    };
    source.connect(processor);
    processor.connect(mute);
    mute.connect(audioContext.destination);
    speechRuntimeRef.current = {
      kind: 'vosk',
      stream,
      audioContext,
      source,
      processor,
      mute,
      recognizer,
      removeTrackListeners,
    };
  }, [addMicrophoneTrackListeners, handleRecognition, stopListening, stopMicrophoneTest, t]);

  const spawnEnemy = useCallback((app: Application) => {
    const words = configRef.current.activeWords;
    if (words.length === 0) return;
    const word = words[Math.floor(Math.random() * words.length)];
    const enemyNumber = metricsRef.current.spawned + 1;
    const resultIndex = enemyResultsRef.current.length;
    const cardTypography = getVoiceCardTypography(word);
    const boardWidth = clamp(cardTypography.estimatedWidth + 32, 88, Math.min(280, app.renderer.width - 24));
    const boardHeight = clamp(cardTypography.fontSize + 28, 50, 74);
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
        fontFamily: 'Inter, M PLUS Rounded 1c, Noto Sans TC, Arial, sans-serif',
        fontSize: cardTypography.fontSize,
        fontWeight: cardTypography.fontWeight,
        align: 'center',
      },
    });
    label.anchor.set(0.5);
    label.y = boardY + boardHeight / 2;
    node.addChild(monster, board, label);
    node.x = x;
    node.y = ENEMY_SPAWN_Y;
    app.stage.addChild(node);

    const enemy: Enemy = {
      id: metricsRef.current.nextId++,
      word,
      x,
      y: ENEMY_SPAWN_Y,
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
    if (!verifySelectedTrainingUser()) return;
    prepareAudioFeedback(jsPsychRef);
    if (!recognitionReady || activeWords.length === 0) return;
    if (phaseRef.current === 'editor' && !microphoneReady) return;
    const app = appRef.current;
    if (!app) return;

    setMicrophoneError('');
    configRef.current = { language, difficulty, gameDurationSec, maxHp, speed, activeWords };
    try {
      await startListening();
    } catch (error) {
      console.error('Unable to start voice recognition.', error);
      const accessError = getMicrophoneAccessError(error, t);
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
    setHp(maxHp);
    setDefeated(0);
    setElapsedSeconds(0);
    setRecognizedText('');
    setResult(null);
    setPhase('playing');
    setShowStartValidation(false);
  }, [
    activeWords,
    clearEnemies,
    difficulty,
    drawStage,
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

  const handleStartGame = useCallback(async () => {
    setShowStartValidation(true);
    if (startIssues.length > 0) {
      window.requestAnimationFrame(() => scrollToStartRequirement(startIssues[0].requirement));
      return;
    }
    setShowStartValidation(false);
    await startGame();
  }, [scrollToStartRequirement, startGame, startIssues]);

  const restartGame = useCallback(() => {
    void startGame();
  }, [startGame]);

  const returnToEditor = useCallback(() => {
    void stopListening();
    clearEnemies();
    const app = appRef.current;
    if (app) drawStage(app);
    setPhase('editor');
  }, [clearEnemies, drawStage, setPhase, stopListening]);

  const pauseGame = useCallback(() => {
    if (phaseRef.current !== 'playing') return;
    setPhase('paused');
    void stopListening();
  }, [setPhase, stopListening]);

  const resumeGame = useCallback(async () => {
    if (phaseRef.current !== 'paused') return;
    try {
      await startListening();
      setPhase('playing');
    } catch (error) {
      console.error('Unable to resume voice recognition.', error);
      const accessError = getMicrophoneAccessError(error, t);
      setMicrophoneError(accessError.message);
      setMicrophoneStatus(accessError.microphoneStatus);
      returnToEditor();
    }
  }, [returnToEditor, setPhase, startListening, t]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      if (phaseRef.current === 'playing') pauseGame();
      else if (phaseRef.current === 'paused') void resumeGame();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [pauseGame, resumeGame]);

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
        const config = DIFFICULTIES[configRef.current.difficulty];
        const targetGameDurationSec = configRef.current.gameDurationSec;
        const isTimeUnlimited = targetGameDurationSec === null;
        metrics.elapsed += dt;
        const nextElapsed = Math.floor(metrics.elapsed);
        setElapsedSeconds((current) => current === nextElapsed ? current : nextElapsed);

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

        const defenseY = app.renderer.height - ENEMY_VISUAL_HEIGHT;
        for (const enemy of [...enemiesRef.current]) {
          enemy.y += configRef.current.speed * dt;
          enemy.node.y = enemy.y;
          if (enemy.y <= defenseY) continue;
          playFailureSound(jsPsychRef);
          recordEnemyOutcome(enemy, false);
          enemy.node.destroy({ children: true });
          enemiesRef.current = enemiesRef.current.filter((item) => item.id !== enemy.id);
          wordMissesRef.current[enemy.word] = (wordMissesRef.current[enemy.word] ?? 0) + 1;
          metrics.hp = Math.max(0, metrics.hp - 1);
          setHp(metrics.hp);
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
      app.destroy(true, { children: true });
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
    const entries = splitVoiceVocabularyInput(word, language);
    const newEntries = entries.filter((entry) => (
      !vocabulary.some((item) => (
        item.language === language
        && normalizeSpeechText(item.word) === normalizeSpeechText(entry)
      ))
    ));
    if (newEntries.length === 0) {
      setNewWord('');
      return;
    }
    const vocabularyIndex = modelVocabularyIndexesRef.current[language];
    if (!vocabularyIndex) {
      setVocabularyWarning(t(
        vocabularyIndexStatus[language] === 'loading'
          ? 'voice.vocabulary.modelChecking'
          : 'voice.vocabulary.modelIndexUnavailable',
      ));
      return;
    }
    const unsupportedEntry = newEntries.find((entry) => (
      !hasVoskVocabularyWord(vocabularyIndex, entry, language)
    ));
    if (unsupportedEntry) {
      setVocabularyWarning(t('voice.vocabulary.unsupportedWord', { word: unsupportedEntry }));
      return;
    }
    updateVocabulary((items) => [
      ...items,
      ...newEntries.flatMap((entry) => createVoiceVocabularyItems(entry, language)),
    ]);
    setNewWord('');
  }, [language, newWord, t, updateVocabulary, vocabulary, vocabularyIndexStatus]);

  const downloadResult = useCallback(() => {
    if (!result) return;
    downloadCsvFile(toCsv(result), `voice_defender_${Date.now()}.csv`);
  }, [result]);

  const timeProgressText = useMemo(() => {
    if (gameDurationSec === null) return `${elapsedSeconds}s / ${t('training.infinite')}`;
    return `${Math.min(elapsedSeconds, gameDurationSec)}/${gameDurationSec}s`;
  }, [elapsedSeconds, gameDurationSec, t]);

  return (
    <div
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
          <div className="training-config">
            <header className="training-config-header">
              <div>
                <span className="training-config-label">{t('voice.configLabel')}</span>
                <h1>{t('voice.title')}</h1>
              </div>
              {modelStatus !== 'error' && (
                <div className={`voice-model-status voice-model-status-${modelStatus}`} aria-live="polite">
                  <span>{modelStatusText}</span>
                  <progress max="100" value={modelProgress} aria-label={modelStatusText} />
                </div>
              )}
            </header>

            <div className="training-config-body">
              <section className="training-setting">
                <div className="training-setting-header">
                  <div>
                    <h2>{t('cognitive.config.difficulty')}</h2>
                    <p>{t(activeConfig.descriptionKey)}</p>
                  </div>
                  <span>{t(activeConfig.labelKey)}</span>
                </div>
                <div className="training-option-grid training-option-grid-three">
                  {Object.entries(DIFFICULTIES).map(([key, value]) => (
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
                </div>
              </section>

              <section className="training-setting">
                <div className="training-setting-header">
                  <div>
                    <h2>{t('voice.config.hp')}</h2>
                    <p>{t('voice.config.hpDesc')}</p>
                  </div>
                  <span>{maxHp}</span>
                </div>
                <div className="training-option-grid training-option-grid-four">
                  {HP_OPTIONS.map((option) => (
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
                        const value = clamp(Number(event.target.value), 1, 20);
                        setCustomHp(value);
                        setMaxHp(value);
                      }}
                      onFocus={() => setMaxHp(customHp)}
                      aria-label={t('drawing.config.customHp')}
                    />
                  </label>
                </div>
              </section>

              <section className="training-setting training-setting-wide">
                <div className="training-setting-header">
                  <div>
                    <h2>{t('drawing.config.gameDuration')}</h2>
                    <p>{gameDurationLabel}</p>
                  </div>
                  <span>
                    {gameDurationSec === DEFAULT_GAME_DURATION_SECONDS
                      ? t('training.default')
                      : isPresetGameDuration
                        ? t('training.optional')
                        : t('training.custom')}
                  </span>
                </div>
                <div className="training-option-grid training-duration-grid">
                  {GAME_DURATION_OPTIONS.filter((option) => option !== null).map((option) => (
                    <button
                      key={option}
                      type="button"
                      className={`training-option ${gameDurationSec === option ? 'active' : ''}`}
                      onClick={() => setGameDurationSec(option)}
                    >
                      <span className="training-option-title">{formatGameDuration(option, t)}</span>
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
                        const value = clamp(Number(event.target.value), 1, 1800);
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
                </div>
              </section>

              <section className="training-setting">
                <div className="training-setting-header">
                  <div>
                    <h2>{t('voice.config.enemySpeed')}</h2>
                    <p>{t('voice.config.speedValue', { value: speed })}</p>
                  </div>
                  <span>{isCustomSpeed ? t('training.custom') : t('training.default')}</span>
                </div>
                <div className="training-option-grid training-speed-grid">
                  {ENEMY_SPEED_OPTIONS.map((option) => (
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
                        const value = clamp(Number(event.target.value), 1, 170);
                        setCustomSpeed(value);
                        setSpeed(value);
                      }}
                      onFocus={() => setSpeed(customSpeed)}
                      aria-label={t('voice.config.customEnemySpeed')}
                    />
                  </label>
                </div>
              </section>

              <section
                ref={recognitionSettingRef}
                className={`training-setting training-setting-wide ${
                  showStartValidation && invalidStartRequirements.has('recognition') ? 'voice-start-invalid' : ''
                }`}
                aria-invalid={showStartValidation && invalidStartRequirements.has('recognition')}
              >
                <div className="training-setting-header">
                  <div>
                    <h2>{t('voice.config.language')}</h2>
                    <p>{t('voice.config.languageDesc')}</p>
                  </div>
                  <span>{t(language === 'zh' ? 'voice.language.zh' : 'voice.language.en')}</span>
                </div>
                <div className="training-option-grid training-option-grid-three">
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
                    onClick={() => void loadModel(language)}
                  >
                    <span className="training-option-title">{t('voice.model.reload')}</span>
                    <span className="training-option-meta">{t('voice.model.cacheHint')}</span>
                  </button>
                </div>
              </section>

              <section
                ref={vocabularySettingRef}
                className={`training-setting training-setting-wide voice-vocabulary-setting ${
                  showStartValidation && invalidStartRequirements.has('vocabulary') ? 'voice-start-invalid' : ''
                }`}
                aria-invalid={showStartValidation && invalidStartRequirements.has('vocabulary')}
              >
                <div className="training-setting-header">
                  <div>
                    <h2>{t('voice.vocabulary.title')}</h2>
                    <p>{t('voice.vocabulary.desc')}</p>
                  </div>
                  <span>{t('voice.vocabulary.activeCount', { active: activeWords.length, total: languageVocabulary.length })}</span>
                </div>
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
                        ...createDefaultVoiceVocabulary().filter((item) => item.language === language),
                      ])}
                    >
                      {t('voice.vocabulary.reset')}
                    </button>
                  </div>
                </div>
              </section>

              <section
                ref={microphoneSettingRef}
                className={`training-setting training-setting-wide voice-microphone-setting voice-microphone-${microphoneStatus} ${
                  showStartValidation && invalidStartRequirements.has('microphone') ? 'voice-start-invalid' : ''
                }`}
                aria-invalid={showStartValidation && invalidStartRequirements.has('microphone')}
              >
                <div className="training-setting-header">
                  <div>
                    <h2>{t('voice.microphone.title')}</h2>
                    <p>{t('voice.microphone.desc')}</p>
                  </div>
                  <span>{getMicrophoneStatusText(microphoneStatus, t)}</span>
                </div>
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
              </section>

              <section className="training-setting training-setting-wide">
                <div className="training-setting-header">
                  <div>
                    <h2>{t('drawing.config.background')}</h2>
                    <p>{backgroundSummary}</p>
                  </div>
                  <span>{backgroundModeLabel}</span>
                </div>
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
              </section>
            </div>

            <div className="training-config-footer">
              <TrainingConfigSummary
                title={t('voice.title')}
                items={[
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
                        value: t(recognitionEngine === 'vosk' ? 'voice.engine.vosk' : 'voice.engine.webSpeech'),
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
                ]}
              />
              <div className="training-config-actions">
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
                  {t('training.start')}
                </StartTrainingButton>
                <button className="btn btn-ghost btn-lg" onClick={handleExit}>{t('training.cancel')}</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {phase !== 'results' && (
        <div className="drawing-defense-hud">
          <div><strong>{t('voice.hud.hp')}</strong> {hp}/{maxHp}</div>
          <div><strong>{t('voice.results.defeated')}</strong> {defeated}</div>
          <div><strong>{t('voice.hud.time')}</strong> {timeProgressText}</div>
          <div>
            <strong>{t('voice.hud.engine')}</strong>{' '}
            {recognitionEngine
              ? t(recognitionEngine === 'vosk' ? 'voice.engine.vosk' : 'voice.engine.webSpeech')
              : '-'}
          </div>
          {phase === 'playing' && (
            <div className={`voice-listening-indicator voice-listening-${microphoneStatus}`}>
              <span aria-hidden="true" />
              <strong>{getMicrophoneStatusText(microphoneStatus, t)}</strong>
            </div>
          )}
          <div><strong>{t('voice.hud.heard')}</strong> {recognizedText || '-'}</div>
          {phase === 'playing' && (
            <button className="btn btn-sm btn-secondary" onClick={pauseGame}>{t('training.pause')}</button>
          )}
          {(phase === 'playing' || phase === 'paused') && (
            <button className="btn btn-sm btn-ghost" onClick={() => finishGame('Stopped')}>{t('voice.finish')}</button>
          )}
        </div>
      )}

      {phase === 'paused' && (
        <div className="training-panel training-panel-compact">
          <h1>{t('voice.pause.title')}</h1>
          <button className="btn btn-primary btn-lg" onClick={() => void resumeGame()}>{t('training.continueGame')}</button>
          <button className="btn btn-secondary btn-lg" onClick={restartGame}>{t('training.restart')}</button>
          <button className="btn btn-ghost btn-lg" onClick={returnToEditor}>{t('training.returnMenu')}</button>
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
              onRestart={restartGame}
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

function getVoiceCardTypography(word: string): {
  estimatedWidth: number;
  fontSize: number;
  fontWeight: '700' | '900';
} {
  const characters = [...word];
  const baseFontSize = characters.length > 10 ? 15 : characters.length > 6 ? 18 : 22;
  const fontScale = getSetting('uiFontSizePx') / DEFAULT_UI_FONT_SIZE_PX;
  const fontSize = Math.round(clamp(baseFontSize * fontScale, 12, 38));
  const estimatedWidth = Math.ceil(characters.reduce((totalWidth, character) => (
    totalWidth + fontSize * getVoiceCardCharacterWidthFactor(character)
  ), 0));

  return {
    estimatedWidth,
    fontSize,
    fontWeight: getSetting('uiFontBold') ? '900' : '700',
  };
}

function getVoiceCardCharacterWidthFactor(character: string): number {
  if (/[\u0000-\u007f]/.test(character)) return 0.62;
  return 1;
}

function getModelStatusText(
  status: ModelStatus,
  stage: ModelLoadStage,
  progress: number,
  t: TFunction,
): string {
  if (status === 'ready') return t('voice.model.ready');
  if (status === 'fallback' && progress < 100) {
    return t('voice.model.fallbackDownloading', { value: progress });
  }
  if (status === 'fallback') return t('voice.model.fallback');
  if (status === 'error') return t('voice.model.error');
  if (status === 'loading' && stage === 'checking-cache') return t('voice.model.checkingCache');
  if (status === 'loading' && stage === 'loading-cache') return t('voice.model.loadingCache');
  if (status === 'loading' && stage === 'downloading') return t('voice.model.downloading', { value: progress });
  if (status === 'loading' && stage === 'saving-cache') return t('voice.model.savingCache');
  if (status === 'loading' && stage === 'initializing') return t('voice.model.initializing');
  return t('voice.model.waiting');
}

export function isLineOrFacebookInAppBrowser(userAgent: string): boolean {
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

function requestMicrophoneStream(constraints: MediaStreamConstraints): Promise<MediaStream> {
  const request = navigator.mediaDevices.getUserMedia(constraints);
  if (!isLikelyIosDevice()) return request;

  let isSettled = false;
  let timeoutId = 0;
  return new Promise((resolve, reject) => {
    timeoutId = window.setTimeout(() => {
      if (isSettled) return;
      isSettled = true;
      reject(new MicrophonePermissionTimeoutError());
    }, IOS_MICROPHONE_PERMISSION_TIMEOUT_MS);

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

function getMicrophoneAccessError(error: unknown, t: TFunction): MicrophoneAccessError {
  if (error instanceof MicrophoneAccessError) return error;

  const isDenied = isMicrophonePermissionDeniedError(error) || error instanceof MicrophonePermissionTimeoutError;
  if (isDenied) {
    const message = isLikelyIosDevice()
      ? t('voice.microphone.iosSettings', { browser: getCurrentBrowserDisplayName(t) })
      : t('voice.microphone.denied');
    return new MicrophoneAccessError(message, 'denied');
  }

  return new MicrophoneAccessError(getErrorMessage(error) || t('voice.microphone.denied'), 'disconnected');
}

function isLikelyIosDevice(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /iPad|iPhone|iPod/i.test(navigator.userAgent)
    || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

function getCurrentBrowserDisplayName(t: TFunction): string {
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

function isMicrophonePermissionDeniedError(error: unknown): boolean {
  const errorName = getErrorName(error);
  const normalizedError = `${errorName} ${getErrorMessage(error)}`.toLowerCase();
  return errorName === 'NotAllowedError'
    || errorName === 'SecurityError'
    || errorName === 'PermissionDeniedError'
    || normalizedError.includes('not-allowed')
    || normalizedError.includes('service-not-allowed')
    || normalizedError.includes('permission denied');
}

function getErrorName(error: unknown): string {
  if (!error || typeof error !== 'object' || !('name' in error)) return '';
  const value = (error as { name?: unknown }).name;
  return typeof value === 'string' ? value : '';
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  if (!error || typeof error !== 'object' || !('message' in error)) return '';
  const value = (error as { message?: unknown }).message;
  return typeof value === 'string' ? value : '';
}

function getMicrophoneStatusText(status: MicrophoneStatus, t: TFunction): string {
  if (status === 'testing') return t('voice.microphone.testing');
  if (status === 'ready') return t('voice.microphone.ready');
  if (status === 'silent') return t('voice.microphone.silent');
  if (status === 'muted') return t('voice.microphone.muted');
  if (status === 'disconnected') return t('voice.microphone.disconnected');
  if (status === 'denied') return t('voice.microphone.deniedStatus');
  return t('voice.microphone.pending');
}

function getMicrophoneStartIssue(
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

function calculateByteRms(samples: Uint8Array): number {
  let sumSquares = 0;
  for (const sample of samples) {
    const normalized = (sample - 128) / 128;
    sumSquares += normalized * normalized;
  }
  return Math.sqrt(sumSquares / samples.length);
}

function calculateFloatRms(samples: Float32Array): number {
  let sumSquares = 0;
  for (const sample of samples) {
    sumSquares += sample * sample;
  }
  return Math.sqrt(sumSquares / samples.length);
}

function toMeterLevel(rms: number): number {
  return clamp(Math.sqrt(rms) * 2.2, 0, 1);
}

function getWebSpeechRecognitionConstructor(): WebSpeechRecognitionConstructor | null {
  if (typeof window === 'undefined') return null;
  const browserWindow = window as Window & {
    SpeechRecognition?: WebSpeechRecognitionConstructor;
    webkitSpeechRecognition?: WebSpeechRecognitionConstructor;
  };
  return browserWindow.SpeechRecognition ?? browserWindow.webkitSpeechRecognition ?? null;
}

function getPositiveNumber(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function getMostDifficultWord(misses: Record<string, number>): string {
  return Object.entries(misses).sort((a, b) => b[1] - a[1])[0]?.[0] ?? '';
}

function formatGameDuration(duration: GameDurationSeconds, t: TFunction): string {
  return duration === null ? t('drawing.config.infiniteMode') : t('training.secondsShort', { value: duration });
}

function toCsv(record: SessionRecord): string {
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

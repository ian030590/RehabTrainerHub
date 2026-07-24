import { type ChangeEvent, type CSSProperties, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Application, Container, Graphics, Text, type Ticker } from 'pixi.js';
import { initJsPsych } from 'jspsych';
import { CreateRuntimeAssetUrlCandidates } from '@rehab-trainer/ui/aiAssets';
import { useT, type TranslationKey } from '../../i18n';
import { DownloadCsvFile } from '../../utils/downloadFile';
import { getActiveUser } from '../../utils/settings';
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
import type { TFunction } from './types';
import { MotorTrainingRulesPanel } from './MotorTrainingRulesPanel';

type Difficulty = 'Beginner' | 'Intermediate' | 'Advanced';
type ShapeId = 'circle' | 'cross' | 'square' | 'triangle' | 'vertical-line' | 'horizontal-line';
type GamePhase = 'menu' | 'rules' | 'playing' | 'results';
type GameResult = 'Victory' | 'Defeat';
type BackgroundMode = 'stars' | 'color' | 'image';
type GameDurationSeconds = number | null;

interface DrawingTowerDefenseGameProps {
  onExit: () => void;
}

interface DifficultyConfig {
  labelKey: TranslationKey;
  spawnMode: 'after-clear-delay' | 'after-clear' | 'fixed-interval';
  spawnIntervalSec: number;
  descriptionKey: TranslationKey;
}

interface Point {
  x: number;
  y: number;
}

interface Enemy {
  id: number;
  x: number;
  y: number;
  shape: ShapeId;
  node: Container;
  spawnedAtSec: number;
  resultIndex: number;
}

interface EnemyResult {
  Enemy_Number: number;
  Shape: ShapeId;
  Reaction_Time_Seconds: number | null;
  Defeated: boolean;
}

interface DrawingSampleMetadata {
  sampleId: string;
  createdAt: string;
  participantId: string;
  targetShape: ShapeId | null;
  targetShapeLabel: string | null;
  recognizedShape: ShapeId | null;
  recognizedShapeLabel: string | null;
  matched: boolean;
  difficulty: Difficulty;
  gameTimeSeconds: GameDurationSeconds;
  enemyNumber: number | null;
  elapsedSeconds: number;
  elapsedSinceTargetSpawnSeconds: number | null;
  enemySpeed: number;
  recognitionStrictness: number;
  strokeWaitMilliseconds: number;
  strokeCount: number;
  pointCount: number;
  sourceCanvasWidth: number | null;
  sourceCanvasHeight: number | null;
  boundingBox: ReturnType<typeof GetBox>;
  imageFormat: 'png-transparent';
  imageSize: number;
}

interface SessionRecord {
  Test_Date: string;
  Participant_ID: string;
  Difficulty: Difficulty;
  Game_Time_Seconds: GameDurationSeconds;
  Starting_HP: number;
  Enemy_Speed: number;
  Recognition_Strictness: number;
  Stroke_Wait_Milliseconds: number;
  Total_Duration_Seconds: number;
  Enemies_Spawned: number;
  Enemies_Defeated: number;
  HP_Remaining: number;
  Game_Result: GameResult;
  Enemy_Results: EnemyResult[];
}

const shapes: readonly ShapeId[] = ['circle', 'cross', 'square', 'triangle', 'vertical-line', 'horizontal-line'];
const defaultJudgeDelayMs = 300;
const strokeWaitOptions = [220, defaultJudgeDelayMs, 350] as const;
const hpOptions = [1, 3, 5] as const;
const gameDurationOptions = [30, 60, 300, null] as const;
const enemySpeedOptions = [5, 15, 30] as const;
const defaultHp = 3;
const defaultEnemySpeed = 5;
const minRecognitionStrictness = 10;
const defaultRecognitionStrictness = 20;
const maxRecognitionStrictness = 90;
const defaultGameDurationSeconds: GameDurationSeconds = 30;
const defaultCustomGameDurationSeconds = 120;
const enemyVisualHeight = 98;
const enemySpawnY = -enemyVisualHeight - 8;
const defaultBackgroundColor = '#005EB8';
const recognizerPoints = 64;
const recognizerSize = 200;
const rdpStationaryPointDistancePx = 2.5;
const defaultRdpEpsilonRatio = 0.08;
const minRdpEpsilonRatio = 0.05;
const maxRdpEpsilonRatio = 0.1;
const rdpClosedEndpointDistancePx = 30;
const rdpStraightAngleDegrees = 160;
const starSkyBackgroundImage = CreateRuntimeAssetUrlCandidates(
  import.meta.env.VITE_AI_ASSET_BASE_URL,
  'game-assets/motortrainer/star-sky/v1/StarSky.png',
  `${import.meta.env.BASE_URL}assets/StarSky.png`,
)
  .map((url) => `url("${url}")`)
  .join(', ');
const drawingSampleUploadEndpoint = import.meta.env.VITE_DRAWING_SAMPLE_UPLOAD_URL?.trim() || '/api/drawing-samples';
const drawingSampleUploadToken = import.meta.env.VITE_DRAWING_SAMPLE_UPLOAD_TOKEN?.trim() || '';
const drawingSampleImageSize = 256;
const drawingSampleImagePadding = 24;
const drawingSampleStrokeWidth = 14;

const difficulties: Record<Difficulty, DifficultyConfig> = {
  Beginner: { labelKey: 'drawing.diff.beginner', spawnMode: 'after-clear-delay', spawnIntervalSec: 2, descriptionKey: 'drawing.diff.beginnerDesc' },
  Intermediate: { labelKey: 'drawing.diff.intermediate', spawnMode: 'after-clear', spawnIntervalSec: 0, descriptionKey: 'drawing.diff.intermediateDesc' },
  Advanced: { labelKey: 'drawing.diff.advanced', spawnMode: 'fixed-interval', spawnIntervalSec: 3, descriptionKey: 'drawing.diff.advancedDesc' },
};

const shapeLabelKeys: Record<ShapeId, TranslationKey> = {
  circle: 'drawing.shape.circle',
  cross: 'drawing.shape.cross',
  square: 'drawing.shape.square',
  triangle: 'drawing.shape.triangle',
  'vertical-line': 'drawing.shape.verticalLine',
  'horizontal-line': 'drawing.shape.horizontalLine',
};

export function DrawingTowerDefenseGame({ onExit }: DrawingTowerDefenseGameProps) {
  const { t } = useT();
  const { fullscreenRootRef, enterTrainingFullscreen } = useFullscreenTrainingRoot<HTMLDivElement>();
  const pixiHostRef = useRef<HTMLDivElement | null>(null);
  const overlayRef = useRef<HTMLDivElement | null>(null);
  const appRef = useRef<Application | null>(null);
  const enemiesRef = useRef<Enemy[]>([]);
  const backgroundLayerRef = useRef<Graphics | null>(null);
  const drawingLayerRef = useRef<Graphics | null>(null);
  const pathRef = useRef<Point[]>([]);
  const strokesRef = useRef<Point[][]>([]);
  const enemyResultsRef = useRef<EnemyResult[]>([]);
  const recognitionTimerRef = useRef<number | null>(null);
  const drawingClearTimerRef = useRef<number | null>(null);
  const uploadedBackgroundUrlRef = useRef<string | null>(null);
  const isDrawingRef = useRef(false);
  const metricsRef = useRef({ defeated: 0, hp: defaultHp, spawned: 0, elapsed: 0, spawnTimer: 0, nextId: 1 });
  const phaseRef = useRef<GamePhase>('menu');
  const configRef = useRef({
    difficulty: 'Beginner' as Difficulty,
    gameDurationSec: defaultGameDurationSeconds,
    maxHp: defaultHp,
    speed: defaultEnemySpeed,
    strictness: defaultRecognitionStrictness,
    strokeWaitMs: defaultJudgeDelayMs,
  });
  const jsPsychRef = useRef<ReturnType<typeof initJsPsych> | null>(null);

  const [phase, setPhaseState] = useState<GamePhase>('menu');
  const [difficulty, setDifficulty] = useState<Difficulty>('Beginner');
  const [gameDurationSec, setGameDurationSec] = useState<GameDurationSeconds>(defaultGameDurationSeconds);
  const [customGameDurationSec, setCustomGameDurationSec] = useState(defaultCustomGameDurationSeconds);
  const [maxHp, setMaxHp] = useState(defaultHp);
  const [customHp, setCustomHp] = useState(defaultHp);
  const [speed, setSpeed] = useState(defaultEnemySpeed);
  const [customSpeed, setCustomSpeed] = useState(defaultEnemySpeed);
  const [strictness, setStrictness] = useState(defaultRecognitionStrictness);
  const [strokeWaitMs, setStrokeWaitMs] = useState(defaultJudgeDelayMs);
  const [customStrokeWaitMs, setCustomStrokeWaitMs] = useState(defaultJudgeDelayMs);
  const [backgroundMode, setBackgroundMode] = useState<BackgroundMode>('stars');
  const backgroundColor = defaultBackgroundColor;
  const [uploadedBackgroundUrl, setUploadedBackgroundUrl] = useState<string | null>(null);
  const [uploadedBackgroundName, setUploadedBackgroundName] = useState(() => t('drawing.upload.noImage'));
  const [result, setResult] = useState<SessionRecord | null>(null);

  const activeConfig = difficulties[difficulty];
  const activeDifficultyLabel = t(activeConfig.labelKey);
  const activeDifficultyDescription = t(activeConfig.descriptionKey);
  const isPresetGameDuration = gameDurationOptions.includes(gameDurationSec as typeof gameDurationOptions[number]);
  const isCustomHp = !hpOptions.includes(maxHp as typeof hpOptions[number]);
  const isCustomSpeed = !enemySpeedOptions.includes(speed as typeof enemySpeedOptions[number]);
  const gameDurationLabel = FormatGameDuration(gameDurationSec, t);
  const backgroundSummary =
    backgroundMode === 'stars' ? t('drawing.background.stars') : backgroundMode === 'color' ? backgroundColor : t('drawing.background.customImage');
  const backgroundModeLabel =
    backgroundMode === 'stars' ? t('drawing.background.image') : backgroundMode === 'color' ? t('drawing.background.color') : t('drawing.background.customImage');
  const backgroundStyle = useMemo<CSSProperties>(() => {
    if (backgroundMode === 'stars') return { backgroundImage: starSkyBackgroundImage };
    if (backgroundMode === 'image' && uploadedBackgroundUrl) {
      return { backgroundImage: `url("${uploadedBackgroundUrl}")` };
    }
    return { backgroundImage: 'none', backgroundColor };
  }, [backgroundColor, backgroundMode, uploadedBackgroundUrl]);
  const setPhase = useCallback((next: GamePhase) => {
    phaseRef.current = next;
    setPhaseState(next);
  }, []);

  useEffect(() => {
    configRef.current = { difficulty, gameDurationSec, maxHp, speed, strictness, strokeWaitMs };
  }, [difficulty, gameDurationSec, maxHp, speed, strictness, strokeWaitMs]);

  useEffect(() => {
    jsPsychRef.current = initJsPsych();
  }, []);

  const clearDrawingInput = useCallback(() => {
    if (recognitionTimerRef.current !== null) {
      window.clearTimeout(recognitionTimerRef.current);
      recognitionTimerRef.current = null;
    }
    if (drawingClearTimerRef.current !== null) {
      window.clearTimeout(drawingClearTimerRef.current);
      drawingClearTimerRef.current = null;
    }
    isDrawingRef.current = false;
    pathRef.current = [];
    strokesRef.current = [];
    drawingLayerRef.current?.clear();
  }, []);

  useEffect(() => () => {
    if (uploadedBackgroundUrlRef.current) URL.revokeObjectURL(uploadedBackgroundUrlRef.current);
    clearDrawingInput();
  }, [clearDrawingInput]);

  const clearPixiState = useCallback(() => {
    clearDrawingInput();
    enemiesRef.current.forEach((enemy) => enemy.node.destroy({ children: true }));
    enemiesRef.current = [];
  }, [clearDrawingInput]);

  const recordEnemyOutcome = useCallback((enemy: Enemy, defeatedEnemy: boolean) => {
    const result = enemyResultsRef.current[enemy.resultIndex];
    if (!result || result.Reaction_Time_Seconds !== null) return;
    const reactionTime = Math.max(0, metricsRef.current.elapsed - enemy.spawnedAtSec);
    result.Reaction_Time_Seconds = Number(reactionTime.toFixed(2));
    result.Defeated = defeatedEnemy;
  }, []);

  const finishGame = useCallback((gameResult: GameResult) => {
    if (phaseRef.current === 'results') return;
    PlayGameEndSound(gameResult, jsPsychRef);
    clearDrawingInput();
    enemiesRef.current.forEach((enemy) => recordEnemyOutcome(enemy, false));
    enemiesRef.current.forEach((enemy) => enemy.node.destroy({ children: true }));
    enemiesRef.current = [];
    const metrics = metricsRef.current;
    const record: SessionRecord = {
      Test_Date: FormatTestDate(new Date()),
      Participant_ID: getActiveUser() || 'Unknown',
      Difficulty: configRef.current.difficulty,
      Game_Time_Seconds: configRef.current.gameDurationSec,
      Starting_HP: configRef.current.maxHp,
      Enemy_Speed: configRef.current.speed,
      Recognition_Strictness: configRef.current.strictness,
      Stroke_Wait_Milliseconds: configRef.current.strokeWaitMs,
      Total_Duration_Seconds: Number(metrics.elapsed.toFixed(1)),
      Enemies_Spawned: metrics.spawned,
      Enemies_Defeated: metrics.defeated,
      HP_Remaining: metrics.hp,
      Game_Result: gameResult,
      Enemy_Results: enemyResultsRef.current.map((enemyResult) => ({ ...enemyResult })),
    };
    setResult(record);
    setPhase('results');
    void SaveTrainingSessionRecord({
      userName: record.Participant_ID,
      moduleId: 'upper-limb-training',
      gameId: 'drawing-defense',
      gameTitle: t('training.drawing.title'),
      difficulty: record.Difficulty,
      trainingDate: record.Test_Date,
      details: {
        Game_Time_Seconds: record.Game_Time_Seconds ?? t('training.infinite'),
        Starting_HP: record.Starting_HP,
        Enemy_Speed: record.Enemy_Speed,
        Recognition_Strictness: record.Recognition_Strictness,
        Stroke_Wait_Milliseconds: record.Stroke_Wait_Milliseconds,
        Total_Duration_Seconds: record.Total_Duration_Seconds,
        Enemies_Spawned: record.Enemies_Spawned,
        Enemies_Defeated: record.Enemies_Defeated,
        HP_Remaining: record.HP_Remaining,
        Game_Result: record.Game_Result,
      },
      detailRows: record.Enemy_Results.map((enemyResult) => ({
        Enemy_Number: enemyResult.Enemy_Number,
        Enemy_Shape: GetShapeLabel(enemyResult.Shape, t),
        Enemy_Reaction_Time_Seconds: enemyResult.Reaction_Time_Seconds,
        Enemy_Defeated: enemyResult.Defeated,
      })),
    });
    WriteJsPsychData(jsPsychRef, record as unknown as Record<string, unknown>, 'Unable to write drawing tower defense result to jsPsych data.');
  }, [clearDrawingInput, recordEnemyOutcome, setPhase, t]);

  const drawLayout = useCallback((app: Application) => {
    const width = app.screen.width;
    const height = app.screen.height;
    const bg = backgroundLayerRef.current ?? new Graphics();
    bg.clear();
    bg.rect(0, 0, width, height).fill({ color: 0x050816, alpha: 0.22 });
    if (!bg.parent) app.stage.addChildAt(bg, 0);
    backgroundLayerRef.current = bg;

    const drawing = drawingLayerRef.current ?? new Graphics();
    if (!drawing.parent) app.stage.addChild(drawing);
    drawingLayerRef.current = drawing;
  }, []);

  const drawShape = useCallback((shape: ShapeId, g: Graphics, cx: number, cy: number, size: number, color = 0x1a1c1e) => {
    if (shape === 'circle') {
      g.circle(cx, cy, size * 0.34).stroke({ color, width: 3 });
    } else if (shape === 'cross') {
      g.moveTo(cx - size * 0.28, cy - size * 0.28).lineTo(cx + size * 0.28, cy + size * 0.28);
      g.moveTo(cx + size * 0.28, cy - size * 0.28).lineTo(cx - size * 0.28, cy + size * 0.28);
      g.stroke({ color, width: 4, cap: 'round' });
    } else if (shape === 'square') {
      g.rect(cx - size * 0.27, cy - size * 0.27, size * 0.54, size * 0.54).stroke({ color, width: 3 });
    } else if (shape === 'triangle') {
      g.moveTo(cx, cy - size * 0.32).lineTo(cx + size * 0.32, cy + size * 0.28).lineTo(cx - size * 0.32, cy + size * 0.28).lineTo(cx, cy - size * 0.32);
      g.stroke({ color, width: 3, join: 'round' });
    } else if (shape === 'vertical-line') {
      g.moveTo(cx, cy - size * 0.34).lineTo(cx, cy + size * 0.34).stroke({ color, width: 4, cap: 'round' });
    } else {
      g.moveTo(cx - size * 0.34, cy).lineTo(cx + size * 0.34, cy).stroke({ color, width: 4, cap: 'round' });
    }
  }, []);

  const spawnEnemy = useCallback((app: Application) => {
    const w = app.screen.width;
    const enemyNumber = metricsRef.current.spawned + 1;
    const shape = shapes[Math.floor(Math.random() * shapes.length)];
    const resultIndex = enemyResultsRef.current.length;
    const enemy: Enemy = {
      id: metricsRef.current.nextId++,
      x: 70 + Math.random() * Math.max(80, w - 140),
      y: enemySpawnY,
      shape,
      node: new Container(),
      spawnedAtSec: metricsRef.current.elapsed,
      resultIndex,
    };
    enemyResultsRef.current.push({
      Enemy_Number: enemyNumber,
      Shape: shape,
      Reaction_Time_Seconds: null,
      Defeated: false,
    });
    const monster = new Text({ text: '👾', style: { fontSize: 42 } });
    monster.anchor.set(0.5);
    monster.x = 0;
    monster.y = 24;
    const board = new Graphics();
    board.roundRect(-34, 48, 68, 50, 6).fill(0xffffff).stroke({ color: 0xc2c6d4, width: 2 });
    drawShape(enemy.shape, board, 0, 73, 54);
    enemy.node.addChild(monster, board);
    enemy.node.x = enemy.x;
    enemy.node.y = enemy.y;
    app.stage.addChild(enemy.node);
    enemiesRef.current.push(enemy);
    metricsRef.current.spawned += 1;
  }, [drawShape]);

  const redrawPath = useCallback(() => {
    const layer = drawingLayerRef.current;
    if (!layer) return;
    layer.clear();
    const drawStroke = (points: Point[]) => {
      if (points.length < 2) return;
      layer.moveTo(points[0].x, points[0].y);
      for (let i = 1; i < points.length; i += 1) {
        layer.lineTo(points[i].x, points[i].y);
      }
    };
    strokesRef.current.forEach(drawStroke);
    drawStroke(pathRef.current);
    if (strokesRef.current.length === 0 && pathRef.current.length < 2) {
      return;
    }
    layer.stroke({ color: 0x005eb8, width: 7, alpha: 0.9, cap: 'round', join: 'round' });
  }, []);

  const queueDrawingSampleUpload = useCallback((strokes: Point[][], recognition: ShapeId | null, target: Enemy | undefined, matched: boolean) => {
    if (matched || !target) return;

    const sampleStrokes = CloneUsableStrokes(strokes);
    const points = FlattenStrokes(sampleStrokes);
    if (points.length < 2 || StrokesPathLength(sampleStrokes) < 8) return;

    const participantId = getActiveUser() || 'Unknown';
    const createdAt = new Date();
    const sampleId = CreateDrawingSampleId(createdAt, participantId, target.shape);
    const stageRect = overlayRef.current?.getBoundingClientRect();
    const targetResult = enemyResultsRef.current[target.resultIndex];
    const elapsedSinceTargetSpawnSeconds = Number(Math.max(0, metricsRef.current.elapsed - target.spawnedAtSec).toFixed(2));
    const metadata: DrawingSampleMetadata = {
      sampleId,
      createdAt: createdAt.toISOString(),
      participantId,
      targetShape: target.shape,
      targetShapeLabel: GetShapeLabel(target.shape, t),
      recognizedShape: recognition,
      recognizedShapeLabel: recognition ? GetShapeLabel(recognition, t) : null,
      matched,
      difficulty: configRef.current.difficulty,
      gameTimeSeconds: configRef.current.gameDurationSec,
      enemyNumber: targetResult?.Enemy_Number ?? null,
      elapsedSeconds: Number(metricsRef.current.elapsed.toFixed(2)),
      elapsedSinceTargetSpawnSeconds,
      enemySpeed: configRef.current.speed,
      recognitionStrictness: configRef.current.strictness,
      strokeWaitMilliseconds: configRef.current.strokeWaitMs,
      strokeCount: sampleStrokes.length,
      pointCount: points.length,
      sourceCanvasWidth: stageRect ? Math.round(stageRect.width) : null,
      sourceCanvasHeight: stageRect ? Math.round(stageRect.height) : null,
      boundingBox: GetBox(points),
      imageFormat: 'png-transparent',
      imageSize: drawingSampleImageSize,
    };

    void CreateDrawingSampleBlob(sampleStrokes)
      .then((blob) => UploadDrawingSample(blob, metadata))
      .catch((error) => {
        console.warn('Unable to upload drawing sample to Discord.', error);
      });
  }, [t]);

  const handlePointerEnd = useCallback(() => {
    if (!isDrawingRef.current) return;
    isDrawingRef.current = false;
    if (pathRef.current.length > 1) {
      strokesRef.current.push(pathRef.current);
    }
    pathRef.current = [];
    if (recognitionTimerRef.current !== null) {
      window.clearTimeout(recognitionTimerRef.current);
    }
    recognitionTimerRef.current = window.setTimeout(() => {
      recognitionTimerRef.current = null;
      const recognition = RecognizeShape(strokesRef.current, configRef.current.strictness);
      const matchedTarget = recognition ? FindClosestEnemyByShape(enemiesRef.current, recognition) : undefined;
      const target = matchedTarget ?? enemiesRef.current[0];
      const matched = Boolean(matchedTarget);
      queueDrawingSampleUpload(strokesRef.current, recognition, target, matched);
      if (matchedTarget) {
        PlaySuccessSound(jsPsychRef);
        recordEnemyOutcome(matchedTarget, true);
        matchedTarget.node.destroy({ children: true });
        enemiesRef.current = enemiesRef.current.filter((enemy) => enemy.id !== matchedTarget.id);
        metricsRef.current.defeated += 1;
      }
      if (drawingClearTimerRef.current !== null) {
        window.clearTimeout(drawingClearTimerRef.current);
      }
      drawingClearTimerRef.current = window.setTimeout(() => {
        drawingClearTimerRef.current = null;
        strokesRef.current = [];
        drawingLayerRef.current?.clear();
      }, 650);
    }, configRef.current.strokeWaitMs);
  }, [queueDrawingSampleUpload, recordEnemyOutcome, t]);

  const startGame = useCallback(async () => {
    if (!VerifySelectedTrainingUser()) return;
    PrepareAudioFeedback(jsPsychRef);
    await enterTrainingFullscreen();

    const app = appRef.current;
    if (!app) return;
    ResizePixiAppToElement(app, pixiHostRef.current);
    clearPixiState();
    app.stage.removeChildren();
    drawLayout(app);
    const initialHp = configRef.current.maxHp;
    metricsRef.current = { defeated: 0, hp: initialHp, spawned: 0, elapsed: 0, spawnTimer: 0, nextId: 1 };
    enemyResultsRef.current = [];
    setResult(null);
    setPhase('playing');
  }, [clearPixiState, drawLayout, enterTrainingFullscreen, setPhase]);

  const returnToMenu = useCallback(() => {
    const app = appRef.current;
    clearPixiState();
    if (app) {
      app.stage.removeChildren();
      drawLayout(app);
    }
    setPhase('menu');
  }, [clearPixiState, drawLayout, setPhase]);

  const handleBackgroundImageUpload = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !file.type.startsWith('image/')) return;
    if (uploadedBackgroundUrlRef.current) URL.revokeObjectURL(uploadedBackgroundUrlRef.current);
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
      app.canvas.className = 'drawing-defense-canvas';
      drawLayout(app);
      app.ticker.add((ticker: Ticker) => {
        if (phaseRef.current !== 'playing') return;
        const dt = Math.min(ticker.deltaMS / 1000, 0.05);
        const metrics = metricsRef.current;
        const cfg = difficulties[configRef.current.difficulty];
        const targetGameDurationSec = configRef.current.gameDurationSec;
        const isTimeUnlimited = targetGameDurationSec === null;
        metrics.elapsed += dt;
        const noActiveEnemies = enemiesRef.current.length === 0;
        if (cfg.spawnMode === 'fixed-interval' || noActiveEnemies) {
          metrics.spawnTimer += dt;
        } else {
          metrics.spawnTimer = 0;
        }
        if (isTimeUnlimited || metrics.elapsed < targetGameDurationSec) {
          const shouldSpawn =
            metrics.spawned === 0 ||
            (cfg.spawnMode === 'after-clear-delay' && noActiveEnemies && metrics.spawnTimer >= cfg.spawnIntervalSec) ||
            (cfg.spawnMode === 'after-clear' && noActiveEnemies) ||
            (cfg.spawnMode === 'fixed-interval' && metrics.spawnTimer >= cfg.spawnIntervalSec);
          if (shouldSpawn) {
            metrics.spawnTimer = 0;
            spawnEnemy(app);
          }
        }
        const enemyBottomOffset = enemyVisualHeight;
        const defenseY = app.screen.height - enemyBottomOffset;
        for (const enemy of [...enemiesRef.current]) {
          enemy.y += configRef.current.speed * dt;
          enemy.node.y = enemy.y;
          if (enemy.y > defenseY) {
            PlayFailureSound(jsPsychRef);
            recordEnemyOutcome(enemy, false);
            enemy.node.destroy({ children: true });
            enemiesRef.current = enemiesRef.current.filter((item) => item.id !== enemy.id);
            metrics.hp = Math.max(0, metrics.hp - 1);
          }
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

    init();

    const onResize = () => {
      const app = appRef.current;
      if (!app) return;
      ResizePixiAppToElement(app, pixiHostRef.current);
      if (phaseRef.current === 'playing') {
        drawLayout(app);
        redrawPath();
        return;
      }
      app.stage.removeChildren();
      drawLayout(app);
    };
    window.addEventListener('resize', onResize);
    return () => {
      cancelled = true;
      window.removeEventListener('resize', onResize);
      app.destroy(true, { children: true, texture: true });
      appRef.current = null;
    };
  }, [drawLayout, finishGame, recordEnemyOutcome, redrawPath, spawnEnemy]);

  useTrainingAbort({
    active: phase === 'playing' || phase === 'rules',
    onAbort: returnToMenu,
  });

  useEffect(() => {
    const overlay = overlayRef.current;
    if (!overlay) return;
    const toPoint = (event: PointerEvent): Point => {
      const rect = overlay.getBoundingClientRect();
      return { x: event.clientX - rect.left, y: event.clientY - rect.top };
    };
    const onPointerDown = (event: PointerEvent) => {
      if (phaseRef.current !== 'playing') return;
      event.preventDefault();
      if (recognitionTimerRef.current !== null) {
        window.clearTimeout(recognitionTimerRef.current);
        recognitionTimerRef.current = null;
      }
      if (drawingClearTimerRef.current !== null) {
        window.clearTimeout(drawingClearTimerRef.current);
        drawingClearTimerRef.current = null;
        strokesRef.current = [];
        drawingLayerRef.current?.clear();
      }
      overlay.setPointerCapture(event.pointerId);
      isDrawingRef.current = true;
      pathRef.current = [toPoint(event)];
      redrawPath();
    };
    const onPointerMove = (event: PointerEvent) => {
      if (!isDrawingRef.current || phaseRef.current !== 'playing') return;
      event.preventDefault();
      pathRef.current.push(toPoint(event));
      redrawPath();
    };
    overlay.addEventListener('pointerdown', onPointerDown);
    overlay.addEventListener('pointermove', onPointerMove);
    overlay.addEventListener('pointerup', handlePointerEnd);
    overlay.addEventListener('pointercancel', handlePointerEnd);
    return () => {
      overlay.removeEventListener('pointerdown', onPointerDown);
      overlay.removeEventListener('pointermove', onPointerMove);
      overlay.removeEventListener('pointerup', handlePointerEnd);
      overlay.removeEventListener('pointercancel', handlePointerEnd);
    };
  }, [handlePointerEnd, redrawPath]);

  const downloadResult = () => {
    if (!result) return;
    DownloadCsvFile(ToCsv([result], t), `drawing_tower_defense_${Date.now()}.csv`);
  };

  return (
    <div ref={fullscreenRootRef} className={`drawing-defense drawing-defense-phase-${phase}`} style={backgroundStyle}>
      <div ref={pixiHostRef} className="drawing-defense-stage" />
      <div ref={overlayRef} className="drawing-defense-input" />

      {phase === 'menu' && (
        <div className="training-panel">
          <TrainingConfigPanel
            label={t('drawing.config.label')}
            title={t('training.drawing.title')}
            summaryTitle={t('training.drawing.title')}
            summaryItems={[
              { label: t('cognitive.config.difficulty'), value: activeDifficultyLabel },
              { label: t('drawing.config.gameDuration'), value: gameDurationLabel },
              { label: t('drawing.config.hp'), value: maxHp },
              { label: t('drawing.config.enemySpeed'), value: t('drawing.config.speedValue', { value: speed }) },
              { label: t('drawing.config.strictness'), value: `${strictness}%` },
              { label: t('drawing.config.strokeWait'), value: t('drawing.config.waitValue', { value: strokeWaitMs }) },
              { label: t('drawing.config.background'), value: backgroundSummary },
            ]}
            actions={(
              <>
                <StartTrainingButton onClick={() => setPhase('rules')}>
                  {t('training.rules')}
                </StartTrainingButton>
                <button className="btn btn-ghost btn-lg" onClick={onExit}>{t('training.cancel')}</button>
              </>
            )}
          >
              <TrainingConfigSection
                title={t('cognitive.config.difficulty')}
                description={activeDifficultyDescription}
                value={activeDifficultyLabel}
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
                title={t('drawing.config.hp')}
                description={t('drawing.config.hpValue', { value: maxHp })}
                value={isCustomHp ? t('training.custom') : t('training.default')}
              >
                <TrainingConfigOptionGroup columns={4}>
                  {hpOptions.map((option) => (
                    <button
                      key={option}
                      type="button"
                      className={`training-option ${maxHp === option ? 'active' : ''}`}
                      onClick={() => setMaxHp(option)}
                    >
                      <span className="training-option-title">{t('drawing.config.hpValue', { value: option })}</span>
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
                value={gameDurationSec === defaultGameDurationSeconds ? t('training.default') : isPresetGameDuration ? t('training.optional') : t('training.custom')}
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
                title={t('drawing.config.enemySpeed')}
                description={t('drawing.config.speedValue', { value: speed })}
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
                      <span className="training-option-meta">{t('drawing.config.speedUnit')}</span>
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
                      aria-label={t('drawing.config.customEnemySpeed')}
                    />
                  </label>
                </TrainingConfigOptionGroup>
              </TrainingConfigSection>

              <TrainingConfigSection
                title={t('drawing.config.strictness')}
                description={`${strictness}%`}
              >
                <input
                  className="training-slider"
                  type="range"
                  min={minRecognitionStrictness}
                  max={maxRecognitionStrictness}
                  step="5"
                  value={strictness}
                  onChange={(event) => setStrictness(Number(event.target.value))}
                />
              </TrainingConfigSection>

              <TrainingConfigSection
                title={t('drawing.config.strokeWait')}
                description={t('drawing.config.waitValue', { value: strokeWaitMs })}
              >
                <TrainingConfigOptionGroup className="training-wait-grid">
                  {strokeWaitOptions.map((wait) => (
                    <button
                      key={wait}
                      type="button"
                      className={`training-option ${strokeWaitMs === wait ? 'active' : ''}`}
                      onClick={() => setStrokeWaitMs(wait)}
                    >
                      <span className="training-option-title">{wait / 1000}s</span>
                    </button>
                  ))}
                  <label
                    className={`training-option training-option-custom ${!strokeWaitOptions.includes(strokeWaitMs as typeof strokeWaitOptions[number]) ? 'active' : ''}`}
                    onClick={() => setStrokeWaitMs(customStrokeWaitMs)}
                  >
                    <span className="training-option-title">{t('training.custom')}</span>
                    <input
                      className="training-number-input"
                      type="number"
                      min="180"
                      max="600"
                      step="10"
                      value={customStrokeWaitMs}
                      onChange={(event) => {
                        const value = Clamp(Number(event.target.value), 180, 600);
                        setCustomStrokeWaitMs(value);
                        setStrokeWaitMs(value);
                      }}
                      onFocus={() => setStrokeWaitMs(customStrokeWaitMs)}
                      aria-label={t('drawing.config.customStrokeWait')}
                    />
                  </label>
                </TrainingConfigOptionGroup>
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
                      <strong>{backgroundColor}</strong>
                    </div>
                    <span className="training-option-meta">{t('drawing.config.fixedColor')}</span>
                  </div>
                  <label
                    className={`drawing-defense-background-card ${backgroundMode === 'image' ? 'active' : ''}`}
                    onClick={() => {
                      if (uploadedBackgroundUrl) setBackgroundMode('image');
                    }}
                  >
                    <div className="drawing-defense-background-card-header">
                      <span>{t('drawing.background.customImage')}</span>
                      <strong>{uploadedBackgroundUrl ? t('drawing.config.uploaded') : t('drawing.config.notUploaded')}</strong>
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
          <MotorTrainingRulesPanel
            gameId="drawing-defense"
            title={t('training.drawing.title')}
            summaryTitle={t('training.drawing.title')}
            summaryItems={[
              { label: t('cognitive.config.difficulty'), value: activeDifficultyLabel },
              { label: t('drawing.config.gameDuration'), value: gameDurationLabel },
              { label: t('drawing.config.hp'), value: maxHp },
              { label: t('drawing.config.enemySpeed'), value: t('drawing.config.speedValue', { value: speed }) },
              { label: t('drawing.config.strictness'), value: `${strictness}%` },
              { label: t('drawing.config.strokeWait'), value: t('drawing.config.waitValue', { value: strokeWaitMs }) },
              { label: t('drawing.config.background'), value: backgroundSummary },
            ]}
            onStart={() => void startGame()}
            onBack={() => setPhase('menu')}
          />
        </div>
      )}

      {phase === 'results' && result && (
        <div className="experiment-container experiment-container-scrollable drawing-defense-results-container">
          <div className="experiment-results">
            <h1>{t('drawing.results.complete')}</h1>
            <div className="training-result-summary">
              <span>
                <small>{t('drawing.results.user')}</small>
                <strong>{result.Participant_ID}</strong>
              </span>
              <span>
                <small>{t('drawing.results.defeatedEnemies')}</small>
                <strong>{result.Enemies_Defeated}/{result.Enemies_Spawned}</strong>
              </span>
              <span>
                <small>{t('drawing.results.duration')}</small>
                <strong>{FormatSeconds(result.Total_Duration_Seconds, t)}</strong>
              </span>
            </div>

            <table className="results-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>{t('drawing.results.shape')}</th>
                  <th>{t('drawing.results.reactionTime')}</th>
                  <th>{t('drawing.results.defeated')}</th>
                </tr>
              </thead>
              <tbody>
                {result.Enemy_Results.map((enemyResult) => (
                  <tr key={enemyResult.Enemy_Number}>
                    <td>{enemyResult.Enemy_Number}</td>
                    <td>{GetShapeLabel(enemyResult.Shape, t)}</td>
                    <td>
                      {enemyResult.Reaction_Time_Seconds === null ? '-' : FormatSeconds(enemyResult.Reaction_Time_Seconds, t)}
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
              onBackHome={returnToMenu}
            />
          </div>
        </div>
      )}
    </div>
  );
}

function CloneUsableStrokes(strokes: Point[][]): Point[][] {
  return strokes
    .filter((stroke) => stroke.length >= 2)
    .map((stroke) => stroke.map((point) => ({ x: point.x, y: point.y })));
}

function CreateDrawingSampleBlob(strokes: Point[][]): Promise<Blob> {
  const points = FlattenStrokes(strokes);
  if (points.length < 2) {
    return Promise.reject(new Error('Drawing sample has no usable points.'));
  }

  const box = GetBox(points);
  const width = Math.max(1, box.maxX - box.minX);
  const height = Math.max(1, box.maxY - box.minY);
  const canvas = document.createElement('canvas');
  canvas.width = drawingSampleImageSize;
  canvas.height = drawingSampleImageSize;
  const ctx = canvas.getContext('2d');
  if (!ctx) return Promise.reject(new Error('Canvas 2D context is unavailable.'));

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = '#111827';
  ctx.lineWidth = drawingSampleStrokeWidth;

  const drawableSize = drawingSampleImageSize - drawingSampleImagePadding * 2;
  const scale = drawableSize / Math.max(width, height);
  const offsetX = (drawingSampleImageSize - width * scale) / 2 - box.minX * scale;
  const offsetY = (drawingSampleImageSize - height * scale) / 2 - box.minY * scale;

  ctx.beginPath();
  strokes.forEach((stroke) => {
    stroke.forEach((point, index) => {
      const x = point.x * scale + offsetX;
      const y = point.y * scale + offsetY;
      if (index === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
  });
  ctx.stroke();

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error('Unable to encode drawing sample PNG.'));
    }, 'image/png');
  });
}

async function UploadDrawingSample(blob: Blob, metadata: DrawingSampleMetadata): Promise<void> {
  const filename = `drawing_${metadata.targetShape ?? 'unknown'}_${metadata.matched ? 'hit' : 'miss'}_${metadata.sampleId}.png`;
  const body = new FormData();
  body.append('image', blob, filename);
  body.append('metadata', JSON.stringify(metadata));

  const response = await fetch(drawingSampleUploadEndpoint, {
    method: 'POST',
    headers: drawingSampleUploadToken ? { 'x-drawing-upload-token': drawingSampleUploadToken } : undefined,
    body,
  });

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`Upload failed with ${response.status}${text ? `: ${text}` : ''}`);
  }
}

function CreateDrawingSampleId(date: Date, participantId: string, targetShape: ShapeId | null): string {
  const timestamp = date.toISOString().replace(/\D/g, '').slice(0, 17);
  const user = SanitizeFilenamePart(participantId) || 'user';
  const shape = targetShape ?? 'unknown';
  const random = Math.random().toString(36).slice(2, 8);
  return `${timestamp}_${user}_${shape}_${random}`;
}

function SanitizeFilenamePart(value: string): string {
  return value.trim().replace(/[^a-zA-Z0-9_-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40);
}

function FindClosestEnemyByShape(enemies: Enemy[], shape: ShapeId): Enemy | undefined {
  return enemies.reduce<Enemy | undefined>((closest, enemy) => {
    if (enemy.shape !== shape) return closest;
    if (!closest || enemy.y > closest.y) return enemy;
    return closest;
  }, undefined);
}

function RecognizeShape(strokes: Point[][], strictness: number): ShapeId | null {
  const usableStrokes = strokes.filter((stroke) => stroke.length >= 2);
  const rawPoints = FlattenStrokes(usableStrokes);
  if (rawPoints.length < 6) return null;

  if (LooksLikeCircle(rawPoints, strictness)) return 'circle';
  const box = GetBox(rawPoints);
  const tolerance = ShapeTolerance(strictness);
  if (LooksLikeIntersectingCross(usableStrokes, box, tolerance)) return 'cross';
  const polygonRecognition = RecognizePolygonByRdpCorners(usableStrokes, rawPoints, box, strictness);
  if (polygonRecognition) return polygonRecognition;
  if (LooksLikeCross(usableStrokes, rawPoints, box, tolerance)) return 'cross';

  const candidate = NormalizeGesture(usableStrokes);
  let best: { shape: ShapeId; score: number } | null = null;

  for (const template of gestureTemplates) {
    if (template.shape === 'square' || template.shape === 'triangle') continue;
    for (const variant of template.variants) {
      const strokePenalty = Math.abs(usableStrokes.length - template.strokeCount) * 0.08;
      const distanceScore = PathDistance(candidate, variant) / (recognizerSize * 0.48);
      const score = Math.max(0, 1 - distanceScore - strokePenalty);
      if (!best || score > best.score) {
        best = { shape: template.shape, score };
      }
    }
  }

  const threshold = 0.42 + strictness * 0.0025;
  const adjustedThreshold =
    best?.shape === 'cross'
      ? threshold - 0.06
      : threshold;
  return best && best.score >= adjustedThreshold ? best.shape : null;
}

function ShapeTolerance(strictness: number): number {
  return 1 - Clamp(strictness, 0, 100) / 100;
}

function LooksLikeCircle(points: Point[], strictness: number): boolean {
  if (points.length < 12) return false;
  const box = GetBox(points);
  const width = box.maxX - box.minX;
  const height = box.maxY - box.minY;
  const maxSize = Math.max(width, height);
  const minSize = Math.min(width, height);
  if (maxSize < 24 || minSize / Math.max(1, maxSize) < 0.45) return false;

  const strictnessRatio = strictness / 100;
  const closedness = Distance(points[0], points[points.length - 1]) / Math.max(1, maxSize);
  const area = PolygonArea(points);
  const areaRatio = area / Math.max(1, width * height);
  const perimeter = PathLength(points) + Distance(points[points.length - 1], points[0]);
  const circularity = 4 * Math.PI * area / Math.max(1, perimeter * perimeter);
  const radialVariation = RadialCoefficientOfVariation(points, box);
  const simplified = Simplify(points, Math.max(4, maxSize * 0.045));
  const corners = CountCorners(simplified);
  const closureLimit = 0.5 - strictnessRatio * 0.18;
  const radialLimit = 0.42 - strictnessRatio * 0.14;
  const circularityFloor = 0.58 + strictness * 0.0012;

  return (
    closedness <= closureLimit &&
    areaRatio >= 0.48 &&
    areaRatio <= 0.95 &&
    circularity >= circularityFloor &&
    radialVariation <= radialLimit &&
    (corners >= 5 || simplified.length >= 7)
  );
}

interface GestureTemplate {
  shape: ShapeId;
  strokeCount: number;
  variants: Point[][];
}

const gestureTemplates: GestureTemplate[] = CreateGestureTemplates();

function CreateGestureTemplates(): GestureTemplate[] {
  const rawTemplates: Array<{ shape: ShapeId; strokes: Point[][] }> = [
    {
      shape: 'circle',
      strokes: [SampleEllipse(0, 0, 50, 50, 48)],
    },
    {
      shape: 'square',
      strokes: [[
        { x: -48, y: -48 },
        { x: 48, y: -48 },
        { x: 48, y: 48 },
        { x: -48, y: 48 },
        { x: -48, y: -48 },
      ]],
    },
    {
      shape: 'square',
      strokes: [
        [{ x: -48, y: -48 }, { x: 48, y: -48 }],
        [{ x: 48, y: -48 }, { x: 48, y: 48 }],
        [{ x: 48, y: 48 }, { x: -48, y: 48 }],
        [{ x: -48, y: 48 }, { x: -48, y: -48 }],
      ],
    },
    {
      shape: 'square',
      strokes: [
        [{ x: -48, y: -48 }, { x: -48, y: 48 }],
        [{ x: -48, y: -48 }, { x: 48, y: -48 }, { x: 48, y: 48 }],
        [{ x: -48, y: 48 }, { x: 48, y: 48 }],
      ],
    },
    {
      shape: 'triangle',
      strokes: [[
        { x: 0, y: -54 },
        { x: 52, y: 46 },
        { x: -52, y: 46 },
        { x: 0, y: -54 },
      ]],
    },
    {
      shape: 'triangle',
      strokes: [
        [{ x: 0, y: -54 }, { x: 52, y: 46 }],
        [{ x: 52, y: 46 }, { x: -52, y: 46 }],
        [{ x: -52, y: 46 }, { x: 0, y: -54 }],
      ],
    },
    {
      shape: 'cross',
      strokes: [
        [{ x: -50, y: -50 }, { x: 50, y: 50 }],
        [{ x: 50, y: -50 }, { x: -50, y: 50 }],
      ],
    },
    {
      shape: 'cross',
      strokes: [[
        { x: -50, y: -50 },
        { x: 50, y: 50 },
        { x: 50, y: -50 },
        { x: -50, y: 50 },
      ]],
    },
    {
      shape: 'vertical-line',
      strokes: [[{ x: 0, y: -55 }, { x: 0, y: 55 }]],
    },
    {
      shape: 'horizontal-line',
      strokes: [[{ x: -55, y: 0 }, { x: 55, y: 0 }]],
    },
  ];

  return rawTemplates.map((template) => ({
    shape: template.shape,
    strokeCount: template.strokes.length,
    variants: GenerateStrokeVariants(template.strokes).map(NormalizeGesture),
  }));
}

function GenerateStrokeVariants(strokes: Point[][]): Point[][][] {
  const orders = Permutations(strokes);
  const variants: Point[][][] = [];
  orders.forEach((orderedStrokes) => {
    const directionCount = 2 ** orderedStrokes.length;
    for (let mask = 0; mask < directionCount; mask += 1) {
      variants.push(orderedStrokes.map((stroke, index) => {
        const shouldReverse = (mask & (1 << index)) !== 0;
        return shouldReverse ? [...stroke].reverse() : stroke;
      }));
    }
  });
  return variants;
}

function Permutations<T>(items: T[]): T[][] {
  if (items.length <= 1) return [items];
  const result: T[][] = [];
  items.forEach((item, index) => {
    const rest = [...items.slice(0, index), ...items.slice(index + 1)];
    Permutations(rest).forEach((permutation) => result.push([item, ...permutation]));
  });
  return result;
}

function NormalizeGesture(strokes: Point[][]): Point[] {
  const points = ResamplePath(strokes.flatMap((stroke) => stroke), recognizerPoints);
  const box = GetBox(points);
  const width = Math.max(1, box.maxX - box.minX);
  const height = Math.max(1, box.maxY - box.minY);
  const scale = recognizerSize / Math.max(width, height);
  const scaled = points.map((point) => ({
    x: (point.x - box.minX) * scale,
    y: (point.y - box.minY) * scale,
  }));
  const center = Centroid(scaled);
  return scaled.map((point) => ({
    x: point.x - center.x,
    y: point.y - center.y,
  }));
}

function ResamplePath(points: Point[], targetCount: number): Point[] {
  if (points.length === 0) return [];
  const interval = PathLength(points) / Math.max(1, targetCount - 1);
  const result: Point[] = [{ ...points[0] }];
  let accumulated = 0;
  let previous = points[0];

  for (let i = 1; i < points.length; i += 1) {
    let current = points[i];
    let segmentLength = Distance(previous, current);
    while (segmentLength > 0 && accumulated + segmentLength >= interval) {
      const ratio = (interval - accumulated) / segmentLength;
      const inserted = {
        x: previous.x + ratio * (current.x - previous.x),
        y: previous.y + ratio * (current.y - previous.y),
      };
      result.push(inserted);
      previous = inserted;
      segmentLength = Distance(previous, current);
      accumulated = 0;
    }
    accumulated += segmentLength;
    previous = current;
  }

  while (result.length < targetCount) {
    result.push({ ...points[points.length - 1] });
  }
  return result.slice(0, targetCount);
}

function PathDistance(a: Point[], b: Point[]): number {
  const count = Math.min(a.length, b.length);
  if (count === 0) return Infinity;
  let sum = 0;
  for (let i = 0; i < count; i += 1) {
    sum += Distance(a[i], b[i]);
  }
  return sum / count;
}

function Centroid(points: Point[]): Point {
  const sum = points.reduce((acc, point) => ({ x: acc.x + point.x, y: acc.y + point.y }), { x: 0, y: 0 });
  return { x: sum.x / Math.max(1, points.length), y: sum.y / Math.max(1, points.length) };
}

function SampleEllipse(cx: number, cy: number, rx: number, ry: number, count: number): Point[] {
  const points: Point[] = [];
  for (let i = 0; i <= count; i += 1) {
    const angle = (Math.PI * 2 * i) / count;
    points.push({ x: cx + Math.cos(angle) * rx, y: cy + Math.sin(angle) * ry });
  }
  return points;
}

function RecognizePolygonByRdpCorners(
  strokes: Point[][],
  points: Point[],
  box: ReturnType<typeof GetBox>,
  strictness: number,
): ShapeId | null {
  const corners = GetRdpPolygonCorners(strokes, points, box, strictness);
  if (corners.length === 3) return 'triangle';
  if (corners.length === 4) return 'square';
  return null;
}

function GetRdpPolygonCorners(
  strokes: Point[][],
  points: Point[],
  box: ReturnType<typeof GetBox>,
  strictness: number,
): Point[] {
  if (points.length < 6) return [];

  const width = box.maxX - box.minX;
  const height = box.maxY - box.minY;
  const maxSize = Math.max(width, height);
  const minSize = Math.min(width, height);
  const diagonal = Math.hypot(width, height);
  if (maxSize < 24 || minSize / Math.max(1, maxSize) < 0.32) return [];

  const preprocessed = FilterStationaryPoints(FlattenStrokes(strokes), rdpStationaryPointDistancePx);
  if (preprocessed.length < 6) return [];

  const simplified = Simplify(preprocessed, RdpEpsilon(strictness, diagonal));
  const closed = MergeClosedEndpoint(simplified, rdpClosedEndpointDistancePx);
  return RemoveNearlyStraightCorners(closed, rdpStraightAngleDegrees);
}

function RdpEpsilon(strictness: number, diagonal: number): number {
  return Math.max(1, diagonal) * RdpEpsilonRatio(strictness);
}

function RdpEpsilonRatio(strictness: number): number {
  const value = Clamp(strictness, minRecognitionStrictness, maxRecognitionStrictness);
  if (value <= defaultRecognitionStrictness) {
    const ratio = (defaultRecognitionStrictness - value) /
      Math.max(1, defaultRecognitionStrictness - minRecognitionStrictness);
    return defaultRdpEpsilonRatio + ratio * (maxRdpEpsilonRatio - defaultRdpEpsilonRatio);
  }

  const ratio = (value - defaultRecognitionStrictness) /
    Math.max(1, maxRecognitionStrictness - defaultRecognitionStrictness);
  return defaultRdpEpsilonRatio - ratio * (defaultRdpEpsilonRatio - minRdpEpsilonRatio);
}

function FilterStationaryPoints(points: Point[], minDistance: number): Point[] {
  if (points.length === 0) return [];

  const filtered: Point[] = [points[0]];
  for (let i = 1; i < points.length; i += 1) {
    if (Distance(points[i], filtered[filtered.length - 1]) >= minDistance) {
      filtered.push(points[i]);
    }
  }
  return filtered;
}

function MergeClosedEndpoint(points: Point[], closeDistance: number): Point[] {
  if (points.length < 3) return points;
  const first = points[0];
  const last = points[points.length - 1];
  if (Distance(first, last) > closeDistance) return points;

  return [
    { x: (first.x + last.x) / 2, y: (first.y + last.y) / 2 },
    ...points.slice(1, -1),
  ];
}

function RemoveNearlyStraightCorners(points: Point[], straightAngle: number): Point[] {
  const corners = [...points];
  let changed = true;

  while (changed && corners.length > 2) {
    changed = false;
    for (let i = 0; i < corners.length; i += 1) {
      const previous = corners[(i - 1 + corners.length) % corners.length];
      const current = corners[i];
      const next = corners[(i + 1) % corners.length];
      if (Angle(previous, current, next) > straightAngle) {
        corners.splice(i, 1);
        changed = true;
        break;
      }
    }
  }

  return corners;
}

function LooksLikeCross(strokes: Point[][], points: Point[], box: ReturnType<typeof GetBox>, tolerance: number): boolean {
  const center = { x: (box.minX + box.maxX) / 2, y: (box.minY + box.maxY) / 2 };
  const lineStrokes = strokes
    .map(GetStrokeLineFeatures)
    .filter((stroke): stroke is StrokeLineFeatures => stroke !== null && stroke.straightness > 0.56 - tolerance * 0.18);
  if (lineStrokes.length >= 2) {
    for (let i = 0; i < lineStrokes.length; i += 1) {
      for (let j = i + 1; j < lineStrokes.length; j += 1) {
        const diff = AngleDifference(lineStrokes[i].angle, lineStrokes[j].angle);
        const bothDiagonal = IsDiagonal(lineStrokes[i].angle, tolerance) && IsDiagonal(lineStrokes[j].angle, tolerance);
        const bothCrossCenter = LinePassesNearCenter(lineStrokes[i], center, box, tolerance) && LinePassesNearCenter(lineStrokes[j], center, box, tolerance);
        if (bothDiagonal && bothCrossCenter && diff > 42 - tolerance * 16 && diff < 138 + tolerance * 16) {
          return true;
        }
      }
    }
  }

  const quadrants = new Set<string>();
  let positive = 0;
  let negative = 0;
  for (let i = 1; i < points.length; i += 1) {
    const dx = points[i].x - points[i - 1].x;
    const dy = points[i].y - points[i - 1].y;
    if (Math.abs(dx) < 2 || Math.abs(dy) < 2) continue;
    if (dx * dy > 0) positive += 1;
    else negative += 1;
  }
  points.forEach((point) => quadrants.add(`${point.x > center.x ? 'r' : 'l'}${point.y > center.y ? 'b' : 't'}`));
  return quadrants.size >= 4 && positive > 1 && negative > 1 && Math.min(positive, negative) / Math.max(positive, negative) > 0.12 - tolerance * 0.08;
}

function LooksLikeIntersectingCross(strokes: Point[][], box: ReturnType<typeof GetBox>, tolerance: number): boolean {
  const width = box.maxX - box.minX;
  const height = box.maxY - box.minY;
  const maxSize = Math.max(width, height);
  const center = { x: (box.minX + box.maxX) / 2, y: (box.minY + box.maxY) / 2 };
  const strokeLines = strokes
    .map(GetStrokeLineFeatures)
    .filter((stroke): stroke is StrokeLineFeatures => stroke !== null && stroke.straightness > 0.58 - tolerance * 0.16);
  const segmentLines = GetSimplifiedStrokeSegments(strokes, Math.max(4, maxSize * 0.04), Math.max(12, maxSize * 0.22));
  const diagonalLines = [...strokeLines, ...segmentLines]
    .filter((line) => IsDiagonal(line.angle, tolerance) && Distance(line.first, line.last) >= maxSize * (0.36 - tolerance * 0.06));
  const centerLimit = maxSize * (0.26 + tolerance * 0.08);
  const minInternalRatio = 0.04 - tolerance * 0.015;

  for (let i = 0; i < diagonalLines.length - 1; i += 1) {
    for (let j = i + 1; j < diagonalLines.length; j += 1) {
      const first = diagonalLines[i];
      const second = diagonalLines[j];
      const diff = AngleDifference(first.angle, second.angle);
      if (diff < 48 - tolerance * 12 || diff > 132 + tolerance * 12) continue;

      const intersection = LineIntersection(first.first, first.last, second.first, second.last);
      if (!intersection) continue;
      if (Distance(intersection, center) > centerLimit) continue;
      if (!PointInsideSegment(intersection, first.first, first.last, maxSize * 0.04)) continue;
      if (!PointInsideSegment(intersection, second.first, second.last, maxSize * 0.04)) continue;
      if (!PointIsInternalToSegment(intersection, first.first, first.last, minInternalRatio)) continue;
      if (!PointIsInternalToSegment(intersection, second.first, second.last, minInternalRatio)) continue;

      return true;
    }
  }

  return false;
}

interface StrokeLineFeatures {
  angle: number;
  first: Point;
  last: Point;
  straightness: number;
}

function FlattenStrokes(strokes: Point[][]): Point[] {
  return strokes.flatMap((stroke) => stroke);
}

function StrokesPathLength(strokes: Point[][]): number {
  return strokes.reduce((sum, stroke) => sum + PathLength(stroke), 0);
}

function GetStrokeLineFeatures(stroke: Point[]): StrokeLineFeatures | null {
  if (stroke.length < 2) return null;
  const first = stroke[0];
  const last = stroke[stroke.length - 1];
  const length = PathLength(stroke);
  if (length < 12) return null;
  const angle = NormalizeAngle(Math.atan2(last.y - first.y, last.x - first.x) * 180 / Math.PI);
  return {
    angle,
    first,
    last,
    straightness: Distance(first, last) / Math.max(1, length),
  };
}

function GetSimplifiedStrokeSegments(strokes: Point[][], epsilon: number, minLength: number): StrokeLineFeatures[] {
  const segments: StrokeLineFeatures[] = [];
  strokes.forEach((stroke) => {
    const simplified = Simplify(stroke, epsilon);
    for (let i = 1; i < simplified.length; i += 1) {
      const first = simplified[i - 1];
      const last = simplified[i];
      const segmentLength = Distance(first, last);
      if (segmentLength < minLength) continue;
      segments.push({
        angle: NormalizeAngle(Math.atan2(last.y - first.y, last.x - first.x) * 180 / Math.PI),
        first,
        last,
        straightness: 1,
      });
    }
  });
  return segments;
}

function LineIntersection(aStart: Point, aEnd: Point, bStart: Point, bEnd: Point): Point | null {
  const denominator =
    (aStart.x - aEnd.x) * (bStart.y - bEnd.y) -
    (aStart.y - aEnd.y) * (bStart.x - bEnd.x);
  if (Math.abs(denominator) < 0.01) return null;

  const aCross = aStart.x * aEnd.y - aStart.y * aEnd.x;
  const bCross = bStart.x * bEnd.y - bStart.y * bEnd.x;
  return {
    x: (aCross * (bStart.x - bEnd.x) - (aStart.x - aEnd.x) * bCross) / denominator,
    y: (aCross * (bStart.y - bEnd.y) - (aStart.y - aEnd.y) * bCross) / denominator,
  };
}

function PointInsideSegment(point: Point, start: Point, end: Point, margin: number): boolean {
  return (
    point.x >= Math.min(start.x, end.x) - margin &&
    point.x <= Math.max(start.x, end.x) + margin &&
    point.y >= Math.min(start.y, end.y) - margin &&
    point.y <= Math.max(start.y, end.y) + margin
  );
}

function PointIsInternalToSegment(point: Point, start: Point, end: Point, minRatio: number): boolean {
  const ratio = SegmentProjectionRatio(point, start, end);
  return ratio >= minRatio && ratio <= 1 - minRatio;
}

function SegmentProjectionRatio(point: Point, start: Point, end: Point): number {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const lengthSquared = dx * dx + dy * dy;
  if (lengthSquared < 1) return 0;
  return ((point.x - start.x) * dx + (point.y - start.y) * dy) / lengthSquared;
}

function NormalizeAngle(angle: number): number {
  const normalized = ((angle % 180) + 180) % 180;
  return normalized;
}

function AngleDifference(a: number, b: number): number {
  const diff = Math.abs(a - b);
  return Math.min(diff, 180 - diff);
}

function IsDiagonal(angle: number, tolerance: number): boolean {
  return Math.abs(angle - 45) < 34 + tolerance * 18 || Math.abs(angle - 135) < 34 + tolerance * 18;
}

function LinePassesNearCenter(line: StrokeLineFeatures, center: Point, box: ReturnType<typeof GetBox>, tolerance: number): boolean {
  const width = box.maxX - box.minX;
  const height = box.maxY - box.minY;
  const maxSize = Math.max(width, height);
  const margin = maxSize * (0.08 + tolerance * 0.05);
  const minX = Math.min(line.first.x, line.last.x) - margin;
  const maxX = Math.max(line.first.x, line.last.x) + margin;
  const minY = Math.min(line.first.y, line.last.y) - margin;
  const maxY = Math.max(line.first.y, line.last.y) + margin;
  if (center.x < minX || center.x > maxX || center.y < minY || center.y > maxY) return false;
  return PerpendicularDistance(center, line.first, line.last) <= maxSize * (0.16 + tolerance * 0.08);
}

function Simplify(points: Point[], epsilon: number): Point[] {
  if (points.length < 3) return points;
  const first = points[0];
  const last = points[points.length - 1];
  let maxDistance = 0;
  let index = 0;
  for (let i = 1; i < points.length - 1; i += 1) {
    const d = PerpendicularDistance(points[i], first, last);
    if (d > maxDistance) {
      index = i;
      maxDistance = d;
    }
  }
  if (maxDistance > epsilon) {
    const left = Simplify(points.slice(0, index + 1), epsilon);
    const right = Simplify(points.slice(index), epsilon);
    return left.slice(0, -1).concat(right);
  }
  return [first, last];
}

function CountCorners(points: Point[]): number {
  let corners = 0;
  for (let i = 1; i < points.length - 1; i += 1) {
    const a = Angle(points[i - 1], points[i], points[i + 1]);
    if (a < 135) corners += 1;
  }
  return corners;
}

function Angle(a: Point, b: Point, c: Point): number {
  const ab = { x: a.x - b.x, y: a.y - b.y };
  const cb = { x: c.x - b.x, y: c.y - b.y };
  const dot = ab.x * cb.x + ab.y * cb.y;
  const mag = Math.hypot(ab.x, ab.y) * Math.hypot(cb.x, cb.y);
  return Math.acos(Math.max(-1, Math.min(1, dot / Math.max(mag, 1)))) * 180 / Math.PI;
}

function PerpendicularDistance(point: Point, lineStart: Point, lineEnd: Point): number {
  const dx = lineEnd.x - lineStart.x;
  const dy = lineEnd.y - lineStart.y;
  if (dx === 0 && dy === 0) return Distance(point, lineStart);
  return Math.abs(dy * point.x - dx * point.y + lineEnd.x * lineStart.y - lineEnd.y * lineStart.x) / Math.hypot(dx, dy);
}

function PathLength(points: Point[]): number {
  return points.slice(1).reduce((sum, point, index) => sum + Distance(points[index], point), 0);
}

function Distance(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function GetBox(points: Point[]) {
  return points.reduce(
    (box, point) => ({
      minX: Math.min(box.minX, point.x),
      maxX: Math.max(box.maxX, point.x),
      minY: Math.min(box.minY, point.y),
      maxY: Math.max(box.maxY, point.y),
    }),
    { minX: Infinity, maxX: -Infinity, minY: Infinity, maxY: -Infinity },
  );
}

function PolygonArea(points: Point[]): number {
  if (points.length < 3) return 0;
  let area = 0;
  for (let i = 0; i < points.length; i += 1) {
    const next = points[(i + 1) % points.length];
    area += points[i].x * next.y - next.x * points[i].y;
  }
  return Math.abs(area) / 2;
}

function RadialCoefficientOfVariation(points: Point[], box: ReturnType<typeof GetBox>): number {
  const cx = (box.minX + box.maxX) / 2;
  const cy = (box.minY + box.maxY) / 2;
  const distances = points.map((point) => Math.hypot(point.x - cx, point.y - cy));
  const mean = distances.reduce((sum, value) => sum + value, 0) / Math.max(1, distances.length);
  const variance = distances.reduce((sum, value) => sum + (value - mean) ** 2, 0) / Math.max(1, distances.length);
  return Math.sqrt(variance) / Math.max(1, mean);
}

function ToCsv(records: SessionRecord[], t: TFunction): string {
  const columns: Array<{ label: string; value: (record: SessionRecord, enemyResult: EnemyResult | null) => unknown }> = [
    { label: t('drawing.csv.testDate'), value: (record) => record.Test_Date },
    { label: 'Participant_ID', value: (record) => record.Participant_ID },
    { label: 'Difficulty', value: (record) => record.Difficulty },
    { label: 'Game_Time_Seconds', value: (record) => record.Game_Time_Seconds ?? t('training.infinite') },
    { label: 'Starting_HP', value: (record) => record.Starting_HP },
    { label: 'Enemy_Speed', value: (record) => record.Enemy_Speed },
    { label: 'Recognition_Strictness', value: (record) => record.Recognition_Strictness },
    { label: 'Stroke_Wait_Milliseconds', value: (record) => record.Stroke_Wait_Milliseconds },
    { label: 'Total_Duration_Seconds', value: (record) => record.Total_Duration_Seconds },
    { label: 'Enemies_Spawned', value: (record) => record.Enemies_Spawned },
    { label: 'Enemies_Defeated', value: (record) => record.Enemies_Defeated },
    { label: 'HP_Remaining', value: (record) => record.HP_Remaining },
    { label: 'Game_Result', value: (record) => record.Game_Result },
    { label: 'Enemy_Number', value: (_record, enemyResult) => enemyResult?.Enemy_Number ?? '' },
    { label: 'Enemy_Shape', value: (_record, enemyResult) => enemyResult ? GetShapeLabel(enemyResult.Shape, t) : '' },
    { label: 'Enemy_Reaction_Time_Seconds', value: (_record, enemyResult) => enemyResult?.Reaction_Time_Seconds ?? '' },
    { label: 'Enemy_Defeated', value: (_record, enemyResult) => enemyResult?.Defeated ?? '' },
  ];
  const rows = records.flatMap((record) => {
    const enemyResults = record.Enemy_Results.length > 0 ? record.Enemy_Results : [null];
    return enemyResults.map((enemyResult) => columns.map((column) => csvCell(column.value(record, enemyResult))).join(','));
  });
  return [columns.map((column) => column.label).join(','), ...rows].join('\n');
}

function FormatGameDuration(duration: GameDurationSeconds, t: TFunction): string {
  return duration === null ? t('drawing.config.infiniteMode') : t('training.secondsShort', { value: duration });
}

function FormatSeconds(value: number, t: TFunction): string {
  return t('training.secondsShort', { value });
}

function GetShapeLabel(shape: ShapeId, t: TFunction): string {
  return t(shapeLabelKeys[shape]);
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

// Canonical Hub-owned oculomotor runtime.
/**
 * jsPsych Custom Plugin: pixi-oculomotor-training
 *
 * PixiJS recreation of the FoveaFlow-style continuous eye movement trainer.
 * A single jsPsych trial is one timed training session.
 */
import { JsPsych, ParameterType } from 'jspsych';
import type { JsPsychPlugin, TrialType } from 'jspsych';
import { Application, Graphics, Sprite, Text, Texture } from 'pixi.js';
import { pixiColors, typography } from '../../theme';
import {
  AttachPixiTrialCanvas,
  CleanupPixiTrial,
  CreatePixiTrialContainer,
  RunPixiTrial,
  pixiRuntimeScopes,
} from '../../utils/pixiPool';
import { PixelFromDegree } from '../../utils/spatialUtils';
import {
  CalculateEyeAspectRatio,
  CreateBlinkDetectorState,
  CreateOculomotorGazeSample,
  EstimatePupilSizePx,
  oculomotorGazeSampleColumns,
  SummarizeOculomotorGazeSamples,
  UpdateBlinkDetector,
} from '../../utils/webgazerMetrics';
import type {
  FaceLandmark,
  OculomotorGazeSample,
  WebGazerEyeFeaturesLike,
} from '../../utils/webgazerMetrics';
import { createRng } from '../../pages/training/oculomotor/random';
import { sampleOculomotorPatternInto } from '../../pages/training/oculomotor/patterns';
import type { Arena, OculomotorMode, OculomotorPattern, OculomotorTargetShape, TargetFrame } from '../../pages/training/oculomotor/types';
import { getOculomotorModeLabel, getOculomotorPatternLabel } from '../../pages/training/oculomotor/presets';

const info = {
  name: 'pixi-oculomotor-training',
  version: '1.0.0',
  parameters: {
    mode: {
      type: ParameterType.STRING,
      default: 'pursuit',
    },
    pattern: {
      type: ParameterType.STRING,
      default: 'randomWalk',
    },
    duration_ms: {
      type: ParameterType.INT,
      default: 60_000,
    },
    speed_px_per_sec: {
      type: ParameterType.FLOAT,
      default: 260,
    },
    target_radius_px: {
      type: ParameterType.FLOAT,
      default: 26,
    },
    distractor_count: {
      type: ParameterType.INT,
      default: 5,
    },
    target_color: {
      type: ParameterType.STRING,
      default: '#3FB950',
    },
    background_color: {
      type: ParameterType.STRING,
      default: '#0D1117',
    },
    target_shape: {
      type: ParameterType.STRING,
      default: 'circle',
    },
    custom_target_image: {
      type: ParameterType.STRING,
      default: '',
    },
    opacity: {
      type: ParameterType.FLOAT,
      default: 1.0,
    },
    background_image: {
      type: ParameterType.STRING,
      default: '',
    },
    audio: {
      type: ParameterType.STRING,
      default: '',
    },
    bounce_jitter: {
      type: ParameterType.INT,
      default: 0,
    },
    round_number: {
      type: ParameterType.INT,
      default: 1,
    },
    total_rounds: {
      type: ParameterType.INT,
      default: 1,
    },
    enable_webgazer: {
      type: ParameterType.BOOL,
      default: false,
    },
    show_gaze_point: {
      type: ParameterType.BOOL,
      default: false,
    },
  },
  data: {
    rt: { type: ParameterType.INT },
    correct: { type: ParameterType.BOOL },
    target: { type: ParameterType.STRING },
    response: { type: ParameterType.STRING },
    mode: { type: ParameterType.STRING },
    pattern: { type: ParameterType.STRING },
    acquired_targets: { type: ParameterType.INT },
    average_fps: { type: ParameterType.FLOAT },
    duration_ms: { type: ParameterType.INT },
    aoi_score: { type: ParameterType.INT },
    mean_target_distance_px: { type: ParameterType.FLOAT },
    target_distance_sd_px: { type: ParameterType.FLOAT },
    time_to_first_fixation_ms: { type: ParameterType.INT },
    average_pupil_size_px: { type: ParameterType.FLOAT },
    blink_count: { type: ParameterType.INT },
    gaze_sample_count: { type: ParameterType.INT },
    gaze_sampling_interval_ms: { type: ParameterType.INT },
    fixation_radius_px: { type: ParameterType.FLOAT },
    fixation_duration_ms: { type: ParameterType.INT },
    gaze_sample_columns: { type: ParameterType.STRING, array: true },
    gaze_samples: { type: ParameterType.COMPLEX, array: true },
  },
} as const;

type Info = typeof info;

interface SafeAreaInsets {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

interface WebGazerPrediction {
  x: number;
  y: number;
  eyeFeatures?: WebGazerEyeFeaturesLike;
}

interface WebGazerRuntimeLike {
  clearGazeListener?: () => unknown;
  getTracker?: () => { getPositions?: () => readonly FaceLandmark[] | null };
  pause?: () => unknown;
  resume?: () => unknown;
  setGazeListener?: (
    callback: (prediction: WebGazerPrediction | null) => void,
  ) => unknown;
  showPredictionPoints?: (show: boolean) => unknown;
}

interface WebGazerExtensionLike {
  hidePredictions?: () => void;
  pause?: () => void;
  resume?: () => void;
  showPredictions?: () => void;
}

const lilacDotCount = 12;
const fullCircle = Math.PI * 2;
const oculomotorPixiScope = pixiRuntimeScopes.oculomotor;
const oculomotorContainerStyle = 'width:100%;height:100%;position:absolute;top:0;left:0;overflow:hidden;background:#0D1117;';
const gazeSamplingIntervalMs = 100;
const minimumFixationDurationMs = 100;
const maximumGazeSampleCount = 3500;

function RoundToTenth(value: number | null): number | null {
  return value === null ? null : Math.round(value * 10) / 10;
}

function CreateSafeAreaProbe(container: HTMLElement): HTMLDivElement {
  const probe = document.createElement('div');
  probe.setAttribute('aria-hidden', 'true');
  probe.style.cssText = 'position:absolute;visibility:hidden;pointer-events:none;padding:env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left);';
  container.appendChild(probe);
  return probe;
}

function ReadSafeAreaInsets(probe: HTMLElement): SafeAreaInsets {
  const style = window.getComputedStyle(probe);
  return {
    top: parseFloat(style.paddingTop) || 0,
    right: parseFloat(style.paddingRight) || 0,
    bottom: parseFloat(style.paddingBottom) || 0,
    left: parseFloat(style.paddingLeft) || 0,
  };
}

const modeTitle: Record<OculomotorMode, string> = {
  pursuit: '眼動訓練 · 追視',
  'reaction-jumps': '眼動訓練 · 跳視',
  'multi-object': '眼動訓練 · 多目標追蹤',
  'lilac-chaser': '眼動訓練 · 周邊固視',
};

const drawTargetShape = (
  gfx: Graphics,
  frame: TargetFrame,
  isReactionFlash: boolean,
  shape: OculomotorTargetShape,
  backgroundColor: number,
) => {
  const outer = frame.radiusPx;
  const inner = Math.max(2, outer * 0.42);
  const ringColor = frame.role === 'target' ? 0xffffff : pixiColors.borderHover;

  drawShape(gfx, shape, frame.x, frame.y, outer, frame.color, frame.alpha);

  if (shape === 'circle') {
    gfx.circle(frame.x, frame.y, inner).fill({
      color: backgroundColor,
      alpha: frame.role === 'target' ? 0.18 : 0.45,
    });
  }

  if (frame.role === 'target') {
    strokeShape(gfx, shape, frame.x, frame.y, outer, isReactionFlash ? pixiColors.success : ringColor, isReactionFlash ? 4 : 2);
  }
};

const drawShape = (
  gfx: Graphics,
  shape: OculomotorTargetShape,
  x: number,
  y: number,
  radius: number,
  color: number,
  alpha: number,
) => {
  if (shape === 'square') {
    gfx.rect(x - radius, y - radius, radius * 2, radius * 2).fill({ color, alpha });
    return;
  }
  if (shape === 'triangle') {
    gfx.poly([
      x, y - radius,
      x + radius * 0.95, y + radius * 0.72,
      x - radius * 0.95, y + radius * 0.72,
    ]).fill({ color, alpha });
    return;
  }
  if (shape === 'cross') {
    const arm = Math.max(3, radius * 0.42);
    gfx
      .rect(x - arm / 2, y - radius, arm, radius * 2)
      .fill({ color, alpha })
      .rect(x - radius, y - arm / 2, radius * 2, arm)
      .fill({ color, alpha });
    return;
  }
  if (shape === 'star') {
    const points: number[] = [];
    for (let i = 0; i < 10; i += 1) {
      const angle = -Math.PI / 2 + (i * Math.PI) / 5;
      const r = i % 2 === 0 ? radius : radius * 0.46;
      points.push(x + Math.cos(angle) * r, y + Math.sin(angle) * r);
    }
    gfx.poly(points).fill({ color, alpha });
    return;
  }
  gfx.circle(x, y, radius).fill({ color, alpha });
};

const strokeShape = (
  gfx: Graphics,
  shape: OculomotorTargetShape,
  x: number,
  y: number,
  radius: number,
  color: number,
  width: number,
) => {
  if (shape === 'square') {
    gfx.rect(x - radius, y - radius, radius * 2, radius * 2).stroke({
      color,
      width,
      alpha: 0.88,
    });
    return;
  }
  if (shape === 'triangle') {
    gfx.poly([
      x, y - radius,
      x + radius * 0.95, y + radius * 0.72,
      x - radius * 0.95, y + radius * 0.72,
    ]).stroke({ color, width, alpha: 0.88 });
    return;
  }
  if (shape === 'cross') {
    const arm = Math.max(3, radius * 0.42);
    gfx
      .rect(x - arm / 2, y - radius, arm, radius * 2)
      .stroke({ color, width, alpha: 0.88 })
      .rect(x - radius, y - arm / 2, radius * 2, arm)
      .stroke({ color, width, alpha: 0.88 });
    return;
  }
  if (shape === 'star') {
    const points: number[] = [];
    for (let i = 0; i < 10; i += 1) {
      const angle = -Math.PI / 2 + (i * Math.PI) / 5;
      const r = i % 2 === 0 ? radius : radius * 0.46;
      points.push(x + Math.cos(angle) * r, y + Math.sin(angle) * r);
    }
    gfx.poly(points).stroke({ color, width, alpha: 0.88 });
    return;
  }
  gfx.circle(x, y, radius).stroke({
      color,
      width,
      alpha: 0.88,
  });
};

const parseCssHexColor = (value: unknown, fallback: number): number => {
  if (typeof value !== 'string') return fallback;
  const match = value.trim().match(/^#?([0-9a-fA-F]{6})$/);
  if (!match) return fallback;
  return parseInt(match[1], 16);
};

const parseTargetShape = (value: unknown): OculomotorTargetShape => {
  return ['circle', 'star', 'square', 'cross', 'triangle', 'custom'].includes(String(value))
    ? value as OculomotorTargetShape
    : 'circle';
};

class PixiOculomotorTrainingPlugin implements JsPsychPlugin<Info> {
  static info = info;

  constructor(private jsPsych: JsPsych) {}

  trial(displayElement: HTMLElement, trial: TrialType<Info>): void {
    const self = this;
    const wrapper = CreatePixiTrialContainer(
      displayElement,
      oculomotorContainerStyle,
      'oculomotor-training-trial',
    );
    const safeAreaProbe = CreateSafeAreaProbe(wrapper);
    const pauseButton = document.createElement('button');
    pauseButton.type = 'button';
    pauseButton.className = 'oculomotor-pause-button';
    pauseButton.textContent = 'Ⅱ';
    pauseButton.setAttribute('aria-label', '暫停訓練');
    wrapper.appendChild(pauseButton);

    const mode = trial.mode as OculomotorMode;
    const pattern = trial.pattern as OculomotorPattern;
    const durationMs = Math.max(5_000, trial.duration_ms as number);
    const speedPxPerSec = Math.max(20, trial.speed_px_per_sec as number);
    const radiusPx = Math.max(6, trial.target_radius_px as number);
    const distractorCount = Math.max(0, trial.distractor_count as number);
    const targetColor = parseCssHexColor(trial.target_color, pixiColors.success);
    const backgroundColor = parseCssHexColor(trial.background_color, pixiColors.bg);
    const targetShape = parseTargetShape(trial.target_shape);
    const customTargetImage = typeof trial.custom_target_image === 'string'
      ? trial.custom_target_image
      : '';
    const opacity = Math.max(0.1, Math.min(1.0, trial.opacity as number));
    const backgroundImage = typeof trial.background_image === 'string' ? trial.background_image : '';
    const customAudio = typeof trial.audio === 'string' ? trial.audio : '';
    const bounceJitter = Math.max(0, trial.bounce_jitter as number);
    const rng = createRng(Math.floor(Math.random() * 2_147_483_646) + 1);
    let ended = false;
    let paused = false;
    let pauseStartedAt = 0;
    let pausedMs = 0;
    let acquiredTargets = 0;
    let frameCount = 0;
    let fpsAccumulator = 0;
    let lastFpsTimestamp = performance.now();
    let flashUntil = 0;

    const enableWebgazer = trial.enable_webgazer as boolean;
    const showGazePoint = enableWebgazer && (trial.show_gaze_point as boolean);
    const aoiRadiusPx = PixelFromDegree(5);

    const runWithApp = (app: Application) => {
      AttachPixiTrialCanvas(oculomotorPixiScope, wrapper);

      const startTime = performance.now();
      const bgGfx = new Graphics();
      const guideGfx = new Graphics();
      const targetGfx = new Graphics();
      const hudGfx = new Graphics();
      const lilacGfx = new Graphics();
      const titleText = new Text();
      const metaText = new Text();
      const timeText = new Text();
      const exitText = new Text();
      const reactionLetter = new Text();
      const frames: TargetFrame[] = [];
      const targetSprites: Sprite[] = [];
      const customTexture = targetShape === 'custom' && customTargetImage
        ? Texture.from(customTargetImage)
        : null;

      let latestTarget: TargetFrame | null = null;
      let hudVisible = false;

      app.stage.addChild(bgGfx, guideGfx, lilacGfx, targetGfx, reactionLetter, hudGfx, titleText, metaText, timeText, exitText);

      let audioElement: HTMLAudioElement | null = null;
      if (customAudio) {
        audioElement = new Audio(customAudio);
        audioElement.loop = true;
        audioElement.volume = 0.5; // Adjust as needed or from settings
        audioElement.play().catch((err) => console.warn('Could not play audio automatically', err));
      }

      let bgSprite: Sprite | null = null;
      if (backgroundImage) {
        bgSprite = new Sprite(Texture.from(backgroundImage));
        app.stage.addChildAt(bgSprite, 1); // Insert right after bgGfx
      }

      titleText.style = {
        fontFamily: typography.fontFamily,
        fontSize: typography.fontSizeL,
        fontWeight: '700',
        fill: pixiColors.textPrimary,
      };
      metaText.style = {
        fontFamily: typography.fontFamily,
        fontSize: typography.fontSizeS,
        fill: pixiColors.textSecondary,
      };
      timeText.style = {
        fontFamily: typography.fontFamily,
        fontSize: typography.fontSizeM,
        fontWeight: '700',
        fill: pixiColors.accentHover,
      };
      exitText.style = {
        fontFamily: typography.fontFamily,
        fontSize: typography.fontSizeS,
        fontWeight: '700',
        fill: pixiColors.textPrimary,
      };
      reactionLetter.style = {
        fontFamily: typography.fontFamily,
        fontSize: Math.max(18, radiusPx * 0.92),
        fontWeight: '800',
        fill: backgroundColor,
      };
      reactionLetter.anchor.set(0.5);

      titleText.text = modeTitle[mode] ?? '眼動訓練';
      metaText.text = mode === 'lilac-chaser'
        ? 'Lilac Chaser'
        : `${getOculomotorModeLabel(mode)} · ${getOculomotorPatternLabel(pattern)}`;

      const getArena = (): Arena => ({
        width: Math.max(1, app.screen.width),
        height: Math.max(1, app.screen.height),
      });

      const getElapsedMs = () => {
        const now = performance.now();
        const activePause = paused ? now - pauseStartedAt : 0;
        return Math.max(0, now - startTime - pausedMs - activePause);
      };

      const gazeSamples: OculomotorGazeSample[] = [];
      let blinkDetectorState = CreateBlinkDetectorState();
      let blinkObservationCount = 0;
      let pendingBlinkEvent: 0 | 1 = 0;
      let fixationSegment = 0;
      let lastGazeSampleAtMs = Number.NEGATIVE_INFINITY;
      const webGazerRuntime = (window as Window & { webgazer?: WebGazerRuntimeLike }).webgazer;
      const webGazerExtension = self.jsPsych.extensions?.webgazer as
        | WebGazerExtensionLike
        | undefined;

      const handleGazePrediction = (prediction: WebGazerPrediction | null) => {
        if (ended || paused) return;
        const timestampMs = performance.now();
        let landmarks: readonly FaceLandmark[] | null = null;
        try {
          landmarks = webGazerRuntime?.getTracker?.().getPositions?.() ?? null;
        } catch {
          landmarks = null;
        }
        const eyeAspectRatio = CalculateEyeAspectRatio(landmarks);
        if (eyeAspectRatio !== null) {
          blinkObservationCount += 1;
          const blinkUpdate = UpdateBlinkDetector(
            blinkDetectorState,
            eyeAspectRatio,
            timestampMs,
          );
          blinkDetectorState = blinkUpdate.state;
          if (blinkUpdate.blinkEvent === 1) pendingBlinkEvent = 1;
        }

        if (
          !prediction
          || !latestTarget
          || !Number.isFinite(prediction.x)
          || !Number.isFinite(prediction.y)
        ) {
          return;
        }
        const elapsedMs = Math.round(getElapsedMs());
        if (gazeSamples.length >= maximumGazeSampleCount) return;
        if (
          pendingBlinkEvent === 0
          && elapsedMs - lastGazeSampleAtMs < gazeSamplingIntervalMs
        ) return;

        const canvas = app.canvas as HTMLCanvasElement;
        const canvasRect = canvas.getBoundingClientRect();
        if (canvasRect.width <= 0 || canvasRect.height <= 0) return;
        const targetPoint = {
          x: canvasRect.left + (latestTarget.x / app.screen.width) * canvasRect.width,
          y: canvasRect.top + (latestTarget.y / app.screen.height) * canvasRect.height,
        };
        const pupilEstimate = blinkDetectorState.isClosed
          ? null
          : EstimatePupilSizePx(prediction.eyeFeatures);
        const sample = CreateOculomotorGazeSample(
          elapsedMs,
          { x: Math.round(prediction.x), y: Math.round(prediction.y) },
          { x: Math.round(targetPoint.x), y: Math.round(targetPoint.y) },
          RoundToTenth(pupilEstimate),
          pendingBlinkEvent,
          fixationSegment,
        );
        gazeSamples.push([
          sample[0],
          sample[1],
          sample[2],
          sample[3],
          sample[4],
          RoundToTenth(sample[5]) ?? 0,
          sample[6],
          sample[7],
          sample[8],
        ]);
        pendingBlinkEvent = 0;
        lastGazeSampleAtMs = elapsedMs;
      };

      const ensureTargetSprite = (index: number) => {
        if (!customTexture) return null;
        if (!targetSprites[index]) {
          const sprite = new Sprite(customTexture);
          sprite.anchor.set(0.5);
          app.stage.addChild(sprite);
          targetSprites[index] = sprite;
        }
        return targetSprites[index];
      };

      const hideTargetSprites = (fromIndex = 0) => {
        for (let i = fromIndex; i < targetSprites.length; i += 1) {
          targetSprites[i].visible = false;
        }
      };

      const drawHud = (remainingMs: number) => {
        const w = app.screen.width;
        const h = app.screen.height;
        const safeInsets = ReadSafeAreaInsets(safeAreaProbe);
        const compact = w - safeInsets.left - safeInsets.right < 560;
        const hudHeight = compact
          ? Math.max(88 + safeInsets.top, Math.min(112 + safeInsets.top, h * 0.3))
          : Math.max(58 + safeInsets.top, Math.min(82 + safeInsets.top, h * 0.12));

        hudVisible = paused;

        hudGfx.clear();
        titleText.visible = hudVisible;
        metaText.visible = hudVisible;
        timeText.visible = hudVisible;
        exitText.visible = hudVisible;

        if (!hudVisible) return;

        const buttonY = safeInsets.top + 12;
        const exitX = w - safeInsets.right - 72;

        hudGfx
          .rect(0, 0, w, hudHeight)
          .fill({ color: pixiColors.bgPanel, alpha: 0.94 })
          .rect(0, hudHeight - 1, w, 1)
          .fill({ color: pixiColors.border });

        hudGfx
          .roundRect(exitX, buttonY, 60, 44, 7)
          .fill({ color: pixiColors.bgCard })
          .stroke({ color: pixiColors.border, width: 1 });

        titleText.style.fontSize = typography.fontSizeL;
        titleText.x = safeInsets.left + 16;
        titleText.y = safeInsets.top + 8;
        metaText.x = safeInsets.left + 16;
        metaText.y = safeInsets.top + (compact ? 34 : 36);

        timeText.text = `${Math.ceil(remainingMs / 1000)}s`;
        timeText.x = compact ? safeInsets.left + 16 : Math.max(safeInsets.left + 200, w - safeInsets.right - 232);
        timeText.y = compact ? safeInsets.top + 58 : safeInsets.top + 22;

        exitText.text = '結束';
        exitText.x = exitX + 15;
        exitText.y = buttonY + 12;
      };

      const drawGuides = (arena: Arena, hudHeight: number) => {
        const cx = arena.width / 2;
        const cy = (arena.height + hudHeight) / 2;

        guideGfx.clear();

        if (mode === 'lilac-chaser') {
          guideGfx
            .rect(0, 0, arena.width, arena.height)
            .fill({ color: backgroundColor })
            .moveTo(cx - 14, cy)
            .lineTo(cx + 14, cy)
            .moveTo(cx, cy - 14)
            .lineTo(cx, cy + 14)
            .stroke({ color: 0x050505, width: 3 });
          return;
        }

        const step = 72;
        for (let x = step; x < arena.width; x += step) {
          guideGfx.moveTo(x, 0).lineTo(x, arena.height);
        }
        for (let y = step; y < arena.height; y += step) {
          guideGfx.moveTo(0, y).lineTo(arena.width, y);
        }
        guideGfx.stroke({ color: pixiColors.border, width: 1, alpha: 0.26 });
      };

      const drawLilacChaser = (arena: Arena, elapsedSec: number) => {
        const hudHeight = Math.max(58, Math.min(72, arena.height * 0.09));
        const cx = arena.width / 2;
        const cy = (arena.height + hudHeight) / 2;
        const orbit = Math.min(arena.width, arena.height - hudHeight) * 0.31;
        const dotRadius = Math.max(8, orbit * 0.13);
        const hiddenIndex = Math.floor(elapsedSec * 10) % lilacDotCount;

        lilacGfx.clear();
        for (let i = 0; i < lilacDotCount; i += 1) {
          if (i === hiddenIndex) continue;
          const angle = -Math.PI / 2 + (i / lilacDotCount) * fullCircle;
          lilacGfx
            .circle(cx + Math.cos(angle) * orbit, cy + Math.sin(angle) * orbit, dotRadius)
            .fill({ color: 0xff00fe, alpha: 0.86 });
        }
      };

      const finish = (response: string) => {
        if (ended) return;
        ended = true;
        app.ticker.remove(tick);
        app.renderer.off('resize', handleResize);
        app.stage.off('pointertap', handleStageTap);
        window.removeEventListener('keydown', handleKeydown);
        webGazerRuntime?.clearGazeListener?.();
        webGazerRuntime?.showPredictionPoints?.(false);
        webGazerRuntime?.pause?.();
        webGazerExtension?.hidePredictions?.();
        webGazerExtension?.pause?.();
        if (audioElement) {
          audioElement.pause();
          audioElement.currentTime = 0;
        }
        CleanupPixiTrial(oculomotorPixiScope, displayElement);

        const elapsed = Math.min(durationMs, Math.round(getElapsedMs()));
        const averageFps = frameCount > 0 ? fpsAccumulator / frameCount : 0;
        const gazeSummary = SummarizeOculomotorGazeSamples(gazeSamples, {
          fixationRadiusPx: aoiRadiusPx,
          minimumFixationDurationMs,
          maximumSampleGapMs: gazeSamplingIntervalMs * 2.5,
        });

        self.jsPsych.finishTrial({
          rt: elapsed,
          correct: true,
          target: modeTitle[mode] ?? mode,
          response,
          mode,
          pattern,
          acquired_targets: acquiredTargets,
          average_fps: Math.round(averageFps * 10) / 10,
          duration_ms: elapsed,
          aoi_score: enableWebgazer ? (gazeSummary.aoiScore ?? 0) : undefined,
          mean_target_distance_px: enableWebgazer
            ? RoundToTenth(gazeSummary.meanDistancePx)
            : undefined,
          target_distance_sd_px: enableWebgazer
            ? RoundToTenth(gazeSummary.distanceStandardDeviationPx)
            : undefined,
          time_to_first_fixation_ms: enableWebgazer
            ? gazeSummary.timeToFirstFixationMs
            : undefined,
          average_pupil_size_px: enableWebgazer
            ? RoundToTenth(gazeSummary.averagePupilSizePx)
            : undefined,
          blink_count: enableWebgazer
            ? (blinkObservationCount > 0 ? gazeSummary.blinkCount : null)
            : undefined,
          gaze_sample_count: enableWebgazer ? gazeSummary.gazeSampleCount : undefined,
          gaze_sampling_interval_ms: enableWebgazer ? gazeSamplingIntervalMs : undefined,
          fixation_radius_px: enableWebgazer ? RoundToTenth(aoiRadiusPx) : undefined,
          fixation_duration_ms: enableWebgazer ? minimumFixationDurationMs : undefined,
          gaze_sample_columns: enableWebgazer ? [...oculomotorGazeSampleColumns] : undefined,
          gaze_samples: enableWebgazer ? gazeSamples : undefined,
        });
      };

      const togglePause = () => {
        if (ended) return;
        if (paused) {
          pausedMs += performance.now() - pauseStartedAt;
          paused = false;
          fixationSegment += 1;
          blinkDetectorState = CreateBlinkDetectorState();
          pendingBlinkEvent = 0;
          lastGazeSampleAtMs = Number.NEGATIVE_INFINITY;
          pauseButton.textContent = 'Ⅱ';
          pauseButton.setAttribute('aria-label', '暫停訓練');
          if (audioElement) audioElement.play().catch(e => console.warn('Audio play failed', e));
          return;
        }
        pauseStartedAt = performance.now();
        paused = true;
        blinkDetectorState = CreateBlinkDetectorState();
        pendingBlinkEvent = 0;
        pauseButton.textContent = '▶';
        pauseButton.setAttribute('aria-label', '繼續訓練');
        if (audioElement) audioElement.pause();
      };

      pauseButton.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        togglePause();
      });

      const handleStageTap = (event: any) => {
        if (ended) return;
        const point = event.global;
        const w = app.screen.width;
        const safeInsets = ReadSafeAreaInsets(safeAreaProbe);
        const compact = w - safeInsets.left - safeInsets.right < 560;
        const hudHeight = compact
          ? Math.max(88 + safeInsets.top, Math.min(112 + safeInsets.top, app.screen.height * 0.3))
          : Math.max(58 + safeInsets.top, Math.min(82 + safeInsets.top, app.screen.height * 0.12));

        if (hudVisible && point.y <= hudHeight) {
          if (point.x >= w - safeInsets.right - 72 && point.x <= w - safeInsets.right - 12) finish('手動結束');
          return;
        }

        if (paused || mode !== 'reaction-jumps' || !latestTarget) return;
        const dx = point.x - latestTarget.x;
        const dy = point.y - latestTarget.y;
        if (dx * dx + dy * dy <= Math.pow(latestTarget.radiusPx * 1.45, 2)) {
          acquiredTargets += 1;
          flashUntil = performance.now() + 140;
        }
      };

      const handleKeydown = (event: KeyboardEvent) => {
        if (event.code === 'Space') {
          event.preventDefault();
          togglePause();
        }
        if (event.code === 'Escape') finish('手動結束');
      };

      const handleResize = () => draw();

      app.stage.eventMode = 'static';
      app.stage.hitArea = app.screen;
      app.stage.on('pointertap', handleStageTap);
      window.addEventListener('keydown', handleKeydown);
      app.renderer.on('resize', handleResize);

      const draw = () => {
        const arena = getArena();
        const elapsedMs = getElapsedMs();
        const elapsedSec = elapsedMs / 1000;
        const remainingMs = Math.max(0, durationMs - elapsedMs);
        const hudHeight = Math.max(58, Math.min(72, arena.height * 0.09));

        bgGfx.clear().rect(0, 0, arena.width, arena.height).fill({
          color: backgroundColor,
        });

        if (bgSprite) {
          bgSprite.width = arena.width;
          bgSprite.height = arena.height;
          bgSprite.x = 0;
          bgSprite.y = 0;
        }

        drawGuides(arena, hudHeight);
        drawHud(remainingMs);

        targetGfx.clear();
        hideTargetSprites();
        reactionLetter.visible = false;
        lilacGfx.visible = mode === 'lilac-chaser';

        if (mode === 'lilac-chaser') {
          latestTarget = {
            x: arena.width / 2,
            y: (arena.height + hudHeight) / 2,
            radiusPx,
            color: targetColor,
            alpha: 1,
            role: 'target',
          };
          drawLilacChaser(arena, elapsedSec);
          return;
        }

        const activePattern = mode === 'reaction-jumps'
          ? 'randomWalk'
          : mode === 'multi-object'
            ? 'randomWalk'
            : pattern;
        const jumpBucket = Math.floor(elapsedSec / 1.15);
        const travelPx = mode === 'reaction-jumps'
          ? jumpBucket * Math.max(260, Math.min(arena.width, arena.height) * 0.55)
          : elapsedSec * speedPxPerSec;
        const count = sampleOculomotorPatternInto(
          frames,
          activePattern,
          arena,
          {
            radiusPx,
            speedPxPerSec,
            travelPx,
            targetCount: 1,
            distractorCount: mode === 'multi-object' ? distractorCount : 0,
            colorA: targetColor,
            colorB: pixiColors.accent,
            opacity,
            jitter: bounceJitter,
          },
          rng,
        );

        latestTarget = frames[0] ?? null;
        const isReactionFlash = performance.now() < flashUntil;
        for (let i = 0; i < count; i += 1) {
          if (customTexture) {
            const sprite = ensureTargetSprite(i);
            if (sprite) {
              sprite.visible = true;
              sprite.x = frames[i].x;
              sprite.y = frames[i].y;
              sprite.width = frames[i].radiusPx * 2;
              sprite.height = frames[i].radiusPx * 2;
              sprite.alpha = frames[i].alpha;
            }
          } else {
            drawTargetShape(targetGfx, frames[i], isReactionFlash && i === 0, targetShape, backgroundColor);
          }
        }
        hideTargetSprites(count);

        if (mode === 'reaction-jumps' && latestTarget) {
          reactionLetter.text = String.fromCharCode(65 + (jumpBucket % 26));
          reactionLetter.x = latestTarget.x;
          reactionLetter.y = latestTarget.y;
          reactionLetter.visible = true;
        }
      };

      const tick = () => {
        if (!displayElement.isConnected) {
          finish('Unmounted');
          return;
        }
        const now = performance.now();
        const dt = now - lastFpsTimestamp;
        lastFpsTimestamp = now;
        if (dt > 0 && dt < 1000) {
          frameCount += 1;
          fpsAccumulator += 1000 / dt;
        }

        if (!paused) {
          draw();
          if (getElapsedMs() >= durationMs) finish('完成');
        } else {
          draw();
        }
      };

      if (enableWebgazer) {
        webGazerRuntime?.setGazeListener?.(handleGazePrediction);
        webGazerRuntime?.resume?.();
        webGazerRuntime?.showPredictionPoints?.(showGazePoint);
        webGazerExtension?.resume?.();
        if (showGazePoint) webGazerExtension?.showPredictions?.();
        else webGazerExtension?.hidePredictions?.();
      }
      draw();
      app.ticker.add(tick);
    };

    RunPixiTrial(oculomotorPixiScope, displayElement, runWithApp);
  }
}

export default PixiOculomotorTrainingPlugin;

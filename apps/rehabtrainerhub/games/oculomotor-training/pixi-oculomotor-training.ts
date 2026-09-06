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
import {
  ConvertOculomotorSpeedToPixels,
  DarkenOculomotorColor,
  GetOculomotorRadiusPx,
  GetOculomotorTravelPx,
  IsOculomotorPatternReversible,
} from '../../pages/training/oculomotor/profiles';
import type {
  Arena,
  OculomotorBehavior,
  OculomotorMode,
  OculomotorPattern,
  OculomotorSpeedUnit,
  OculomotorTargetShape,
  TargetFrame,
} from '../../pages/training/oculomotor/types';
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
    behavior: {
      type: ParameterType.STRING,
      default: 'constant',
    },
    speed_value: {
      type: ParameterType.FLOAT,
      default: 20,
    },
    speed_unit: {
      type: ParameterType.STRING,
      default: 'deg/s',
    },
    viewing_distance_cm: {
      type: ParameterType.FLOAT,
      default: 60,
    },
    css_px_per_cm: {
      type: ParameterType.FLOAT,
      default: 37.8,
    },
    target_radius_px: {
      type: ParameterType.FLOAT,
      default: 35,
    },
    target_count: {
      type: ParameterType.INT,
      default: 1,
    },
    distractor_count: {
      type: ParameterType.INT,
      default: 5,
    },
    distractor_brightness: {
      type: ParameterType.FLOAT,
      default: 0.7,
    },
    target_color: {
      type: ParameterType.STRING,
      default: '#76d900',
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
    motion_direction: {
      type: ParameterType.INT,
      default: 1,
    },
    show_trail: {
      type: ParameterType.BOOL,
      default: false,
    },
    letter_enabled: {
      type: ParameterType.BOOL,
      default: false,
    },
    letter_color: {
      type: ParameterType.STRING,
      default: '#000000',
    },
    letter_weight: {
      type: ParameterType.INT,
      default: 600,
    },
    letter_scale: {
      type: ParameterType.FLOAT,
      default: 0.5,
    },
    lilac_chaser_scale: {
      type: ParameterType.FLOAT,
      default: 1,
    },
    lilac_chaser_color: {
      type: ParameterType.STRING,
      default: '#ff00fe',
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
    gaze_coordinate_source: { type: ParameterType.STRING },
    aoi_score: { type: ParameterType.INT },
    mean_target_distance_px: { type: ParameterType.FLOAT },
    target_distance_sd_px: { type: ParameterType.FLOAT },
    time_to_first_fixation_ms: { type: ParameterType.INT },
    average_pupil_size_px: { type: ParameterType.FLOAT },
    pupil_size_sd_px: { type: ParameterType.FLOAT },
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
  t?: number;
}

interface WebGazerRawPrediction extends WebGazerPrediction {
  eyeFeatures?: WebGazerEyeFeaturesLike;
}

interface WebGazerRuntimeLike {
  clearGazeListener?: () => unknown;
  getTracker?: () => { getPositions?: () => readonly FaceLandmark[] | null };
  setGazeListener?: (
    callback: (prediction: WebGazerRawPrediction | null) => void,
  ) => unknown;
}

interface WebGazerExtensionLike {
  hidePredictions?: () => void;
  hideVideo?: () => void;
  onGazeUpdate: (
    callback: (prediction: WebGazerPrediction | null) => void,
  ) => () => void;
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
) => {
  const outer = frame.radiusPx;
  const ringColor = frame.role === 'target' ? 0xffffff : pixiColors.borderHover;

  drawShape(gfx, shape, frame.x, frame.y, outer, frame.color, frame.alpha);

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
  if (shape === 'ring') {
    gfx.circle(x, y, radius).stroke({
      color,
      width: Math.max(3, radius * 0.28),
      alpha,
    });
    return;
  }
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
  if (shape === 'diamond') {
    gfx.poly([
      x, y - radius * 1.25,
      x + radius * 1.25, y,
      x, y + radius * 1.25,
      x - radius * 1.25, y,
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
  if (shape === 'ring') {
    gfx.circle(x, y, radius).stroke({ color, width, alpha: 0.88 });
    return;
  }
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
  if (shape === 'diamond') {
    gfx.poly([
      x, y - radius * 1.25,
      x + radius * 1.25, y,
      x, y + radius * 1.25,
      x - radius * 1.25, y,
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
  return ['circle', 'ring', 'star', 'square', 'diamond', 'cross', 'triangle', 'custom'].includes(String(value))
    ? value as OculomotorTargetShape
    : 'circle';
};

const parseBehavior = (value: unknown): OculomotorBehavior => {
  return [
    'constant',
    'wavePattern',
    'surgePattern',
    'alternatingPattern',
    'climbPattern',
    'sizePulse',
  ].includes(String(value)) ? value as OculomotorBehavior : 'constant';
};

const parseSpeedUnit = (value: unknown): OculomotorSpeedUnit => {
  return ['deg/s', 'cm/s', 'screen/s'].includes(String(value))
    ? value as OculomotorSpeedUnit
    : 'deg/s';
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
    const activePattern: OculomotorPattern = mode === 'reaction-jumps'
      ? 'teleport'
      : mode === 'multi-object'
        ? 'multipleObjectTracking'
        : pattern;
    const durationMs = Math.max(5_000, trial.duration_ms as number);
    const behavior = parseBehavior(trial.behavior);
    const speedUnit = parseSpeedUnit(trial.speed_unit);
    const speedMaximum = speedUnit === 'cm/s' ? 143 : speedUnit === 'screen/s' ? 6 : 100;
    const speedValue = Math.min(speedMaximum, Math.max(
      speedUnit === 'screen/s' ? 0.01 : 0.1,
      trial.speed_value as number,
    ));
    const viewingDistanceCm = Math.min(120, Math.max(20, trial.viewing_distance_cm as number));
    const cssPxPerCm = Math.min(120, Math.max(10, trial.css_px_per_cm as number));
    const baseRadiusPx = Math.min(100, Math.max(4, trial.target_radius_px as number));
    const targetCount = Math.min(6, Math.max(1, Math.round(trial.target_count as number)));
    const distractorCount = Math.min(10, Math.max(0, Math.round(trial.distractor_count as number)));
    const distractorBrightness = Math.min(1, Math.max(0.35, trial.distractor_brightness as number));
    const parsedTargetColor = parseCssHexColor(trial.target_color, 0x76d900);
    const targetColor = ((parsedTargetColor >> 16) & 0xff) >= 240
      && ((parsedTargetColor >> 8) & 0xff) <= 32
      && (parsedTargetColor & 0xff) <= 32
      ? 0xffb020
      : parsedTargetColor;
    const distractorColor = DarkenOculomotorColor(targetColor, distractorBrightness);
    const backgroundColor = parseCssHexColor(trial.background_color, pixiColors.bg);
    const targetShape = parseTargetShape(trial.target_shape);
    const customTargetImage = typeof trial.custom_target_image === 'string'
      ? trial.custom_target_image
      : '';
    const opacity = Math.max(0, Math.min(1.0, trial.opacity as number));
    const backgroundImage = typeof trial.background_image === 'string' ? trial.background_image : '';
    const customAudio = typeof trial.audio === 'string' ? trial.audio : '';
    const bounceJitter = Math.max(0, trial.bounce_jitter as number);
    const motionDirection = trial.motion_direction === -1 ? -1 : 1;
    const showTrail = Boolean(trial.show_trail) && IsOculomotorPatternReversible(activePattern);
    const letterEnabled = Boolean(trial.letter_enabled);
    const letterColor = parseCssHexColor(trial.letter_color, 0x000000);
    const letterWeight = trial.letter_weight === 400
      ? '400'
      : trial.letter_weight === 500
        ? '500'
        : trial.letter_weight === 700
          ? '700'
          : trial.letter_weight === 800
            ? '800'
            : '600';
    const letterScale = Math.min(1.2, Math.max(0.45, trial.letter_scale as number));
    const lilacChaserScale = Math.min(1.25, Math.max(0.75, trial.lilac_chaser_scale as number));
    const lilacChaserColor = parseCssHexColor(trial.lilac_chaser_color, 0xff00fe);
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
    const webGazerExtension = self.jsPsych.extensions?.webgazer as unknown as
      | WebGazerExtensionLike
      | undefined;
    const subscribeToOfficialGazeUpdates = webGazerExtension?.onGazeUpdate?.bind(webGazerExtension);

    if (enableWebgazer && typeof subscribeToOfficialGazeUpdates !== 'function') {
      throw new Error('The native jsPsych WebGazer extension is unavailable for the formal trial.');
    }

    const runWithApp = (app: Application) => {
      AttachPixiTrialCanvas(oculomotorPixiScope, wrapper);

      const startTime = performance.now();
      const bgGfx = new Graphics();
      const guideGfx = new Graphics();
      const trailGfx = new Graphics();
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
      const targetLetters: Text[] = [];
      const trailFrames: Array<Array<Pick<TargetFrame, 'x' | 'y' | 'radiusPx' | 'color' | 'alpha'>>> = [];
      let lastTrailSampleMs = -Infinity;
      const customTexture = targetShape === 'custom' && customTargetImage
        ? Texture.from(customTargetImage)
        : null;

      let latestTarget: TargetFrame | null = null;
      let hudVisible = false;

      app.stage.addChild(bgGfx, guideGfx, trailGfx, lilacGfx, targetGfx, reactionLetter, hudGfx, titleText, metaText, timeText, exitText);

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
        fontSize: Math.max(18, baseRadiusPx * 0.92),
        fontWeight: '800',
        fill: backgroundColor,
      };
      reactionLetter.anchor.set(0.5);

      titleText.text = modeTitle[mode] ?? '眼動訓練';
      metaText.text = mode === 'lilac-chaser'
        ? 'Lilac Chaser'
        : `${getOculomotorModeLabel(mode)} · ${getOculomotorPatternLabel(activePattern)}`;

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
      let totalBlinkCount = 0;
      let pendingBlinkEvent: 0 | 1 = 0;
      let fixationSegment = 0;
      let latestEyeFeatures: WebGazerEyeFeaturesLike | null = null;
      let stopOfficialGazeUpdates: (() => void) | undefined;
      const webGazerRuntime = (window as Window & { webgazer?: WebGazerRuntimeLike }).webgazer;

      const handleEyeFeatures = (prediction: WebGazerRawPrediction | null) => {
        if (ended || paused) return;
        latestEyeFeatures = prediction?.eyeFeatures ?? null;
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
          if (blinkUpdate.blinkEvent === 1) {
            pendingBlinkEvent = 1;
            totalBlinkCount += 1;
          }
        }
      };

      const handleGazePrediction = (prediction: WebGazerPrediction | null) => {
        if (ended || paused) return;
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

        const canvas = app.canvas as HTMLCanvasElement;
        const canvasRect = canvas.getBoundingClientRect();
        if (canvasRect.width <= 0 || canvasRect.height <= 0) return;
        const targetPoint = {
          x: canvasRect.left + (latestTarget.x / app.screen.width) * canvasRect.width,
          y: canvasRect.top + (latestTarget.y / app.screen.height) * canvasRect.height,
        };
        const pupilEstimate = blinkDetectorState.isClosed
          ? null
          : EstimatePupilSizePx(latestEyeFeatures);
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

      const drawGuides = (arena: Arena) => {
        const cx = arena.width / 2;
        const cy = arena.height / 2;

        guideGfx.clear();

        if (mode === 'lilac-chaser') {
          const minSide = Math.min(arena.width, arena.height);
          const crossArm = minSide * 0.0132 * lilacChaserScale;
          guideGfx
            .rect(0, 0, arena.width, arena.height)
            .fill({ color: 0xd8d8da })
            .moveTo(cx - crossArm, cy)
            .lineTo(cx + crossArm, cy)
            .moveTo(cx, cy - crossArm)
            .lineTo(cx, cy + crossArm)
            .stroke({
              color: 0x050505,
              width: Math.max(2, minSide * 0.0125 * lilacChaserScale),
            });
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
        const cx = arena.width / 2;
        const cy = arena.height / 2;
        const minSide = Math.min(arena.width, arena.height);
        const orbit = minSide * 0.3381 * lilacChaserScale;
        const dotRadius = Math.max(4, minSide * 0.0399 * lilacChaserScale);
        const hiddenIndex = Math.floor(elapsedSec * 10) % lilacDotCount;

        lilacGfx.clear();
        for (let i = 0; i < lilacDotCount; i += 1) {
          if (i === hiddenIndex) continue;
          const angle = -Math.PI / 2 + (i / lilacDotCount) * fullCircle;
          lilacGfx
            .circle(cx + Math.cos(angle) * orbit, cy + Math.sin(angle) * orbit, dotRadius)
            .fill({ color: lilacChaserColor });
        }
      };

      const finish = (response: string) => {
        if (ended) return;
        ended = true;
        app.ticker.remove(tick);
        app.renderer.off('resize', handleResize);
        app.stage.off('pointertap', handleStageTap);
        window.removeEventListener('keydown', handleKeydown);
        stopOfficialGazeUpdates?.();
        stopOfficialGazeUpdates = undefined;
        webGazerRuntime?.clearGazeListener?.();
        webGazerExtension?.hidePredictions?.();
        webGazerExtension?.hideVideo?.();
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
          pattern: activePattern,
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
          pupil_size_sd_px: enableWebgazer
            ? RoundToTenth(gazeSummary.pupilSizeStandardDeviationPx)
            : undefined,
          blink_count: enableWebgazer
            ? (blinkObservationCount > 0 ? totalBlinkCount : null)
            : undefined,
          gaze_sample_count: enableWebgazer ? gazeSummary.gazeSampleCount : undefined,
          gaze_sampling_interval_ms: enableWebgazer ? gazeSamplingIntervalMs : undefined,
          fixation_radius_px: enableWebgazer ? RoundToTenth(aoiRadiusPx) : undefined,
          fixation_duration_ms: enableWebgazer ? minimumFixationDurationMs : undefined,
          gaze_sample_columns: enableWebgazer ? [...oculomotorGazeSampleColumns] : undefined,
          gaze_samples: enableWebgazer ? gazeSamples : undefined,
        });
      };

      const ensureTargetLetter = (index: number) => {
        if (!targetLetters[index]) {
          const text = new Text();
          text.anchor.set(0.5);
          app.stage.addChild(text);
          targetLetters[index] = text;
        }
        return targetLetters[index];
      };

      const hideTargetLetters = (fromIndex = 0) => {
        for (let index = fromIndex; index < targetLetters.length; index += 1) {
          targetLetters[index].visible = false;
        }
      };

      const drawTargetLetters = (count: number, elapsedSec: number, jumpBucket: number) => {
        if (!letterEnabled) {
          hideTargetLetters();
          return;
        }
        const bucket = mode === 'reaction-jumps' ? jumpBucket : Math.floor(elapsedSec / 2);
        const formScale = targetShape === 'cross'
          ? 0.72
          : targetShape === 'diamond'
            ? 0.86
            : targetShape === 'ring'
              ? 0.82
              : targetShape === 'square'
                ? 1.05
                : targetShape === 'triangle'
                  ? 0.76
                  : 1;
        for (let index = 0; index < count; index += 1) {
          const frame = frames[index];
          const text = ensureTargetLetter(index);
          text.text = String.fromCharCode(65 + ((bucket * 7 + index * 11) % 26));
          text.style = {
            fontFamily: typography.fontFamily,
            fontSize: Math.max(6, frame.radiusPx * formScale * letterScale),
            fontWeight: letterWeight,
            fill: letterColor,
          };
          text.x = frame.x;
          text.y = frame.y;
          text.alpha = frame.alpha;
          text.visible = true;
        }
        hideTargetLetters(count);
      };

      const drawTrail = (count: number, elapsedMs: number) => {
        trailGfx.clear();
        if (!showTrail) {
          trailFrames.length = 0;
          return;
        }
        if (elapsedMs - lastTrailSampleMs >= 55) {
          lastTrailSampleMs = elapsedMs;
          trailFrames.push(frames
            .slice(0, count)
            .filter((frame) => frame.role === 'target')
            .map(({ x, y, radiusPx, color, alpha }) => ({ x, y, radiusPx, color, alpha })));
          if (trailFrames.length > 16) trailFrames.shift();
        }
        trailFrames.forEach((snapshot, snapshotIndex) => {
          const ageAlpha = ((snapshotIndex + 1) / trailFrames.length) * 0.28;
          snapshot.forEach((frame) => {
            drawShape(
              trailGfx,
              targetShape === 'custom' ? 'circle' : targetShape,
              frame.x,
              frame.y,
              frame.radiusPx,
              frame.color,
              frame.alpha * ageAlpha,
            );
          });
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
          pauseButton.textContent = 'Ⅱ';
          pauseButton.setAttribute('aria-label', '暫停訓練');
          webGazerExtension?.resume?.();
          if (audioElement) audioElement.play().catch(e => console.warn('Audio play failed', e));
          return;
        }
        pauseStartedAt = performance.now();
        paused = true;
        blinkDetectorState = CreateBlinkDetectorState();
        pendingBlinkEvent = 0;
        pauseButton.textContent = '▶';
        pauseButton.setAttribute('aria-label', '繼續訓練');
        webGazerExtension?.pause?.();
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

        bgGfx.clear().rect(0, 0, arena.width, arena.height).fill({
          color: backgroundColor,
        });

        if (bgSprite) {
          bgSprite.width = arena.width;
          bgSprite.height = arena.height;
          bgSprite.x = 0;
          bgSprite.y = 0;
        }

        drawGuides(arena);
        drawHud(remainingMs);

        targetGfx.clear();
        hideTargetSprites();
        reactionLetter.visible = false;
        lilacGfx.visible = mode === 'lilac-chaser';

        if (mode === 'lilac-chaser') {
          trailGfx.clear();
          trailFrames.length = 0;
          hideTargetLetters();
          latestTarget = {
            x: arena.width / 2,
            y: arena.height / 2,
            radiusPx: baseRadiusPx,
            color: targetColor,
            alpha: 1,
            role: 'target',
          };
          drawLilacChaser(arena, elapsedSec);
          return;
        }

        const speedPxPerSec = ConvertOculomotorSpeedToPixels(
          speedValue,
          speedUnit,
          arena,
          viewingDistanceCm,
          cssPxPerCm,
        );
        const radiusPx = GetOculomotorRadiusPx(behavior, elapsedSec, baseRadiusPx);
        const direction = IsOculomotorPatternReversible(activePattern) ? motionDirection : 1;
        const travelPx = GetOculomotorTravelPx(behavior, elapsedSec, speedPxPerSec) * direction;
        const reactionJumpDistancePx = Math.min(
          820,
          Math.max(420, Math.min(arena.width, arena.height) * 0.55),
        );
        const jumpBucket = Math.floor(Math.abs(travelPx) / reactionJumpDistancePx);
        const count = sampleOculomotorPatternInto(
          frames,
          activePattern,
          arena,
          {
            radiusPx,
            speedPxPerSec,
            travelPx,
            targetCount: mode === 'multi-object' ? targetCount : 1,
            distractorCount: mode === 'multi-object' ? distractorCount : 0,
            colorA: targetColor,
            colorB: distractorColor,
            opacity,
            jitter: bounceJitter,
          },
          rng,
        );

        latestTarget = frames[0] ?? null;
        drawTrail(count, elapsedMs);
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
            drawTargetShape(targetGfx, frames[i], isReactionFlash && i === 0, targetShape);
          }
        }
        hideTargetSprites(count);
        drawTargetLetters(count, elapsedSec, jumpBucket);
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
        webGazerRuntime?.setGazeListener?.(handleEyeFeatures);
        stopOfficialGazeUpdates = subscribeToOfficialGazeUpdates!(handleGazePrediction);
        webGazerExtension?.hideVideo?.();
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

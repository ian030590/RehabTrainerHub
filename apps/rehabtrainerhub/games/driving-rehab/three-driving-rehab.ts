// Game-owned driving runtime. The view is a pseudo-3D pixel renderer in the
// style of jakesgordon/javascript-racer: projected road polygons and scaled
// sprites on a small 2D canvas.
import { JsPsych, ParameterType } from 'jspsych';
import type { JsPsychPlugin, TrialType } from 'jspsych';
import { MeasureDisplayRefreshRate } from './runtime/displayTiming';
const typography = { fontFamily: 'system-ui, sans-serif' };
import { soundManager } from './runtime/soundManager';
import { difficultyPresets, hazardTemplates } from './hazards/driving-hazards';
import {
  drivingRoute,
  drivingRouteVariants,
  BuildDrivingRoute,
  PickRandomDrivingRoute,
  type DrivingRouteVariant,
} from './route/driving-route';
import {
  CalculateDrivingCameraPose,
  type DrivingCameraMode,
} from './camera/driving-camera';
import {
  CreateDrivingRenderQuality,
  DrivingViewportController,
  type DrivingRenderQuality,
} from './rendering/driving-rendering';
import { CalculateDriverEyePose } from './pixel/pixelCamera';
import { CalculateDesktopMiniMapRect, CalculateSteeringWheelAngle } from './pixel/pixelCockpit';
import { PixelDrivingRenderer, type PixelScene, type PixelVehicle } from './pixel/pixelRenderer';
import { PixelWorldBuilder, groundLayer, type PixelWorld } from './pixel/pixelWorld';
import { carModels, facadeIds, treeFrames, type CarModel, type VehicleColor } from './pixel/spriteNames';
import spriteSheet from './sprites/driving-sprites.json';
import {
  CalculateAmbientSpawnDistance,
  CalculateFollowingSpeed,
  CalculateRearSpawnDistance,
  CollisionBoxesOverlap,
  FindTrafficLeaderGap,
  IsTrafficMoveBlocked,
  PlanRearTraffic,
  ShouldRespawnAmbientTraffic,
  ShouldRespawnRearTraffic,
  minimumFollowingGap,
  type TrafficBody,
} from './traffic/drivingTraffic';
import {
  CalculateDrivingFixedSteps,
  CalculateEstimatedPresentationTime,
  CalculateFrameAlignedReactionTime,
  NormalizeDrivingInputTimestamp,
  SummarizeReactionTimes,
} from './timing/driving-timing';
import {
  FindDrivingWheelGamepad,
  IsDrivingWheelGamepad,
  ParseDrivingWheelCalibration,
  ReadDrivingWheelInput,
  type DrivingWheelCalibration,
} from './input/driving-input';
import { drivingText, type DrivingText } from './text/driving-text';
import { RegisterDrivingRuntimeDisposer } from './lifecycle/driving-runtime-lifecycle';
import type {
  ActiveHazard,
  CollisionBox2D,
  CollisionFootprint,
  DifficultyPreset,
  DrivingControlMode,
  DrivingEventId,
  DrivingEventResult,
  DrivingInput,
  DrivingLanguage,
  HazardId,
  HazardTemplate,
  HazardVisual,
  IntersectionZone,
  RoutePoint,
  RouteSegment,
  TrafficLightState,
  Vec2,
  VehicleResetPose,
} from './types/types';

// Ground colours for the pixel world (0xRRGGBB, blended into fog at draw time).
const worldColors = {
  asphalt: 0x4c5157,
  asphaltBand: 0x52575d,
  intersection: 0x4a4f55,
  curb: 0xc6c3b8,
  curbRed: 0xb3392f,
  sidewalk: 0xb3a998,
  sidewalkBand: 0xaba18f,
  white: 0xf0f0ea,
  yellow: 0xf0c02a,
  scooterBox: 0x2f8a59,
};

// Resolved while this module first runs: the IIFE build resolves these
// against document.currentScript, which is gone once a trial starts.
const spriteAtlasUrl = new URL('./sprites/driving-sprites.png', import.meta.url).href;
const steeringWheelUrl = new URL('./textures/steering-wheel.svg', import.meta.url).href;
const carPedalsUrl = new URL('./textures/car-pedals.svg', import.meta.url).href;

type DrivingTouchKey = 'left' | 'right' | 'up' | 'down';

// Ambient vehicles move along the route; x, z and heading follow from
// distance and lateral every step. A waiting vehicle stays hidden until
// there is room for it out of the player's sight: behind the player for rear
// traffic (rearSlot set), ahead of the visible road for the rest.
interface AmbientTrafficActor extends TrafficBody, PixelVehicle {
  kind: 'car' | 'scooter';
  cruiseSpeed: number;
  rearSlot: number | null;
  laneIndex: number;
  waiting: boolean;
  // Stopped for the player's car, so it never blocks the player driving off.
  yieldingToPlayer: boolean;
}

interface MiniMapRouteSample {
  distance: number;
  x: number;
  z: number;
}

interface RouteLookup {
  segment: RouteSegment;
  index: number;
  local: number;
}

const info = {
  name: 'three-driving-rehab',
  version: '3.0.0',
  parameters: {
    red_flash_enabled: {
      type: ParameterType.BOOL,
      default: true,
    },
    /** 'beginner' | 'intermediate' | 'advanced' - controls hazard reaction window */
    driving_difficulty: {
      type: ParameterType.STRING,
      default: 'beginner',
    },
    control_mode: {
      type: ParameterType.STRING,
      default: 'arrow',
    },
    wheel_calibration: {
      type: ParameterType.COMPLEX,
      default: null,
    },
    render_quality: {
      type: ParameterType.STRING,
      default: 'high',
    },
    driving_duration_sec: {
      type: ParameterType.INT,
      default: 80,
    },
    language: {
      type: ParameterType.STRING,
      default: 'zh',
    },
  },
  data: {
    rt: { type: ParameterType.INT },
    correct: { type: ParameterType.BOOL },
    target: { type: ParameterType.STRING },
    response: { type: ParameterType.STRING },
    duration_ms: { type: ParameterType.INT },
    average_rt: { type: ParameterType.INT },
    median_rt: { type: ParameterType.INT },
    valid_event_count: { type: ParameterType.INT },
    reaction_event_count: { type: ParameterType.INT },
    successful_avoidance_count: { type: ParameterType.INT },
    event_count: { type: ParameterType.INT },
    collisions: { type: ParameterType.INT },
    lane_deviations: { type: ParameterType.INT },
    average_fps: { type: ParameterType.INT },
    display_refresh_hz: { type: ParameterType.FLOAT },
    display_refresh_ms: { type: ParameterType.FLOAT },
    refresh_sample_count: { type: ParameterType.INT },
    refresh_measurement_valid: { type: ParameterType.BOOL },
    rendering_quality: { type: ParameterType.STRING },
    control_mode: { type: ParameterType.STRING },
    route_progress: { type: ParameterType.FLOAT },
    driving_events: { type: ParameterType.COMPLEX },
  },
} as const;

type Info = typeof info;

class ThreeDrivingRehabPlugin implements JsPsychPlugin<Info> {
  static info = info;

  private renderer: PixelDrivingRenderer | null = null;
  private root: HTMLDivElement | null = null;
  private pixelWorld: PixelWorld | null = null;
  // DrivingViewportController updates a camera's aspect. The pixel camera is
  // rebuilt from the canvas size every frame, so this one only absorbs it.
  private readonly viewportCamera = { aspect: 1, updateProjectionMatrix() {} };
  private raf = 0;
  private unregisterRuntimeDisposer: (() => void) | null = null;
  private finished = false;
  private routeLength = 0;
  private routeSegmentStarts: number[] = [];
  private miniMapRouteSamples: MiniMapRouteSample[] = [];
  private lastFrameTime = 0;
  private trialStartTime = 0;
  private simulationTime = 0;
  private simulationAccumulatorMs = 0;
  private fpsSamples: number[] = [];
  private activeHazards: ActiveHazard[] = [];
  private eventResults: DrivingEventResult[] = [];
  private lastBrakePressed = false;
  private pendingBrakeTimestamp: number | null = null;
  private ambientTrafficActors: AmbientTrafficActor[] = [];
  private renderQuality: DrivingRenderQuality = CreateDrivingRenderQuality('high');
  private viewportController: DrivingViewportController | null = null;
  private displayRefreshMs = 1000 / 60;
  private displayRefreshHz = 60;
  private refreshSampleCount = 0;
  private refreshMeasured = false;
  private selectedRouteVariant: DrivingRouteVariant | null = null;

  // Free-steering vehicle state. vehicleX/Z is always the rendered and physical
  // vehicle center in world coordinates. Route progress/lateral are projections
  // of that center onto the active route.
  private vehicleX = 0;
  private vehicleZ = 0;
  private vehicleHeading = 0; // radians, 0 = -Z direction
  private vehicleSpeed = 0;
  private steeringInput = 0;
  private lastResponseSteering = 0;
  private frontWheelAngle = 0;
  private lastYawRate = 0;
  private progress = 0;        // projected distance along route (for hazards/HUD)
  private previousProgress = 0;
  private lateralOffset = 0;   // signed distance from route center (+ = right)
  private laneDeviationCount = 0;
  private laneDeviationActive = false;
  private laneMarkingViolationActive = false;
  private navigationDeviationActive = false;
  private lastCollisionEventTime = 0;
  private laneDepartureStartTime: number | null = null;
  private lastInLanePose: VehicleResetPose | null = null;
  private laneDeparturePose: VehicleResetPose | null = null;
  private laneResetActive = false;
  private laneResetBlackoutTimer: number | null = null;
  private laneResetClearTimer: number | null = null;
  private cameraMode: DrivingCameraMode = 'first-person';

  // Intersection / turning state
  private intersections: IntersectionZone[] = [];

  // Difficulty
  private difficultyPreset: DifficultyPreset = difficultyPresets.beginner;

  // Mini-map
  private miniMapCanvas: HTMLCanvasElement | null = null;
  private miniMapCtx: CanvasRenderingContext2D | null = null;
  private rearviewLastUpdateTime = 0;
  private miniMapLastUpdateTime = 0;
  private miniMapLastDirectionText = '';
  private miniMapDirectionLabel: HTMLDivElement | null = null;

  private keyState = {
    left: false,
    right: false,
    up: false,
    down: false,
  };

  private keydownListener: ((event: KeyboardEvent) => void) | null = null;
  private keyupListener: ((event: KeyboardEvent) => void) | null = null;
  private touchControlsRoot: HTMLDivElement | null = null;
  private hudPanelObserver: ResizeObserver | null = null;
  private inputPauseOverlay: HTMLDivElement | null = null;
  private inputPausedAt = 0;
  private visibilityPausedAt: number | null = null;
  private visibilityChangeListener: (() => void) | null = null;
  private gamepadConnectedListener: ((event: GamepadEvent) => void) | null = null;
  private gamepadDisconnectedListener: ((event: GamepadEvent) => void) | null = null;
  private gamepadConnected = false;
  private startupAbort = new AbortController();
  private controlMode: DrivingControlMode = 'arrow';
  private wheelCalibration: DrivingWheelCalibration | null = null;
  private language: DrivingLanguage = 'zh';
  private text: DrivingText = drivingText.zh;

  private hud: {
    status: HTMLDivElement;
    route: HTMLDivElement;
    speed: HTMLDivElement;
    distance: HTMLDivElement;
    view?: HTMLDivElement;
    event: HTMLDivElement;
    redFlash: HTMLDivElement;
    blackout?: HTMLDivElement;
    panel?: HTMLDivElement;
    miniMapWrapper?: HTMLDivElement;
  } | null = null;

  private roadCollisionBoxes: CollisionBox2D[] = [];
  private buildingCollisionBoxes: CollisionBox2D[] = [];

  private readonly defaultRoadWidth = 10.95;
  private readonly defaultLaneWidth = 3.2;
  private readonly vehicleHalfWidth = 1.0;
  private readonly vehicleHalfLength = 2.25;
  private readonly wheelBase = 2.72;
  private readonly maxVehicleSpeed = 18;
  private readonly fixedSimulationStepMs = 1000 / 120;
  private readonly maxSimulationCatchUpMs = 250;
  private readonly initialRouteDistance = 18;
  private readonly routeTurnBlendDistance = 14;
  private readonly sidewalkWidth = 3;
  private readonly buildingRoadGap = 1.2;
  private readonly buildingRoadMargin = 0.35;
  private readonly buildingIntersectionClearance = 24;
  private readonly roadMarkingIntersectionClearance = 30;
  private readonly minLaneDeviationLimit = 5.4;
  private readonly laneDeviationGraceMs = 500;
  private readonly laneResetBlackoutMs = 90;
  private readonly laneResetHoldMs = 120;
  private readonly stopLineSetback = 10.5;
  private readonly minIntersectionSpacing = 70;
  private readonly trafficGreenMs = 6400;
  private readonly trafficYellowMs = 1800;
  private readonly trafficRedMs = 5400;
  private route: RouteSegment[] = [...drivingRoute];
  private readonly hazardTemplates: HazardTemplate[] = [...hazardTemplates];

  constructor(private jsPsych: JsPsych) {
    this.route = this.ensureRoute(this.route);
    this.updateRouteMetrics();
  }

  private updateRouteMetrics() {
    this.routeSegmentStarts = [];
    let total = 0;
    for (const segment of this.route) {
      this.routeSegmentStarts.push(total);
      total += segment.length;
    }
    this.routeLength = total;
    this.miniMapRouteSamples = this.createMiniMapRouteSamples();
  }
  trial(displayElement: HTMLElement, trial: TrialType<Info>) {
    displayElement.replaceChildren();
    this.resetTrialState(trial);
    this.unregisterRuntimeDisposer = RegisterDrivingRuntimeDisposer(() => {
      if (this.finished) return;
      this.finished = true;
      this.startupAbort.abort();
      this.detachGlobalListeners();
      this.cleanupRenderResources();
    });
    soundManager.prepare();

    const root = document.createElement('div');
    root.className = 'driving-rehab-root';
    root.tabIndex = 0;
    root.setAttribute('aria-busy', 'true');
    Object.assign(root.style, {
      position: 'relative',
      width: '100%',
      height: '100%',
      overflow: 'hidden',
      background: '#0f1720',
      color: '#fff',
      fontFamily: typography.fontFamily,
      userSelect: 'none',
    });
    displayElement.appendChild(root);
    const loadingOverlay = this.createLoadingOverlay(root);

    const startDriving = async () => {
      if (this.finished || this.renderer) return;
      try {
        console.info('[DrivingRehab] selected render quality', { level: this.renderQuality.level });
        this.initScene(root);
        this.initHud(root, trial.red_flash_enabled ?? true);
        this.initTouchControls(root);
        this.initInputPauseOverlay(root);
        if (this.finished) return;
        if (!displayElement.isConnected) {
          this.finishTrial(displayElement, 'aborted');
          return;
        }
        this.updateTrafficLights(0);
        this.renderFirstFrameBeforeReveal(performance.now());
        // The sprite atlas loads while the display refresh is measured. A load
        // failure is held here and reported once the measurement ends.
        // initScene() has just set the renderer; the guard above narrowed it to null.
        const renderer = this.renderer as PixelDrivingRenderer | null;
        const spritesLoaded = Promise.resolve(renderer?.ready).then(() => null, (error: unknown) => error);

        // Measure after the scene is built and drawn once, so startup work
        // does not eat the sampling timeout or make a fast display look like
        // the 60 Hz fallback.
        const displayRefresh = await MeasureDisplayRefreshRate({
          signal: this.startupAbort.signal,
          sampleCount: 48,
          minimumSampleCount: 12,
          minSampleMs: 1,
          maxSampleMs: 100,
          timeoutMs: 2_000,
        });
        this.displayRefreshMs = displayRefresh.refreshMs;
        this.displayRefreshHz = displayRefresh.refreshHz;
        this.refreshSampleCount = displayRefresh.sampleCount;
        this.refreshMeasured = displayRefresh.measured;
        root.dataset.drivingRefreshHz = this.refreshMeasured
          ? this.displayRefreshHz.toFixed(3)
          : 'fallback';
        root.dataset.drivingRefreshSamples = String(this.refreshSampleCount);
        if (this.finished) return;
        const spriteError = await spritesLoaded;
        if (spriteError) throw spriteError;
        if (this.finished) return;
        if (!displayElement.isConnected) {
          this.finishTrial(displayElement, 'aborted');
          return;
        }

        this.trialStartTime = performance.now();
        this.simulationTime = this.trialStartTime;
        this.simulationAccumulatorMs = 0;
        this.lastFrameTime = this.trialStartTime;
        const initialInput = this.readInput();
        this.updateVehicleFree(initialInput, 0, this.trialStartTime);
        this.updateTrafficLights(this.trialStartTime);
        this.lastBrakePressed = initialInput.brake > 0.35;
        this.renderFirstFrameBeforeReveal(this.trialStartTime);
        root.setAttribute('aria-busy', 'false');
        loadingOverlay.remove();
        root.focus();
        this.attachVisibilityPauseListener();
        this.attachKeyboardListeners(displayElement);
        this.attachGamepadListeners();
        this.raf = requestAnimationFrame((time) => this.loop(time, trial, displayElement));
      } catch (error) {
        console.error(error);
        this.finishTrial(displayElement, 'load-error');
      }
    };

    void startDriving();
  }

  private createLoadingOverlay(root: HTMLDivElement): HTMLDivElement {
    const overlay = document.createElement('div');
    overlay.setAttribute('role', 'status');
    overlay.setAttribute('aria-live', 'polite');
    Object.assign(overlay.style, {
      position: 'absolute',
      inset: '0',
      zIndex: '50',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'rgba(255, 255, 255, 0.88)',
      cursor: 'wait',
      pointerEvents: 'auto',
    });
    overlay.setAttribute(
      'aria-label',
      this.language === 'en'
        ? 'Loading driving environment...'
        : '\u6b63\u5728\u8f09\u5165\u99d5\u99db\u5834\u666f...',
    );

    const spinner = document.createElement('div');
    spinner.setAttribute('aria-hidden', 'true');
    Object.assign(spinner.style, {
      width: '34px',
      height: '34px',
      border: '4px solid rgba(23, 32, 51, 0.2)',
      borderTopColor: '#172033',
      borderRadius: '50%',
      boxSizing: 'border-box',
    });
    spinner.animate(
      [{ transform: 'rotate(0deg)' }, { transform: 'rotate(360deg)' }],
      { duration: 850, iterations: Infinity },
    );

    overlay.append(spinner);
    root.appendChild(overlay);
    return overlay;
  }

  private resetTrialState(trial?: TrialType<Info>) {
    this.startupAbort.abort();
    this.startupAbort = new AbortController();
    this.cleanupRenderResources();
    this.selectedRouteVariant = PickRandomDrivingRoute();
    this.route = this.ensureRoute(BuildDrivingRoute(this.selectedRouteVariant));
    this.updateRouteMetrics();
    this.finished = false;
    const startDistance = this.getInitialRouteDistance();
    const startPoint = this.getSurfacePoint(startDistance);
    const startHeading = this.getHeadingFromDirection(startPoint.dir);
    const startLaneOffset = this.getDrivingLaneOffset(startDistance);
    const startVehicleCenter = this.getRouteLateralPoint(startPoint, startLaneOffset);
    this.vehicleX = startVehicleCenter.x;
    this.vehicleZ = startVehicleCenter.z;
    this.vehicleHeading = startHeading;
    this.vehicleSpeed = 0;
    this.steeringInput = 0;
    this.frontWheelAngle = 0;
    this.lastYawRate = 0;
    this.progress = startDistance;
    this.previousProgress = startDistance;
    this.lateralOffset = startLaneOffset;
    this.cameraMode = 'first-person';
    this.trialStartTime = 0;
    this.simulationTime = 0;
    this.simulationAccumulatorMs = 0;
    this.lastFrameTime = 0;
    this.laneDeviationCount = 0;
    this.laneDeviationActive = false;
    this.laneMarkingViolationActive = false;
    this.navigationDeviationActive = false;
    this.lastCollisionEventTime = 0;
    this.laneDepartureStartTime = null;
    this.lastInLanePose = { x: this.vehicleX, z: this.vehicleZ, progress: this.progress, lateral: this.lateralOffset };
    this.laneDeparturePose = null;
    this.laneResetActive = false;
    this.clearLaneResetTimers();
    this.lastBrakePressed = false;
    this.pendingBrakeTimestamp = null;
    this.fpsSamples = [];
    this.displayRefreshMs = 1000 / 60;
    this.displayRefreshHz = 60;
    this.refreshSampleCount = 0;
    this.refreshMeasured = false;
    this.activeHazards = [];
    this.eventResults = [];
    this.lastResponseSteering = 0;
    this.ambientTrafficActors = [];
    this.roadCollisionBoxes = [];
    this.buildingCollisionBoxes = [];
    this.keyState = { left: false, right: false, up: false, down: false };
    this.miniMapCanvas = null;
    this.miniMapCtx = null;
    this.rearviewLastUpdateTime = 0;
    this.miniMapLastUpdateTime = 0;
    this.miniMapLastDirectionText = '';
    this.miniMapDirectionLabel = null;
    this.gamepadConnected = FindDrivingWheelGamepad(navigator.getGamepads?.() ?? []) !== null;
    this.controlMode = this.getControlMode((trial as any)?.control_mode);
    this.wheelCalibration = ParseDrivingWheelCalibration((trial as any)?.wheel_calibration);
    this.language = this.getLanguage((trial as any)?.language);
    this.text = drivingText[this.language];
    this.renderQuality = CreateDrivingRenderQuality((trial as any)?.render_quality);

    // Difficulty
    const diffKey = (trial as any)?.driving_difficulty ?? 'beginner';
    this.difficultyPreset = difficultyPresets[diffKey] ?? difficultyPresets.beginner;

    // Build intersection zones from route
    this.intersections = [];
    let pendingIntersection: IntersectionZone | null = null;
    const addPendingIntersection = () => {
      if (pendingIntersection) this.intersections.push(pendingIntersection);
      pendingIntersection = null;
    };
    let cumulativeDist = 0;
    for (let i = 0; i < this.route.length; i++) {
      cumulativeDist += this.route[i].length;
      if (i < this.route.length - 1) {
        const turnDir = this.getRouteTurn(this.route[i].dir, this.route[i + 1].dir);
        const intersection: IntersectionZone = {
          distance: cumulativeDist,
          segmentIndex: i,
          instruction: this.getTurnInstruction(turnDir),
          turnDir,
          entered: false,
          announced: false,
          trafficSignalState: 'green',
          trafficSignalOffsetMs: i * 2600,
          redLightChecked: false,
        };
        if (!pendingIntersection || intersection.distance - pendingIntersection.distance >= this.minIntersectionSpacing) {
          addPendingIntersection();
          pendingIntersection = intersection;
        } else if (!pendingIntersection.turnDir && intersection.turnDir) {
          pendingIntersection = intersection;
        }
      }
    }
    addPendingIntersection();
  }

  private attachKeyboardListeners(displayElement: HTMLElement) {
    this.keydownListener = (event: KeyboardEvent) => {
      if (this.shouldPreventKeyDefault(event.code)) {
        event.preventDefault();
      }
      this.setKeyboardInput(event.code, true, event.timeStamp);
      if (event.code === 'KeyC' || event.code === 'KeyV') {
        event.preventDefault();
        this.cycleCameraMode();
      }
      if (event.code === 'Escape') this.finishTrial(displayElement, 'aborted');
    };
    this.keyupListener = (event: KeyboardEvent) => {
      this.setKeyboardInput(event.code, false, event.timeStamp);
    };
    window.addEventListener('keydown', this.keydownListener);
    window.addEventListener('keyup', this.keyupListener);
  }

  private initTouchControls(root: HTMLDivElement) {
    this.touchControlsRoot?.remove();
    this.touchControlsRoot = null;
    this.inputPauseOverlay = null;
    this.inputPausedAt = 0;
    this.visibilityPausedAt = null;
    if (!this.isTouchControlEnabled()) return;

    const controls = document.createElement('div');
    controls.className = 'driving-touch-controls';
    Object.assign(controls.style, {
      position: 'absolute',
      inset: '0',
      zIndex: '12',
      pointerEvents: 'none',
      touchAction: 'none',
      userSelect: 'none',
      WebkitUserSelect: 'none',
    });

    const steering = document.createElement('div');
    steering.dataset.drivingControlGroup = 'steering';
    Object.assign(steering.style, {
      position: 'absolute',
      left: 'max(14px, env(safe-area-inset-left))',
      bottom: 'max(14px, env(safe-area-inset-bottom))',
      width: '140px',
      height: '140px',
      pointerEvents: 'auto',
    });

    const pedals = document.createElement('div');
    pedals.dataset.drivingControlGroup = 'pedals';
    Object.assign(pedals.style, {
      position: 'absolute',
      right: 'max(14px, env(safe-area-inset-right))',
      bottom: 'max(14px, env(safe-area-inset-bottom))',
      display: 'flex',
      gap: '8px',
      pointerEvents: 'auto',
    });

    // Above the pedals, so the speedometer in the middle stays visible.
    const camera = CreateDrivingTouchButton('CAM', 'Switch camera view');
    camera.dataset.drivingControlGroup = 'camera';
    Object.assign(camera.style, {
      position: 'absolute',
      right: 'max(14px, env(safe-area-inset-right))',
      bottom: 'calc(max(14px, env(safe-area-inset-bottom)) + 74px)',
      minWidth: '64px',
      height: '44px',
      pointerEvents: 'auto',
      fontSize: '13px',
    });
    camera.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      this.cycleCameraMode();
    });

    const wheel = document.createElement('div');
    wheel.dataset.drivingControlVisual = 'wheel';
    Object.assign(wheel.style, {
      position: 'absolute',
      inset: '0',
      background: 'var(--primary)',
      mask: `url(${steeringWheelUrl}) center / contain no-repeat`,
      WebkitMask: `url(${steeringWheelUrl}) center / contain no-repeat`,
      filter: 'drop-shadow(0 4px 8px var(--bg-overlay))',
      pointerEvents: 'none',
      transition: 'transform 120ms ease-out',
    });
    const left = this.createDrivingPressButton('', 'Steer left', ['left']);
    const right = this.createDrivingPressButton('', 'Steer right', ['right']);
    const throttle = this.createDrivingPressButton('', 'Throttle', ['up']);
    const brake = this.createDrivingPressButton('', 'Brake', ['down']);

    for (const button of [left, right]) {
      Object.assign(button.style, {
        position: 'absolute',
        top: '0',
        bottom: '0',
        minWidth: '0',
        width: '50%',
        height: '100%',
        padding: '0',
        border: '0',
        borderRadius: '50%',
        background: 'transparent',
        boxShadow: 'none',
      });
    }
    left.style.left = '0';
    right.style.right = '0';
    const renderWheel = () => {
      wheel.style.transform = `rotate(${this.keyState.left ? -28 : this.keyState.right ? 28 : 0}deg) scale(${this.keyState.left || this.keyState.right ? 0.96 : 1})`;
    };
    for (const button of [left, right]) {
      button.addEventListener('pointerdown', renderWheel);
      button.addEventListener('pointerup', renderWheel);
      button.addEventListener('pointercancel', renderWheel);
      button.addEventListener('lostpointercapture', renderWheel);
    }
    Object.assign(throttle.style, {
      minWidth: '88px',
      width: '88px',
      height: '64px',
      padding: '9px 24px',
      borderRadius: '18px',
      background: 'color-mix(in srgb, var(--success) 72%, transparent)',
      backgroundImage: `url(${carPedalsUrl})`,
      backgroundPosition: '25% 52%',
      backgroundRepeat: 'no-repeat',
      backgroundSize: '650% auto',
      color: 'var(--text-on-accent)',
      transformOrigin: 'bottom',
      transition: 'transform 90ms ease-out, filter 90ms ease-out',
    });
    Object.assign(brake.style, {
      minWidth: '88px',
      width: '88px',
      height: '64px',
      padding: '12px 10px',
      borderRadius: '18px',
      background: 'color-mix(in srgb, var(--error) 76%, transparent)',
      backgroundImage: `url(${carPedalsUrl})`,
      backgroundPosition: '59% 54%',
      backgroundRepeat: 'no-repeat',
      backgroundSize: '650% auto',
      color: 'var(--text-on-accent)',
      transformOrigin: 'bottom',
      transition: 'transform 90ms ease-out, filter 90ms ease-out',
    });
    for (const [button, key] of [[brake, 'down'], [throttle, 'up']] as const) {
      const renderPedal = () => {
        const pressed = this.keyState[key];
        button.style.transform = pressed ? 'perspective(120px) rotateX(-14deg) translateY(7px)' : 'none';
      };
      button.addEventListener('pointerdown', renderPedal);
      button.addEventListener('pointerup', renderPedal);
      button.addEventListener('pointercancel', renderPedal);
      button.addEventListener('lostpointercapture', renderPedal);
    }

    steering.append(wheel, left, right);
    pedals.append(brake, throttle);
    controls.append(steering, pedals, camera);
    root.appendChild(controls);
    this.touchControlsRoot = controls;
    this.syncTouchControlsLayout();
  }

  private createDrivingPressButton(
    label: string,
    ariaLabel: string,
    keys: DrivingTouchKey[],
  ) {
    const button = CreateDrivingTouchButton(label, ariaLabel);
    const setPressed = (pressed: boolean) => {
      for (const key of keys) {
        this.keyState[key] = pressed;
      }
    };
    const release = (event: PointerEvent) => {
      event.preventDefault();
      setPressed(false);
      this.captureSteeringInputTimestamp(event.timeStamp);
    };

    button.addEventListener('pointerdown', (event) => {
      event.preventDefault();
      event.stopPropagation();
      button.setPointerCapture(event.pointerId);
      if (keys.includes('down') && !this.keyState.down) {
        this.captureBrakeInputTimestamp(event.timeStamp);
      }
      setPressed(true);
      this.captureSteeringInputTimestamp(event.timeStamp);
    });
    button.addEventListener('pointerup', release);
    button.addEventListener('pointercancel', release);
    button.addEventListener('lostpointercapture', release);
    button.addEventListener('contextmenu', (event) => event.preventDefault());
    return button;
  }

  private initInputPauseOverlay(root: HTMLDivElement) {
    this.inputPauseOverlay?.remove();
    const overlay = document.createElement('div');
    overlay.setAttribute('role', 'alert');
    overlay.setAttribute('aria-live', 'assertive');
    Object.assign(overlay.style, {
      position: 'absolute',
      inset: '0',
      zIndex: '60',
      display: 'none',
      placeItems: 'center',
      padding: '24px',
      background: 'var(--bg-overlay)',
      color: 'var(--text-primary)',
      textAlign: 'center',
      pointerEvents: 'auto',
    });
    const message = document.createElement('div');
    Object.assign(message.style, {
      width: 'min(520px, 100%)',
      padding: '22px',
      border: '1px solid var(--border-hover)',
      borderRadius: 'var(--radius-l)',
      background: 'var(--bg-card)',
    });
    const title = document.createElement('strong');
    title.textContent = this.text.inputPausedTitle;
    Object.assign(title.style, { display: 'block', fontSize: '22px', lineHeight: '1.3' });
    const detail = document.createElement('p');
    detail.textContent = this.text.inputPausedDetail;
    Object.assign(detail.style, { margin: '10px 0 0', fontSize: '15px', lineHeight: '1.55' });
    message.append(title, detail);
    overlay.append(message);
    root.appendChild(overlay);
    this.inputPauseOverlay = overlay;
  }

  private shouldPreventKeyDefault(code: string): boolean {
    if (code === 'Space') return true;
    if (this.controlMode === 'arrow') {
      return ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(code);
    }
    if (this.controlMode === 'wasd') {
      return ['KeyA', 'KeyD', 'KeyW', 'KeyS'].includes(code);
    }
    return false;
  }

  private setKeyboardInput(code: string, pressed: boolean, eventTimestamp: number) {
    if (this.controlMode === 'arrow') {
      if (code === 'ArrowLeft') this.keyState.left = pressed;
      if (code === 'ArrowRight') this.keyState.right = pressed;
      if (code === 'ArrowUp') this.keyState.up = pressed;
      if (code === 'ArrowDown' || code === 'Space') {
        if (pressed && !this.keyState.down) {
          this.captureBrakeInputTimestamp(eventTimestamp);
        }
        this.keyState.down = pressed;
      }
      this.captureSteeringInputTimestamp(eventTimestamp);
      return;
    }
    if (this.controlMode === 'wasd') {
      if (code === 'KeyA') this.keyState.left = pressed;
      if (code === 'KeyD') this.keyState.right = pressed;
      if (code === 'KeyW') this.keyState.up = pressed;
      if (code === 'KeyS' || code === 'Space') {
        if (pressed && !this.keyState.down) {
          this.captureBrakeInputTimestamp(eventTimestamp);
        }
        this.keyState.down = pressed;
      }
      this.captureSteeringInputTimestamp(eventTimestamp);
    }
  }

  private attachGamepadListeners() {
    this.gamepadConnectedListener = (event: GamepadEvent) => {
      if (this.controlMode !== 'wheel' || !IsDrivingWheelGamepad(event.gamepad)) return;
      this.gamepadConnected = true;
      if (this.hud?.event) this.hud.event.textContent = this.format(this.text.controllerConnected, { id: event.gamepad.id });
    };
    this.gamepadDisconnectedListener = () => {
      if (this.controlMode !== 'wheel') return;
      this.gamepadConnected = FindDrivingWheelGamepad(navigator.getGamepads?.() ?? []) !== null;
      if (this.hud?.event && !this.gamepadConnected) this.hud.event.textContent = this.text.controllerDisconnected;
    };
    window.addEventListener('gamepadconnected', this.gamepadConnectedListener);
    window.addEventListener('gamepaddisconnected', this.gamepadDisconnectedListener);
  }

  private initScene(root: HTMLDivElement) {
    this.root = root;
    const renderer = new PixelDrivingRenderer({
      pixelBudget: this.getPixelBudget(),
      spriteUrl: spriteAtlasUrl,
      wheelUrl: steeringWheelUrl,
    });
    this.renderer = renderer;
    root.dataset.drivingRenderer = 'canvas-2d-pixel';
    root.appendChild(renderer.domElement);
    this.viewportController = new DrivingViewportController({
      renderer,
      camera: this.viewportCamera,
      root,
      pixelRatioCap: this.renderQuality.pixelRatioCap,
      onLayoutChange: () => this.syncMobileHudLayout(),
    });
    this.viewportController.start();

    this.buildWorld();
    this.createAmbientTraffic();
    this.createRearTraffic();
    this.preloadHazardEvents();
  }

  // Number of game pixels on screen; CSS scales them up without smoothing.
  private getPixelBudget(): number {
    if (this.renderQuality.level === 'low') return 64_000;
    if (this.renderQuality.level === 'medium') return 96_000;
    return 129_600;
  }

  private getMainDrawDistance(): number {
    if (this.renderQuality.level === 'low') return 180;
    if (this.renderQuality.level === 'medium') return 240;
    return 300;
  }

  private isTouchLandscape() {
    if (!this.isTouchControlEnabled()) return false;
    if (typeof window.matchMedia === 'function') {
      return window.matchMedia('(orientation: landscape)').matches;
    }
    return window.innerWidth >= window.innerHeight;
  }

  private isTouchControlEnabled() {
    return this.controlMode === 'touch' && navigator.maxTouchPoints > 0;
  }

  private syncTouchControlsLayout() {
    const controls = this.touchControlsRoot;
    if (!controls) return;
    const width = controls.clientWidth || controls.parentElement?.clientWidth || window.innerWidth;
    const height = controls.clientHeight || controls.parentElement?.clientHeight || window.innerHeight;
    const compact = width < 420 || height > width;
    const veryNarrow = width < 240;
    const steering = controls.querySelector<HTMLElement>('[data-driving-control-group="steering"]');
    const pedals = controls.querySelector<HTMLElement>('[data-driving-control-group="pedals"]');
    const camera = controls.querySelector<HTMLElement>('[data-driving-control-group="camera"]');
    const pedalButtons = pedals?.querySelectorAll<HTMLElement>('button') ?? [];
    const steeringSize = compact ? Math.max(92, Math.min(116, Math.floor(width * 0.3))) : 140;
    const pedalWidth = compact ? Math.max(54, Math.min(72, Math.floor(width * 0.21))) : 88;
    const pedalHeight = compact ? 52 : 64;
    const sideInset = compact ? 'max(8px, env(safe-area-inset-left))' : 'max(14px, env(safe-area-inset-left))';
    const bottomInset = compact ? 'max(8px, env(safe-area-inset-bottom))' : 'max(14px, env(safe-area-inset-bottom))';

    if (steering) {
      steering.style.left = sideInset;
      steering.style.bottom = veryNarrow
        ? `calc(${bottomInset} + ${pedalHeight + 18}px)`
        : bottomInset;
      steering.style.width = `${steeringSize}px`;
      steering.style.height = `${steeringSize}px`;
    }
    if (pedals) {
      pedals.style.right = compact
        ? 'max(8px, env(safe-area-inset-right))'
        : 'max(14px, env(safe-area-inset-right))';
      pedals.style.bottom = bottomInset;
      pedals.style.gap = compact ? '6px' : '8px';
    }
    for (const button of pedalButtons) {
      button.style.minWidth = `${pedalWidth}px`;
      button.style.width = `${pedalWidth}px`;
      button.style.height = `${pedalHeight}px`;
      button.style.borderRadius = compact ? '15px' : '18px';
      button.style.fontSize = compact ? '12px' : button.getAttribute('aria-label') === 'Throttle' ? '15px' : '13px';
    }
    if (camera) {
      camera.style.minWidth = compact ? '54px' : '64px';
      camera.style.height = compact ? '40px' : '44px';
      camera.style.right = pedals?.style.right ?? '';
      camera.style.bottom = `calc(${bottomInset} + ${veryNarrow ? pedalHeight + steeringSize + 26 : pedalHeight + 10}px)`;
      camera.style.fontSize = compact ? '11px' : '13px';
    }
  }

  private syncMobileHudLayout() {
    this.syncTouchControlsLayout();
    this.applyHudLayout();
    this.syncCockpitTopOverlay();
  }

  // Lets the renderer hang the interior mirror below the status panel when
  // the panel would cover it.
  private syncCockpitTopOverlay() {
    const panel = this.hud?.panel;
    const root = this.root;
    if (!panel || !root || !this.renderer) return;
    const rootBox = root.getBoundingClientRect();
    const box = panel.getBoundingClientRect();
    this.renderer.setTopOverlay({ left: box.left - rootBox.left, right: box.right - rootBox.left, bottom: box.bottom - rootBox.top });
  }

  private applyHudLayout() {
    const hud = this.hud;
    const miniMapWrapper = hud?.miniMapWrapper;
    if (!miniMapWrapper) return;

    const directionLabel = this.miniMapDirectionLabel;
    const titleBar = miniMapWrapper.querySelector<HTMLElement>('[data-minimap-title]');
    const hudPanel = hud?.panel;
    const isLandscapeTouch = this.isTouchLandscape();
    if (isLandscapeTouch) {
      Object.assign(miniMapWrapper.style, {
        top: 'max(12px, env(safe-area-inset-top))',
        left: 'max(12px, env(safe-area-inset-left))',
        right: 'auto',
        bottom: 'auto',
        width: '148px',
        height: '126px',
        borderRadius: '12px',
        transform: 'none',
      });
      if (directionLabel) {
        Object.assign(directionLabel.style, {
          minHeight: '36px',
          padding: '6px 8px',
          fontSize: '12px',
          lineHeight: '1.15',
        });
      }
      if (titleBar) titleBar.style.display = 'none';
      if (hudPanel) {
        Object.assign(hudPanel.style, {
          top: 'max(12px, env(safe-area-inset-top))',
          left: 'calc(max(12px, env(safe-area-inset-left)) + 160px)',
          minWidth: '0',
          width: 'min(232px, calc(100vw - 190px))',
          maxWidth: 'calc(100vw - 190px)',
          padding: '7px 9px',
          gap: '4px',
          fontSize: '11px',
          lineHeight: '1.25',
        });
      }
      return;
    }

    if (this.isTouchControlEnabled()) {
      Object.assign(miniMapWrapper.style, {
        top: 'max(10px, env(safe-area-inset-top))',
        left: 'max(10px, env(safe-area-inset-left))',
        right: 'auto',
        bottom: 'auto',
        width: '132px',
        height: '112px',
        borderRadius: '11px',
        transform: 'none',
      });
      if (directionLabel) {
        Object.assign(directionLabel.style, {
          minHeight: '34px',
          padding: '5px 7px',
          fontSize: '11px',
          lineHeight: '1.15',
        });
      }
      if (titleBar) titleBar.style.display = 'none';
      if (hudPanel) {
        Object.assign(hudPanel.style, {
          top: 'max(10px, env(safe-area-inset-top))',
          left: 'calc(max(10px, env(safe-area-inset-left)) + 142px)',
          minWidth: '0',
          width: 'calc(100vw - max(10px, env(safe-area-inset-left)) - 152px)',
          maxWidth: 'none',
          padding: '6px 7px',
          gap: '3px',
          fontSize: '10px',
          lineHeight: '1.2',
        });
      }
      return;
    }

    const root = this.root;
    const mapRect = CalculateDesktopMiniMapRect(root?.clientWidth || window.innerWidth, root?.clientHeight || window.innerHeight);
    Object.assign(miniMapWrapper.style, {
      top: `${mapRect.y}px`,
      left: 'auto',
      right: '18px',
      bottom: 'auto',
      width: `${mapRect.w}px`,
      height: `${mapRect.h}px`,
      borderRadius: '16px',
      transform: 'none',
    });
    if (directionLabel) {
      Object.assign(directionLabel.style, {
        minHeight: '54px',
        padding: '10px 14px',
        fontSize: '15px',
        lineHeight: '1.25',
      });
    }
    if (titleBar) titleBar.style.display = mapRect.h >= 220 ? 'flex' : 'none';
    if (hudPanel) {
      Object.assign(hudPanel.style, {
        top: '16px',
        left: '16px',
        minWidth: '220px',
        width: 'auto',
        maxWidth: 'min(420px, calc(100vw - 280px))',
        padding: '10px 12px',
        gap: '6px',
        fontSize: '13px',
        lineHeight: '1.3',
      });
    }
  }

  private getDifficultyFogRange(): { near: number; far: number } {
    if (this.difficultyPreset === difficultyPresets.advanced) {
      return {
        near: this.renderQuality.fogNear * 0.46,
        far: this.renderQuality.fogFar * 0.54,
      };
    }

    if (this.difficultyPreset === difficultyPresets.intermediate) {
      return {
        near: this.renderQuality.fogNear * 0.68,
        far: this.renderQuality.fogFar * 0.76,
      };
    }

    return {
      near: this.renderQuality.fogNear,
      far: this.renderQuality.fogFar,
    };
  }

  private initHud(root: HTMLDivElement, redFlashEnabled: boolean) {
    const hud = document.createElement('div');
    Object.assign(hud.style, {
      position: 'absolute',
      inset: '0',
      zIndex: '10',
      pointerEvents: 'none',
    });

    const status = document.createElement('div');
    const route = document.createElement('div');
    const speed = document.createElement('div');
    const distance = document.createElement('div');
    const view = document.createElement('div');
    const event = document.createElement('div');
    status.textContent = this.text.taskDelivery;
    route.textContent = this.getRouteHudText();
    speed.textContent = '0 km/h';
    distance.textContent = '0 m';
    view.textContent = this.getCameraModeText();
    event.textContent = this.text.watchRoad;

    const hudPanel = document.createElement('div');
    hudPanel.dataset.drivingHud = 'status';
    Object.assign(hudPanel.style, {
      position: 'absolute',
      top: '16px',
      left: '16px',
      display: 'grid',
      gap: '6px',
      minWidth: '220px',
      maxWidth: 'min(420px, calc(100vw - 280px))',
      padding: '10px 12px',
      borderRadius: '8px',
      background: 'rgba(15, 23, 42, 0.72)',
      color: '#fff',
      fontSize: '13px',
      lineHeight: '1.3',
      boxShadow: '0 10px 26px rgba(0,0,0,0.22)',
      backdropFilter: 'blur(4px)',
    });
    Object.assign(status.style, { fontWeight: '800' });
    Object.assign(route.style, {
      color: 'rgba(191,219,254,0.95)',
      fontSize: '12px',
      fontWeight: '800',
      overflowWrap: 'anywhere',
    });
    Object.assign(event.style, { color: 'rgba(226,232,240,0.92)' });
    const metrics = document.createElement('div');
    Object.assign(metrics.style, {
      display: 'flex',
      gap: '10px',
      flexWrap: 'wrap',
      color: 'rgba(226,232,240,0.88)',
      fontSize: '12px',
      fontWeight: '700',
    });
    metrics.append(speed, distance, view);
    hudPanel.append(status, route, metrics, event);

    const redFlash = document.createElement('div');
    Object.assign(redFlash.style, {
      position: 'absolute',
      inset: '0',
      opacity: '0',
      transition: 'opacity 90ms linear',
      boxShadow: redFlashEnabled ? 'inset 0 0 0 22px rgba(255, 46, 46, 0.86), inset 0 0 80px rgba(255, 0, 0, 0.42)' : 'none',
    });

    const blackout = document.createElement('div');
    Object.assign(blackout.style, {
      position: 'absolute',
      inset: '0',
      zIndex: '25',
      opacity: '0',
      pointerEvents: 'none',
      background: '#000',
      transition: `opacity ${this.laneResetBlackoutMs}ms ease`,
    });

    const miniMapWrapper = this.createMiniMap();

    hud.append(redFlash, hudPanel, miniMapWrapper, blackout);
    root.appendChild(hud);

    this.hud = { status, route, speed, distance, view, event, redFlash, blackout, panel: hudPanel, miniMapWrapper };
    this.updateCameraModeHud();
    this.syncMobileHudLayout();
    // Longer event text can wrap the panel onto another line.
    if (typeof ResizeObserver === 'function') {
      this.hudPanelObserver = new ResizeObserver(() => this.syncCockpitTopOverlay());
      this.hudPanelObserver.observe(hudPanel);
    }
  }

  /** Create the GPS-style mini-map navigation panel */
  private createMiniMap(): HTMLDivElement {
    const wrapper = document.createElement('div');
    Object.assign(wrapper.style, {
      position: 'absolute',
      bottom: '28px',
      right: '18px',
      width: '236px',
      height: '278px',
      borderRadius: '16px',
      overflow: 'hidden',
      border: '1px solid rgba(15,23,42,0.18)',
      background: '#f8fafc',
      boxShadow: '0 14px 34px rgba(0,0,0,0.38), 0 1px 0 rgba(255,255,255,0.9) inset',
      zIndex: '15',
      display: 'flex',
      flexDirection: 'column',
    });

    // Turn instruction, styled like a navigation step banner.
    const dirLabel = document.createElement('div');
    dirLabel.setAttribute('data-minimap-dir', '');
    Object.assign(dirLabel.style, {
      minHeight: '54px',
      padding: '10px 14px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      color: '#fff',
      background: '#1a73e8',
      fontSize: '15px',
      fontWeight: '800',
      lineHeight: '1.25',
      textAlign: 'center',
      boxShadow: '0 1px 0 rgba(255,255,255,0.18) inset',
    });
    dirLabel.textContent = `\u2191 ${this.text.straight}`;

    // Compact title bar.
    const titleBar = document.createElement('div');
    titleBar.setAttribute('data-minimap-title', '');
    Object.assign(titleBar.style, {
      padding: '7px 12px',
      background: '#fff',
      borderBottom: '1px solid rgba(15,23,42,0.08)',
      display: 'flex',
      alignItems: 'center',
      gap: '6px',
      fontSize: '11px',
      fontWeight: '700',
      color: '#334155',
    });
    const icon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    icon.setAttribute('width', '14');
    icon.setAttribute('height', '14');
    icon.setAttribute('viewBox', '0 0 24 24');
    icon.setAttribute('fill', 'none');
    icon.setAttribute('stroke', '#1a73e8');
    icon.setAttribute('stroke-width', '2.5');
    icon.setAttribute('stroke-linecap', 'round');
    icon.setAttribute('stroke-linejoin', 'round');
    const polygon = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
    polygon.setAttribute('points', '3 11 22 2 13 21 11 13 3 11');
    icon.appendChild(polygon);
    const titleText = document.createElement('span');
    titleText.textContent = this.text.navigation;
    titleBar.append(icon, titleText);

    // Canvas
    const canvas = document.createElement('canvas');
    canvas.width = 236;
    canvas.height = 194;
    Object.assign(canvas.style, {
      width: '100%',
      minHeight: '0',
      flex: '1',
      display: 'block',
    });

    wrapper.append(dirLabel, titleBar, canvas);
    this.miniMapDirectionLabel = dirLabel;
    this.miniMapCanvas = canvas;
    this.miniMapCtx = canvas.getContext('2d');

    return wrapper;
  }

  /** Render the mini-map each frame */
  private updateMiniMap() {
    const ctx = this.miniMapCtx;
    const canvas = this.miniMapCanvas;
    if (!ctx || !canvas) return;

    const now = performance.now();
    if (now - this.miniMapLastUpdateTime < this.getMiniMapUpdateIntervalMs()) return;
    this.miniMapLastUpdateTime = now;

    const w = canvas.width;
    const h = canvas.height;
    const vehicleBox = this.getVehicleCollisionBox();
    const forward = this.getForwardVector(this.vehicleHeading);
    const right = this.getRightVector(this.vehicleHeading);
    const scale = 1.72;
    const originX = w / 2;
    const originY = h * 0.76;

    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = '#eef3f1';
    ctx.fillRect(0, 0, w, h);

    const toScreen = (px: number, pz: number) => ({
      sx: originX + ((px - vehicleBox.centerX) * right.x + (pz - vehicleBox.centerZ) * right.z) * scale,
      sy: originY - ((px - vehicleBox.centerX) * forward.x + (pz - vehicleBox.centerZ) * forward.z) * scale,
    });

    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    const drawPath = (fromDistance: number, toDistance: number, color: string, widthPx: number) => {
      const from = this.clamp(fromDistance, 0, this.routeLength);
      const to = this.clamp(toDistance, 0, this.routeLength);
      if (to <= from) return;

      ctx.strokeStyle = color;
      ctx.lineWidth = widthPx;
      ctx.beginPath();

      const firstPoint = this.getDrivingLanePoint(from);
      const firstScreen = toScreen(firstPoint.x, firstPoint.z);
      ctx.moveTo(firstScreen.sx, firstScreen.sy);

      this.forEachMiniMapRouteSample(from, to, (sample) => {
        const screen = toScreen(sample.x, sample.z);
        ctx.lineTo(screen.sx, screen.sy);
      });

      const endPoint = this.getDrivingLanePoint(to);
      const endScreen = toScreen(endPoint.x, endPoint.z);
      ctx.lineTo(endScreen.sx, endScreen.sy);
      ctx.stroke();
    };

    const visibleBack = Math.max(0, this.progress - 18);
    const visibleAhead = Math.min(this.routeLength, this.progress + 126);
    drawPath(visibleBack, visibleAhead, 'rgba(148, 163, 184, 0.28)', 28);
    drawPath(visibleBack, visibleAhead, '#ffffff', 20);
    drawPath(this.progress, visibleAhead, '#1a73e8', 12);
    drawPath(this.progress, visibleAhead, '#185abc', 3);

    const nextInter = this.intersections.find((iz) => !iz.entered && this.progress < iz.distance);
    if (nextInter) {
      const point = this.getDrivingLanePoint(nextInter.distance);
      const screen = toScreen(point.x, point.z);
      if (screen.sx > -24 && screen.sx < w + 24 && screen.sy > -24 && screen.sy < h + 24) {
        ctx.fillStyle = '#fff';
        ctx.strokeStyle = '#1a73e8';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(screen.sx, screen.sy, 10, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = '#1a73e8';
        ctx.font = `bold 13px ${typography.fontFamily}`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(this.getNavigationArrow(nextInter.turnDir), screen.sx, screen.sy + 0.5);
      }
    }

    const destPt = this.getDrivingLanePoint(this.routeLength - 2);
    const destScreen = toScreen(destPt.x, destPt.z);
    if (destScreen.sx > -18 && destScreen.sx < w + 18 && destScreen.sy > -18 && destScreen.sy < h + 18) {
      ctx.fillStyle = '#ef4444';
      ctx.beginPath();
      ctx.arc(destScreen.sx, destScreen.sy, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.font = `bold 9px ${typography.fontFamily}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('B', destScreen.sx, destScreen.sy + 0.2);
    }

    // Current car position stays as a small blue dot near the bottom,
    // matching turn-by-turn navigation rather than an overview map.
    const cs = { sx: originX, sy: originY };
    const pulse = 0.5 + 0.5 * Math.sin(now / 300);

    ctx.strokeStyle = `rgba(26, 115, 232, ${0.22 + pulse * 0.16})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(cs.sx, cs.sy, 9 + pulse * 3, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(cs.sx, cs.sy, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#1a73e8';
    ctx.beginPath();
    ctx.arc(cs.sx, cs.sy, 5, 0, Math.PI * 2);
    ctx.fill();

    const dirLabel = this.miniMapDirectionLabel;
    if (dirLabel) {
      let nextText = '';
      if (nextInter) {
        const dist = Math.round(nextInter.distance - this.progress);
        const arrow = this.getNavigationArrow(nextInter.turnDir);
        nextText = `${arrow} ${this.format(this.text.turnAfterMeters, { dist, instruction: nextInter.instruction })}`;
      } else {
        nextText = `\u2191 ${this.text.straightToDestination}`;
      }
      if (nextText !== this.miniMapLastDirectionText) {
        dirLabel.textContent = nextText;
        this.miniMapLastDirectionText = nextText;
      }
    }
  }

  private getMiniMapUpdateIntervalMs(): number {
    if (this.renderQuality.level === 'low') return 66;
    if (this.renderQuality.level === 'medium') return 50;
    return 33;
  }

  private createMiniMapRouteSamples(): MiniMapRouteSample[] {
    if (this.routeLength <= 0) return [];

    const samples: MiniMapRouteSample[] = [];
    const step = 3;
    for (let distance = 0; distance <= this.routeLength; distance += step) {
      const lanePoint = this.getDrivingLanePoint(distance);
      samples.push({ distance, x: lanePoint.x, z: lanePoint.z });
    }

    const last = this.getDrivingLanePoint(this.routeLength);
    const lastSample = samples[samples.length - 1];
    if (!lastSample || lastSample.distance < this.routeLength) {
      samples.push({ distance: this.routeLength, x: last.x, z: last.z });
    }
    return samples;
  }

  private forEachMiniMapRouteSample(
    from: number,
    to: number,
    callback: (sample: MiniMapRouteSample) => void,
  ) {
    for (const sample of this.miniMapRouteSamples) {
      if (sample.distance <= from) continue;
      if (sample.distance >= to) break;
      callback(sample);
    }
  }

  private getRearviewUpdateIntervalMs(): number {
    return 1000 / 30;
  }

  private buildWorld() {
    this.roadCollisionBoxes = [];
    this.buildingCollisionBoxes = [];
    const world = new PixelWorldBuilder();

    let segmentStartDistance = 0;
    for (const segment of this.route) {
      const mid = {
        x: segment.start.x + segment.dir.x * segment.length / 2,
        z: segment.start.z + segment.dir.z * segment.length / 2,
      };
      const heading = this.getHeadingFromDirection(segment.dir);
      const normal = this.getRouteRightVector(segment.dir);
      const roadWidth = this.getSegmentRoadWidth(segment);

      this.addRoadSurface(world, segment.start, segment.dir, normal, 0, segment.length, roadWidth, segmentStartDistance);
      this.roadCollisionBoxes.push({
        centerX: mid.x,
        centerZ: mid.z,
        angle: heading,
        halfWidth: roadWidth / 2,
        halfLength: segment.length / 2,
      });

      this.addRoadEdgeMarkings(world, segment, segmentStartDistance, normal);
      this.addLaneMarkings(world, segment, segmentStartDistance, normal);
      segmentStartDistance += segment.length;
    }

    this.addLeftDriveStopLines(world);
    this.addTrafficLights(world);

    for (const inter of this.intersections) {
      const point = this.getRoutePoint(inter.distance);
      const approachWidth = this.getSegmentRoadWidth(this.route[inter.segmentIndex]);
      const nextWidth = this.getSegmentRoadWidth(this.route[inter.segmentIndex + 1] ?? this.route[inter.segmentIndex]);
      const intersectionWidth = Math.max(approachWidth, nextWidth) + 18;
      const crossHeading = this.getHeadingFromDirection(point.normal);
      world.addStrip(
        point,
        point.dir,
        point.normal,
        -(approachWidth + 18) / 2,
        (approachWidth + 18) / 2,
        -intersectionWidth / 2,
        intersectionWidth / 2,
        worldColors.intersection,
        groundLayer.asphalt,
      );
      this.roadCollisionBoxes.push({
        centerX: point.x,
        centerZ: point.z,
        angle: crossHeading,
        halfWidth: (approachWidth + 18) / 2,
        halfLength: intersectionWidth / 2,
      });
      this.addCrossStreets(world, inter, point, approachWidth, nextWidth, intersectionWidth);
    }
    this.addBuildings(world);
    this.addTaiwanStreetDetails(world);
    this.addTurnSignage(world);
    this.addDestinationMarker(world);
    this.pixelWorld = world.finish();
  }

  // Asphalt in alternating bands, the speed cue javascript-racer uses, with a
  // curb and a sidewalk on both sides. Curbs near intersections are painted
  // red (no stopping), as on Taipei streets.
  private addRoadSurface(
    world: PixelWorldBuilder,
    origin: Vec2,
    dir: Vec2,
    normal: Vec2,
    from: number,
    to: number,
    roadWidth: number,
    routeStart: number | null,
  ) {
    const half = roadWidth / 2;
    const step = 6;
    const curbWidth = 0.25;
    const curbPiece = 1.5;
    for (let start = from; start < to - 0.01; start += step) {
      const end = Math.min(to, start + step);
      const band = Math.floor(((routeStart ?? 0) + start) / step) % 2 === 0;
      world.addStrip(origin, dir, normal, start, end, -half, half, band ? worldColors.asphalt : worldColors.asphaltBand, groundLayer.asphalt);
      const redCurb = routeStart !== null && this.isNearIntersection(routeStart + (start + end) / 2, this.roadMarkingIntersectionClearance);
      for (const side of [-1, 1]) {
        const curbInner = side * half;
        const curbOuter = side * (half + curbWidth);
        const walkOuter = side * (half + curbWidth + this.sidewalkWidth);
        world.addStrip(
          origin, dir, normal, start, end,
          Math.min(curbOuter, walkOuter), Math.max(curbOuter, walkOuter),
          band ? worldColors.sidewalk : worldColors.sidewalkBand,
          groundLayer.sidewalk,
        );
        if (!redCurb) {
          world.addStrip(origin, dir, normal, start, end, Math.min(curbInner, curbOuter), Math.max(curbInner, curbOuter), worldColors.curb, groundLayer.curb);
          continue;
        }
        for (let piece = start; piece < end - 0.01; piece += curbPiece) {
          const red = Math.floor(((routeStart ?? 0) + piece) / curbPiece) % 2 === 0;
          world.addStrip(
            origin, dir, normal, piece, Math.min(end, piece + curbPiece),
            Math.min(curbInner, curbOuter), Math.max(curbInner, curbOuter),
            red ? worldColors.curbRed : worldColors.curb,
            groundLayer.curb,
          );
        }
      }
    }
  }

  // Side streets leave each intersection so it reads as a crossing, not a
  // corner. They are scenery only and have no collision boxes.
  private addCrossStreets(world: PixelWorldBuilder, inter: IntersectionZone, point: RoutePoint, approachWidth: number, nextWidth: number, intersectionWidth: number) {
    const armLength = 60;
    const next = this.route[inter.segmentIndex + 1];
    const arms: Array<{ dir: Vec2; from: number; width: number }> = [
      { dir: point.dir, from: (approachWidth + 18) / 2, width: approachWidth },
      { dir: point.normal, from: intersectionWidth / 2, width: nextWidth },
      { dir: { x: -point.normal.x, z: -point.normal.z }, from: intersectionWidth / 2, width: nextWidth },
    ];
    for (const arm of arms) {
      // The route itself already paves the arm it continues along.
      if (next && arm.dir.x * next.dir.x + arm.dir.z * next.dir.z > 0.9) continue;
      this.addRoadSurface(world, point, arm.dir, this.getRouteRightVector(arm.dir), arm.from, armLength, arm.width, null);
    }
  }

  private addLeftDriveStopLines(world: PixelWorldBuilder) {
    for (const inter of this.intersections) {
      const segment = this.route[inter.segmentIndex];
      if (!segment) continue;

      const localDistance = Math.max(1, segment.length - this.stopLineSetback);
      const normal = this.getRouteRightVector(segment.dir);
      const roadWidth = this.getSegmentRoadWidth(segment);
      const laneOffset = this.getDrivingLaneOffset(inter.distance - this.stopLineSetback);
      const laneWidth = Math.max(3.0, roadWidth / 2 - 1.6);
      this.addMarking(world, segment.start, segment.dir, normal, localDistance, laneOffset, laneWidth, 0.72, worldColors.white);
    }
  }

  private addTrafficLights(world: PixelWorldBuilder) {
    this.intersections.forEach((inter, index) => {
      const segment = this.route[inter.segmentIndex];
      if (!segment) return;

      const normal = this.getRouteRightVector(segment.dir);
      const localDistance = Math.max(2, segment.length - this.stopLineSetback - 2.4);
      const roadWidth = this.getSegmentRoadWidth(segment);
      const base = {
        x: segment.start.x + segment.dir.x * localDistance + normal.x * (roadWidth / 2 + 1.2),
        z: segment.start.z + segment.dir.z * localDistance + normal.z * (roadWidth / 2 + 1.2),
      };
      // A small kerbed island keeps the signal post off the intersection asphalt.
      world.addStrip(base, segment.dir, normal, -0.9, 0.9, -0.9, 0.9, worldColors.sidewalk, groundLayer.paint);
      world.addProp({ x: base.x, z: base.z, signal: index });
    });
  }

  private addTaiwanStreetDetails(world: PixelWorldBuilder) {
    for (const inter of this.intersections) {
      const segment = this.route[inter.segmentIndex];
      if (!segment) continue;
      const normal = this.getRouteRightVector(segment.dir);
      const boxDistance = Math.max(2, segment.length - this.stopLineSetback - 6.2);
      const roadWidth = this.getSegmentRoadWidth(segment);
      const laneOffset = this.getDrivingLaneOffset(inter.distance - this.stopLineSetback);

      // Scooter waiting box with its white side lines.
      this.addMarking(world, segment.start, segment.dir, normal, boxDistance, laneOffset, Math.max(3.4, roadWidth / 2 - 1.4), 4.8, worldColors.scooterBox);
      for (const side of [-1, 1]) {
        this.addMarking(world, segment.start, segment.dir, normal, boxDistance, laneOffset + side * (roadWidth / 4 - 0.35), 0.14, 4.8, worldColors.white);
      }
    }

    const streetDetailStep = this.renderQuality.level === 'low' ? 44 : 22;
    for (let d = 18; d < this.routeLength - 12; d += streetDetailStep) {
      const point = this.getRoutePoint(d);
      const roadWidth = point.roadWidth;
      const slot = Math.floor(d / 22);
      const nearIntersection = this.isNearIntersectionPlaza(d, 1);
      const treeDistance = d + streetDetailStep / 2;
      const treePoint = treeDistance < this.routeLength - 12 && !this.isNearIntersectionPlaza(treeDistance, 1)
        ? this.getRoutePoint(treeDistance)
        : null;

      for (const side of [-1, 1]) {
        if (treePoint) {
          const tree = this.getRouteLateralPoint(treePoint, side * (treePoint.roadWidth / 2 + 2.4));
          world.addProp({ ...tree, frame: treeFrames[(slot + (side > 0 ? 1 : 0)) % treeFrames.length] });
        }
        if (nearIntersection) continue;

        if ((slot + side) % 2 === 0) {
          // The lamp arm reaches over the road from either side.
          const lamp = this.getRouteLateralPoint(point, side * (roadWidth / 2 + 2.0));
          world.addProp({ ...lamp, frame: 'prop/street-light', mirrored: side > 0 });
          continue;
        }

        const bayOffset = side * (roadWidth / 2 + 0.65);
        for (const across of [-0.95, 0.95]) {
          this.addMarking(world, point, point.dir, point.normal, 0, bayOffset + across, 0.1, 4.0, worldColors.white);
        }
        for (const along of [-1.95, 1.95]) {
          this.addMarking(world, point, point.dir, point.normal, along, bayOffset, 2.0, 0.1, worldColors.white);
        }
        if (this.renderQuality.level !== 'low' && d % 44 === 18) {
          world.addProp({ ...this.getRouteLateralPoint(point, bayOffset), frame: 'prop/parked-scooter' });
        }
        if ((slot + side) % 3 === 0) {
          world.addProp({ ...this.getRouteLateralPoint(point, side * (roadWidth / 2 + 3.0)), frame: 'prop/utility-pole' });
        }
      }
    }
  }

  // Thin painted rectangle centred on (along, across) in a road's frame.
  private addMarking(world: PixelWorldBuilder, origin: Vec2, dir: Vec2, normal: Vec2, along: number, across: number, width: number, length: number, color: number) {
    world.addStrip(origin, dir, normal, along - length / 2, along + length / 2, across - width / 2, across + width / 2, color, groundLayer.paint);
  }

  private addRoadEdgeMarkings(world: PixelWorldBuilder, segment: RouteSegment, segmentStartDistance: number, normal: Vec2) {
    const edgeLength = 10;
    const roadWidth = this.getSegmentRoadWidth(segment);
    for (let d = edgeLength / 2; d < segment.length; d += edgeLength + 1.5) {
      if (this.isNearIntersection(segmentStartDistance + d, this.roadMarkingIntersectionClearance)) continue;
      for (const side of [-1, 1]) {
        this.addMarking(world, segment.start, segment.dir, normal, d, side * (roadWidth / 2 - 0.1), 0.18, edgeLength, worldColors.white);
      }
    }
  }

  private addLaneMarkings(world: PixelWorldBuilder, segment: RouteSegment, segmentStartDistance: number, normal: Vec2) {
    const laneCount = this.getSegmentLaneCount(segment);
    if (laneCount <= 1) return;

    const laneWidth = this.getSegmentLaneWidth(segment);
    const dividerOffsets = this.getLaneDividerOffsets(segment);
    const solidStep = 6.5;
    for (let d = 5; d < segment.length - 3; d += solidStep) {
      if (this.isNearIntersection(segmentStartDistance + d, this.roadMarkingIntersectionClearance)) continue;

      for (const offset of dividerOffsets) {
        const isCenterDivider = !segment.oneWay && Math.abs(offset) < laneWidth * 0.35;

        if (isCenterDivider) {
          if (laneCount <= 2) {
            if (Math.floor(d / 13) % 2 === 0) {
              this.addMarking(world, segment.start, segment.dir, normal, d, offset, 0.14, 5.8, worldColors.yellow);
            }
            continue;
          }
          for (const gap of [-0.18, 0.18]) {
            this.addMarking(world, segment.start, segment.dir, normal, d, offset + gap, 0.13, solidStep + 0.25, worldColors.yellow);
          }
          continue;
        }

        if (Math.floor(d / 13) % 2 === 0) {
          this.addMarking(world, segment.start, segment.dir, normal, d, offset, 0.12, 5.6, worldColors.white);
        }
      }
    }
  }

  private addBuildings(world: PixelWorldBuilder) {
    const buildingStep = this.renderQuality.level === 'low' ? 34 : 20;

    for (let d = 15; d < this.routeLength - 10; d += buildingStep) {
      const point = this.getRoutePoint(d);
      for (const side of [-1, 1]) {
        const height = 7 + ((d * (side + 3)) % 17);
        const width = 7 + (d % 6);
        const depth = 7.5 + ((d + 3) % 6);
        if (this.isNearIntersection(d, this.buildingIntersectionClearance + depth / 2)) continue;

        const angle = this.getSceneYawForDirection(point.dir) + side * Math.PI / 2;
        const heading = this.getHeadingFromSceneYaw(angle);
        const setback = point.roadWidth / 2 + this.sidewalkWidth + this.buildingRoadGap + depth / 2 + (d % 8);
        const centerX = point.x + point.normal.x * side * setback;
        const centerZ = point.z + point.normal.z * side * setback;
        const collisionBox: CollisionBox2D = {
          centerX,
          centerZ,
          angle: heading,
          halfWidth: width / 2,
          halfLength: depth / 2,
        };
        if (!this.isBuildingFootprintClear(collisionBox)) continue;

        const facade = this.pickFacade(width, height, d + side * 7);
        world.addBuilding(collisionBox, facade.height, facade.id, { x: point.x, z: point.z });
        this.buildingCollisionBoxes.push(collisionBox);
      }
    }
  }

  // Picks one of the three facades whose proportions best fit the planned
  // height, and returns the height that shows that facade unstretched.
  private pickFacade(width: number, targetHeight: number, seed: number): { id: string; height: number } {
    const frames = (spriteSheet as { frames: Record<string, { w: number; h: number }> }).frames;
    const ranked = facadeIds
      .map((id) => {
        const frame = frames[`facade/${id}/front`];
        return { id, height: frame ? (frame.h / frame.w) * width : targetHeight };
      })
      .sort((left, right) => Math.abs(left.height - targetHeight) - Math.abs(right.height - targetHeight));
    return ranked[Math.abs(Math.floor(seed)) % Math.min(3, ranked.length)];
  }

  private isNearIntersectionPlaza(distance: number, margin: number): boolean {
    return this.intersections.some((inter) => {
      const approachWidth = this.getSegmentRoadWidth(this.route[inter.segmentIndex]);
      const nextWidth = this.getSegmentRoadWidth(this.route[inter.segmentIndex + 1] ?? this.route[inter.segmentIndex]);
      return Math.abs(distance - inter.distance) < (Math.max(approachWidth, nextWidth) + 18) / 2 + margin;
    });
  }

  private isNearIntersection(distance: number, clearance: number): boolean {
    return this.intersections.some((intersection) => Math.abs(distance - intersection.distance) < clearance);
  }

  private isBuildingFootprintClear(box: CollisionBox2D): boolean {
    return !this.roadCollisionBoxes.some((roadBox) => (
      this.boxesOverlap(box, this.expandCollisionBox(roadBox, this.buildingRoadMargin))
    ));
  }

  private expandCollisionBox(box: CollisionBox2D, margin: number): CollisionBox2D {
    return {
      ...box,
      halfWidth: box.halfWidth + margin,
      halfLength: box.halfLength + margin,
    };
  }

  /** Add road signs before turns, on the right for left-hand-drive traffic. */
  private addTurnSignage(world: PixelWorldBuilder) {
    for (const inter of this.intersections) {
      if (!inter.turnDir) continue;

      const point = this.getRoutePoint(Math.max(5, inter.distance - 20));
      const canvas = this.createTurnSignCanvas(inter.turnDir);
      if (!canvas) continue;
      world.addProp({ ...this.getRouteLateralPoint(point, point.roadWidth / 2 + 1), canvas, canvasPpm: 10 });
    }
  }

  // Blue direction sign (2.8 x 1.8 m board on a 4 m post) drawn at 10 px per metre.
  private createTurnSignCanvas(turnDir: 'left' | 'right'): HTMLCanvasElement | null {
    const canvas = document.createElement('canvas');
    canvas.width = 28;
    canvas.height = 51;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.fillStyle = '#8a9096';
    ctx.fillRect(13, 18, 2, 33);
    ctx.fillStyle = '#f4f6f8';
    ctx.fillRect(0, 0, 28, 18);
    ctx.fillStyle = '#1f5fd6';
    ctx.fillRect(1, 1, 26, 16);
    ctx.fillStyle = '#f4f6f8';
    const arrow = turnDir === 'right'
      ? [[6, 7], [15, 7], [15, 4], [22, 9], [15, 14], [15, 11], [6, 11]]
      : [[22, 7], [13, 7], [13, 4], [6, 9], [13, 14], [13, 11], [22, 11]];
    ctx.beginPath();
    arrow.forEach(([x, y], index) => (index === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)));
    ctx.closePath();
    ctx.fill();
    return canvas;
  }

  private addDestinationMarker(world: PixelWorldBuilder) {
    const point = this.getRoutePoint(this.routeLength - 5);
    const canvas = this.createDestinationCanvas();
    if (!canvas) return;
    world.addProp({ ...this.getRouteLateralPoint(point, point.roadWidth / 2 + 4), canvas, canvasPpm: 10 });
  }

  // Chequered finish flag on a 5 m post, at 10 px per metre. The post sits in
  // the middle of the canvas, which is the sprite's anchor.
  private createDestinationCanvas(): HTMLCanvasElement | null {
    const canvas = document.createElement('canvas');
    canvas.width = 86;
    canvas.height = 53;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.fillStyle = '#f4f6f8';
    ctx.fillRect(41, 3, 4, 50);
    ctx.fillStyle = '#16191d';
    ctx.fillRect(45, 3, 40, 22);
    for (let row = 0; row < 4; row += 1) {
      for (let column = 0; column < 8; column += 1) {
        if ((row + column) % 2 === 0) {
          ctx.fillStyle = '#f4f6f8';
          ctx.fillRect(46 + column * 5, 4 + row * 5, 5, 5);
        }
      }
    }
    return canvas;
  }

  private loop(time: number, trial: TrialType<Info>, displayElement: HTMLElement) {
    if (this.finished || !this.renderer) return;
    if (!displayElement.isConnected) {
      this.finishTrial(displayElement, 'aborted');
      return;
    }
    if (this.syncVisibilityPause(time) || this.syncInputPause(time)) {
      this.lastFrameTime = time;
      this.raf = requestAnimationFrame((nextTime) => this.loop(nextTime, trial, displayElement));
      return;
    }
    this.excludeInactiveFrameGap(time);
    const frameDurationMs = Math.max(0, time - this.lastFrameTime);
    this.lastFrameTime = time;
    if (frameDurationMs >= 1 && frameDurationMs <= 100) {
      this.fpsSamples.push(1000 / frameDurationMs);
    }
    if (this.fpsSamples.length > 240) this.fpsSamples.shift();

    const input = this.readInput();
    const brakePressed = input.brake > 0.35;
    if (!this.laneResetActive && brakePressed && !this.lastBrakePressed) {
      this.handleBrakePressed(input.brakeTimestamp ?? time);
    }
    if (brakePressed) this.pendingBrakeTimestamp = null;
    this.lastBrakePressed = brakePressed;
    const responseSteering = Math.abs(input.steering) > 0.15 ? Math.sign(input.steering) : 0;
    if (!this.laneResetActive && responseSteering !== 0 && responseSteering !== this.lastResponseSteering) {
      this.handleHazardResponse(time, responseSteering < 0 ? 'steer-left' : 'steer-right');
    }
    this.lastResponseSteering = responseSteering;

    const fixedSteps = CalculateDrivingFixedSteps(
      this.simulationAccumulatorMs,
      frameDurationMs,
      this.fixedSimulationStepMs,
      this.maxSimulationCatchUpMs,
    );
    this.simulationAccumulatorMs = fixedSteps.nextAccumulatorMs;
    const fixedDt = this.fixedSimulationStepMs / 1000;
    for (let step = 0; step < fixedSteps.stepCount; step += 1) {
      this.simulationTime += this.fixedSimulationStepMs;
      if (!this.laneResetActive) {
        this.updateVehicleFree(input, fixedDt, this.simulationTime);
        this.updateTrafficLights(this.simulationTime);
        this.updateIntersections();
        this.activateScheduledHazards(this.simulationTime);
        this.updateHazards(this.simulationTime);
        this.updateAmbientTraffic(fixedDt);
      } else {
        this.vehicleSpeed = 0;
        this.lastYawRate = 0;
        this.updateTrafficLights(this.simulationTime);
        this.updateAmbientTraffic(fixedDt);
      }
    }
    this.updateHud();
    this.updateCockpitHud();
    this.updateMiniMap();
    this.renderFrame(time);
    this.markHazardsPresented(CalculateEstimatedPresentationTime(
      time,
      performance.now(),
      this.refreshMeasured ? this.displayRefreshMs : Number.NaN,
    ));

    if (this.isTrialTimedOut(this.simulationTime, trial)) {
      soundManager.playEnd('Victory', );
      this.finishTrial(displayElement, 'timeout');
      return;
    }

    if (this.isDestinationReached()) {
      soundManager.playEnd('Victory', );
      this.finishTrial(displayElement, 'completed');
      return;
    }
    this.raf = requestAnimationFrame((nextTime) => this.loop(nextTime, trial, displayElement));
  }

  private renderFirstFrameBeforeReveal(time: number) {
    if (!this.renderer) return;
    this.updateHud();
    this.updateCockpitHud();
    this.updateMiniMap();
    this.renderFrame(time, true);
    this.markHazardsPresented(CalculateEstimatedPresentationTime(
      time,
      performance.now(),
      this.refreshMeasured ? this.displayRefreshMs : Number.NaN,
    ));
  }

  // Draws one frame from the driver's eye (shifted left of the car's
  // centreline, as in a left-hand-drive car) or from behind the car. Mirrors
  // refresh at 30 Hz.
  private renderFrame(time: number, refreshMirrors = false) {
    const renderer = this.renderer;
    if (!renderer || !this.pixelWorld) return;
    this.viewportController?.prepareMainRender();
    const firstPerson = this.cameraMode === 'first-person';
    const cameraPose = CalculateDrivingCameraPose({
      vehicleX: this.vehicleX,
      vehicleZ: this.vehicleZ,
      vehicleHeading: this.vehicleHeading,
      mode: this.cameraMode,
    });
    const pose = firstPerson ? CalculateDriverEyePose(cameraPose, this.vehicleHeading) : cameraPose;
    const updateMirrors = firstPerson
      && (refreshMirrors || time - this.rearviewLastUpdateTime >= this.getRearviewUpdateIntervalMs());
    if (updateMirrors) this.rearviewLastUpdateTime = time;
    const fog = this.getDifficultyFogRange();
    renderer.render(this.buildPixelScene(firstPerson), {
      pose,
      vehicle: { x: this.vehicleX, z: this.vehicleZ, heading: this.vehicleHeading },
      firstPerson,
      drawDistance: Math.min(fog.far, this.getMainDrawDistance()),
      fog,
      cockpit: {
        steeringAngleDeg: CalculateSteeringWheelAngle(this.frontWheelAngle),
        speedKph: this.vehicleSpeed * 3.6,
        maxKph: Math.round(this.maxVehicleSpeed * 3.6),
        wheelImage: null,
      },
      updateMirrors,
    });
    if (updateMirrors && this.root) this.root.dataset.drivingMirrorVehicles = String(renderer.mirrorVehicleCount);
  }

  private buildPixelScene(firstPerson: boolean): PixelScene {
    const vehicles: PixelVehicle[] = [];
    for (const actor of this.ambientTrafficActors) {
      if (!actor.waiting) vehicles.push(actor);
    }
    for (const hazard of this.activeHazards) {
      if (hazard.visual.visible) vehicles.push(hazard.visual);
    }
    return {
      world: this.pixelWorld as PixelWorld,
      vehicles,
      signals: this.intersections.map((inter) => inter.trafficSignalState),
      player: firstPerson ? null : { x: this.vehicleX, z: this.vehicleZ, heading: this.vehicleHeading },
    };
  }

  private isTrialTimedOut(time: number, trial: TrialType<Info>): boolean {
    const durationSec = Number((trial as any).driving_duration_sec ?? 80);
    const durationMs = Math.max(5_000, durationSec * 1000);
    return this.trialStartTime > 0 && time - this.trialStartTime >= durationMs;
  }

  // Free steering: the vehicle keeps a world position (x, z) and heading, and steering turns the heading.
  // progress and lateralOffset are projected from that world position.
  private updateVehicleFree(input: DrivingInput, dt: number, time: number) {
    const accelerationResponse = 2.65;
    const coastResponse = 1.35;
    const brakeResponse = 9.6;
    const rollingDrag = 0.9;
    const previousX = this.vehicleX;
    const previousZ = this.vehicleZ;
    const previousHeading = this.vehicleHeading;
    const previousProgress = this.progress;
    const previousBox = this.getVehicleCollisionBox();

    // Reference-style target speed smoothing: controls stay the same, but the car
    // eases into throttle/brake like the reference project instead of instantly
    // applying raw acceleration every frame.
    const targetSpeed = input.brake > 0.02
      ? 0
      : input.throttle * this.maxVehicleSpeed;
    const speedResponse = input.brake > 0.02
      ? brakeResponse
      : targetSpeed > this.vehicleSpeed
        ? accelerationResponse
        : coastResponse;
    this.vehicleSpeed = this.expSmoothing(this.vehicleSpeed, targetSpeed, speedResponse, dt);
    this.vehicleSpeed -= rollingDrag * (1 - input.throttle) * dt;
    this.vehicleSpeed = this.clamp(this.vehicleSpeed, 0, this.maxVehicleSpeed);

    const speedRatio = this.clamp(this.vehicleSpeed / this.maxVehicleSpeed, 0, 1);
    const maxSteerAngle = this.lerp(0.72, 0.28, Math.pow(speedRatio, 0.82));
    const targetWheelAngle = input.steering * maxSteerAngle;
    const steeringResponse = Math.abs(input.steering) > 0.01 ? 6.4 : 8.8;
    this.frontWheelAngle = this.expSmoothing(this.frontWheelAngle, targetWheelAngle, steeringResponse, dt);
    if (Math.abs(input.steering) <= 0.01 && Math.abs(this.frontWheelAngle) < 0.0015) {
      this.frontWheelAngle = 0;
    }
    this.steeringInput = maxSteerAngle > 0
      ? this.clamp(this.frontWheelAngle / maxSteerAngle, -1, 1)
      : 0;
    if (Math.abs(this.steeringInput) < 0.002) this.steeringInput = 0;

    // Kinematic bicycle model with speed-dependent steering. Keep enough grip at
    // medium speed so turns feel like road driving rather than a sliding camera.
    const lateralGrip = this.lerp(1.0, 0.84, Math.pow(speedRatio, 0.9));
    this.lastYawRate = this.vehicleSpeed > 0.03
      ? (this.vehicleSpeed * Math.tan(this.frontWheelAngle) / this.wheelBase) * lateralGrip
      : 0;
    this.vehicleHeading += this.lastYawRate * dt;

    // Move forward in heading direction
    // heading=0 -> moving in -Z, heading=PI/2 -> moving in +X
    const forward = this.getForwardVector(this.vehicleHeading);
    this.vehicleX += forward.x * this.vehicleSpeed * dt;
    this.vehicleZ += forward.z * this.vehicleSpeed * dt;

    const buildingCollision = this.isVehicleCollidingWithBuilding();
    const traffic = this.checkVehicleTrafficContact(previousBox);
    if (traffic.newContact) this.recordAvoidanceTrafficCollision();
    if (buildingCollision || traffic.newContact) this.recordCollisionEvent(time);
    if (buildingCollision || traffic.blocked) {
      this.vehicleX = previousX;
      this.vehicleZ = previousZ;
      this.vehicleHeading = previousHeading;
      this.vehicleSpeed = 0;
      this.frontWheelAngle = 0;
      this.steeringInput = 0;
      this.lastYawRate = 0;
    }

    // Project vehicle position onto the route to compute progress & lateral offset
    const vehicleBox = this.getVehicleCollisionBox();
    const proj = this.projectOntoRoute(vehicleBox.centerX, vehicleBox.centerZ, previousProgress);
    this.previousProgress = previousProgress;
    this.progress = proj.distance;
    this.lateralOffset = proj.lateral;

    this.updateDrivingRuleViolations();

    // Lane deviation check - deviation is being too far from route center
    this.updateLaneDepartureState(Math.abs(this.lateralOffset) > this.getLaneDeviationLimit(this.progress), time);
  }

  private updateDrivingRuleViolations() {
    const routeHeading = this.getRouteHeading(this.progress);
    const headingDelta = Math.abs(this.getSignedAngleDelta(this.vehicleHeading, routeHeading));
    const deviatingFromNavigation = this.vehicleSpeed > 3.0 && headingDelta > 1.05;
    if (deviatingFromNavigation && !this.navigationDeviationActive) {
      this.recordDrivingRuleEvent('navigation-deviation', 'wrong-direction');
    }
    this.navigationDeviationActive = deviatingFromNavigation;

    const stillOnRoad = Math.abs(this.lateralOffset) <= this.getLaneDeviationLimit(this.progress);
    const laneMarkingViolation = stillOnRoad && this.isProtectedLaneMarkingCrossed(this.progress, this.lateralOffset);

    if (laneMarkingViolation && !this.laneMarkingViolationActive) {
      this.recordDrivingRuleEvent('lane-marking-crossed', 'lane-line-crossed');
    }
    this.laneMarkingViolationActive = laneMarkingViolation;
  }

  private updateLaneDepartureState(deviating: boolean, time: number) {
    const currentPose = this.getCurrentResetPose();

    if (deviating) {
      if (!this.laneDeviationActive) {
        this.laneDeviationCount += 1;
        this.laneDepartureStartTime = time;
        this.laneDeparturePose = this.lastInLanePose ?? currentPose;
        this.recordDrivingRuleEvent('lane-departure', 'lane-departure');
      }
      this.laneDeviationActive = true;
      if (this.laneDepartureStartTime !== null && time - this.laneDepartureStartTime >= this.laneDeviationGraceMs) {
        this.triggerLaneReset();
      }
      return;
    }

    this.lastInLanePose = currentPose;
    this.laneDepartureStartTime = null;
    this.laneDeparturePose = null;
    this.laneDeviationActive = false;
  }

  private recordDrivingRuleEvent(
    eventId: DrivingEventId,
    response: string,
    options: { collision?: boolean; rt?: number | null; valid?: boolean; preheldBrake?: boolean } = {},
  ) {
    this.eventResults.push({
      event_id: eventId,
      label: this.getDrivingRuleEventLabel(eventId),
      distance_m: Math.round(this.progress),
      rt_ms: options.rt ?? null,
      valid: options.valid ?? true,
      collision: options.collision ?? false,
      brake_preheld: options.preheldBrake ?? false,
      response,
    });
  }

  private getDrivingRuleEventLabel(eventId: DrivingEventId): string {
    const labels: Record<string, { zh: string; en: string }> = {
      'navigation-deviation': { zh: '\u504f\u96e2\u5c0e\u822a', en: 'Navigation deviation' },
      'lane-marking-crossed': { zh: '\u58d3\u7dda', en: 'Lane marking crossed' },
      'lane-departure': { zh: '\u504f\u96e2\u8eca\u9053', en: 'Lane departure' },
      'vehicle-collision': { zh: '\u649e\u8eca', en: 'Vehicle collision' },
      'traffic-light-red': { zh: '\u95d6\u7d05\u71c8', en: this.text.redLightViolation },
    };
    return labels[eventId]?.[this.language] ?? String(eventId);
  }

  private getCurrentResetPose(): VehicleResetPose {
    return {
      x: this.vehicleX,
      z: this.vehicleZ,
      progress: this.progress,
      lateral: this.lateralOffset,
    };
  }

  private triggerLaneReset() {
    if (this.laneResetActive) return;

    const resetPose = this.laneDeparturePose ?? this.lastInLanePose ?? this.getCurrentResetPose();
    this.laneResetActive = true;
    this.vehicleSpeed = 0;
    this.frontWheelAngle = 0;
    this.steeringInput = 0;
    this.lastYawRate = 0;

    if (this.hud?.blackout) this.hud.blackout.style.opacity = '1';

    this.laneResetBlackoutTimer = window.setTimeout(() => {
      this.laneResetBlackoutTimer = null;
      this.applyLaneResetPose(resetPose);
      this.laneResetClearTimer = window.setTimeout(() => {
        this.laneResetClearTimer = null;
        if (this.hud?.blackout) this.hud.blackout.style.opacity = '0';
        this.laneResetActive = false;
        this.laneDepartureStartTime = null;
        this.laneDeparturePose = null;
        this.laneDeviationActive = false;
        this.lastInLanePose = this.getCurrentResetPose();
      }, this.laneResetHoldMs);
    }, this.laneResetBlackoutMs);
  }

  private applyLaneResetPose(pose: VehicleResetPose) {
    const routePoint = this.getSurfacePoint(pose.progress);
    const safeLateral = this.clamp(
      pose.lateral,
      -this.getLaneDeviationLimit(pose.progress) + this.vehicleHalfWidth,
      this.getLaneDeviationLimit(pose.progress) - this.vehicleHalfWidth,
    );
    const resetHeading = this.getHeadingFromDirection(routePoint.dir);
    const vehicleCenter = this.getRouteLateralPoint(routePoint, safeLateral);

    this.vehicleX = vehicleCenter.x;
    this.vehicleZ = vehicleCenter.z;
    this.vehicleHeading = resetHeading;
    this.vehicleSpeed = 0;
    this.frontWheelAngle = 0;
    this.steeringInput = 0;
    this.lastYawRate = 0;

    const vehicleBox = this.getVehicleCollisionBox();
    const projected = this.projectOntoRoute(vehicleBox.centerX, vehicleBox.centerZ, pose.progress);
    this.previousProgress = projected.distance;
    this.progress = projected.distance;
    this.lateralOffset = projected.lateral;

    // Traffic keeps moving while the screen is dark, so a car may now sit on
    // the reset point. It leaves before the screen comes back and returns out
    // of sight.
    const clearance = {
      ...vehicleBox,
      halfWidth: vehicleBox.halfWidth + 0.3,
      halfLength: vehicleBox.halfLength + 1.5,
    };
    for (const actor of this.ambientTrafficActors) {
      if (!actor.waiting && CollisionBoxesOverlap(clearance, this.getTrafficActorCollisionBox(actor))) actor.waiting = true;
    }
  }

  /** Project a world point onto the route.
   *  Returns the route distance and signed lateral offset (+ = right of road).
   *  Near overlapping streets, prefer the candidate closest to the current
   *  progress so route projection cannot jump back to an earlier pass. */
  private projectOntoRoute(wx: number, wz: number, referenceDistance = this.progress): { distance: number; lateral: number } {
    let bestScore = Infinity;
    let bestRouteD = 0;
    let bestLateral = 0;

    for (let i = 0; i < this.route.length; i += 1) {
      const segment = this.route[i];
      const dx = wx - segment.start.x;
      const dz = wz - segment.start.z;
      const dot = dx * segment.dir.x + dz * segment.dir.z;
      const clampedT = Math.max(0, Math.min(segment.length, dot));
      const closestX = segment.start.x + segment.dir.x * clampedT;
      const closestZ = segment.start.z + segment.dir.z * clampedT;
      const distSq = (wx - closestX) ** 2 + (wz - closestZ) ** 2;
      const normal = this.getRouteRightVector(segment.dir);
      const normalX = normal.x;
      const normalZ = normal.z;
      const lateral = (wx - closestX) * normalX + (wz - closestZ) * normalZ;
      const routeDistance = (this.routeSegmentStarts[i] ?? 0) + clampedT;
      const delta = routeDistance - referenceDistance;
      const backtrackPenalty = delta < -8 ? Math.abs(delta) * 1.4 : 0;
      const jumpPenalty = delta > 42 ? (delta - 42) * 0.45 : 0;
      const continuityPenalty = Math.abs(delta) * 0.12 + backtrackPenalty + jumpPenalty;
      const score = distSq + continuityPenalty;
      if (score < bestScore) {
        bestScore = score;
        bestRouteD = routeDistance;
        bestLateral = lateral;
      }
    }

    return { distance: bestRouteD, lateral: bestLateral };
  }

  /** Update intersection crossing detection */
  private updateIntersections() {
    for (const inter of this.intersections) {
      if (inter.entered) continue;

      const distToInter = inter.distance - this.progress;
      const stopLineDistance = this.getIntersectionStopLineDistance(inter);
      if (!inter.announced && distToInter < 50 && distToInter > 0) {
        inter.announced = true;
        if (this.hud && inter.turnDir) {
          const arrow = this.getNavigationArrow(inter.turnDir);
          this.hud.status.textContent = this.format(this.text.upcomingTurn, { instruction: inter.instruction, arrow });
        }
      }

      if (!inter.redLightChecked && this.previousProgress < stopLineDistance && this.progress >= stopLineDistance) {
        inter.redLightChecked = true;
        if (inter.trafficSignalState === 'red') {
          this.recordRedLightViolation(inter);
        }
      }

      if (this.progress >= inter.distance) {
        inter.entered = true;
      }
    }
  }

  private updateTrafficLights(time: number) {
    const elapsedMs = Math.max(0, time - this.trialStartTime);
    for (const inter of this.intersections) {
      inter.trafficSignalState = this.getTrafficLightState(elapsedMs + inter.trafficSignalOffsetMs);
    }
  }

  private getTrafficLightState(elapsedMs: number): TrafficLightState {
    const cycleMs = this.trafficGreenMs + this.trafficYellowMs + this.trafficRedMs;
    const phase = ((elapsedMs % cycleMs) + cycleMs) % cycleMs;
    if (phase < this.trafficGreenMs) return 'green';
    if (phase < this.trafficGreenMs + this.trafficYellowMs) return 'yellow';
    return 'red';
  }

  private getIntersectionStopLineDistance(inter: IntersectionZone): number {
    return Math.max(0, inter.distance - this.stopLineSetback);
  }

  private isDestinationReached(): boolean {
    if (this.progress >= this.routeLength - 2) return true;
    if (this.progress < this.routeLength - 18) return false;

    const destination = this.getRoutePoint(this.routeLength);
    const laneOffset = this.getDrivingLaneOffset(this.routeLength);
    const vehicleBox = this.getVehicleCollisionBox();
    const destinationX = destination.x + destination.normal.x * laneOffset;
    const destinationZ = destination.z + destination.normal.z * laneOffset;
    return Math.hypot(vehicleBox.centerX - destinationX, vehicleBox.centerZ - destinationZ) < 7.5;
  }

  private recordRedLightViolation(inter: IntersectionZone) {
    const result: DrivingEventResult = {
      event_id: 'traffic-light-red',
      label: this.text.redLightViolation,
      distance_m: Math.round(this.progress),
      rt_ms: null,
      valid: true,
      collision: false,
      brake_preheld: false,
      response: 'red-light-violation',
    };
    this.eventResults.push(result);
    soundManager.playFailure();
    if (this.hud?.event) {
      this.hud.event.textContent = this.text.redLightViolationMessage;
    }
    inter.redLightChecked = true;
  }

  private preloadHazardEvents() {
    const scheduledEvents = this.createHazardSchedule();
    this.activeHazards = scheduledEvents.map(({ template, triggerDistance }) => {
      const hazardDistance = this.getHazardSpawnDistance(template.id, triggerDistance);
      const point = this.getRoutePoint(hazardDistance);
      const visual = this.createHazardVisual(template.id);
      visual.x = point.x;
      visual.z = point.z;
      visual.heading = this.getHeadingFromDirection(point.dir);

      return {
        active: false,
        template,
        visual,
        triggerDistance,
        hazardDistance,
        startTime: 0,
        presentedAt: null,
        crossingStarted: false,
        brakeTime: null,
        rt: null,
        preheldBrake: false,
        collision: false,
        resolved: false,
        removeAt: null,
        currentDistance: hazardDistance,
        currentLateral: 0,
        targetLateral: 0,
        crossingStartLateral: 0,
        crossingEndLateral: 0,
        result: {
          event_id: template.id,
          label: this.getHazardLabel(template.id),
          distance_m: Math.round(triggerDistance),
          rt_ms: null,
          valid: true,
          collision: false,
          brake_preheld: false,
          avoidance_success: null,
          other_vehicle_collision: false,
          response: 'pending',
        },
      };
    });
  }

  private createHazardSchedule(): Array<{ template: HazardTemplate; triggerDistance: number }> {
    const scheduledEvents: Array<{ template: HazardTemplate; triggerDistance: number }> = [];
    let triggerDistance = 45;
    const { minHazardInterval, maxHazardInterval } = this.difficultyPreset;

    while (triggerDistance < this.routeLength - 40) {
      const template = this.hazardTemplates[0];
      scheduledEvents.push({ template, triggerDistance });
      triggerDistance += (minHazardInterval + maxHazardInterval) / 2;
    }

    return scheduledEvents;
  }

  private createAmbientTraffic() {
    const palette = ['white', 'blue', 'red', 'amber', 'green', 'navy'] as const;
    for (let i = 0; i < this.renderQuality.ambientTrafficCount; i += 1) {
      const isScooter = i % 3 !== 0;
      const direction: 1 | -1 = i % 3 === 0 ? -1 : 1;
      const distance = (i * 71 + 42) % Math.max(1, this.routeLength - 12);
      const color = palette[i % palette.length];
      const kind = isScooter ? 'scooter' : 'car';
      const sprite = isScooter
        ? `scooter/${color}`
        : i % 9 === 0
          ? 'car/taxi/taxi'
          : `car/${carModels[Math.floor(i / 3) % carModels.length]}/${color}`;
      const actor = this.createTrafficActor(kind, sprite, {
        distance,
        lateral: this.getTrafficLaneOffset(distance, direction, isScooter, i),
        direction,
        cruiseSpeed: isScooter ? 6.8 + (i % 5) * 0.95 : 7.4 + (i % 4) * 1.05,
        rearSlot: null,
        laneIndex: i,
        waiting: false,
      });
      this.ambientTrafficActors.push(actor);
      this.positionTrafficActor(actor);
    }
  }

  private createTrafficActor(
    kind: 'car' | 'scooter',
    sprite: string,
    placement: Pick<AmbientTrafficActor, 'distance' | 'lateral' | 'direction' | 'cruiseSpeed' | 'rearSlot' | 'laneIndex' | 'waiting'>,
  ): AmbientTrafficActor {
    const footprint = this.getTrafficActorCollisionBox({ kind, x: 0, z: 0, heading: 0 });
    return {
      kind,
      sprite,
      x: 0,
      z: 0,
      heading: 0,
      speed: 0,
      halfWidth: footprint.halfWidth,
      halfLength: footprint.halfLength,
      yieldingToPlayer: false,
      ...placement,
    };
  }

  // Same-direction traffic that starts behind the player, so the mirrors show
  // cars following, waiting behind at red lights and overtaking.
  private createRearTraffic() {
    const palette = ['white', 'navy', 'red', 'blue'] as const;
    const count = this.renderQuality.level === 'low' ? 2 : this.renderQuality.level === 'medium' ? 3 : 4;
    for (const slot of PlanRearTraffic(count, this.progress)) {
      const kind = slot.slot === 2 ? 'scooter' : 'car';
      const color = palette[slot.slot % palette.length];
      const actor = this.createTrafficActor(
        kind,
        kind === 'scooter' ? `scooter/${color}` : `car/${carModels[(slot.slot + 1) % carModels.length]}/${color}`,
        {
          distance: slot.distance,
          lateral: this.getRearTrafficLaneOffset(slot.distance, slot.slot),
          direction: 1,
          cruiseSpeed: slot.cruiseSpeed,
          rearSlot: slot.slot,
          laneIndex: slot.slot,
          waiting: slot.waiting,
        },
      );
      this.ambientTrafficActors.push(actor);
      this.positionTrafficActor(actor);
    }
  }

  // Even slots follow in the player's lane; odd slots use the other lanes and overtake.
  private getRearTrafficLaneOffset(distance: number, slot: number): number {
    const point = this.getRoutePoint(distance);
    const own = this.getDrivingLaneOffset(distance);
    const others = this.getTravelLaneOffsets(this.route[point.segmentIndex], 1)
      .filter((offset) => Math.abs(offset - own) > 0.5)
      .sort((left, right) => Math.abs(left - own) - Math.abs(right - own));
    if (slot % 2 === 0 || others.length === 0) return own;
    return others[Math.floor(slot / 2) % others.length];
  }

  private updateRearTrafficSpawns() {
    for (const actor of this.ambientTrafficActors) {
      if (actor.rearSlot === null) continue;
      if (!actor.waiting && !ShouldRespawnRearTraffic(actor.distance, this.progress)) continue;
      const distance = CalculateRearSpawnDistance(this.progress, actor.rearSlot);
      if (distance === null) {
        actor.waiting = true;
        continue;
      }
      const lateral = this.getRearTrafficLaneOffset(distance, actor.rearSlot);
      if (this.isTrafficSpawnBlocked(actor, distance, lateral)) {
        actor.waiting = true;
        continue;
      }
      this.spawnTrafficActor(actor, distance, lateral);
    }
  }

  // Ambient vehicles that leave the route or drop out of the mirrors return on
  // the road beyond what the player can see. Near the destination that road
  // runs out, so they stay away rather than appear in front of the player.
  private updateAmbientTrafficSpawns() {
    const hiddenAhead = this.getTrafficSpawnAhead();
    for (const actor of this.ambientTrafficActors) {
      if (actor.rearSlot !== null) continue;
      if (!actor.waiting && !ShouldRespawnAmbientTraffic(actor.distance, this.progress, this.routeLength)) continue;
      actor.waiting = true;
      const distance = CalculateAmbientSpawnDistance(this.progress, this.routeLength, hiddenAhead);
      if (distance === null) continue;
      const lateral = this.getTrafficLaneOffset(distance, actor.direction, actor.kind === 'scooter', actor.laneIndex);
      if (this.isTrafficSpawnBlocked(actor, distance, lateral)) continue;
      this.spawnTrafficActor(actor, distance, lateral);
    }
  }

  // The renderer draws nothing past this distance, plus a margin for fog.
  private getTrafficSpawnAhead(): number {
    return Math.min(this.getDifficultyFogRange().far, this.getMainDrawDistance()) + 40;
  }

  private isTrafficSpawnBlocked(actor: AmbientTrafficActor, distance: number, lateral: number): boolean {
    return this.ambientTrafficActors.some((other) => other !== actor
      && !other.waiting
      && other.direction === actor.direction
      && Math.abs(other.lateral - lateral) < other.halfWidth + actor.halfWidth + 0.3
      && Math.abs(other.distance - distance) < other.halfLength + actor.halfLength + 8);
  }

  private spawnTrafficActor(actor: AmbientTrafficActor, distance: number, lateral: number) {
    actor.waiting = false;
    actor.yieldingToPlayer = false;
    actor.distance = distance;
    actor.lateral = lateral;
    actor.speed = actor.cruiseSpeed;
    this.positionTrafficActor(actor);
  }

  private updateAmbientTraffic(dt: number) {
    this.updateRearTrafficSpawns();
    this.updateAmbientTrafficSpawns();
    const player: TrafficBody = {
      distance: this.progress,
      lateral: this.lateralOffset,
      direction: 1,
      speed: this.vehicleSpeed,
      halfLength: this.vehicleHalfLength,
      halfWidth: this.vehicleHalfWidth,
    };
    const playerBox = this.getVehicleCollisionBox();
    const bodies: TrafficBody[] = [player];
    for (const actor of this.ambientTrafficActors) {
      if (!actor.waiting) bodies.push(actor);
    }
    for (const actor of this.ambientTrafficActors) {
      if (actor.waiting) continue;
      const leader = FindTrafficLeaderGap(actor, bodies);
      let gap = leader?.gap ?? Infinity;
      let leaderSpeed = leader?.leader.speed ?? 0;
      const stopDistance = this.getTrafficActorStopDistance(actor);
      if (stopDistance !== null) {
        // A red or yellow stop line acts as a stopped car just past the line.
        const stopGap = (stopDistance - actor.distance) * actor.direction - actor.halfLength + minimumFollowingGap;
        if (stopGap < gap) {
          gap = stopGap;
          leaderSpeed = 0;
        }
      }
      actor.speed = CalculateFollowingSpeed(actor.cruiseSpeed, gap, leaderSpeed, actor.speed, dt);
      const from = this.getTrafficActorCollisionBox(actor);
      const previousDistance = actor.distance;
      actor.distance += actor.direction * actor.speed * dt;
      if (actor.distance < 4 || actor.distance > this.routeLength - 4) {
        actor.waiting = true;
        continue;
      }
      this.positionTrafficActor(actor);
      // Same-direction traffic stops at the player's car instead of driving
      // into it, for example when the player is angled across two lanes.
      const blockedByPlayer = actor.direction === 1
        && IsTrafficMoveBlocked(from, this.getTrafficActorCollisionBox(actor), playerBox);
      if (blockedByPlayer) {
        actor.distance = previousDistance;
        actor.speed = 0;
        this.positionTrafficActor(actor);
      }
      actor.yieldingToPlayer = blockedByPlayer || (leader?.leader === player && leader.gap < minimumFollowingGap);
    }
  }

  private getTrafficActorStopDistance(actor: AmbientTrafficActor): number | null {
    let nextInter: IntersectionZone | undefined;
    if (actor.direction === 1) {
      nextInter = this.intersections.find((inter) => inter.distance > actor.distance);
    } else {
      for (let i = this.intersections.length - 1; i >= 0; i -= 1) {
        if (this.intersections[i].distance < actor.distance) {
          nextInter = this.intersections[i];
          break;
        }
      }
    }
    if (!nextInter) return null;

    const stopDistance = this.getTrafficActorStopLineDistance(nextInter, actor.direction);
    const distanceToStop = (stopDistance - actor.distance) * actor.direction;
    if (distanceToStop < 0 || distanceToStop > 28) return null;
    if (nextInter.trafficSignalState !== 'red' && nextInter.trafficSignalState !== 'yellow') return null;
    return stopDistance;
  }

  private getTrafficActorStopLineDistance(intersection: IntersectionZone, direction: 1 | -1): number {
    if (direction === 1) return this.getIntersectionStopLineDistance(intersection) - 2.2;
    return Math.min(this.routeLength, intersection.distance + this.stopLineSetback + 2.2);
  }

  private getTrafficLaneOffset(distance: number, direction: 1 | -1, isScooter: boolean, index: number): number {
    const point = this.getRoutePoint(distance);
    const segment = this.route[point.segmentIndex];
    const laneWidth = this.getSegmentLaneWidth(segment);
    const laneOffsets = this.getTravelLaneOffsets(segment, point.oneWay ? 1 : direction);
    const base = laneOffsets[Math.abs(index + (isScooter ? 1 : 0)) % laneOffsets.length] ?? this.getDrivingLaneOffset(distance);
    const laneJitter = isScooter
      ? ((index % 2 === 0 ? -0.35 : 0.35) * (direction === 1 ? 1 : -1))
      : 0.1 * direction;
    return this.clamp(
      base + laneJitter,
      -point.roadWidth / 2 + laneWidth / 2,
      point.roadWidth / 2 - laneWidth / 2,
    );
  }

  private getTravelLaneOffsets(segment: RouteSegment, direction: 1 | -1): number[] {
    const laneCount = this.getSegmentLaneCount(segment);
    const laneWidth = this.getSegmentLaneWidth(segment);
    if (segment.oneWay) {
      const usableWidth = Math.min(this.getSegmentRoadWidth(segment) - 1.1, laneCount * laneWidth);
      const startOffset = -usableWidth / 2 + laneWidth / 2;
      return Array.from({ length: laneCount }, (_, lane) => startOffset + lane * laneWidth);
    }

    const lanesPerDirection = Math.max(1, Math.floor(laneCount / 2));
    return Array.from({ length: lanesPerDirection }, (_, lane) => (
      direction === 1
        ? laneWidth * (lane + 0.5)
        : -laneWidth * (lane + 0.5)
    ));
  }

  private positionTrafficActor(actor: AmbientTrafficActor) {
    const point = this.getRoutePoint(actor.distance);
    actor.x = point.x + point.normal.x * actor.lateral;
    actor.z = point.z + point.normal.z * actor.lateral;
    actor.heading = this.getHeadingFromDirection({
      x: point.dir.x * actor.direction,
      z: point.dir.z * actor.direction,
    });
  }

  private getTrafficActorCollisionBox(actor: Pick<AmbientTrafficActor, 'kind' | 'x' | 'z' | 'heading'>): CollisionBox2D {
    const scooter = actor.kind === 'scooter';
    return {
      centerX: actor.x,
      centerZ: actor.z,
      angle: actor.heading,
      halfWidth: scooter ? 0.55 : 1.0,
      halfLength: scooter ? 0.95 : 2.25,
    };
  }

  private activateScheduledHazards(time: number) {
    if (this.activeHazards.some((hazard) => hazard.active && !hazard.resolved)) return;

    const hazard = this.activeHazards.find((item) => !item.active && !item.resolved && this.progress >= item.triggerDistance);
    if (!hazard) return;

    const input = this.readInput();
    const hazardDistance = this.getHazardSpawnDistance(hazard.template.id, this.progress);
    const point = this.getRoutePoint(hazardDistance);
    const vehicleLaneLateral = this.getCurrentVehicleLaneLateral();
    const targetLateral = this.getHazardTargetLateral(hazard.template.id, hazardDistance, vehicleLaneLateral);
    const initialLateral = hazard.template.id === 'wrong-way-driver'
      ? this.getOpposingLaneOffset(hazardDistance, targetLateral)
      : targetLateral;
    const crossingSide = targetLateral >= 0 ? 1 : -1;
    const roadWidth = this.getRoadWidthAtDistance(hazardDistance);
    const crossingEdge = hazard.template.id === 'child-crossing'
      ? roadWidth / 2 + 0.25
      : roadWidth / 2 + 0.8;
    const crossingStartLateral = crossingSide * crossingEdge;
    const crossingEndLateral = -crossingSide * crossingEdge;
    const preheldBrake = input.brake > 0.35;

    hazard.active = true;
    hazard.triggerDistance = this.progress;
    hazard.hazardDistance = hazardDistance;
    hazard.startTime = time;
    hazard.presentedAt = null;
    hazard.crossingStarted = false;
    hazard.brakeTime = preheldBrake ? time : null;
    hazard.rt = null;
    hazard.preheldBrake = preheldBrake;
    hazard.collision = false;
    hazard.resolved = false;
    hazard.removeAt = null;
    hazard.currentDistance = hazardDistance;
    hazard.currentLateral = initialLateral;
    hazard.targetLateral = targetLateral;
    hazard.crossingStartLateral = hazard.template.id === 'wrong-way-driver' ? initialLateral : crossingStartLateral;
    hazard.crossingEndLateral = crossingEndLateral;
    hazard.result.distance_m = Math.round(this.progress);
    hazard.result.rt_ms = null;
    hazard.result.valid = !preheldBrake;
    hazard.result.collision = false;
    hazard.result.brake_preheld = preheldBrake;
    hazard.result.response = preheldBrake ? 'invalid-preheld-brake' : 'pending';
    hazard.visual.visible = true;
    hazard.visual.x = point.x + point.normal.x * initialLateral;
    hazard.visual.y = 0;
    hazard.visual.z = point.z + point.normal.z * initialLateral;
    hazard.visual.heading = this.getHeadingFromDirection(
      hazard.template.id === 'wrong-way-driver' ? { x: -point.dir.x, z: -point.dir.z } : point.dir,
    );

  }

  private syncInputPause(time: number) {
    const inputAvailable = this.controlMode !== 'wheel' || (() => {
      const wheel = FindDrivingWheelGamepad(navigator.getGamepads?.() ?? []);
      return Boolean(
        wheel
        && this.wheelCalibration
        && ReadDrivingWheelInput(wheel, this.wheelCalibration),
      );
    })();
    if (!inputAvailable) {
      if (this.inputPausedAt === 0) {
        this.inputPausedAt = time;
        this.keyState = { left: false, right: false, up: false, down: false };
        this.lastBrakePressed = false;
        if (this.inputPauseOverlay) this.inputPauseOverlay.style.display = 'grid';
      }
      return true;
    }
    if (this.inputPausedAt === 0) return false;

    const pausedDuration = Math.max(0, time - this.inputPausedAt);
    this.inputPausedAt = 0;
    if (this.inputPauseOverlay) this.inputPauseOverlay.style.display = 'none';
    this.shiftResponseClockAfterPause(pausedDuration);
    this.lastFrameTime = time;
    this.lastBrakePressed = this.readInput().brake > 0.35;
    return false;
  }

  private attachVisibilityPauseListener() {
    if (this.visibilityChangeListener) return;
    this.visibilityChangeListener = () => {
      const time = performance.now();
      if (document.visibilityState !== 'visible') {
        this.beginVisibilityPause(time);
      } else {
        this.endVisibilityPause(time);
      }
    };
    document.addEventListener('visibilitychange', this.visibilityChangeListener);
    if (document.visibilityState !== 'visible') {
      this.beginVisibilityPause(performance.now());
    }
  }

  private beginVisibilityPause(time: number) {
    if (this.visibilityPausedAt === null) this.visibilityPausedAt = time;
    this.keyState = { left: false, right: false, up: false, down: false };
    this.pendingBrakeTimestamp = null;
    this.lastBrakePressed = false;
  }

  private endVisibilityPause(time: number) {
    if (this.visibilityPausedAt === null) return;
    const pausedDuration = Math.max(0, time - this.visibilityPausedAt);
    this.visibilityPausedAt = null;
    this.shiftResponseClockAfterPause(pausedDuration);
    // If a wheel-disconnect pause overlaps the hidden interval, move its start
    // forward too so the same wall-clock duration is not excluded twice.
    if (this.inputPausedAt > 0) this.inputPausedAt += pausedDuration;
    this.lastFrameTime = time;
    this.pendingBrakeTimestamp = null;
    this.lastBrakePressed = this.controlMode === 'wheel'
      ? this.readInput().brake > 0.35
      : false;
  }

  private syncVisibilityPause(time: number) {
    if (document.visibilityState !== 'visible') {
      this.beginVisibilityPause(time);
      return true;
    }
    this.endVisibilityPause(time);
    return false;
  }

  private excludeInactiveFrameGap(time: number) {
    if (this.lastFrameTime <= 0) return;
    const gap = time - this.lastFrameTime;
    if (!Number.isFinite(gap) || gap <= this.maxSimulationCatchUpMs) return;
    const excludedDuration = gap - this.maxSimulationCatchUpMs;
    this.shiftResponseClockAfterPause(excludedDuration);
    if (this.inputPausedAt > 0) this.inputPausedAt += excludedDuration;
    this.lastFrameTime += excludedDuration;
  }

  private shiftResponseClockAfterPause(pausedDuration: number) {
    if (pausedDuration <= 0) return;
    for (const hazard of this.activeHazards) {
      if (hazard.presentedAt !== null) hazard.presentedAt += pausedDuration;
    }
    this.rearviewLastUpdateTime = performance.now();
    this.miniMapLastUpdateTime = performance.now();
  }

  private markHazardsPresented(time: number) {
    for (const hazard of this.activeHazards) {
      if (hazard.active && !hazard.resolved && hazard.visual.visible && hazard.crossingStarted && hazard.presentedAt === null) {
        hazard.presentedAt = time;
        hazard.preheldBrake = this.readInput().brake > 0.35;
        hazard.brakeTime = null;
        hazard.result.brake_preheld = hazard.preheldBrake;
        hazard.result.valid = false;
        hazard.result.response = 'pending';
        hazard.result.distance_m = Math.round(this.progress);
        this.eventResults.push(hazard.result);
        this.flashRed();
        if (this.hud) this.hud.event.textContent = hazard.result.label;
      }
    }
  }

  private getHazardLeadDistance(id: HazardId): number {
    const leadDistance = this.difficultyPreset.hazardLeadDistance;
    if (id === 'child-crossing') {
      return leadDistance;
    }
    if (id === 'elder-stopped') {
      return leadDistance;
    }
    if (id === 'drunk-driver') {
      return leadDistance * 1.35;
    }
    if (id === 'wrong-way-driver') {
      return 185;
    }
    if (id === 'plane-crash') {
      return leadDistance * 1.25;
    }
    return leadDistance;
  }

  private getHazardSpawnDistance(id: HazardId, triggerDistance: number): number {
    let distance = this.clamp(triggerDistance + this.getHazardLeadDistance(id), 10, this.routeLength - 8);
    for (let attempt = 0; attempt < 5 && this.isNearIntersection(distance, 30); attempt += 1) {
      distance = this.clamp(distance + 24, 10, this.routeLength - 8);
    }
    return distance;
  }

  private updateHazards(time: number) {
    const timeoutMs = this.difficultyPreset.hazardTimeoutMs;

    for (const hazard of this.activeHazards) {
      if (hazard.resolved) {
        if (hazard.removeAt !== null && time >= hazard.removeAt) {
          hazard.visual.visible = false;
          hazard.removeAt = null;
        }
        continue;
      }
      if (!hazard.active) continue;

      const age = time - hazard.startTime;
      const point = this.getRoutePoint(hazard.currentDistance);
      const baseY = hazard.template.id === 'plane-crash' ? Math.max(0.3, 18 - age * 0.018) : 0;
      let lateral = hazard.targetLateral;

      if (hazard.template.id === 'child-crossing') {
        lateral = this.lerp(hazard.crossingStartLateral, hazard.crossingEndLateral, Math.min(1, age / 2600));
      } else if (hazard.template.id === 'drunk-driver') {
        lateral = hazard.targetLateral;
      } else if (hazard.template.id === 'wrong-way-driver') {
        const minimumWrongWayDistance = Math.max(0, hazard.triggerDistance - 62);
        hazard.currentDistance = Math.max(minimumWrongWayDistance, hazard.hazardDistance - age * 0.018);
        const movingPoint = this.getRoutePoint(hazard.currentDistance);
        const routeGap = hazard.currentDistance - this.progress;
        const swerve = this.clamp((54 - routeGap) / 24, 0, 1) ** 2;
        if (swerve > 0) hazard.crossingStarted = true;
        lateral = this.lerp(hazard.crossingStartLateral, hazard.targetLateral, swerve);
        hazard.visual.x = movingPoint.x + movingPoint.normal.x * lateral;
        hazard.visual.y = 0;
        hazard.visual.z = movingPoint.z + movingPoint.normal.z * lateral;
        hazard.currentLateral = lateral;
        hazard.visual.heading = this.getHeadingFromDirection({ x: -movingPoint.dir.x, z: -movingPoint.dir.z });
      }

      if (hazard.template.id !== 'wrong-way-driver') {
        hazard.currentLateral = lateral;
        hazard.visual.x = point.x + point.normal.x * lateral;
        hazard.visual.y = baseY;
        hazard.visual.z = point.z + point.normal.z * lateral;
        hazard.visual.heading = this.getHeadingFromDirection(point.dir) - (hazard.template.id === 'drunk-driver' ? Math.sin(age / 300) * 0.5 : 0);
      }

      const distanceToHazard = hazard.currentDistance - this.progress;
      const collisionNow = !hazard.resolved && this.isHazardColliding(hazard);
      const requiresDodge = hazard.template.id === 'wrong-way-driver';
      const safeBrake = !requiresDodge && hazard.brakeTime !== null && this.vehicleSpeed < 2.4 && !collisionNow && distanceToHazard > -1;
      // Keep observing collisions until both vehicles have completely passed.
      const wrongWayDodged = requiresDodge && !collisionNow && this.hasPassedHazard(hazard);
      const passedHazard = !requiresDodge && !collisionNow && this.hasPassedHazard(hazard);

      if (collisionNow) {
        this.resolveHazard(hazard, time, true, hazard.brakeTime ? 'collision-after-brake' : 'collision-no-brake');
      } else if (safeBrake) {
        this.resolveHazard(hazard, time, false, hazard.preheldBrake ? 'invalid-preheld-brake' : 'brake');
      } else if (wrongWayDodged) {
        const response = hazard.preheldBrake
          ? 'invalid-preheld-brake'
          : hazard.brakeTime
            ? 'dodge-after-brake'
            : 'dodge';
        this.resolveHazard(hazard, time, false, response);
      } else if (passedHazard) {
        const response = hazard.preheldBrake
          ? 'invalid-preheld-brake'
          : hazard.brakeTime
            ? 'dodge-after-brake'
            : 'dodge';
        this.resolveHazard(hazard, time, false, response);
      }

      if (!requiresDodge && !hazard.resolved && age > timeoutMs && hazard.brakeTime !== null && this.vehicleSpeed < 2.4 && !collisionNow) {
        this.resolveHazard(hazard, time, false, hazard.preheldBrake ? 'invalid-preheld-brake' : 'brake');
      }

    }
  }

  private resolveHazard(hazard: ActiveHazard, time: number, collision: boolean, response: string) {
    if (hazard.resolved) return;
    hazard.resolved = true;
    hazard.collision = collision;
    hazard.result.collision = collision;
    hazard.result.avoidance_success = !collision
      && !(this.difficultyPreset === difficultyPresets.advanced && hazard.result.other_vehicle_collision);
    if (hazard.rt === null) hazard.result.response = response;
    hazard.result.rt_ms = hazard.rt;
    hazard.result.valid = hazard.rt !== null;
    hazard.removeAt = time + 950;

    if (!hazard.result.avoidance_success) {
      soundManager.playFailure();
      this.vehicleSpeed = Math.min(this.vehicleSpeed, 2.5);
    } else {
      soundManager.playSuccess();
    }

    if (this.hud) {
      const rtText = hazard.rt !== null ? `${hazard.rt} ms` : this.text.noValidRt;
      const outcome = !hazard.result.avoidance_success
        ? this.text.collision
        : response === 'dodge' || response === 'dodge-after-brake'
          ? this.text.dodged
          : this.text.stopped;
      this.hud.event.textContent = this.format(this.text.hazardResult, {
        label: hazard.result.label,
        outcome,
        rtText,
      });
    }
  }

  private isVehicleCollidingWithBuilding(): boolean {
    if (this.buildingCollisionBoxes.length === 0) return false;
    const vehicleBox = this.getVehicleCollisionBox();
    return this.buildingCollisionBoxes.some((buildingBox) => this.boxesOverlap(vehicleBox, buildingBox));
  }

  // newContact: the move touched a vehicle it was clear of before.
  // blocked: the move has to be undone.
  private checkVehicleTrafficContact(previousBox: CollisionBox2D): { newContact: boolean; blocked: boolean } {
    const vehicleBox = this.getVehicleCollisionBox();
    let newContact = false;
    let blocked = false;
    for (const actor of this.ambientTrafficActors) {
      if (actor.waiting) continue;
      const actorBox = this.getTrafficActorCollisionBox(actor);
      if (!CollisionBoxesOverlap(vehicleBox, actorBox)) continue;
      if (!CollisionBoxesOverlap(previousBox, actorBox)) newContact = true;
      if (IsTrafficMoveBlocked(previousBox, vehicleBox, actorBox, actor.yieldingToPlayer)) blocked = true;
    }
    return { newContact, blocked };
  }

  private recordCollisionEvent(time: number) {
    if (time - this.lastCollisionEventTime < 1200) return;
    this.lastCollisionEventTime = time;
    this.recordDrivingRuleEvent('vehicle-collision', 'collision', { collision: true });
    soundManager.playFailure();
  }

  private recordAvoidanceTrafficCollision() {
    for (const hazard of this.activeHazards) {
      if (hazard.active && !hazard.resolved && hazard.presentedAt !== null) {
        hazard.result.other_vehicle_collision = true;
        if (this.difficultyPreset === difficultyPresets.advanced) hazard.result.avoidance_success = false;
      }
    }
  }

  private isHazardColliding(hazard: ActiveHazard): boolean {
    if (hazard.template.id === 'plane-crash' && hazard.visual.y > 1.6) return false;
    return this.boxesOverlap(this.getVehicleCollisionBox(), this.getHazardCollisionBox(hazard));
  }

  private hasPassedHazard(hazard: ActiveHazard): boolean {
    const vehicleBox = this.getVehicleCollisionBox();
    const hazardBox = this.getHazardCollisionBox(hazard);
    const passDistance = vehicleBox.halfLength + hazardBox.halfLength + 1.2;
    return this.progress - hazard.currentDistance > passDistance;
  }

  private hasDodgedWrongWayDriver(hazard: ActiveHazard): boolean {
    const vehicleBox = this.getVehicleCollisionBox();
    const hazardBox = this.getHazardCollisionBox(hazard);
    const routeGap = hazard.currentDistance - this.progress;
    const contactWindow = vehicleBox.halfLength + hazardBox.halfLength + 0.8;
    if (routeGap > contactWindow) return false;

    const vehicleLateral = this.getCurrentVehicleLaneLateral();
    const lateralClearance = Math.abs(vehicleLateral - hazard.currentLateral);
    const requiredClearance = vehicleBox.halfWidth + hazardBox.halfWidth + 0.9;
    return lateralClearance >= requiredClearance;
  }

  private hasWrongWayDriverOverrun(hazard: ActiveHazard): boolean {
    const vehicleBox = this.getVehicleCollisionBox();
    const hazardBox = this.getHazardCollisionBox(hazard);
    const routeGap = hazard.currentDistance - this.progress;
    const overrunDistance = vehicleBox.halfLength + hazardBox.halfLength + 0.8;
    return routeGap < -overrunDistance;
  }

  private getVehicleCollisionBox(): CollisionBox2D {
    return {
      centerX: this.vehicleX,
      centerZ: this.vehicleZ,
      angle: this.vehicleHeading,
      halfWidth: this.vehicleHalfWidth,
      halfLength: this.vehicleHalfLength,
    };
  }

  private getCurrentVehicleLaneLateral(): number {
    const vehicleBox = this.getVehicleCollisionBox();
    const projected = this.projectOntoRoute(vehicleBox.centerX, vehicleBox.centerZ, this.progress);
    const maxLaneLateral = this.getRoadWidthAtDistance(projected.distance) / 2 - this.vehicleHalfWidth;
    return this.clamp(projected.lateral, -maxLaneLateral, maxLaneLateral);
  }

  private getHazardTargetLateral(id: HazardId, distance: number, vehicleLaneLateral: number): number {
    if (id === 'elder-stopped' || id === 'plane-crash') {
      return this.getDrivingLaneOffset(distance);
    }
    return vehicleLaneLateral;
  }

  private getOpposingLaneOffset(distance: number, targetLateral: number): number {
    const point = this.getRoutePoint(distance);
    const laneWidth = this.getSegmentLaneWidth(this.route[point.segmentIndex]);
    return this.clamp(
      -targetLateral,
      -point.roadWidth / 2 + laneWidth / 2,
      point.roadWidth / 2 - laneWidth / 2,
    );
  }

  private getHazardCollisionBox(hazard: ActiveHazard): CollisionBox2D {
    const footprint = hazard.visual.vehicleKind === 'scooter'
      ? { halfWidth: 0.45, halfLength: 1.2 }
      : this.getHazardFootprint(hazard.template.id);
    return {
      centerX: hazard.visual.x,
      centerZ: hazard.visual.z,
      angle: hazard.visual.heading,
      ...footprint,
    };
  }

  // Sprite and placement for a hazard. Only wrong-way drivers are scheduled;
  // the other hazard types keep a plain car look.
  private createHazardVisual(id: HazardId): HazardVisual {
    const palette = ['white', 'blue', 'red', 'amber', 'green', 'navy'] as const;
    const models = ['sedan', 'hatchback', 'suv', 'van'] as const;
    const create = (vehicleKind: 'car' | 'scooter', color: VehicleColor, model: CarModel): HazardVisual => ({
      visible: false,
      x: 0,
      y: 0,
      z: 0,
      heading: 0,
      vehicleKind,
      color,
      model,
      sprite: vehicleKind === 'scooter' ? `scooter/${color}` : `car/${model}/${color}`,
    });
    if (id === 'wrong-way-driver') {
      const color = palette[Math.floor(Math.random() * palette.length)];
      const isScooter = Math.random() < 0.5;
      const model = models[Math.floor(Math.random() * models.length)];
      return create(isScooter ? 'scooter' : 'car', color, model);
    }
    if (id === 'drunk-driver') return create('car', 'amber', 'sedan');
    return create('car', 'red', 'hatchback');
  }

  private getHazardFootprint(id: HazardId): CollisionFootprint {
    switch (id) {
      case 'child-crossing':
        return { halfWidth: 0.34, halfLength: 0.34 };
      case 'elder-stopped':
        return { halfWidth: 0.44, halfLength: 0.44 };
      case 'plane-crash':
        return { halfWidth: 4.8, halfLength: 4.2 };
      case 'drunk-driver':
      case 'wrong-way-driver':
        return { halfWidth: 1.0, halfLength: 2.25 };
      default:
        return { halfWidth: 1, halfLength: 1 };
    }
  }

  private boxesOverlap(a: CollisionBox2D, b: CollisionBox2D): boolean {
    return CollisionBoxesOverlap(a, b);
  }

  private handleBrakePressed(time: number) {
    this.handleHazardResponse(time, 'brake');
  }

  private handleHazardResponse(time: number, response: 'brake' | 'steer-left' | 'steer-right') {
    const hazard = this.activeHazards.find((item) => item.active && !item.resolved);
    if (!hazard || hazard.presentedAt === null || time < hazard.presentedAt) return;
    if (response === 'brake') hazard.brakeTime ??= time;
    if (hazard.rt !== null) return;
    const reaction = CalculateFrameAlignedReactionTime(
      hazard.presentedAt,
      time,
      this.refreshMeasured ? this.displayRefreshMs : Number.NaN,
    );
    hazard.rt = reaction.rawRtMs;
    hazard.result.rt_ms = hazard.rt;
    hazard.result.raw_rt_ms = reaction.rawRtMs;
    hazard.result.reaction_frames = reaction.frameCount;
    hazard.result.response = response;
    hazard.result.valid = true;
    if (this.hud) {
      this.hud.event.textContent = this.format(this.text.brakeReaction, {
        label: hazard.result.label,
        rt: Math.round(hazard.rt),
      });
    }
  }

  private cycleCameraMode() {
    const modes: DrivingCameraMode[] = ['third-person', 'first-person'];
    const next = modes[(modes.indexOf(this.cameraMode) + 1) % modes.length];
    this.cameraMode = next;
    this.updateCameraModeHud();
    if (this.hud?.event) {
      this.hud.event.textContent = this.language === 'en'
        ? `View: ${this.getCameraModeText()}`
        : `視角：${this.getCameraModeText()}`;
    }
  }

  private getCameraModeText(): string {
    if (this.language === 'en') {
      return this.cameraMode === 'first-person' ? 'First-person' : 'Third-person';
    }
    return this.cameraMode === 'first-person' ? '\u7b2c\u4e00\u4eba\u7a31' : '\u7b2c\u4e09\u4eba\u7a31';
  }

  private updateCameraModeHud() {
    if (this.hud?.view) {
      this.hud.view.textContent = this.language === 'en'
        ? `View: ${this.getCameraModeText()}`
        : `視角：${this.getCameraModeText()}`;
    }
    if (this.root) this.root.dataset.drivingCamera = this.cameraMode;
    this.updateCockpitHud();
  }

  // The cockpit itself is drawn on the canvas; these attributes let tests and
  // assistive tools read the speedometer.
  private updateCockpitHud() {
    if (!this.root) return;
    this.root.dataset.drivingSpeedometer = String(Math.round(this.vehicleSpeed * 3.6));
    this.root.dataset.drivingCockpit = this.cameraMode === 'first-person' ? 'left-hand-drive' : 'hidden';
  }

  private updateHud() {
    if (!this.hud) return;

    // Show navigation instruction with distance to next turn
    const nextInter = this.intersections.find((iz) => !iz.entered && this.progress < iz.distance);
    if (nextInter && nextInter.turnDir) {
      const dist = Math.round(nextInter.distance - this.progress);
      const arrow = this.getNavigationArrow(nextInter.turnDir);
      this.hud.status.textContent = this.language === 'en'
        ? `Navigation: ${nextInter.instruction} in ${dist}m ${arrow}`
        : `\u5c0e\u822a\uff1a${dist}m \u5f8c${nextInter.instruction} ${arrow}`;
    } else {
      this.hud.status.textContent = this.language === 'en'
        ? 'Navigation: continue to destination'
        : '\u5c0e\u822a\uff1a\u76f4\u884c\u524d\u5f80\u7d42\u9ede';
    }
    this.hud.route.textContent = this.getRouteHudText();
    this.hud.speed.textContent = `${Math.round(this.vehicleSpeed * 3.6)} km/h`;
    this.hud.distance.textContent = `${Math.max(0, Math.round(this.routeLength - this.progress))} m`;
    if (this.hud.view) {
      this.hud.view.textContent = this.language === 'en'
        ? `View: ${this.getCameraModeText()}`
        : `\u8996\u89d2\uff1a${this.getCameraModeText()}`;
    }
  }

  private flashRed() {
    if (!this.hud?.redFlash || this.hud.redFlash.style.boxShadow === 'none') return;
    this.hud.redFlash.style.opacity = '1';
    window.setTimeout(() => {
      if (this.hud?.redFlash) this.hud.redFlash.style.opacity = '0';
    }, 120);
  }

  private readInput(): DrivingInput {
    let steering = 0;
    let throttle = this.keyState.up ? 1 : 0;
    let brake = this.keyState.down ? 1 : 0;
    let brakeTimestamp = this.pendingBrakeTimestamp;
    let gamepadName = '';

    if (this.keyState.left) steering -= 1;
    if (this.keyState.right) steering += 1;

    const gamepad = FindDrivingWheelGamepad(navigator.getGamepads?.() ?? []);
    this.gamepadConnected = Boolean(gamepad);
    if (this.controlMode === 'wheel' && gamepad && this.wheelCalibration) {
      gamepadName = gamepad.id;
      const wheelInput = ReadDrivingWheelInput(gamepad, this.wheelCalibration);
      if (wheelInput) {
        steering = Math.abs(wheelInput.steering) > 0.03 ? wheelInput.steering : 0;
        throttle = wheelInput.throttle;
        brake = wheelInput.brake;
        if (brake > 0.35 && Number.isFinite(gamepad.timestamp)) {
          brakeTimestamp = this.normalizeInputTimestamp(gamepad.timestamp);
        }
      }
    }

    return {
      steering: Math.max(-1, Math.min(1, steering)),
      throttle: Math.max(0, Math.min(1, throttle)),
      brake: Math.max(0, Math.min(1, brake)),
      brakeTimestamp,
      gamepadName,
    };
  }

  private getControlMode(value: unknown): DrivingControlMode {
    return value === 'wasd' || value === 'wheel' || value === 'touch' ? value : 'arrow';
  }

  private getLanguage(value: unknown): DrivingLanguage {
    return value === 'en' ? 'en' : 'zh';
  }

  private getRouteAlias(): string {
    const routeId = this.selectedRouteVariant?.id;
    const index = drivingRouteVariants.findIndex((route) => route.id === routeId);
    return index >= 0 ? `R${index + 1}` : 'R?';
  }

  private getRouteHudText(): string {
    const roadName = this.getRouteAt(this.progress).segment.name;
    const route = this.getRouteAlias();
    const road = roadName ? ` / ${roadName}` : '';
    return this.language === 'en' ? `Route: ${route}${road}` : `路線：${route}${road}`;
  }

  private getHazardLabel(id: HazardId): string {
    return this.text.hazardLabels[id];
  }

  private format(template: string, params: Record<string, string | number>): string {
    return Object.entries(params).reduce(
      (text, [key, value]) => text.replace(new RegExp(`{${key}}`, 'g'), String(value)),
      template,
    );
  }

  private clamp(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, value));
  }

  private lerp(start: number, end: number, t: number): number {
    return start + (end - start) * this.clamp(t, 0, 1);
  }

  private expSmoothing(current: number, target: number, response: number, dt: number): number {
    const t = 1 - Math.exp(-Math.max(0, response) * Math.max(0, dt));
    return this.lerp(current, target, t);
  }

  private getSignedAngleDelta(angle: number, target: number): number {
    return Math.atan2(Math.sin(angle - target), Math.cos(angle - target));
  }

  private getForwardVector(angle: number): Vec2 {
    return { x: Math.sin(angle), z: -Math.cos(angle) };
  }

  private getRightVector(angle: number): Vec2 {
    return { x: Math.cos(angle), z: Math.sin(angle) };
  }

  private getRouteRightVector(dir: Vec2): Vec2 {
    return { x: -dir.z, z: dir.x };
  }

  private getHeadingFromDirection(dir: Vec2): number {
    return Math.atan2(dir.x, -dir.z);
  }

  private getSceneYawFromHeading(heading: number): number {
    return -heading;
  }

  private getHeadingFromSceneYaw(yaw: number): number {
    return -yaw;
  }

  private getSceneYawForDirection(dir: Vec2): number {
    return this.getSceneYawFromHeading(this.getHeadingFromDirection(dir));
  }

  private getRouteLateralPoint(point: Pick<RoutePoint, 'x' | 'z' | 'normal'>, lateral: number): Vec2 {
    return {
      x: point.x + point.normal.x * lateral,
      z: point.z + point.normal.z * lateral,
    };
  }

  private getDrivingLanePoint(distance: number): Vec2 {
    return this.getRouteLateralPoint(this.getSurfacePoint(distance), this.getDrivingLaneOffset(distance));
  }

  private getSegmentRoadWidth(segment?: RouteSegment): number {
    return Math.max(2.8, segment?.roadWidth ?? this.defaultRoadWidth);
  }

  private getSegmentLaneCount(segment?: RouteSegment): number {
    return Math.max(1, Math.round(segment?.laneCount ?? 2));
  }

  private getSegmentLaneWidth(segment?: RouteSegment): number {
    return this.getSegmentRoadWidth(segment) / this.getSegmentLaneCount(segment);
  }

  private getLaneDividerOffsets(segment: RouteSegment): number[] {
    const laneCount = this.getSegmentLaneCount(segment);
    if (laneCount <= 1) return [];
    const laneWidth = this.getSegmentLaneWidth(segment);
    const usableWidth = Math.min(this.getSegmentRoadWidth(segment) - 1.1, laneCount * laneWidth);
    const startOffset = -usableWidth / 2;
    const offsets: number[] = [];
    for (let lane = 1; lane < laneCount; lane += 1) {
      offsets.push(startOffset + lane * laneWidth);
    }
    return offsets;
  }

  private isProtectedLaneMarkingCrossed(distance: number, lateral: number): boolean {
    const point = this.getRoutePoint(distance);
    const segment = this.route[point.segmentIndex];
    const laneWidth = this.getSegmentLaneWidth(segment);
    const dividerTouchDistance = this.vehicleHalfWidth + 0.18;

    const crossingCenterDoubleYellow = !point.oneWay
      && this.getSegmentLaneCount(segment) >= 3
      && Math.abs(lateral) <= dividerTouchDistance + 0.1;
    if (crossingCenterDoubleYellow) return true;

    if (!this.isNearIntersection(distance, 38)) return false;
    return this.getLaneDividerOffsets(segment).some((offset) => {
      const isCenterDivider = !point.oneWay && Math.abs(offset) < laneWidth * 0.35;
      if (isCenterDivider) return false;
      return Math.abs(lateral - offset) <= dividerTouchDistance;
    });
  }

  private getRoadWidthAtDistance(distance: number): number {
    return this.getRoutePoint(distance).roadWidth;
  }

  private getInitialRouteDistance(): number {
    return this.getStableRouteDistance(this.initialRouteDistance);
  }

  private getStableRouteDistance(distance: number): number {
    const min = 2;
    const max = Math.max(min, this.routeLength - 12);
    let safe = this.clamp(distance, min, max);
    const padding = this.routeTurnBlendDistance + 2;

    for (let attempt = 0; attempt < this.route.length; attempt += 1) {
      const at = this.getRouteAt(safe);
      const segmentStart = this.routeSegmentStarts[at.index] ?? 0;
      const segmentEnd = segmentStart + at.segment.length;
      let next = safe;

      if (at.index > 0 && safe - segmentStart < padding) {
        next = segmentStart + padding;
      }
      if (at.index < this.route.length - 1 && segmentEnd - safe < padding) {
        next = segmentEnd + padding;
      }
      next = this.clamp(next, min, max);
      if (Math.abs(next - safe) < 0.001) return next;
      safe = next;
    }

    return safe;
  }

  private getDrivingLaneOffset(distance: number): number {
    const point = this.getRoutePoint(distance);
    const segment = this.route[point.segmentIndex];
    const laneWidth = this.getSegmentLaneWidth(segment);
    const laneCount = this.getSegmentLaneCount(segment);
    if (point.oneWay) {
      const usableWidth = Math.min(point.roadWidth - 1.1, laneCount * laneWidth);
      const startOffset = -usableWidth / 2 + laneWidth / 2;
      const centerLane = Math.floor((laneCount - 1) / 2);
      return startOffset + centerLane * laneWidth;
    }
    const lanesPerDirection = Math.max(1, Math.floor(laneCount / 2));
    const laneOffsets = this.getTravelLaneOffsets(segment, 1);
    return laneOffsets[Math.floor(lanesPerDirection / 2)]
      ?? Math.min(point.roadWidth / 2 - laneWidth / 2, laneWidth * 0.5);
  }

  private getLaneDeviationLimit(distance: number): number {
    return Math.max(this.minLaneDeviationLimit, this.getRoadWidthAtDistance(distance) / 2 - 0.35);
  }

  // Route helpers, also used for hazard placement and the minimap.
  private ensureRoute(route: RouteSegment[]): RouteSegment[] {
    const clean = route.filter((segment) => (
      Number.isFinite(segment.length)
      && segment.length > 0.5
      && Number.isFinite(segment.start.x)
      && Number.isFinite(segment.start.z)
      && Number.isFinite(segment.dir.x)
      && Number.isFinite(segment.dir.z)
      && Number.isFinite(segment.roadWidth)
      && Number.isFinite(segment.laneCount)
    ));
    if (clean.length > 0) return clean;
    return [{
      start: { x: 0, z: 0 },
      dir: { x: 0, z: -1 },
      length: 160,
      roadWidth: this.defaultRoadWidth,
      laneCount: 2,
      oneWay: true,
      name: 'fallback-road',
    }];
  }

  private getRouteAt(distance: number): RouteLookup {
    const maxDistance = Math.max(0, this.routeLength);
    const clamped = this.clamp(distance, 0, maxDistance);
    let index = 0;
    let low = 0;
    let high = this.route.length - 1;

    while (low <= high) {
      const mid = Math.floor((low + high) / 2);
      if ((this.routeSegmentStarts[mid] ?? 0) <= clamped) {
        index = mid;
        low = mid + 1;
      } else {
        high = mid - 1;
      }
    }

    const segment = this.route[index] ?? this.route[0];
    const start = this.routeSegmentStarts[index] ?? 0;
    return {
      segment,
      index,
      local: this.clamp(clamped - start, 0, segment.length),
    };
  }

  private getRouteHeading(distance: number): number {
    const point = this.getRoutePoint(distance);
    return this.getHeadingFromDirection(point.dir);
  }

  private getRoutePoint(distance: number): RoutePoint {
    const at = this.getRouteAt(distance);
    const { index, local } = at;
    const dir = this.getSmoothedDirection(index, local);
    return this.makeRoutePoint(at, dir);
  }

  private getSurfacePoint(distance: number): RoutePoint {
    const at = this.getRouteAt(distance);
    return this.makeRoutePoint(at, at.segment.dir);
  }

  private makeRoutePoint(at: RouteLookup, dir: Vec2): RoutePoint {
    const { segment, index, local } = at;
    const normal = this.getRouteRightVector(dir);
    return {
      x: segment.start.x + segment.dir.x * local,
      z: segment.start.z + segment.dir.z * local,
      dir,
      normal,
      segmentIndex: index,
      localDistance: local,
      roadWidth: this.getSegmentRoadWidth(segment),
      laneCount: this.getSegmentLaneCount(segment),
      oneWay: segment.oneWay,
    };
  }

  private getSmoothedDirection(index: number, local: number): Vec2 {
    const segment = this.route[index];
    const blendDistance = this.routeTurnBlendDistance;
    if (local > segment.length - blendDistance && this.route[index + 1]) {
      const t = (local - (segment.length - blendDistance)) / blendDistance;
      return this.normalizeDir({
        x: segment.dir.x * (1 - t) + this.route[index + 1].dir.x * t,
        z: segment.dir.z * (1 - t) + this.route[index + 1].dir.z * t,
      });
    }
    if (local < blendDistance && this.route[index - 1]) {
      const t = local / blendDistance;
      return this.normalizeDir({
        x: this.route[index - 1].dir.x * (1 - t) + segment.dir.x * t,
        z: this.route[index - 1].dir.z * (1 - t) + segment.dir.z * t,
      });
    }
    return segment.dir;
  }

  private normalizeDir(dir: Vec2): Vec2 {
    const length = Math.hypot(dir.x, dir.z) || 1;
    return { x: dir.x / length, z: dir.z / length };
  }

  private getRouteTurn(from: Vec2, to: Vec2): 'left' | 'right' | null {
    const signedTurn = from.x * to.z - from.z * to.x;
    const dot = from.x * to.x + from.z * to.z;
    const angle = Math.atan2(signedTurn, dot);
    if (Math.abs(angle) < Math.PI / 12) return null;
    return angle > 0 ? 'right' : 'left';
  }

  private getTurnInstruction(turnDir: 'left' | 'right' | null): string {
    if (turnDir === 'left') return this.text.turnLeft;
    if (turnDir === 'right') return this.text.turnRight;
    return this.text.straight;
  }

  private getNavigationArrow(turnDir: 'left' | 'right' | null): string {
    if (turnDir === 'left') return '\u2190';
    if (turnDir === 'right') return '\u2192';
    return '\u2191';
  }

  private finishTrial(displayElement: HTMLElement, response: string) {
    if (this.finished) return;
    this.finished = true;

    const duration = this.trialStartTime > 0
      ? Math.round(Math.max(0, this.simulationTime - this.trialStartTime))
      : 0;
    const rounds = this.eventResults.filter((event) => event.event_id === 'wrong-way-driver');
    for (const event of rounds) {
      if (event.response === 'pending') event.response = 'no-response';
    }
    const validEvents = rounds.filter((event) => event.valid);
    const validRts = validEvents
      .filter((event) => event.rt_ms !== null)
      .map((event) => event.rt_ms);
    const reactionSummary = SummarizeReactionTimes(validRts);
    const collisions = this.eventResults.filter((event) => event.collision).length;
    const averageFps = this.fpsSamples.length
      ? Math.round(this.fpsSamples.reduce((sum, fps) => sum + fps, 0) / this.fpsSamples.length)
      : 0;

    this.detachGlobalListeners();
    this.cleanupRenderResources();
    displayElement.replaceChildren();

    this.jsPsych.finishTrial({
      rt: reactionSummary.averageMs,
      correct: response === 'completed' && rounds.length > 0 && rounds.every(event => event.avoidance_success === true),
      target: this.text.deliveryTarget,
      response,
      duration_ms: duration,
      average_rt: reactionSummary.averageMs,
      median_rt: reactionSummary.medianMs,
      valid_event_count: validEvents.length,
      reaction_event_count: validRts.length,
      successful_avoidance_count: rounds.filter(event => event.avoidance_success === true).length,
      event_count: rounds.length,
      collisions,
      lane_deviations: this.laneDeviationCount,
      average_fps: averageFps,
      display_refresh_hz: this.refreshMeasured ? Math.round(this.displayRefreshHz * 100) / 100 : 0,
      display_refresh_ms: this.refreshMeasured ? Math.round(this.displayRefreshMs * 1000) / 1000 : 0,
      refresh_sample_count: this.refreshSampleCount,
      refresh_measurement_valid: this.refreshMeasured,
      rendering_quality: this.renderQuality.level,
      control_mode: this.controlMode,
      route_id: this.selectedRouteVariant?.id ?? 'unknown',
      route_label: this.selectedRouteVariant?.label ?? 'Unknown route',
      route_progress: Math.round(this.progress * 10) / 10,
      driving_events: rounds,
    });
  }

  private detachGlobalListeners() {
    this.startupAbort.abort();
    cancelAnimationFrame(this.raf);
    if (this.keydownListener) {
      window.removeEventListener('keydown', this.keydownListener);
      this.keydownListener = null;
    }
    if (this.keyupListener) {
      window.removeEventListener('keyup', this.keyupListener);
      this.keyupListener = null;
    }
    this.detachResizeSync();
    if (this.gamepadConnectedListener) {
      window.removeEventListener('gamepadconnected', this.gamepadConnectedListener);
      this.gamepadConnectedListener = null;
    }
    if (this.gamepadDisconnectedListener) {
      window.removeEventListener('gamepaddisconnected', this.gamepadDisconnectedListener);
      this.gamepadDisconnectedListener = null;
    }
    if (this.visibilityChangeListener) {
      document.removeEventListener('visibilitychange', this.visibilityChangeListener);
      this.visibilityChangeListener = null;
    }
    this.visibilityPausedAt = null;
  }

  private normalizeInputTimestamp(value: number) {
    return NormalizeDrivingInputTimestamp(value, performance.now());
  }

  private captureBrakeInputTimestamp(value: number) {
    const timestamp = this.normalizeInputTimestamp(value);
    if (document.visibilityState !== 'visible' || this.visibilityPausedAt !== null) return;
    this.excludeInactiveFrameGap(timestamp);
    this.pendingBrakeTimestamp = timestamp;
    this.lastBrakePressed = true;
    if (!this.laneResetActive) this.handleBrakePressed(timestamp);
  }

  private captureSteeringInputTimestamp(value: number) {
    const steering = Number(this.keyState.right) - Number(this.keyState.left);
    const previous = this.lastResponseSteering;
    this.lastResponseSteering = steering;
    if (!steering || steering === previous || this.laneResetActive
      || document.visibilityState !== 'visible' || this.visibilityPausedAt !== null) return;
    const timestamp = this.normalizeInputTimestamp(value);
    this.excludeInactiveFrameGap(timestamp);
    this.handleHazardResponse(timestamp, steering < 0 ? 'steer-left' : 'steer-right');
  }

  private detachResizeSync() {
    this.viewportController?.stop();
    this.viewportController = null;
    this.hudPanelObserver?.disconnect();
    this.hudPanelObserver = null;
  }

  private clearLaneResetTimers() {
    if (this.laneResetBlackoutTimer !== null) {
      window.clearTimeout(this.laneResetBlackoutTimer);
      this.laneResetBlackoutTimer = null;
    }
    if (this.laneResetClearTimer !== null) {
      window.clearTimeout(this.laneResetClearTimer);
      this.laneResetClearTimer = null;
    }
  }

  private cleanupRenderResources() {
    this.unregisterRuntimeDisposer?.();
    this.unregisterRuntimeDisposer = null;
    cancelAnimationFrame(this.raf);
    this.clearLaneResetTimers();
    this.detachResizeSync();
    this.miniMapLastUpdateTime = 0;
    this.miniMapLastDirectionText = '';
    this.miniMapRouteSamples = [];
    this.rearviewLastUpdateTime = 0;
    if (this.renderer) {
      this.renderer.dispose();
      this.renderer = null;
    }
    this.pixelWorld = null;
    this.root = null;
    this.touchControlsRoot?.remove();
    this.touchControlsRoot = null;
    this.inputPauseOverlay?.remove();
    this.inputPauseOverlay = null;
    this.inputPausedAt = 0;
    this.visibilityPausedAt = null;
    this.ambientTrafficActors = [];
    this.hud = null;
    this.miniMapCanvas = null;
    this.miniMapCtx = null;
    this.miniMapDirectionLabel = null;
  }
}

function CreateDrivingTouchButton(label: string, ariaLabel: string) {
  const button = document.createElement('button');
  button.type = 'button';
  button.textContent = label;
  button.setAttribute('aria-label', ariaLabel);
  Object.assign(button.style, {
    minWidth: '58px',
    height: '58px',
    padding: '0 14px',
    border: '1px solid var(--border-hover)',
    borderRadius: '12px',
    background: 'var(--bg-overlay)',
    color: 'var(--text-primary)',
    boxShadow: 'var(--shadow-floating)',
    cursor: 'pointer',
    fontFamily: typography.fontFamily,
    fontSize: '22px',
    fontWeight: '900',
    lineHeight: '1',
    touchAction: 'none',
    userSelect: 'none',
    WebkitUserSelect: 'none',
    WebkitTapHighlightColor: 'transparent',
    backdropFilter: 'blur(8px)',
    WebkitBackdropFilter: 'blur(8px)',
  });
  button.addEventListener('pointerdown', () => {
    button.style.setProperty('scale', '0.96');
    button.style.filter = 'brightness(0.84)';
  });
  const clearActive = () => {
    button.style.setProperty('scale', '1');
    button.style.filter = '';
  };
  button.addEventListener('pointerup', clearActive);
  button.addEventListener('pointercancel', clearActive);
  button.addEventListener('pointerleave', clearActive);
  return button;
}

export default ThreeDrivingRehabPlugin;

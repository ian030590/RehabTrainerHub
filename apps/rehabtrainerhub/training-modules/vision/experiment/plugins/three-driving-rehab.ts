// Canonical Hub-owned driving runtime.
import { JsPsych, ParameterType } from 'jspsych';
import type { JsPsychPlugin, TrialType } from 'jspsych';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { CreateRuntimeAssetUrlCandidates } from '@rehab-trainer/ui/aiAssets';
import { MeasureDisplayRefreshRate } from '@rehab-trainer/ui/displayTiming';
import { typography } from '@rehab-trainer/ui/trainerTheme';
import { soundManager } from '../../utils/soundManager';
import { difficultyPresets, hazardTemplates } from './driving/driving-hazards';
import {
  drivingRoute,
  drivingRouteVariants,
  BuildDrivingRoute,
  PickRandomDrivingRoute,
  ProjectTaipeiLonLat,
  type DrivingRouteVariant,
} from './driving/driving-route';
import { three, type ThreeModule } from './driving/driving-scene';
import {
  CalculateDrivingCameraPose,
  type DrivingCameraMode,
} from './driving/driving-camera';
import {
  CalculateDrivingViewport,
  CaptureDrivingRendererPassState,
  CreateDrivingRenderQuality,
  DrivingViewportController,
  RestoreDrivingRendererPassState,
  type DrivingRenderQuality,
  type DrivingRenderQualityLevel,
} from './driving/driving-rendering';
import {
  CalculateDrivingFixedSteps,
  CalculateEstimatedPresentationTime,
  CalculateFrameAlignedReactionTime,
  NormalizeDrivingInputTimestamp,
  SummarizeReactionTimes,
} from './driving/driving-timing';
import {
  FindDrivingWheelGamepad,
  IsDrivingWheelGamepad,
  ParseDrivingWheelCalibration,
  ReadDrivingWheelInput,
  type DrivingWheelCalibration,
} from './driving/driving-input';
import { drivingText, type DrivingText } from './driving/driving-text';
import { RegisterDrivingRuntimeDisposer } from './driving/driving-runtime-lifecycle';
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
  IntersectionZone,
  RoutePoint,
  RouteSegment,
  TrafficLightState,
  Vec2,
  VehicleResetPose,
} from './driving/types';

type DrivingTouchKey = 'left' | 'right' | 'up' | 'down';

interface VehicleWheelBinding {
  node: any;
  initialY: number;
  baseRotationX: number;
  baseRotationY: number;
  baseRotationZ: number;
  front: boolean;
}

interface AmbientTrafficActor {
  group: any;
  shadow: any;
  distance: number;
  lateral: number;
  direction: 1 | -1;
  speed: number;
  targetSpeed: number;
  cruiseSpeed: number;
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

interface BoxInstanceSpec {
  x: number;
  y: number;
  z: number;
  yaw: number;
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

  private renderer: any = null;
  private scene: any = null;
  private camera: any = null;
  private vehicleRoot: any = null;
  private vehicleModel: any = null;
  private fallbackVehicle: any = null;
  private vehicleBlobShadow: any = null;
  private blobShadowTexture: any = null;
  private wheelBindings: VehicleWheelBinding[] = [];
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
  private needsFirstFrameCameraSnap = false;
  private cameraMode: DrivingCameraMode = 'first-person';
  private wheelSpin = 0;

  // Intersection / turning state
  private intersections: IntersectionZone[] = [];

  // Difficulty
  private difficultyPreset: DifficultyPreset = difficultyPresets.beginner;

  // Mini-map
  private miniMapCanvas: HTMLCanvasElement | null = null;
  private miniMapCtx: CanvasRenderingContext2D | null = null;
  private rearviewMirrorCanvases: Partial<Record<'center' | 'left' | 'right', HTMLCanvasElement>> = {};
  private rearviewRenderTargets: Partial<Record<'center' | 'left' | 'right', any>> = {};
  private rearviewPixelBuffers: Partial<Record<'center' | 'left' | 'right', Uint8Array>> = {};
  private rearviewImageData = new WeakMap<HTMLCanvasElement, ImageData>();
  private rearviewCamera: any = null;
  private rearviewLookAt: any = null;
  private rearviewLastUpdateTime = 0;
  private sideRearviewMirrorsEnabled = true;
  private rearviewQualityLevel: DrivingRenderQualityLevel = 'high';
  private miniMapLastUpdateTime = 0;
  private miniMapLastDirectionText = '';
  private asphaltTexture: any = null;
  private asphaltMaterials = new Map<number, any>();
  private signTextureCache = new Map<string, any>();
  private miniMapDirectionLabel: HTMLDivElement | null = null;
  private cockpitSteeringWheel: HTMLDivElement | null = null;
  private cockpitSpeedNeedle: HTMLDivElement | null = null;
  private cockpitSpeedText: HTMLDivElement | null = null;

  private keyState = {
    left: false,
    right: false,
    up: false,
    down: false,
  };

  private keydownListener: ((event: KeyboardEvent) => void) | null = null;
  private keyupListener: ((event: KeyboardEvent) => void) | null = null;
  private touchControlsRoot: HTMLDivElement | null = null;
  private inputPauseOverlay: HTMLDivElement | null = null;
  private inputPausedAt = 0;
  private visibilityPausedAt: number | null = null;
  private visibilityChangeListener: (() => void) | null = null;
  private gamepadConnectedListener: ((event: GamepadEvent) => void) | null = null;
  private gamepadDisconnectedListener: ((event: GamepadEvent) => void) | null = null;
  private gamepadConnected = false;
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
    cockpit?: HTMLDivElement;
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
  private readonly baseCameraFov = 68;
  private readonly initialRouteDistance = 18;
  private readonly routeTurnBlendDistance = 14;
  private readonly referenceVehicleModelYawOffset = Math.PI;
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
  private readonly referenceVehicleUrls = CreateRuntimeAssetUrlCandidates(
    import.meta.env.VITE_AI_ASSET_BASE_URL,
    'game-assets/rehabtrainerhub/vision/reference-car/v1/car.glb',
    '/assets/driving/reference-car-game/vehicals/car.glb',
  );
  private readonly taipeiOsmUrl = '/assets/driving/taipei-osm/taipei-xinyi-osm.json';

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

  private configureInitialRearviewQuality() {
    this.rearviewQualityLevel = this.renderQuality.level;
  }

  trial(displayElement: HTMLElement, trial: TrialType<Info>) {
    displayElement.replaceChildren();
    this.resetTrialState(trial);
    this.unregisterRuntimeDisposer = RegisterDrivingRuntimeDisposer(() => {
      if (this.finished) return;
      this.finished = true;
      this.detachGlobalListeners();
      this.cleanupRenderResources();
    });
    soundManager.init();

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
        if (this.renderQuality.useReferenceVehicleModel) {
          await this.loadReferenceVehicleModel();
        }
        if (this.finished) return;
        if (!displayElement.isConnected) {
          this.finishTrial(displayElement, 'aborted');
          return;
        }
        this.updateVehicleVisual(0);
        this.updateTrafficLights(0);
        this.renderFirstFrameBeforeReveal(performance.now());

        // Measure only after high-quality scene/model initialization and a GPU
        // warm-up render. Heavy startup work must not consume the sampling
        // timeout or make a fast display look like the 60 Hz fallback.
        const displayRefresh = await MeasureDisplayRefreshRate({
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
        this.updateVehicleVisual(0);
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
    if (!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      spinner.animate(
        [{ transform: 'rotate(0deg)' }, { transform: 'rotate(360deg)' }],
        { duration: 850, iterations: Infinity },
      );
    }

    overlay.append(spinner);
    root.appendChild(overlay);
    return overlay;
  }

  private resetTrialState(trial?: TrialType<Info>) {
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
    this.wheelSpin = 0;
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
    this.needsFirstFrameCameraSnap = true;
    this.lastBrakePressed = false;
    this.pendingBrakeTimestamp = null;
    this.fpsSamples = [];
    this.displayRefreshMs = 1000 / 60;
    this.displayRefreshHz = 60;
    this.refreshSampleCount = 0;
    this.refreshMeasured = false;
    this.activeHazards = [];
    this.eventResults = [];
    this.ambientTrafficActors = [];
    this.roadCollisionBoxes = [];
    this.buildingCollisionBoxes = [];
    this.keyState = { left: false, right: false, up: false, down: false };
    this.miniMapCanvas = null;
    this.miniMapCtx = null;
    this.rearviewMirrorCanvases = {};
    this.rearviewRenderTargets = {};
    this.rearviewPixelBuffers = {};
    this.rearviewImageData = new WeakMap<HTMLCanvasElement, ImageData>();
    this.rearviewCamera = null;
    this.rearviewLookAt = null;
    this.rearviewLastUpdateTime = 0;
    this.sideRearviewMirrorsEnabled = true;
    this.rearviewQualityLevel = 'high';
    this.miniMapLastUpdateTime = 0;
    this.miniMapLastDirectionText = '';
    this.asphaltTexture = null;
    this.asphaltMaterials = new Map<number, any>();
    this.signTextureCache = new Map<string, any>();
    this.miniMapDirectionLabel = null;
    this.cockpitSteeringWheel = null;
    this.cockpitSpeedNeedle = null;
    this.cockpitSpeedText = null;
    this.gamepadConnected = FindDrivingWheelGamepad(navigator.getGamepads?.() ?? []) !== null;
    this.controlMode = this.getControlMode((trial as any)?.control_mode);
    this.wheelCalibration = ParseDrivingWheelCalibration((trial as any)?.wheel_calibration);
    this.language = this.getLanguage((trial as any)?.language);
    this.text = drivingText[this.language];
    this.renderQuality = CreateDrivingRenderQuality((trial as any)?.render_quality);
    this.configureInitialRearviewQuality();

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

    const camera = CreateDrivingTouchButton('CAM', 'Switch camera view');
    camera.dataset.drivingControlGroup = 'camera';
    Object.assign(camera.style, {
      position: 'absolute',
      left: '50%',
      bottom: 'max(14px, env(safe-area-inset-bottom))',
      minWidth: '64px',
      height: '44px',
      transform: 'translateX(-50%)',
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
      background: 'var(--accent)',
      mask: 'url(/assets/driving-controls/steering-wheel.svg) center / contain no-repeat',
      WebkitMask: 'url(/assets/driving-controls/steering-wheel.svg) center / contain no-repeat',
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
      backgroundImage: 'url(/assets/driving-controls/car-pedals.svg)',
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
      backgroundImage: 'url(/assets/driving-controls/car-pedals.svg)',
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
    };

    button.addEventListener('pointerdown', (event) => {
      event.preventDefault();
      event.stopPropagation();
      button.setPointerCapture(event.pointerId);
      if (keys.includes('down') && !this.keyState.down) {
        this.captureBrakeInputTimestamp(event.timeStamp);
      }
      setPressed(true);
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
      if (code === 'ArrowDown') {
        if (pressed && !this.keyState.down) {
          this.captureBrakeInputTimestamp(eventTimestamp);
        }
        this.keyState.down = pressed;
      }
      return;
    }
    if (this.controlMode === 'wasd') {
      if (code === 'KeyA') this.keyState.left = pressed;
      if (code === 'KeyD') this.keyState.right = pressed;
      if (code === 'KeyW') this.keyState.up = pressed;
      if (code === 'KeyS') {
        if (pressed && !this.keyState.down) {
          this.captureBrakeInputTimestamp(eventTimestamp);
        }
        this.keyState.down = pressed;
      }
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
    const three = this.requireThree();
    this.scene = new three.Scene();
    this.scene.background = new three.Color(0xd9eaf1);
    this.scene.fog = new three.Fog(0xcbd7d9, this.renderQuality.fogNear, this.renderQuality.fogFar);

    const initialViewport = CalculateDrivingViewport(
      root.clientWidth,
      root.clientHeight,
      window.devicePixelRatio || 1,
      this.renderQuality.pixelRatioCap,
    );
    this.camera = new three.PerspectiveCamera(
      this.baseCameraFov,
      initialViewport.aspect,
      0.1,
      this.renderQuality.cameraFar,
    );
    this.rearviewCamera = new three.PerspectiveCamera(66, 3.2, 0.1, Math.min(this.renderQuality.cameraFar, 360));
    this.rearviewLookAt = new three.Vector3();

    this.renderer = new three.WebGLRenderer({
      antialias: this.renderQuality.antialias,
      alpha: false,
      powerPreference: 'high-performance',
    });
    this.renderer.shadowMap.enabled = false;
    this.renderer.outputColorSpace = three.SRGBColorSpace;
    this.renderer.domElement.style.width = '100%';
    this.renderer.domElement.style.height = '100%';
    this.renderer.domElement.style.display = 'block';
    root.appendChild(this.renderer.domElement);
    this.viewportController = new DrivingViewportController({
      renderer: this.renderer,
      camera: this.camera,
      root,
      pixelRatioCap: this.renderQuality.pixelRatioCap,
      onLayoutChange: () => this.syncMobileHudLayout(),
    });
    this.viewportController.start();

    this.createSceneEnvironment();
    this.buildWorld();
    this.createVehicleVisual();
    this.createAmbientTraffic();
    this.preloadHazardEvents();
    if (this.renderQuality.useOsmCity) void this.loadTaipeiOsmCity();
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
      camera.style.bottom = compact
        ? `calc(${bottomInset} + ${veryNarrow ? pedalHeight + steeringSize + 26 : pedalHeight + 18}px)`
        : bottomInset;
      camera.style.fontSize = compact ? '11px' : '13px';
    }
  }

  private syncMobileHudLayout() {
    this.syncTouchControlsLayout();
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

    Object.assign(miniMapWrapper.style, {
      top: 'auto',
      left: 'auto',
      right: '18px',
      bottom: '28px',
      width: '236px',
      height: '278px',
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
    if (titleBar) titleBar.style.display = 'flex';
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

  private createSceneEnvironment() {
    const three = this.requireThree();
    if (!this.scene) return;

    const fogRange = this.getDifficultyFogRange();
    this.scene.fog = new three.Fog(0xcbd7d9, fogRange.near, fogRange.far);

    const ambient = new three.AmbientLight(0xffffff, 1.28);
    const sun = new three.DirectionalLight(0xffe7c2, 1.55);
    sun.position.set(38, 62, 26);
    sun.castShadow = false;

    const hemi = new three.HemisphereLight(0xbfd4df, 0x4d6b50, 0.92);
    this.scene.add(ambient, sun, hemi);
    this.addSkyDome();
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

  private addSkyDome() {
    const three = this.requireThree();
    if (!this.scene) return;

    const routeBounds = this.getRouteBounds();
    const sky = new three.Mesh(
      new three.SphereGeometry(1200, 32, 16),
      new three.MeshBasicMaterial({
        map: this.createSkyTexture(),
        side: three.DoubleSide,
        depthWrite: false,
        fog: false,
      }),
    );
    sky.name = 'driving-sky-dome';
    sky.position.set(
      (routeBounds.minX + routeBounds.maxX) / 2,
      -120,
      (routeBounds.minZ + routeBounds.maxZ) / 2,
    );
    sky.renderOrder = -1000;
    this.scene.add(sky);
  }

  private createSkyTexture() {
    const three = this.requireThree();
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
      gradient.addColorStop(0, '#5f9ed0');
      gradient.addColorStop(0.42, '#a8d3e5');
      gradient.addColorStop(0.66, '#e4eef0');
      gradient.addColorStop(1, '#f7dfbd');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      const sun = ctx.createRadialGradient(384, 74, 2, 384, 74, 92);
      sun.addColorStop(0, 'rgba(255,246,205,0.95)');
      sun.addColorStop(0.22, 'rgba(255,226,156,0.56)');
      sun.addColorStop(1, 'rgba(255,226,156,0)');
      ctx.fillStyle = sun;
      ctx.fillRect(250, 0, 262, 190);

      ctx.fillStyle = 'rgba(255,255,255,0.28)';
      for (const [x, y, w] of [
        [54, 72, 92],
        [154, 48, 68],
        [286, 96, 116],
        [418, 122, 82],
      ] as const) {
        ctx.beginPath();
        ctx.ellipse(x, y, w, 12, 0, 0, Math.PI * 2);
        ctx.ellipse(x + w * 0.38, y + 4, w * 0.7, 10, 0, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    const texture = new three.CanvasTexture(canvas);
    texture.colorSpace = three.SRGBColorSpace;
    texture.needsUpdate = true;
    return texture;
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

    this.sideRearviewMirrorsEnabled = true;

    // Create mini-map
    const miniMapWrapper = this.createMiniMap();

    const cockpit = this.createCockpitMask();
    hud.append(redFlash, cockpit, hudPanel, miniMapWrapper, blackout);
    root.appendChild(hud);

    this.hud = { status, route, speed, distance, view, event, redFlash, blackout, cockpit, panel: hudPanel, miniMapWrapper };
    this.updateCameraModeHud();
    this.syncMobileHudLayout();
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

    // Update direction label
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

  private createCockpitMask(): HTMLDivElement {
    const cockpit = document.createElement('div');
    Object.assign(cockpit.style, {
      position: 'absolute',
      inset: '0',
      pointerEvents: 'none',
      boxShadow: 'inset 0 0 0 10px rgba(4, 12, 18, 0.68), inset 0 80px 90px rgba(4, 12, 18, 0.28)',
    });

    const dash = document.createElement('div');
    Object.assign(dash.style, {
      position: 'absolute',
      left: '0',
      right: '0',
      bottom: '0',
      height: '24%',
      background: 'linear-gradient(180deg, rgba(30,39,44,0.92), rgba(8,12,16,0.98))',
      borderTop: '3px solid rgba(255,255,255,0.10)',
      borderRadius: '50% 50% 0 0 / 16% 16% 0 0',
    });

    // Left-hand-drive cockpit: driver and steering wheel are on the left side.
    const wheel = document.createElement('div');
    Object.assign(wheel.style, {
      position: 'absolute',
      left: '38%',
      bottom: '4%',
      width: '220px',
      height: '110px',
      transform: 'translateX(-50%)',
      transformOrigin: '50% 100%',
      border: '18px solid rgba(9, 14, 18, 0.96)',
      borderBottom: '0',
      borderRadius: '140px 140px 0 0',
      boxShadow: '0 0 0 2px rgba(255,255,255,0.08), inset 0 8px 24px rgba(255,255,255,0.06)',
    });
    const wheelSpoke = document.createElement('div');
    Object.assign(wheelSpoke.style, {
      position: 'absolute',
      left: '50%',
      bottom: '-8px',
      width: '18px',
      height: '74px',
      transform: 'translateX(-50%)',
      borderRadius: '12px',
      background: 'linear-gradient(180deg, rgba(28,34,40,0.96), rgba(8,12,16,0.96))',
      boxShadow: '0 0 0 1px rgba(255,255,255,0.08)',
    });
    const wheelHub = document.createElement('div');
    Object.assign(wheelHub.style, {
      position: 'absolute',
      left: '50%',
      bottom: '-18px',
      width: '56px',
      height: '34px',
      transform: 'translateX(-50%)',
      borderRadius: '999px',
      background: 'linear-gradient(180deg, rgba(33,41,49,0.98), rgba(8,12,16,0.98))',
      boxShadow: 'inset 0 6px 12px rgba(255,255,255,0.06)',
    });
    wheel.append(wheelSpoke, wheelHub);
    this.cockpitSteeringWheel = wheel;

    const cluster = document.createElement('div');
    Object.assign(cluster.style, {
      position: 'absolute',
      left: '30%',
      bottom: '8%',
      width: '148px',
      height: '58px',
      transform: 'translateX(-50%)',
      borderRadius: '48px 48px 12px 12px',
      background: 'linear-gradient(180deg, rgba(15,23,31,0.94), rgba(3,7,12,0.96))',
      border: '1px solid rgba(255,255,255,0.08)',
      boxShadow: '0 8px 18px rgba(0,0,0,0.32), inset 0 1px 0 rgba(255,255,255,0.10)',
    });
    const dial = document.createElement('div');
    Object.assign(dial.style, {
      position: 'absolute',
      left: '16px',
      top: '8px',
      width: '44px',
      height: '44px',
      borderRadius: '50%',
      border: '2px solid rgba(125,211,252,0.42)',
      background: 'radial-gradient(circle at 50% 58%, rgba(14,23,34,0.9), rgba(2,6,10,0.96))',
    });
    const needle = document.createElement('div');
    Object.assign(needle.style, {
      position: 'absolute',
      left: '20px',
      bottom: '20px',
      width: '2px',
      height: '18px',
      transformOrigin: '50% 100%',
      transform: 'rotate(-115deg)',
      background: '#f87171',
      borderRadius: '2px',
      boxShadow: '0 0 8px rgba(248,113,113,0.75)',
    });
    dial.appendChild(needle);
    const speedReadout = document.createElement('div');
    Object.assign(speedReadout.style, {
      position: 'absolute',
      right: '16px',
      top: '12px',
      color: '#dff7ff',
      fontSize: '15px',
      fontWeight: '900',
      lineHeight: '1',
      textShadow: '0 0 10px rgba(56,189,248,0.45)',
    });
    speedReadout.textContent = '0';
    const speedUnit = document.createElement('div');
    Object.assign(speedUnit.style, {
      position: 'absolute',
      right: '16px',
      top: '31px',
      color: 'rgba(223,247,255,0.72)',
      fontSize: '9px',
      fontWeight: '800',
      lineHeight: '1',
    });
    speedUnit.textContent = 'km/h';
    cluster.append(dial, speedReadout, speedUnit);
    dash.appendChild(cluster);
    this.cockpitSpeedNeedle = needle;
    this.cockpitSpeedText = speedReadout;

    const hood = document.createElement('div');
    Object.assign(hood.style, {
      position: 'absolute',
      left: '50%',
      bottom: '19%',
      width: '44%',
      height: '10%',
      transform: 'translateX(-50%)',
      borderRadius: '50% 50% 0 0 / 70% 70% 0 0',
      background: 'linear-gradient(180deg, rgba(59,130,246,0.72), rgba(18,31,46,0.92))',
      boxShadow: 'inset 0 14px 28px rgba(255,255,255,0.10), 0 -8px 30px rgba(15,23,42,0.16)',
    });

    const leftPillar = document.createElement('div');
    Object.assign(leftPillar.style, {
      position: 'absolute',
      left: '0',
      top: '0',
      width: '9%',
      height: '100%',
      background: 'linear-gradient(90deg, rgba(5,10,14,0.88), rgba(5,10,14,0.10))',
      clipPath: 'polygon(0 0, 100% 0, 42% 100%, 0 100%)',
    });

    const rightPillar = document.createElement('div');
    Object.assign(rightPillar.style, {
      position: 'absolute',
      right: '0',
      top: '0',
      width: '9%',
      height: '100%',
      background: 'linear-gradient(270deg, rgba(5,10,14,0.88), rgba(5,10,14,0.10))',
      clipPath: 'polygon(0 0, 100% 0, 100% 100%, 58% 100%)',
    });

    const centerMirror = this.createRearviewMirror('center');
    cockpit.append(hood, dash, wheel, leftPillar, rightPillar, centerMirror);
    if (this.sideRearviewMirrorsEnabled) {
      cockpit.append(this.createRearviewMirror('left'), this.createRearviewMirror('right'));
    }
    return cockpit;
  }

  private createRearviewMirror(position: 'center' | 'left' | 'right'): HTMLDivElement {
    const mirror = document.createElement('div');
    const isCenter = position === 'center';
    const isLeft = position === 'left';
    mirror.dataset.rearviewWrapper = position;

    Object.assign(mirror.style, {
      position: 'absolute',
      overflow: 'hidden',
      background: 'linear-gradient(145deg, rgba(5, 10, 14, 0.98), rgba(18, 27, 34, 0.98))',
      border: isCenter ? '5px solid rgba(7, 11, 15, 0.98)' : '4px solid rgba(7, 11, 15, 0.96)',
      borderRadius: isCenter ? '10px' : '18px 22px 20px 18px / 16px 18px 22px 20px',
      boxShadow: '0 10px 22px rgba(0,0,0,0.36), inset 0 0 0 1px rgba(255,255,255,0.10)',
    });

    if (isCenter) {
      Object.assign(mirror.style, {
        left: '50%',
        top: '112px',
        width: '210px',
        height: '52px',
        transform: 'translateX(-50%)',
      });
    } else {
      Object.assign(mirror.style, {
        top: '44%',
        width: '128px',
        height: '72px',
        transform: isLeft ? 'skewY(-5deg) rotate(-2deg)' : 'skewY(5deg) rotate(2deg)',
      });
      if (isLeft) {
        mirror.style.left = '18px';
      } else {
        mirror.style.right = '18px';
      }
    }

    const glass = document.createElement('div');
    Object.assign(glass.style, {
      position: 'absolute',
      inset: isCenter ? '4px 6px' : '5px',
      overflow: 'hidden',
      borderRadius: isCenter ? '6px' : '14px 18px 16px 14px / 12px 14px 18px 16px',
      background: '#071118',
      boxShadow: 'inset 0 0 18px rgba(0,0,0,0.44)',
    });

    const canvas = document.createElement('canvas');
    const canvasSize = this.getRearviewCanvasSize(position);
    canvas.width = canvasSize.width;
    canvas.height = canvasSize.height;
    canvas.dataset.rearviewMirror = position;
    Object.assign(canvas.style, {
      position: 'absolute',
      inset: '0',
      width: '100%',
      height: '100%',
      display: 'block',
      background: '#071118',
      transform: 'scaleX(-1)',
    });
    this.rearviewMirrorCanvases[position] = canvas;

    const highlight = document.createElement('div');
    Object.assign(highlight.style, {
      position: 'absolute',
      inset: '0',
      background: 'linear-gradient(120deg, rgba(255,255,255,0.18), rgba(255,255,255,0.02) 30%, rgba(255,255,255,0) 54%)',
    });

    const vignette = document.createElement('div');
    Object.assign(vignette.style, {
      position: 'absolute',
      inset: '0',
      boxShadow: 'inset 0 0 18px rgba(0,0,0,0.62)',
    });

    glass.append(canvas, highlight, vignette);
    mirror.appendChild(glass);
    return mirror;
  }

  private updateRearviewMirrors(time: number) {
    if (!this.renderer || !this.scene || !this.rearviewCamera) return;
    if (this.cameraMode !== 'first-person') return;
    if (time - this.rearviewLastUpdateTime < this.getRearviewUpdateIntervalMs()) return;
    this.rearviewLastUpdateTime = time;

    const centerCanvas = this.rearviewMirrorCanvases.center;
    const leftCanvas = this.sideRearviewMirrorsEnabled ? this.rearviewMirrorCanvases.left : null;
    const rightCanvas = this.sideRearviewMirrorsEnabled ? this.rearviewMirrorCanvases.right : null;
    const centerConnected = Boolean(centerCanvas?.isConnected);
    const leftConnected = Boolean(leftCanvas?.isConnected);
    const rightConnected = Boolean(rightCanvas?.isConnected);
    if (!centerConnected && !leftConnected && !rightConnected) return;

    const vehicleBox = this.getVehicleCollisionBox();
    const forward = this.getForwardVector(this.vehicleHeading);
    const right = this.getRightVector(this.vehicleHeading);
    const three = this.requireThree();
    const rendererState = CaptureDrivingRendererPassState(
      this.renderer,
      () => new three.Vector4(),
    );
    const previousVehicleVisible = this.vehicleRoot?.visible;
    if (this.vehicleRoot) this.vehicleRoot.visible = false;

    try {
      if (centerConnected && centerCanvas) {
        this.renderRearviewMirror('center', centerCanvas, vehicleBox, forward, right);
      }

      if (leftConnected && leftCanvas) {
        this.renderRearviewMirror('left', leftCanvas, vehicleBox, forward, right);
      }
      if (rightConnected && rightCanvas) {
        this.renderRearviewMirror('right', rightCanvas, vehicleBox, forward, right);
      }
    } finally {
      RestoreDrivingRendererPassState(this.renderer, rendererState);
      if (this.vehicleRoot && previousVehicleVisible !== undefined) {
        this.vehicleRoot.visible = previousVehicleVisible;
      }
    }
  }

  private renderRearviewMirror(
    position: 'center' | 'left' | 'right',
    canvas: HTMLCanvasElement,
    vehicleBox: CollisionBox2D,
    forward: Vec2,
    right: Vec2,
  ) {
    if (!this.renderer || !this.scene || !this.rearviewCamera) return;

    const three = this.requireThree();
    const width = Math.max(1, canvas.width);
    const height = Math.max(1, canvas.height);
    const target = this.getRearviewRenderTarget(position, width, height);
    const side = position === 'center' ? 0 : position === 'left' ? -1 : 1;
    const sideOffset = position === 'center' ? 0 : side * 1.45;
    const sideLook = position === 'center' ? 0 : side * 32;
    const eyeBack = position === 'center' ? 1.2 : 0.45;
    const eyeHeight = position === 'center' ? 2.22 : 1.84;
    const lookDistance = position === 'center' ? 115 : 82;

    this.rearviewCamera.fov = position === 'center' ? 52 : 66;
    this.rearviewCamera.aspect = width / height;
    this.rearviewCamera.updateProjectionMatrix();
    this.rearviewCamera.position.set(
      vehicleBox.centerX - forward.x * eyeBack + right.x * sideOffset,
      eyeHeight,
      vehicleBox.centerZ - forward.z * eyeBack + right.z * sideOffset,
    );
    const lookAt = this.rearviewLookAt ?? new three.Vector3();
    this.rearviewLookAt = lookAt;
    lookAt.set(
      vehicleBox.centerX - forward.x * lookDistance + right.x * sideLook,
      1.28,
      vehicleBox.centerZ - forward.z * lookDistance + right.z * sideLook,
    );
    this.rearviewCamera.lookAt(lookAt);

    this.renderer.setRenderTarget(target);
    this.renderer.clear(true, true, true);
    this.renderer.render(this.scene, this.rearviewCamera);
    const pixels = this.getRearviewPixelBuffer(position, width, height);
    this.renderer.readRenderTargetPixels(target, 0, 0, width, height, pixels);
    this.copyRearviewPixelsToCanvas(pixels, canvas);
  }

  private getRearviewUpdateIntervalMs(): number {
    return 1000 / 30;
  }

  private getRearviewCanvasSize(position: 'center' | 'left' | 'right') {
    const isCenter = position === 'center';
    const baseWidth = isCenter ? 320 : 192;
    const baseHeight = isCenter ? 82 : 108;
    const scale = this.rearviewQualityLevel === 'high'
      ? 1
      : this.rearviewQualityLevel === 'medium'
        ? 0.72
        : 0.5;
    return {
      width: Math.max(1, Math.round(baseWidth * scale)),
      height: Math.max(1, Math.round(baseHeight * scale)),
    };
  }

  private getRearviewRenderTarget(position: 'center' | 'left' | 'right', width: number, height: number) {
    const existing = this.rearviewRenderTargets[position];
    if (existing?.width === width && existing?.height === height) return existing;
    existing?.dispose?.();
    const three = this.requireThree();
    const target = new three.WebGLRenderTarget(width, height, { depthBuffer: true, stencilBuffer: false });
    target.texture.colorSpace = three.SRGBColorSpace;
    this.rearviewRenderTargets[position] = target;
    this.rearviewPixelBuffers[position] = new Uint8Array(width * height * 4);
    return target;
  }

  private getRearviewPixelBuffer(position: 'center' | 'left' | 'right', width: number, height: number): Uint8Array {
    const existing = this.rearviewPixelBuffers[position];
    if (existing && existing.length === width * height * 4) return existing;
    const next = new Uint8Array(width * height * 4);
    this.rearviewPixelBuffers[position] = next;
    return next;
  }

  private copyRearviewPixelsToCanvas(pixels: Uint8Array, canvas: HTMLCanvasElement) {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const { width, height } = canvas;
    let imageData = this.rearviewImageData.get(canvas);
    if (!imageData || imageData.width !== width || imageData.height !== height) {
      imageData = ctx.createImageData(width, height);
      this.rearviewImageData.set(canvas, imageData);
    }
    const rowLength = width * 4;
    for (let y = 0; y < height; y += 1) {
      const sourceStart = (height - y - 1) * rowLength;
      const targetStart = y * rowLength;
      imageData.data.set(pixels.subarray(sourceStart, sourceStart + rowLength), targetStart);
    }
    ctx.putImageData(imageData, 0, 0);
  }

  /* ================================================================
   * WORLD BUILDING
   * ================================================================ */
  private buildWorld() {
    const three = this.requireThree();
    if (!this.scene) return;

    this.roadCollisionBoxes = [];
    this.buildingCollisionBoxes = [];

    const roadBaseMat = new three.MeshStandardMaterial({ color: 0x2b3035, roughness: 0.9, metalness: 0.08 });
    const centerLineMat = new three.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.76, metalness: 0.05 });
    const laneDividerMat = new three.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.72, metalness: 0.03 });
    const stopLineMat = new three.MeshStandardMaterial({ color: 0xffffff, roughness: 0.68, metalness: 0.04 });
    const edgeMat = new three.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.7,
      metalness: 0.08,
      emissive: 0xaa1111,
      emissiveIntensity: 0.24,
    });
    const grassMat = new three.MeshStandardMaterial({
      color: 0x4f8d55,
      roughness: 0.86,
      metalness: 0.02,
      dithering: true,
    });

    const routeBounds = this.getRouteBounds();
    const groundSize = Math.max(
      1800,
      routeBounds.maxX - routeBounds.minX + 720,
      routeBounds.maxZ - routeBounds.minZ + 720,
    );
    const ground = new three.Mesh(new three.PlaneGeometry(groundSize, groundSize, 64, 64), grassMat);
    ground.rotation.x = -Math.PI / 2;
    ground.position.set((routeBounds.minX + routeBounds.maxX) / 2, -0.52, (routeBounds.minZ + routeBounds.maxZ) / 2);
    ground.receiveShadow = false;
    this.scene.add(ground);

    let segmentStartDistance = 0;
    for (const segment of this.route) {
      const mid = {
        x: segment.start.x + segment.dir.x * segment.length / 2,
        z: segment.start.z + segment.dir.z * segment.length / 2,
      };
      const heading = this.getHeadingFromDirection(segment.dir);
      const angle = this.getSceneYawFromHeading(heading);
      const normal = this.getRouteRightVector(segment.dir);
      const roadWidth = this.getSegmentRoadWidth(segment);

      const roadBase = new three.Mesh(new three.BoxGeometry(roadWidth + 0.44, 0.08, segment.length), roadBaseMat);
      roadBase.position.set(mid.x, -0.03, mid.z);
      roadBase.rotation.y = angle;
      roadBase.receiveShadow = false;
      this.scene.add(roadBase);

      const road = new three.Mesh(
        new three.BoxGeometry(roadWidth, 0.045, segment.length),
        this.createAsphaltRoadMaterial(segment.length),
      );
      road.position.set(mid.x, 0.015, mid.z);
      road.rotation.y = angle;
      road.receiveShadow = false;
      this.scene.add(road);
      this.roadCollisionBoxes.push({
        centerX: mid.x,
        centerZ: mid.z,
        angle: heading,
        halfWidth: roadWidth / 2,
        halfLength: segment.length / 2,
      });

      this.addRoadEdgeMarkings(segment, segmentStartDistance, angle, normal, edgeMat);
      this.addLaneMarkings(segment, segmentStartDistance, angle, normal, centerLineMat, laneDividerMat);
      segmentStartDistance += segment.length;
    }

    this.addLeftDriveStopLines(stopLineMat);
    this.addTrafficLights();

    for (const inter of this.intersections) {
      const point = this.getRoutePoint(inter.distance);
      const approachWidth = this.getSegmentRoadWidth(this.route[inter.segmentIndex]);
      const nextWidth = this.getSegmentRoadWidth(this.route[inter.segmentIndex + 1] ?? this.route[inter.segmentIndex]);
      const intersectionWidth = Math.max(approachWidth, nextWidth) + 18;
      const cross = new three.Mesh(
        new three.BoxGeometry(approachWidth + 18, 0.04, intersectionWidth),
        this.createAsphaltRoadMaterial(intersectionWidth),
      );
      cross.position.set(point.x, 0.025, point.z);
      const crossHeading = this.getHeadingFromDirection(point.normal);
      const crossAngle = this.getSceneYawFromHeading(crossHeading);
      cross.rotation.y = crossAngle;
      cross.receiveShadow = false;
      this.scene.add(cross);
      this.roadCollisionBoxes.push({
        centerX: point.x,
        centerZ: point.z,
        angle: crossHeading,
        halfWidth: (approachWidth + 18) / 2,
        halfLength: intersectionWidth / 2,
      });
    }
    this.addBuildings();
    this.addTaiwanStreetDetails();
    this.addTurnSignage();
    this.addDestinationMarker();
  }

  private addLeftDriveStopLines(material: any) {
    const three = this.requireThree();
    if (!this.scene) return;

    for (const inter of this.intersections) {
      const segment = this.route[inter.segmentIndex];
      if (!segment) continue;

      const localDistance = Math.max(1, segment.length - this.stopLineSetback);
      const normal = this.getRouteRightVector(segment.dir);
      const angle = this.getSceneYawForDirection(segment.dir);
      const roadWidth = this.getSegmentRoadWidth(segment);
      const laneOffset = this.getDrivingLaneOffset(inter.distance - this.stopLineSetback);
      const laneWidth = Math.max(3.0, roadWidth / 2 - 1.6);
      const stopLine = new three.Mesh(new three.BoxGeometry(laneWidth, 0.052, 0.72), material);
      stopLine.position.set(
        segment.start.x + segment.dir.x * localDistance + normal.x * laneOffset,
        0.085,
        segment.start.z + segment.dir.z * localDistance + normal.z * laneOffset,
      );
      stopLine.rotation.y = angle;
      this.scene.add(stopLine);
    }
  }

  private addTrafficLights() {
    const three = this.requireThree();
    if (!this.scene) return;

    const postMat = new three.MeshStandardMaterial({ color: 0x29323a, roughness: 0.58, metalness: 0.35 });
    const housingMat = new three.MeshStandardMaterial({ color: 0x111827, roughness: 0.62, metalness: 0.18 });
    const pedestrianMat = new three.MeshStandardMaterial({ color: 0x0b1720, roughness: 0.62, metalness: 0.14 });
    const walkMat = new three.MeshBasicMaterial({ color: 0x21e66f });

    for (const inter of this.intersections) {
      const segment = this.route[inter.segmentIndex];
      if (!segment) continue;

      const normal = this.getRouteRightVector(segment.dir);
      const angle = this.getSceneYawForDirection(segment.dir);
      const localDistance = Math.max(2, segment.length - this.stopLineSetback - 2.4);
      const roadWidth = this.getSegmentRoadWidth(segment);
      const baseX = segment.start.x + segment.dir.x * localDistance + normal.x * (roadWidth / 2 + 1.2);
      const baseZ = segment.start.z + segment.dir.z * localDistance + normal.z * (roadWidth / 2 + 1.2);

      const group = new three.Group();
      const post = new three.Mesh(new three.CylinderGeometry(0.12, 0.16, 4.4, 10), postMat);
      post.position.y = 2.2;
      const housing = new three.Mesh(new three.BoxGeometry(0.78, 2.25, 0.36), housingMat);
      housing.position.set(0, 4.35, 0);
      const red = new three.Mesh(new three.SphereGeometry(0.28, 16, 10), new three.MeshBasicMaterial({ color: 0x451414 }));
      const yellow = new three.Mesh(new three.SphereGeometry(0.28, 16, 10), new three.MeshBasicMaterial({ color: 0x4a3a16 }));
      const green = new three.Mesh(new three.SphereGeometry(0.28, 16, 10), new three.MeshBasicMaterial({ color: 0x123d24 }));
      red.position.set(0, 4.9, 0.2);
      yellow.position.set(0, 4.35, 0.2);
      green.position.set(0, 3.8, 0.2);
      const pedestrianBox = new three.Mesh(new three.BoxGeometry(0.68, 0.58, 0.18), pedestrianMat);
      pedestrianBox.position.set(0, 2.62, 0.18);
      const littleGreenHead = new three.Mesh(new three.SphereGeometry(0.07, 10, 8), walkMat);
      littleGreenHead.position.set(0, 2.72, 0.29);
      const littleGreenBody = new three.Mesh(new three.BoxGeometry(0.08, 0.16, 0.03), walkMat);
      littleGreenBody.position.set(0, 2.56, 0.29);
      const littleGreenLeg = new three.Mesh(new three.BoxGeometry(0.2, 0.04, 0.03), walkMat);
      littleGreenLeg.position.set(0.02, 2.43, 0.29);
      littleGreenLeg.rotation.z = -0.35;
      group.add(post, housing, red, yellow, green, pedestrianBox, littleGreenHead, littleGreenBody, littleGreenLeg);
      group.position.set(baseX, 0, baseZ);
      group.rotation.y = angle;
      group.traverse?.((child: any) => {
        child.castShadow = false;
        child.receiveShadow = false;
      });
      this.scene.add(group);
      inter.trafficLightGroup = group;
      inter.trafficLightLamps = { red, yellow, green };
    }
  }

  private addTaiwanStreetDetails() {
    const three = this.requireThree();
    if (!this.scene) return;

    const scooterBoxMat = new three.MeshStandardMaterial({ color: 0x0f8b57, roughness: 0.72, metalness: 0.04 });
    const laneMarkMat = new three.MeshStandardMaterial({ color: 0xffffff, roughness: 0.62, metalness: 0.02 });
    const poleMat = new three.MeshStandardMaterial({ color: 0x27272a, roughness: 0.74, metalness: 0.08 });
    const yellowMat = new three.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.65, metalness: 0.04 });
    const utilityMat = new three.MeshStandardMaterial({ color: 0x9aa3a9, roughness: 0.76, metalness: 0.12 });
    const arcadeMat = new three.MeshStandardMaterial({ color: 0xd9d4c8, roughness: 0.82, metalness: 0.02 });
    const columnMat = new three.MeshStandardMaterial({ color: 0xb9b3a7, roughness: 0.86, metalness: 0.02 });

    for (const inter of this.intersections) {
      const segment = this.route[inter.segmentIndex];
      if (!segment) continue;
      const normal = this.getRouteRightVector(segment.dir);
      const angle = this.getSceneYawForDirection(segment.dir);
      const boxDistance = Math.max(2, segment.length - this.stopLineSetback - 6.2);
      const roadWidth = this.getSegmentRoadWidth(segment);
      const laneOffset = this.getDrivingLaneOffset(inter.distance - this.stopLineSetback);
      const center = {
        x: segment.start.x + segment.dir.x * boxDistance + normal.x * laneOffset,
        z: segment.start.z + segment.dir.z * boxDistance + normal.z * laneOffset,
      };

      const waitingBox = new three.Mesh(new three.BoxGeometry(Math.max(3.4, roadWidth / 2 - 1.4), 0.036, 4.8), scooterBoxMat);
      waitingBox.position.set(center.x, 0.105, center.z);
      waitingBox.rotation.y = angle;
      this.scene.add(waitingBox);

      for (const side of [-1, 1]) {
        const line = new three.Mesh(new three.BoxGeometry(0.14, 0.048, 4.8), laneMarkMat);
        line.position.set(
          center.x + normal.x * side * (roadWidth / 4 - 0.35),
          0.13,
          center.z + normal.z * side * (roadWidth / 4 - 0.35),
        );
        line.rotation.y = angle;
        this.scene.add(line);
      }
    }

    const streetDetailStep = this.renderQuality.level === 'low' ? 44 : 22;
    const arcadeStep = this.renderQuality.level === 'low' ? 72 : this.renderQuality.level === 'medium' ? 48 : 36;
    const utilityBoxInstances: BoxInstanceSpec[] = [];
    const parkingBayInstances: BoxInstanceSpec[] = [];

    for (let d = 18; d < this.routeLength - 12; d += streetDetailStep) {
      if (this.isNearIntersection(d, 14)) continue;
      const point = this.getRoutePoint(d);
      const angle = this.getSceneYawForDirection(point.dir);
      const roadWidth = point.roadWidth;

      for (const side of [-1, 1]) {
        if ((Math.floor(d / 22) + side) % 2 === 0) {
          const pole = new three.Group();
          const shaft = new three.Mesh(new three.CylinderGeometry(0.13, 0.16, 5.2, 10), poleMat);
          shaft.position.y = 2.6;
          pole.add(shaft);
          for (let band = 0; band < 4; band += 1) {
            const stripe = new three.Mesh(new three.BoxGeometry(0.34, 0.18, 0.04), yellowMat);
            stripe.position.set(0, 0.75 + band * 0.32, -0.16);
            stripe.rotation.z = band % 2 ? -0.25 : 0.25;
            pole.add(stripe);
          }
          const arm = new three.Mesh(new three.BoxGeometry(2.4, 0.08, 0.08), poleMat);
          arm.position.set(side * 0.95, 4.85, 0);
          pole.add(arm);
          pole.position.set(
            point.x + point.normal.x * side * (roadWidth / 2 + 2.0),
            0,
            point.z + point.normal.z * side * (roadWidth / 2 + 2.0),
          );
          pole.rotation.y = angle;
          this.scene.add(pole);
        }

        if ((Math.floor(d / 22) + side) % 3 === 0) {
          utilityBoxInstances.push({
            x: point.x + point.normal.x * side * (roadWidth / 2 + 1.4),
            y: 0.9,
            z: point.z + point.normal.z * side * (roadWidth / 2 + 1.4),
            yaw: angle,
          });
        }

        if ((Math.floor(d / 22) + side) % 2 !== 0) {
          const bayCenter = {
            x: point.x + point.normal.x * side * (roadWidth / 2 + 0.65),
            z: point.z + point.normal.z * side * (roadWidth / 2 + 0.65),
          };
          parkingBayInstances.push({
            x: bayCenter.x,
            y: 0.11,
            z: bayCenter.z,
            yaw: angle,
          });
          if (this.renderQuality.level !== 'low' && d % 44 === 18) {
            const scooter = this.createScooterMesh(0x2563eb);
            scooter.position.set(bayCenter.x, 0.12, bayCenter.z);
            scooter.rotation.y = angle + Math.PI * 0.5 * side;
            scooter.scale.setScalar(0.86);
            this.scene.add(scooter);
          }
        }
      }
    }

    this.addBoxInstances(1.2, 1.8, 0.72, utilityMat, utilityBoxInstances);
    this.addBoxInstances(2.0, 0.035, 4.0, laneMarkMat, parkingBayInstances);

    for (let d = 28; d < this.routeLength - 25; d += arcadeStep) {
      if (this.isNearIntersection(d, 18)) continue;
      const point = this.getRoutePoint(d);
      const angle = this.getSceneYawForDirection(point.dir);
      const roadWidth = point.roadWidth;
      for (const side of [-1, 1]) {
        const arcade = new three.Group();
        const canopy = new three.Mesh(new three.BoxGeometry(12, 0.28, 3.2), arcadeMat);
        canopy.position.y = 3.05;
        arcade.add(canopy);
        for (const x of [-4.8, -2.4, 0, 2.4, 4.8]) {
          const column = new three.Mesh(new three.BoxGeometry(0.22, 3.0, 0.22), columnMat);
          column.position.set(x, 1.5, 1.18);
          arcade.add(column);
        }
        arcade.position.set(
          point.x + point.normal.x * side * (roadWidth / 2 + 5.2),
          0,
          point.z + point.normal.z * side * (roadWidth / 2 + 5.2),
        );
        arcade.rotation.y = angle + (side > 0 ? 0 : Math.PI);
        arcade.traverse?.((child: any) => {
          child.castShadow = false;
          child.receiveShadow = false;
        });
        this.scene.add(arcade);
      }
    }
  }

  private addRoadEdgeMarkings(
    segment: RouteSegment,
    segmentStartDistance: number,
    angle: number,
    normal: Vec2,
    material: any,
  ) {
    if (!this.scene) return;

    const edgeLength = 10;
    const roadWidth = this.getSegmentRoadWidth(segment);
    const instances: BoxInstanceSpec[] = [];
    for (let d = edgeLength / 2; d < segment.length; d += edgeLength + 1.5) {
      if (this.isNearIntersection(segmentStartDistance + d, this.roadMarkingIntersectionClearance)) continue;
      const center = {
        x: segment.start.x + segment.dir.x * d,
        z: segment.start.z + segment.dir.z * d,
      };
      for (const side of [-1, 1]) {
        instances.push({
          x: center.x + normal.x * side * (roadWidth / 2 - 0.1),
          y: 0.06,
          z: center.z + normal.z * side * (roadWidth / 2 - 0.1),
          yaw: angle,
        });
      }
    }
    this.addBoxInstances(0.18, 0.055, edgeLength, material, instances);
  }

  private addLaneMarkings(
    segment: RouteSegment,
    segmentStartDistance: number,
    angle: number,
    normal: Vec2,
    centerLineMat: any,
    laneDividerMat: any,
  ) {
    if (!this.scene) return;

    const laneCount = this.getSegmentLaneCount(segment);
    if (laneCount <= 1) return;

    const laneWidth = this.getSegmentLaneWidth(segment);
    const dividerOffsets = this.getLaneDividerOffsets(segment);
    const centerDashInstances: BoxInstanceSpec[] = [];
    const centerSolidInstances: BoxInstanceSpec[] = [];
    const laneDashInstances: BoxInstanceSpec[] = [];

    const addStripeInstance = (instances: BoxInstanceSpec[], distance: number, offset: number, y = 0.062) => {
      const center = {
        x: segment.start.x + segment.dir.x * distance,
        z: segment.start.z + segment.dir.z * distance,
      };
      instances.push({
        x: center.x + normal.x * offset,
        y,
        z: center.z + normal.z * offset,
        yaw: angle,
      });
    };

    const createDoubleStripe = (
      distance: number,
      offset: number,
      gap: number,
      instances: BoxInstanceSpec[],
    ) => {
      addStripeInstance(instances, distance, offset - gap);
      addStripeInstance(instances, distance, offset + gap);
    };

    const solidStep = 6.5;
    for (let d = 5; d < segment.length - 3; d += solidStep) {
      if (this.isNearIntersection(segmentStartDistance + d, this.roadMarkingIntersectionClearance)) continue;

      for (const offset of dividerOffsets) {
        const isCenterDivider = !segment.oneWay && Math.abs(offset) < laneWidth * 0.35;

        if (isCenterDivider) {
          if (laneCount <= 2) {
            if (Math.floor(d / 13) % 2 === 0) {
              addStripeInstance(centerDashInstances, d, offset);
            }
            continue;
          }
          createDoubleStripe(d, offset, 0.18, centerSolidInstances);
          continue;
        }

        if (Math.floor(d / 13) % 2 === 0) {
          addStripeInstance(laneDashInstances, d, offset, 0.06);
        }
      }
    }

    this.addBoxInstances(0.14, 0.054, 5.8, centerLineMat, centerDashInstances);
    this.addBoxInstances(0.13, 0.054, solidStep + 0.25, centerLineMat, centerSolidInstances);
    this.addBoxInstances(0.12, 0.054, 5.6, laneDividerMat, laneDashInstances);
  }

  private addBoxInstances(width: number, height: number, length: number, material: any, instances: BoxInstanceSpec[]) {
    if (!this.scene || instances.length === 0) return;
    const three = this.requireThree();
    const geometry = new three.BoxGeometry(width, height, length);
    const mesh = new three.InstancedMesh(geometry, material, instances.length);
    const transform = new three.Object3D();

    instances.forEach((instance, index) => {
      transform.position.set(instance.x, instance.y, instance.z);
      transform.rotation.set(0, instance.yaw, 0);
      transform.updateMatrix();
      mesh.setMatrixAt(index, transform.matrix);
    });

    mesh.instanceMatrix.needsUpdate = true;
    mesh.castShadow = false;
    mesh.receiveShadow = false;
    this.scene.add(mesh);
  }

  private createAsphaltRoadMaterial(length: number) {
    const three = this.requireThree();
    const repeatBucket = Math.max(1, Math.round(length / 20));
    const cached = this.asphaltMaterials.get(repeatBucket);
    if (cached) return cached;

    const map = this.createLowResolutionRoadTexture(repeatBucket);
    const material = new three.MeshStandardMaterial({
      map,
      color: 0x686868,
      roughness: 0.92,
      metalness: 0.02,
    });
    this.asphaltMaterials.set(repeatBucket, material);
    return material;
  }

  private createLowResolutionRoadTexture(repeatY: number) {
    const three = this.requireThree();
    if (this.asphaltTexture) {
      const texture = this.asphaltTexture.clone();
      texture.repeat.set(1.15, repeatY);
      texture.needsUpdate = true;
      return texture;
    }

    const canvas = document.createElement('canvas');
    canvas.width = this.renderQuality.roadTextureSize;
    canvas.height = this.renderQuality.roadTextureSize;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.fillStyle = '#5b5e5f';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      for (let i = 0; i < this.renderQuality.roadNoiseSamples; i += 1) {
        const shade = 58 + Math.floor(Math.random() * 52);
        ctx.fillStyle = `rgba(${shade}, ${shade}, ${shade}, ${0.08 + Math.random() * 0.12})`;
        const x = Math.random() * canvas.width;
        const y = Math.random() * canvas.height;
        ctx.fillRect(x, y, 1 + Math.random() * 2, 1 + Math.random() * 2);
      }
      ctx.strokeStyle = 'rgba(255,255,255,0.035)';
      ctx.lineWidth = 1;
      for (let y = 0; y < canvas.height; y += 42) {
        ctx.beginPath();
        ctx.moveTo(0, y + Math.random() * 8);
        ctx.lineTo(canvas.width, y + Math.random() * 8);
        ctx.stroke();
      }
    }

    const texture = new three.CanvasTexture(canvas);
    texture.wrapS = three.RepeatWrapping;
    texture.wrapT = three.RepeatWrapping;
    texture.repeat.set(1.15, repeatY);
    texture.colorSpace = three.SRGBColorSpace;
    texture.needsUpdate = true;
    this.asphaltTexture = texture;
    return texture;
  }

  private addBuildings() {
    if (!this.scene) return;
    const colors = [0xb9c7d3, 0xd6c2a6, 0xa9bfac, 0xcaa4a4, 0xa9a7c8, 0xc7d2c6];
    const accents = [0x0f766e, 0x1d4ed8, 0xdc2626, 0x9333ea, 0xf59e0b];
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

        const color = colors[Math.floor((d + side * 7) % colors.length)];
        const accent = accents[Math.floor((d * 3 + side * 11) % accents.length)];
        const building = this.createUrbanBuilding(width, height, depth, color, accent, d + side * 19);
        building.position.set(centerX, 0, centerZ);
        building.rotation.y = angle;
        this.scene.add(building);
        this.buildingCollisionBoxes.push(collisionBox);
      }
    }
  }

  private createUrbanBuilding(width: number, height: number, depth: number, color: number, accent: number, seed: number) {
    const three = this.requireThree();
    const group = new three.Group();
    const bodyMat = new three.MeshStandardMaterial({ color, roughness: 0.82, metalness: 0.03 });
    const roofMat = new three.MeshStandardMaterial({ color: 0x4b5563, roughness: 0.78, metalness: 0.08 });
    const windowMat = new three.MeshBasicMaterial({ color: 0xc7e7ff, transparent: true, opacity: 0.62 });
    const signMat = new three.MeshBasicMaterial({ color: accent });
    const awningMat = new three.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.7, metalness: 0.02 });

    const body = new three.Mesh(new three.BoxGeometry(width, height, depth), bodyMat);
    body.position.y = height / 2;
    group.add(body);

    const roof = new three.Mesh(new three.BoxGeometry(width + 0.35, 0.32, depth + 0.35), roofMat);
    roof.position.y = height + 0.16;
    group.add(roof);

    if (this.renderQuality.level !== 'low') {
      const frontZ = depth / 2 + 0.035;
      const rowCount = this.clamp(Math.floor((height - 3) / 2.2), 2, 8);
      const columnCount = this.clamp(Math.floor(width / 1.55), 3, 7);
      const startX = -((columnCount - 1) * 1.18) / 2;
      for (let row = 0; row < rowCount; row += 1) {
        for (let column = 0; column < columnCount; column += 1) {
          if ((row + column + Math.floor(seed)) % 5 === 0) continue;
          const window = new three.Mesh(new three.BoxGeometry(0.62, 0.72, 0.045), windowMat);
          window.position.set(startX + column * 1.18, 3.25 + row * 2.0, frontZ);
          group.add(window);
        }
      }

      const storefront = new three.Mesh(new three.BoxGeometry(width * 0.72, 0.62, 0.055), signMat);
      storefront.position.set(0, 2.25, frontZ + 0.02);
      group.add(storefront);

      const awning = new three.Mesh(new three.BoxGeometry(width * 0.82, 0.18, 1.05), awningMat);
      awning.position.set(0, 2.95, frontZ + 0.42);
      group.add(awning);

      if (height > 13) {
        const balconyMat = new three.MeshBasicMaterial({ color: 0x263238 });
        for (let floor = 0; floor < Math.min(4, rowCount - 1); floor += 1) {
          const rail = new three.Mesh(new three.BoxGeometry(width * 0.62, 0.08, 0.12), balconyMat);
          rail.position.set(0, 4.05 + floor * 2.0, frontZ + 0.22);
          group.add(rail);
        }
      }
    }

    group.traverse?.((child: any) => {
      child.castShadow = false;
      child.receiveShadow = false;
    });
    return group;
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

  /** Add physical road signs at intersections */
  private addTurnSignage() {
    const three = this.requireThree();
    if (!this.scene) return;

    for (const inter of this.intersections) {
      if (!inter.turnDir) continue;

      const signDist = Math.max(5, inter.distance - 20);
      const point = this.getRoutePoint(signDist);
      const group = new three.Group();

      // Post
      const postMat = new three.MeshBasicMaterial({ color: 0x888888 });
      const post = new three.Mesh(new three.BoxGeometry(0.2, 4, 0.2), postMat);
      post.position.y = 2;
      group.add(post);

      // Sign board
      const signMat = new three.MeshBasicMaterial({ color: 0x2563eb });
      const sign = new three.Mesh(new three.BoxGeometry(2.8, 1.8, 0.12), signMat);
      sign.position.y = 4.2;
      group.add(sign);

      // Arrow on sign
      const arrowLabel = this.getNavigationArrow(inter.turnDir);
      const texture = this.createSignTexture(arrowLabel);
      const arrowMat = new three.MeshBasicMaterial({ map: texture, transparent: true, depthWrite: false });
      const arrowPlane = new three.Mesh(new three.PlaneGeometry(2.2, 1.4), arrowMat);
      arrowPlane.position.set(0, 4.2, 0.07);
      group.add(arrowPlane);

      // Place on the right side of the road for left-hand-drive traffic.
      group.position.set(
        point.x + point.normal.x * (point.roadWidth / 2 + 1),
        0,
        point.z + point.normal.z * (point.roadWidth / 2 + 1),
      );
      group.rotation.y = this.getSceneYawForDirection(point.dir);
      this.scene.add(group);
    }
  }

  private createSignTexture(label: string) {
    const cached = this.signTextureCache.get(label);
    if (cached) return cached;

    const three = this.requireThree();
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.clearRect(0, 0, 256, 128);
      ctx.fillStyle = '#ffffff';
      ctx.font = `bold 92px ${typography.fontFamily}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(label, 128, 64);
    }
    const texture = new three.CanvasTexture(canvas);
    texture.needsUpdate = true;
    this.signTextureCache.set(label, texture);
    return texture;
  }

  private addDestinationMarker() {
    const three = this.requireThree();
    if (!this.scene) return;
    const point = this.getRoutePoint(this.routeLength - 5);
    const group = new three.Group();
    const postMat = new three.MeshBasicMaterial({ color: 0xffffff });
    const flagMat = new three.MeshBasicMaterial({ color: 0x38bdf8 });
    const post = new three.Mesh(new three.BoxGeometry(0.35, 5, 0.35), postMat);
    post.position.y = 2.5;
    const flag = new three.Mesh(new three.BoxGeometry(4, 2.2, 0.18), flagMat);
    flag.position.set(2, 4.2, 0);
    group.add(post, flag);
    group.position.set(point.x + point.normal.x * (point.roadWidth / 2 + 4), 0, point.z + point.normal.z * (point.roadWidth / 2 + 4));
    this.scene.add(group);
  }

  private async loadTaipeiOsmCity() {
    if (!this.renderQuality.useOsmCity) return;
    if (!this.scene || typeof fetch === 'undefined') return;

    try {
      const response = await fetch(this.taipeiOsmUrl);
      if (!response.ok) return;
      const payload = await response.json();
      if (!payload || !Array.isArray(payload.elements)) return;
      this.addTaipeiOsmCity(payload.elements);
    } catch (error) {
      console.warn('Unable to load Taipei OSM city data.', error);
    }
  }

  private addTaipeiOsmCity(elements: any[]) {
    const three = this.requireThree();
    if (!this.scene) return;

    const nodeMap = new Map<number, { lat: number; lon: number }>();
    for (const element of elements) {
      if (element?.type === 'node' && Number.isFinite(element.lat) && Number.isFinite(element.lon)) {
        nodeMap.set(element.id, { lat: element.lat, lon: element.lon });
      }
    }

    const group = new three.Group();
    group.name = 'taipei-xinyi-osm-city';
    const roadMat = new three.MeshStandardMaterial({ color: 0x4b5563, roughness: 0.88, metalness: 0.03 });
    const buildingMats = [
      new three.MeshStandardMaterial({ color: 0xbec7cf, roughness: 0.82, metalness: 0.02 }),
      new three.MeshStandardMaterial({ color: 0xc8beb1, roughness: 0.84, metalness: 0.02 }),
      new three.MeshStandardMaterial({ color: 0xaeb8bd, roughness: 0.8, metalness: 0.03 }),
      new three.MeshStandardMaterial({ color: 0xd3d0c8, roughness: 0.86, metalness: 0.01 }),
    ];
    const arcadeShadowMat = new three.MeshStandardMaterial({ color: 0x30343a, roughness: 0.88, metalness: 0.02 });
    let buildingCount = 0;
    let roadSegmentCount = 0;
    const roadLimit = this.renderQuality.osmRoadSegmentLimit;
    const buildingLimit = this.renderQuality.osmBuildingLimit;
    const routeBounds = this.getRouteBounds();
    const routePadding = 180;
    const isInRouteWindow = (point: Vec2) => (
      point.x >= routeBounds.minX - routePadding
      && point.x <= routeBounds.maxX + routePadding
      && point.z >= routeBounds.minZ - routePadding
      && point.z <= routeBounds.maxZ + routePadding
    );

    for (const element of elements) {
      if (element?.type !== 'way' || !Array.isArray(element.nodes) || !element.tags) continue;
      const points = element.nodes
        .map((id: number) => nodeMap.get(id))
        .filter(Boolean)
        .map((node: { lat: number; lon: number }) => this.projectTaipeiLonLat(node.lon, node.lat));
      if (points.length < 2) continue;

      if (element.tags.highway && roadSegmentCount < roadLimit) {
        const width = this.getOsmRoadWidth(element.tags);
        for (let i = 1; i < points.length; i += 1) {
          const a = points[i - 1];
          const b = points[i];
          if (!isInRouteWindow(a) && !isInRouteWindow(b)) continue;
          const dx = b.x - a.x;
          const dz = b.z - a.z;
          const length = Math.hypot(dx, dz);
          if (length < 2 || roadSegmentCount >= roadLimit) continue;
          const centerX = (a.x + b.x) / 2;
          const centerZ = (a.z + b.z) / 2;
          if (this.getDistanceToRoute(centerX, centerZ) > 130) continue;
          const road = new three.Mesh(new three.BoxGeometry(width, 0.024, length), roadMat);
          road.position.set(centerX, -0.455, centerZ);
          road.rotation.y = this.getSceneYawForDirection({ x: dx / length, z: dz / length });
          group.add(road);
          roadSegmentCount += 1;
        }
      }

      if (element.tags.building && buildingCount < buildingLimit) {
        const bbox = this.getPointBounds(points);
        const width = bbox.maxX - bbox.minX;
        const depth = bbox.maxZ - bbox.minZ;
        if (width < 1.4 || depth < 1.4 || width > 140 || depth > 140) continue;
        const height = this.getOsmBuildingHeight(element.tags, buildingCount);
        const mat = buildingMats[buildingCount % buildingMats.length];
        const collisionBox: CollisionBox2D = {
          centerX: (bbox.minX + bbox.maxX) / 2,
          centerZ: (bbox.minZ + bbox.maxZ) / 2,
          angle: 0,
          halfWidth: width / 2,
          halfLength: depth / 2,
        };
        if (!this.isBuildingFootprintClear(this.expandCollisionBox(collisionBox, 2.2))) continue;
        if (!this.isBoxNearRoute(collisionBox, 95)) continue;
        const building = new three.Mesh(new three.BoxGeometry(width, height, depth), mat);
        building.position.set(collisionBox.centerX, height / 2 - 0.45, collisionBox.centerZ);
        group.add(building);
        this.buildingCollisionBoxes.push(collisionBox);

        if (height > 7 && Math.min(width, depth) > 4) {
          const arcade = new three.Mesh(new three.BoxGeometry(width * 0.78, 2.25, 1.1), arcadeShadowMat);
          arcade.position.set(building.position.x, 0.72, bbox.minZ + 0.55);
          group.add(arcade);
        }
        buildingCount += 1;
      }
    }

    this.scene.add(group);
  }

  private projectTaipeiLonLat(lon: number, lat: number): Vec2 {
    return ProjectTaipeiLonLat(lon, lat);
  }

  private getPointBounds(points: Vec2[]) {
    return points.reduce(
      (bounds, point) => ({
        minX: Math.min(bounds.minX, point.x),
        maxX: Math.max(bounds.maxX, point.x),
        minZ: Math.min(bounds.minZ, point.z),
        maxZ: Math.max(bounds.maxZ, point.z),
      }),
      { minX: Infinity, maxX: -Infinity, minZ: Infinity, maxZ: -Infinity },
    );
  }

  private getOsmRoadWidth(tags: Record<string, string>): number {
    const explicitWidth = Number.parseFloat(String(tags.width ?? '').replace(/[^\d.]/g, ''));
    if (Number.isFinite(explicitWidth) && explicitWidth > 1) return this.clamp(explicitWidth, 2.4, 48);

    const forwardLanes = Number.parseFloat(String(tags['lanes:forward'] ?? ''));
    const backwardLanes = Number.parseFloat(String(tags['lanes:backward'] ?? ''));
    const lanes = Number.parseFloat(String(tags.lanes ?? ''));
    const laneCount = Number.isFinite(forwardLanes) && Number.isFinite(backwardLanes)
      ? forwardLanes + backwardLanes
      : Number.isFinite(lanes)
        ? lanes
        : 0;
    if (laneCount > 0) return this.clamp(laneCount * this.defaultLaneWidth + 1.2, 3.4, 42);

    const highway = tags.highway;
    if (highway === 'primary' || highway === 'secondary') return 8.4;
    if (highway === 'tertiary' || highway === 'residential') return 5.8;
    if (highway === 'service') return 3.4;
    if (highway === 'footway' || highway === 'path' || highway === 'steps') return 1.4;
    return 4.6;
  }

  private getOsmBuildingHeight(tags: Record<string, string>, index: number): number {
    const explicitHeight = Number.parseFloat(String(tags.height ?? '').replace(/[^\d.]/g, ''));
    if (Number.isFinite(explicitHeight) && explicitHeight > 2) return this.clamp(explicitHeight, 3.4, 520);
    const levels = Number.parseFloat(String(tags['building:levels'] ?? ''));
    if (Number.isFinite(levels) && levels > 0) return this.clamp(levels * 3.25, 3.4, 360);
    return 8 + (index % 7) * 4.2;
  }

  private createVehicleVisual() {
    const three = this.requireThree();
    if (!this.scene) return;

    const root = new three.Group();
    root.name = 'driving-reference-vehicle-root';
    this.vehicleRoot = root;
    this.scene.add(root);

    const fallback = this.createFallbackVehicle();
    this.fallbackVehicle = fallback.group;
    this.wheelBindings = fallback.wheels;
    root.add(fallback.group);
    this.vehicleBlobShadow = this.createBlobShadowMesh(2.75, 5.35, 0.42);
    this.scene.add(this.vehicleBlobShadow);
    this.updateVehicleVisual(0);
  }

  private createBlobShadowMesh(width: number, length: number, opacity: number) {
    const three = this.requireThree();
    const material = new three.MeshBasicMaterial({
      map: this.getBlobShadowTexture(),
      transparent: true,
      opacity,
      depthWrite: false,
    });
    const shadow = new three.Mesh(new three.PlaneGeometry(width, length), material);
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.y = 0.118;
    shadow.renderOrder = 1;
    return shadow;
  }

  private getBlobShadowTexture() {
    if (this.blobShadowTexture) return this.blobShadowTexture;

    const three = this.requireThree();
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      const gradient = ctx.createRadialGradient(128, 64, 8, 128, 64, 68);
      gradient.addColorStop(0, 'rgba(0,0,0,0.55)');
      gradient.addColorStop(0.58, 'rgba(0,0,0,0.22)');
      gradient.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
    this.blobShadowTexture = new three.CanvasTexture(canvas);
    this.blobShadowTexture.needsUpdate = true;
    return this.blobShadowTexture;
  }

  private createFallbackVehicle(bodyColor = 0x1d4ed8): { group: any; wheels: VehicleWheelBinding[] } {
    const three = this.requireThree();
    const group = new three.Group();
    group.name = 'driving-reference-fallback-car';

    const bodyMat = new three.MeshStandardMaterial({ color: bodyColor, roughness: 0.42, metalness: 0.26 });
    const glassMat = new three.MeshStandardMaterial({ color: 0x172554, roughness: 0.18, metalness: 0.12 });
    const tireMat = new three.MeshStandardMaterial({ color: 0x111111, roughness: 0.72, metalness: 0.12 });
    const rimMat = new three.MeshStandardMaterial({ color: 0xb9c2cc, roughness: 0.42, metalness: 0.55 });

    const body = new three.Mesh(new three.BoxGeometry(1.95, 0.88, 4.5), bodyMat);
    body.position.y = 0.82;
    body.castShadow = false;
    body.receiveShadow = false;
    const cabin = new three.Mesh(new three.BoxGeometry(1.38, 0.82, 1.7), glassMat);
    cabin.position.set(0, 1.44, -0.28);
    cabin.castShadow = false;
    group.add(body, cabin);

    const wheels: VehicleWheelBinding[] = [];
    for (const [x, z, front] of [
      [-0.98, -1.46, true],
      [0.98, -1.46, true],
      [-0.98, 1.38, false],
      [0.98, 1.38, false],
    ] as const) {
      const wheel = new three.Group();
      const tire = new three.Mesh(new three.TorusGeometry(0.38, 0.12, 8, 18), tireMat);
      tire.rotation.y = Math.PI / 2;
      const rim = new three.Mesh(new three.CylinderGeometry(0.22, 0.22, 0.15, 16), rimMat);
      rim.rotation.z = Math.PI / 2;
      wheel.add(tire, rim);
      wheel.position.set(x, 0.42, z);
      wheel.castShadow = false;
      group.add(wheel);
      wheels.push({
        node: wheel,
        initialY: wheel.position.y,
        baseRotationX: wheel.rotation.x,
        baseRotationY: wheel.rotation.y,
        baseRotationZ: wheel.rotation.z,
        front,
      });
    }

    return { group, wheels };
  }

  private loadReferenceVehicleModel(): Promise<boolean> {
    if (!this.renderQuality.useReferenceVehicleModel) return Promise.resolve(false);
    const root = this.vehicleRoot;
    if (!root) return Promise.resolve(false);

    const loader = new GLTFLoader();
    return new Promise((resolve) => {
      const loadCandidate = (candidateIndex: number) => loader.load(
        this.referenceVehicleUrls[candidateIndex],
        (gltf) => {
          if (this.finished || !this.vehicleRoot) {
            this.disposeObject(gltf.scene);
            resolve(false);
            return;
          }

          const three = this.requireThree();
          const model = gltf.scene;
          model.name = 'driving-reference-car-glb';
          model.traverse?.((child: any) => {
            child.castShadow = false;
            child.receiveShadow = false;
            const material = child.material;
            if (material) {
              const materials = Array.isArray(material) ? material : [material];
              for (const item of materials) {
                this.applyVehicleMaterialQuality(item);
              }
            }
          });

          model.updateMatrixWorld(true);
          let box = new three.Box3().setFromObject(model);
          const size = new three.Vector3();
          box.getSize(size);
          const modelLength = Math.max(size.z, size.x, 1);
          const scale = 4.55 / modelLength;
          model.scale.setScalar(scale);
          model.updateMatrixWorld(true);

          box = new three.Box3().setFromObject(model);
          const center = new three.Vector3();
          box.getCenter(center);
          model.position.set(-center.x, -box.min.y, -center.z);
          model.rotation.y = this.referenceVehicleModelYawOffset;

          this.vehicleRoot.remove(this.fallbackVehicle);
          this.vehicleRoot.add(model);
          this.vehicleModel = model;
          this.fallbackVehicle = null;
          this.bindReferenceWheels(model);
          this.updateVehicleVisual(0);
          resolve(true);
        },
        undefined,
        (error) => {
          if (candidateIndex + 1 < this.referenceVehicleUrls.length) {
            console.warn(
              'Unable to load the reference vehicle from the configured CDN. Falling back locally.',
              error,
            );
            loadCandidate(candidateIndex + 1);
            return;
          }
          console.warn('Unable to load reference driving vehicle model.', error);
          resolve(false);
        },
      );
      loadCandidate(0);
    });
  }

  private applyVehicleMaterialQuality(material: any) {
    material.roughness = Math.min(0.78, material.roughness ?? 0.58);
    material.metalness = Math.max(0.08, material.metalness ?? 0.08);

    for (const key of ['map', 'emissiveMap', 'aoMap']) {
      if (material[key]) {
        const previous = material[key];
        const next = this.capTextureResolution(previous, this.renderQuality.vehicleTextureSize);
        material[key] = next;
        if (next !== previous) previous.dispose?.();
      }
    }

    if (this.renderQuality.level === 'high') {
      for (const key of ['normalMap', 'roughnessMap', 'metalnessMap']) {
        if (material[key]) {
          const previous = material[key];
          const next = this.capTextureResolution(previous, this.renderQuality.vehicleTextureSize);
          material[key] = next;
          if (next !== previous) previous.dispose?.();
        }
      }
    } else {
      material.normalMap?.dispose?.();
      material.roughnessMap?.dispose?.();
      material.metalnessMap?.dispose?.();
      material.normalMap = null;
      material.roughnessMap = null;
      material.metalnessMap = null;
    }

    material.needsUpdate = true;
  }

  private capTextureResolution(texture: any, maxSize: number) {
    const image = texture?.image as CanvasImageSource & { width?: number; height?: number } | undefined;
    const sourceWidth = Number(image?.width ?? 0);
    const sourceHeight = Number(image?.height ?? 0);
    const sourceMax = Math.max(sourceWidth, sourceHeight);
    if (!image || sourceMax <= maxSize || sourceWidth <= 0 || sourceHeight <= 0) return texture;

    const three = this.requireThree();
    const scale = maxSize / sourceMax;
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(sourceWidth * scale));
    canvas.height = Math.max(1, Math.round(sourceHeight * scale));
    const ctx = canvas.getContext('2d');
    if (!ctx) return texture;
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);

    const capped = new three.CanvasTexture(canvas);
    capped.wrapS = texture.wrapS;
    capped.wrapT = texture.wrapT;
    capped.flipY = texture.flipY;
    capped.colorSpace = texture.colorSpace ?? three.SRGBColorSpace;
    if (texture.offset && capped.offset) capped.offset.copy(texture.offset);
    if (texture.repeat && capped.repeat) capped.repeat.copy(texture.repeat);
    if (texture.center && capped.center) capped.center.copy(texture.center);
    capped.rotation = texture.rotation ?? 0;
    capped.needsUpdate = true;
    return capped;
  }

  private bindReferenceWheels(model: any) {
    const bindings: VehicleWheelBinding[] = [];
    model.traverse?.((child: any) => {
      const name = String(child.name ?? '').toLowerCase();
      if (!name.includes('wheel')) return;
      const front = name.includes('fl') || name.includes('fr') || name.includes('front');
      bindings.push({
        node: child,
        initialY: child.position.y,
        baseRotationX: child.rotation.x,
        baseRotationY: child.rotation.y,
        baseRotationZ: child.rotation.z,
        front,
      });
    });
    this.wheelBindings = bindings;
  }

  private updateVehicleVisual(dt: number) {
    if (!this.vehicleRoot) return;

    const vehicleBox = this.getVehicleCollisionBox();
    const speedRatio = this.clamp(this.vehicleSpeed / this.maxVehicleSpeed, 0, 1);
    this.wheelSpin += this.vehicleSpeed * dt * 2.7;
    const pitch = this.lastBrakePressed
      ? this.lerp(-0.012, -0.026, speedRatio)
      : this.lerp(0.004, -0.004, speedRatio);
    const roll = this.clamp(-this.steeringInput * 0.022 - this.lastYawRate * 0.018, -0.035, 0.035);

    const sceneYaw = this.getSceneYawFromHeading(this.vehicleHeading);
    this.vehicleRoot.position.set(vehicleBox.centerX, 0.018, vehicleBox.centerZ);
    this.vehicleRoot.rotation.set(
      pitch,
      sceneYaw,
      roll,
    );
    if (this.vehicleBlobShadow) {
      this.vehicleBlobShadow.position.set(vehicleBox.centerX, 0.118, vehicleBox.centerZ);
      this.vehicleBlobShadow.rotation.y = sceneYaw;
    }

    for (const wheel of this.wheelBindings) {
      wheel.node.position.y = wheel.initialY;
      wheel.node.rotation.x = wheel.baseRotationX + this.wheelSpin;
      wheel.node.rotation.y = wheel.baseRotationY - (wheel.front ? this.frontWheelAngle * 0.72 : 0);
      wheel.node.rotation.z = wheel.baseRotationZ;
    }

    if (this.vehicleModel) {
      this.vehicleModel.rotation.x = 0;
    }
  }

  /* ================================================================
   * MAIN LOOP
   * ================================================================ */
  private loop(time: number, trial: TrialType<Info>, displayElement: HTMLElement) {
    if (this.finished || !this.renderer || !this.scene || !this.camera) return;
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
    const simulatedDt = fixedSteps.simulatedMs / 1000;
    this.updateVehicleVisual(simulatedDt);
    this.updateCameraFree();
    if (this.needsFirstFrameCameraSnap) {
      this.needsFirstFrameCameraSnap = false;
      this.snapCameraToVehicle();
    }
    this.updateHud();
    this.updateCockpitHud();
    this.updateMiniMap();
    this.updateRearviewMirrors(time);

    this.viewportController?.prepareMainRender();
    this.renderer.render(this.scene, this.camera);
    this.markHazardsPresented(CalculateEstimatedPresentationTime(
      time,
      performance.now(),
      this.refreshMeasured ? this.displayRefreshMs : Number.NaN,
    ));

    if (this.isTrialTimedOut(this.simulationTime, trial)) {
      soundManager.playRunEnd();
      this.finishTrial(displayElement, 'timeout');
      return;
    }

    if (this.isDestinationReached()) {
      soundManager.playRunEnd();
      this.finishTrial(displayElement, 'completed');
      return;
    }
    this.raf = requestAnimationFrame((nextTime) => this.loop(nextTime, trial, displayElement));
  }

  private renderFirstFrameBeforeReveal(time: number) {
    if (!this.renderer || !this.scene || !this.camera) return;
    this.snapCameraToVehicle();
    this.needsFirstFrameCameraSnap = false;
    this.updateHud();
    this.updateCockpitHud();
    this.updateMiniMap();
    this.updateRearviewMirrors(time);
    this.viewportController?.prepareMainRender();
    this.renderer.render(this.scene, this.camera);
    this.markHazardsPresented(CalculateEstimatedPresentationTime(
      time,
      performance.now(),
      this.refreshMeasured ? this.displayRefreshMs : Number.NaN,
    ));
  }

  private isTrialTimedOut(time: number, trial: TrialType<Info>): boolean {
    const durationSec = Number((trial as any).driving_duration_sec ?? 80);
    const durationMs = Math.max(5_000, durationSec * 1000);
    return this.trialStartTime > 0 && time - this.trialStartTime >= durationMs;
  }

  /* ================================================================
   * FREE-STEERING VEHICLE PHYSICS
   * Vehicle has world position (x, z) and heading angle.
   * Steering changes heading; vehicle moves in heading direction.
   * "progress" and "lateralOffset" are projected from world pos.
   * ================================================================ */
  private updateVehicleFree(input: DrivingInput, dt: number, time: number) {
    const accelerationResponse = 2.65;
    const coastResponse = 1.35;
    const brakeResponse = 9.6;
    const rollingDrag = 0.9;
    const previousX = this.vehicleX;
    const previousZ = this.vehicleZ;
    const previousHeading = this.vehicleHeading;
    const previousProgress = this.progress;

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

    if (this.isVehicleCollidingWithBuilding() || this.isVehicleCollidingWithTraffic()) {
      this.recordCollisionEvent(time);
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
    this.snapCameraToVehicle();
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
      const state = this.getTrafficLightState(elapsedMs + inter.trafficSignalOffsetMs);
      const previousRenderedState = inter.trafficSignalRenderedState;
      inter.trafficSignalState = state;
      if (state !== previousRenderedState) {
        this.updateTrafficLightVisual(inter, state);
        inter.trafficSignalRenderedState = state;
      }
    }
  }

  private getTrafficLightState(elapsedMs: number): TrafficLightState {
    const cycleMs = this.trafficGreenMs + this.trafficYellowMs + this.trafficRedMs;
    const phase = ((elapsedMs % cycleMs) + cycleMs) % cycleMs;
    if (phase < this.trafficGreenMs) return 'green';
    if (phase < this.trafficGreenMs + this.trafficYellowMs) return 'yellow';
    return 'red';
  }

  private updateTrafficLightVisual(inter: IntersectionZone, state: TrafficLightState) {
    const lamps = inter.trafficLightLamps;
    if (!lamps) return;
    lamps.red.material.color.setHex(state === 'red' ? 0xff1f1f : 0x451414);
    lamps.yellow.material.color.setHex(state === 'yellow' ? 0xffd84a : 0x4a3a16);
    lamps.green.material.color.setHex(state === 'green' ? 0x16d463 : 0x123d24);
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
    soundManager.playIncorrect();
    if (this.hud?.event) {
      this.hud.event.textContent = this.text.redLightViolationMessage;
    }
    inter.redLightChecked = true;
  }

  private preloadHazardEvents() {
    if (!this.scene) return;

    const scheduledEvents = this.createHazardSchedule();
    this.activeHazards = scheduledEvents.map(({ template, triggerDistance }) => {
      const hazardDistance = this.getHazardSpawnDistance(template.id, triggerDistance);
      const point = this.getRoutePoint(hazardDistance);
      const group = this.createHazardMesh(template.id);
      group.visible = false;
      group.position.set(point.x, 0, point.z);
      group.rotation.y = this.getSceneYawForDirection(point.dir);
      this.scene?.add(group);

      return {
        active: false,
        template,
        group,
        triggerDistance,
        hazardDistance,
        startTime: 0,
        presentedAt: null,
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
          response: 'pending',
        },
      };
    });
  }

  private createHazardSchedule(): Array<{ template: HazardTemplate; triggerDistance: number }> {
    const scheduledEvents: Array<{ template: HazardTemplate; triggerDistance: number }> = [];
    let hazardPool = [...this.hazardTemplates].sort(() => Math.random() - 0.5);
    let triggerDistance = 30 + Math.random() * 35;
    const { minHazardInterval, maxHazardInterval } = this.difficultyPreset;

    while (triggerDistance < this.routeLength - 40) {
      if (hazardPool.length === 0) {
        hazardPool = [...this.hazardTemplates].sort(() => Math.random() - 0.5);
      }
      const template = hazardPool.pop()!;
      scheduledEvents.push({ template, triggerDistance });
      triggerDistance += minHazardInterval + Math.random() * (maxHazardInterval - minHazardInterval);
    }

    return scheduledEvents;
  }

  private createAmbientTraffic() {
    if (!this.scene) return;

    const palette = [0xeeeeee, 0x2563eb, 0xef4444, 0xf59e0b, 0x22c55e, 0x0f172a];
    for (let i = 0; i < this.renderQuality.ambientTrafficCount; i += 1) {
      const isScooter = i % 3 !== 0;
      const direction: 1 | -1 = i % 3 === 0 ? -1 : 1;
      const distance = (i * 71 + 42) % Math.max(1, this.routeLength - 12);
      const group = isScooter
        ? this.createScooterMesh(palette[i % palette.length])
        : this.createFallbackVehicle(palette[i % palette.length]).group;
      group.scale.setScalar(isScooter ? 1.0 : 1.02);
      const shadow = this.createBlobShadowMesh(isScooter ? 1.25 : 2.75, isScooter ? 2.0 : 5.25, isScooter ? 0.28 : 0.36);
      this.scene.add(group);
      this.scene.add(shadow);
      const actor: AmbientTrafficActor = {
        group,
        shadow,
        distance,
        lateral: this.getTrafficLaneOffset(distance, direction, isScooter, i),
        direction,
        speed: 0,
        targetSpeed: 0,
        cruiseSpeed: isScooter ? 6.8 + (i % 5) * 0.95 : 7.4 + (i % 4) * 1.05,
      };
      this.ambientTrafficActors.push(actor);
      this.positionTrafficActor(actor);
    }
  }

  private updateAmbientTraffic(dt: number) {
    for (const actor of this.ambientTrafficActors) {
      const stopDistance = this.getTrafficActorStopDistance(actor);
      actor.targetSpeed = stopDistance !== null ? 0 : actor.cruiseSpeed;
      actor.speed = this.expSmoothing(actor.speed, actor.targetSpeed, actor.targetSpeed > actor.speed ? 2.2 : 5.8, dt);
      actor.distance += actor.direction * actor.speed * dt;
      if (actor.distance > this.routeLength - 4) actor.distance = 6;
      if (actor.distance < 4) actor.distance = this.routeLength - 6;
      this.positionTrafficActor(actor);
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
    actor.group.position.set(
      point.x + point.normal.x * actor.lateral,
      0.05,
      point.z + point.normal.z * actor.lateral,
    );
    actor.group.rotation.y = this.getSceneYawForDirection({
      x: point.dir.x * actor.direction,
      z: point.dir.z * actor.direction,
    });
    actor.shadow.position.set(actor.group.position.x, 0.116, actor.group.position.z);
    actor.shadow.rotation.y = actor.group.rotation.y;
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
    hazard.group.visible = true;
    hazard.group.position.set(point.x + point.normal.x * initialLateral, 0, point.z + point.normal.z * initialLateral);
    hazard.group.rotation.y = this.getSceneYawForDirection(
      hazard.template.id === 'wrong-way-driver' ? { x: -point.dir.x, z: -point.dir.z } : point.dir,
    );

    this.eventResults.push(hazard.result);
    this.flashRed();
    if (this.hud) this.hud.event.textContent = hazard.result.label;
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
      if (hazard.active && !hazard.resolved && hazard.group.visible && hazard.presentedAt === null) {
        hazard.presentedAt = time;
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
          hazard.group.visible = false;
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
        lateral = this.lerp(hazard.crossingStartLateral, hazard.targetLateral, swerve);
        hazard.group.position.set(
          movingPoint.x + movingPoint.normal.x * lateral,
          0,
          movingPoint.z + movingPoint.normal.z * lateral,
        );
        hazard.currentLateral = lateral;
        hazard.group.rotation.y = this.getSceneYawForDirection({ x: -movingPoint.dir.x, z: -movingPoint.dir.z });
      }

      if (hazard.template.id !== 'wrong-way-driver') {
        hazard.currentLateral = lateral;
        hazard.group.position.set(
          point.x + point.normal.x * lateral,
          baseY,
          point.z + point.normal.z * lateral,
        );
        hazard.group.rotation.y = this.getSceneYawForDirection(point.dir) + (hazard.template.id === 'drunk-driver' ? Math.sin(age / 300) * 0.5 : 0);
      }

      if (hazard.template.id === 'plane-crash') {
        hazard.group.rotation.z = Math.min(1.15, age / 900);
      }

      const distanceToHazard = hazard.currentDistance - this.progress;
      const collisionNow = !hazard.resolved && this.isHazardColliding(hazard);
      const requiresDodge = hazard.template.id === 'wrong-way-driver';
      const safeBrake = !requiresDodge && hazard.brakeTime !== null && this.vehicleSpeed < 2.4 && !collisionNow && distanceToHazard > -1;
      const wrongWayDodged = requiresDodge && !collisionNow && this.hasDodgedWrongWayDriver(hazard);
      const wrongWayOverran = requiresDodge && !collisionNow && !wrongWayDodged && this.hasWrongWayDriverOverrun(hazard);
      const passedHazard = !requiresDodge && !collisionNow && this.hasPassedHazard(hazard);

      if (collisionNow) {
        this.resolveHazard(hazard, time, true, hazard.brakeTime ? 'collision-after-brake' : 'collision-no-brake');
      } else if (wrongWayOverran) {
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
    hazard.result.response = response;
    hazard.result.rt_ms = hazard.rt;
    hazard.result.valid = !hazard.preheldBrake && (hazard.rt !== null || response === 'dodge');
    hazard.removeAt = time + 950;

    if (collision) {
      soundManager.playIncorrect();
      this.vehicleSpeed = Math.min(this.vehicleSpeed, 2.5);
    } else {
      soundManager.playCorrect();
    }

    if (this.hud) {
      const rtText = hazard.rt !== null ? `${hazard.rt} ms` : this.text.noValidRt;
      const outcome = collision
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

  private isVehicleCollidingWithTraffic(): boolean {
    if (this.ambientTrafficActors.length === 0) return false;
    const vehicleBox = this.getVehicleCollisionBox();
    return this.ambientTrafficActors.some((actor) => {
      const isScooter = Math.max(actor.group.scale.x, actor.group.scale.z) <= 0.95;
      const trafficBox: CollisionBox2D = {
        centerX: actor.group.position.x,
        centerZ: actor.group.position.z,
        angle: this.getHeadingFromSceneYaw(actor.group.rotation.y || 0),
        halfWidth: isScooter ? 0.55 : 1.0,
        halfLength: isScooter ? 0.95 : 2.25,
      };
      return this.boxesOverlap(vehicleBox, trafficBox);
    });
  }

  private recordCollisionEvent(time: number) {
    if (time - this.lastCollisionEventTime < 1200) return;
    this.lastCollisionEventTime = time;
    this.recordDrivingRuleEvent('vehicle-collision', 'collision', { collision: true });
    soundManager.playIncorrect();
  }

  private isHazardColliding(hazard: ActiveHazard): boolean {
    if (hazard.template.id === 'plane-crash' && hazard.group.position.y > 1.6) return false;
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
    const footprint = this.getHazardFootprint(hazard.template.id);
    return {
      centerX: hazard.group.position.x,
      centerZ: hazard.group.position.z,
      angle: this.getHeadingFromSceneYaw(hazard.group.rotation.y || 0),
      ...footprint,
    };
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
    const axes = [
      this.getBoxWidthAxis(a.angle),
      this.getForwardVector(a.angle),
      this.getBoxWidthAxis(b.angle),
      this.getForwardVector(b.angle),
    ];

    for (const axis of axes) {
      const centerDelta = Math.abs((a.centerX - b.centerX) * axis.x + (a.centerZ - b.centerZ) * axis.z);
      const radiusA = this.getProjectedRadius(a, axis);
      const radiusB = this.getProjectedRadius(b, axis);
      if (centerDelta > radiusA + radiusB) return false;
    }

    return true;
  }

  private getProjectedRadius(box: CollisionBox2D, axis: Vec2): number {
    const widthAxis = this.getBoxWidthAxis(box.angle);
    const lengthAxis = this.getForwardVector(box.angle);
    return (
      box.halfWidth * Math.abs(widthAxis.x * axis.x + widthAxis.z * axis.z)
      + box.halfLength * Math.abs(lengthAxis.x * axis.x + lengthAxis.z * axis.z)
    );
  }

  private handleBrakePressed(time: number) {
    const hazard = this.activeHazards.find((item) => item.active && !item.resolved && item.brakeTime === null);
    if (!hazard || hazard.preheldBrake || hazard.presentedAt === null) return;
    if (time < hazard.presentedAt) {
      hazard.preheldBrake = true;
      hazard.brakeTime = time;
      hazard.result.brake_preheld = true;
      hazard.result.valid = false;
      hazard.result.response = 'invalid-preheld-brake';
      return;
    }
    const reaction = CalculateFrameAlignedReactionTime(
      hazard.presentedAt,
      time,
      this.refreshMeasured ? this.displayRefreshMs : Number.NaN,
    );
    hazard.brakeTime = time;
    hazard.rt = reaction.rtMs;
    hazard.result.rt_ms = hazard.rt;
    hazard.result.raw_rt_ms = reaction.rawRtMs;
    hazard.result.reaction_frames = reaction.frameCount;
    hazard.result.response = 'brake';
    hazard.result.valid = true;
    if (this.hud) {
      this.hud.event.textContent = this.format(this.text.brakeReaction, {
        label: hazard.result.label,
        rt: hazard.rt,
      });
    }
  }

  /* ================================================================
   * HAZARD MESHES
   * ================================================================ */
  private createHazardMesh(id: HazardId) {
    switch (id) {
      case 'child-crossing':
        return this.createPersonMesh(0xffd166, 0.55, { backpack: true });
      case 'elder-stopped':
        return this.createPersonMesh(0xd9d9d9, 0.68, { cane: true });
      case 'plane-crash':
        return this.createPlaneMesh();
      case 'drunk-driver':
        return this.createCarMesh(0xf97316);
      case 'wrong-way-driver':
        return this.createCarMesh(0xef4444);
      default:
        return this.createCarMesh(0xef4444);
    }
  }

  private createScooterMesh(color: number) {
    const three = this.requireThree();
    const group = new three.Group();
    const bodyMat = new three.MeshStandardMaterial({ color, roughness: 0.45, metalness: 0.18 });
    const darkMat = new three.MeshStandardMaterial({ color: 0x111111, roughness: 0.7, metalness: 0.08 });
    const metalMat = new three.MeshStandardMaterial({ color: 0xd1d5db, roughness: 0.36, metalness: 0.48 });

    const body = new three.Mesh(new three.BoxGeometry(0.7, 0.36, 1.55), bodyMat);
    body.position.y = 0.58;
    const seat = new three.Mesh(new three.BoxGeometry(0.48, 0.14, 0.72), darkMat);
    seat.position.set(0, 0.86, -0.08);
    const handle = new three.Mesh(new three.BoxGeometry(1.0, 0.08, 0.08), metalMat);
    handle.position.set(0, 1.02, -0.62);
    const front = new three.Mesh(new three.BoxGeometry(0.42, 0.72, 0.28), bodyMat);
    front.position.set(0, 0.76, -0.54);
    group.add(body, seat, handle, front);

    for (const z of [-0.62, 0.58]) {
      const wheel = new three.Mesh(new three.TorusGeometry(0.22, 0.065, 8, 16), darkMat);
      wheel.rotation.y = Math.PI / 2;
      wheel.position.set(0, 0.28, z);
      group.add(wheel);
    }

    group.traverse?.((child: any) => {
      child.castShadow = false;
      child.receiveShadow = false;
    });
    return group;
  }

  private createPersonMesh(color: number, scale: number, options: { backpack?: boolean; cane?: boolean } = {}) {
    const three = this.requireThree();
    const group = new three.Group();
    const skin = new three.MeshStandardMaterial({ color: 0xf2c6a0, roughness: 0.78, metalness: 0.02 });
    const bodyMat = new three.MeshStandardMaterial({ color, roughness: 0.72, metalness: 0.02 });
    const dark = new three.MeshStandardMaterial({ color: 0x222222, roughness: 0.7, metalness: 0.04 });
    const head = new three.Mesh(new three.SphereGeometry(0.45 * scale, 8, 6), skin);
    head.position.y = 2.1 * scale;
    const body = new three.Mesh(new three.BoxGeometry(0.8 * scale, 1.15 * scale, 0.45 * scale), bodyMat);
    body.position.y = 1.25 * scale;
    const leftArm = new three.Mesh(new three.BoxGeometry(0.16 * scale, 0.82 * scale, 0.16 * scale), bodyMat);
    leftArm.position.set(-0.52 * scale, 1.3 * scale, 0);
    leftArm.rotation.z = options.cane ? -0.25 : 0.38;
    const rightArm = new three.Mesh(new three.BoxGeometry(0.16 * scale, 0.82 * scale, 0.16 * scale), bodyMat);
    rightArm.position.set(0.52 * scale, 1.3 * scale, 0);
    rightArm.rotation.z = options.backpack ? -0.42 : 0.25;
    const leftLeg = new three.Mesh(new three.BoxGeometry(0.22 * scale, 0.9 * scale, 0.22 * scale), dark);
    leftLeg.position.set(-0.22 * scale, 0.45 * scale, 0);
    leftLeg.rotation.z = options.backpack ? 0.18 : 0;
    const rightLeg = new three.Mesh(new three.BoxGeometry(0.22 * scale, 0.9 * scale, 0.22 * scale), dark);
    rightLeg.position.set(0.22 * scale, 0.45 * scale, 0);
    rightLeg.rotation.z = options.backpack ? -0.18 : 0;
    group.add(head, body, leftArm, rightArm, leftLeg, rightLeg);
    if (options.backpack) {
      const packMat = new three.MeshStandardMaterial({ color: 0x2563eb, roughness: 0.62, metalness: 0.05 });
      const pack = new three.Mesh(new three.BoxGeometry(0.52 * scale, 0.68 * scale, 0.22 * scale), packMat);
      pack.position.set(0, 1.35 * scale, -0.34 * scale);
      group.add(pack);
    }
    if (options.cane) {
      const caneMat = new three.MeshStandardMaterial({ color: 0x7c4a2d, roughness: 0.66, metalness: 0.08 });
      const cane = new three.Mesh(new three.CylinderGeometry(0.035 * scale, 0.035 * scale, 1.35 * scale, 8), caneMat);
      cane.position.set(-0.68 * scale, 0.72 * scale, 0.18 * scale);
      cane.rotation.z = -0.16;
      group.add(cane);
    }
    return group;
  }

  private createCarMesh(color: number) {
    const group = new three.Group();
    const referenceCar = this.vehicleModel?.clone?.(true);
    if (referenceCar) {
      referenceCar.rotation.x = 0;
      referenceCar.traverse?.((child: any) => {
        child.castShadow = false;
        child.receiveShadow = false;
      });
      group.add(referenceCar);
      return group;
    }

    const fallback = this.createFallbackVehicle(color);
    group.add(fallback.group);
    return group;
  }

  private createPlaneMesh() {
    const three = this.requireThree();
    const group = new three.Group();
    const bodyMat = new three.MeshBasicMaterial({ color: 0xd6dde4 });
    const wingMat = new three.MeshBasicMaterial({ color: 0x94a3b8 });
    const smokeMat = new three.MeshBasicMaterial({ color: 0x4b5563, transparent: true, opacity: 0.42 });
    const debrisMat = new three.MeshBasicMaterial({ color: 0x1f2937 });
    const body = new three.Mesh(new three.BoxGeometry(1.4, 1.2, 7), bodyMat);
    const wing = new three.Mesh(new three.BoxGeometry(8, 0.18, 1.4), wingMat);
    const tail = new three.Mesh(new three.BoxGeometry(4, 0.16, 1.1), wingMat);
    tail.position.z = -2.8;
    tail.position.y = 0.75;
    group.add(body, wing, tail);
    for (const [x, y, z, radius] of [
      [-1.7, 0.9, -3.3, 0.7],
      [1.6, 1.15, -3.9, 0.55],
      [0.2, 1.35, -4.6, 0.82],
    ] as const) {
      const smoke = new three.Mesh(new three.SphereGeometry(radius, 10, 8), smokeMat);
      smoke.position.set(x, y, z);
      group.add(smoke);
    }
    for (const [x, z, w] of [
      [-3.1, 2.8, 1.1],
      [2.8, 1.9, 0.8],
      [0.8, -3.8, 0.9],
    ] as const) {
      const debris = new three.Mesh(new three.BoxGeometry(w, 0.16, 0.42), debrisMat);
      debris.position.set(x, 0.12, z);
      debris.rotation.y = x * 0.7;
      group.add(debris);
    }
    group.scale.set(1.2, 1.2, 1.2);
    return group;
  }

  /* ================================================================
   * CAMERA - deterministic vehicle-relative rig with view switching
   * ================================================================ */
  private updateCameraFree() {
    this.applyCameraPose();
  }

  /**
   * Teleport the camera instantly to the correct follow position without lerp.
   * Use this after initScene() and lane resets so the next rendered frame already
   * shows the correct perspective instead of lerping from a stale camera pose.
   */
  private snapCameraToVehicle() {
    this.applyCameraPose();
  }

  private applyCameraPose() {
    if (!this.camera) return;
    const pose = CalculateDrivingCameraPose({
      vehicleX: this.vehicleX,
      vehicleZ: this.vehicleZ,
      vehicleHeading: this.vehicleHeading,
      mode: this.cameraMode,
    });
    this.camera.position.set(pose.position.x, pose.position.y, pose.position.z);
    this.camera.up.set(pose.up.x, pose.up.y, pose.up.z);
    this.camera.lookAt(pose.lookAt.x, pose.lookAt.y, pose.lookAt.z);
    if (Math.abs(this.camera.fov - pose.fov) > 0.0001) {
      this.camera.fov = pose.fov;
      this.camera.updateProjectionMatrix();
    }
  }

  private cycleCameraMode() {
    const modes: DrivingCameraMode[] = ['third-person', 'first-person'];
    const next = modes[(modes.indexOf(this.cameraMode) + 1) % modes.length];
    this.cameraMode = next;
    this.updateCameraModeHud();
    this.snapCameraToVehicle();
    if (this.hud?.event) {
      this.hud.event.textContent = this.language === 'en'
        ? `View: ${this.getCameraModeText()}`
        : `\u8996\u89d2\uff1a${this.getCameraModeText()}`;
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
        : `\u8996\u89d2\uff1a${this.getCameraModeText()}`;
    }
    if (this.hud?.cockpit) {
      this.hud.cockpit.style.display = this.cameraMode === 'first-person' ? 'block' : 'none';
    }
    if (this.vehicleRoot) {
      this.vehicleRoot.visible = this.cameraMode === 'third-person';
    }
    if (this.vehicleBlobShadow) {
      this.vehicleBlobShadow.visible = this.cameraMode === 'third-person';
    }
  }

  private updateCockpitHud() {
    if (this.cockpitSteeringWheel) {
      const steeringDeg = this.clamp(this.frontWheelAngle * 34, -24, 24);
      this.cockpitSteeringWheel.style.transform = `translateX(-50%) rotate(${steeringDeg}deg)`;
    }
    const speedKph = Math.round(this.vehicleSpeed * 3.6);
    if (this.cockpitSpeedText) {
      this.cockpitSpeedText.textContent = String(speedKph);
    }
    if (this.cockpitSpeedNeedle) {
      const speedRatio = this.clamp(speedKph / Math.round(this.maxVehicleSpeed * 3.6), 0, 1);
      this.cockpitSpeedNeedle.style.transform = `rotate(${-115 + speedRatio * 230}deg)`;
    }
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

  /* ================================================================
   * INPUT
   * ================================================================ */
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

  private getBoxWidthAxis(angle: number): Vec2 {
    return this.getRightVector(angle);
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

  private getRouteBounds() {
    return this.route.reduce(
      (bounds, segment) => {
        const endX = segment.start.x + segment.dir.x * segment.length;
        const endZ = segment.start.z + segment.dir.z * segment.length;
        return {
          minX: Math.min(bounds.minX, segment.start.x, endX),
          maxX: Math.max(bounds.maxX, segment.start.x, endX),
          minZ: Math.min(bounds.minZ, segment.start.z, endZ),
          maxZ: Math.max(bounds.maxZ, segment.start.z, endZ),
        };
      },
      { minX: Infinity, maxX: -Infinity, minZ: Infinity, maxZ: -Infinity },
    );
  }

  private getDistanceToRoute(wx: number, wz: number): number {
    let bestDistSq = Infinity;
    for (const segment of this.route) {
      const dx = wx - segment.start.x;
      const dz = wz - segment.start.z;
      const dot = dx * segment.dir.x + dz * segment.dir.z;
      const clampedT = this.clamp(dot, 0, segment.length);
      const closestX = segment.start.x + segment.dir.x * clampedT;
      const closestZ = segment.start.z + segment.dir.z * clampedT;
      bestDistSq = Math.min(bestDistSq, (wx - closestX) ** 2 + (wz - closestZ) ** 2);
    }
    return Math.sqrt(bestDistSq);
  }

  private isBoxNearRoute(box: CollisionBox2D, margin: number): boolean {
    const reach = Math.hypot(box.halfWidth, box.halfLength) + margin;
    return this.getDistanceToRoute(box.centerX, box.centerZ) <= reach;
  }

  /* ================================================================
   * ROUTE HELPERS (used for hazard placement, minimap, etc.)
   * ================================================================ */
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

  /* ================================================================
   * TRIAL FINISH & CLEANUP
   * ================================================================ */
  private finishTrial(displayElement: HTMLElement, response: string) {
    if (this.finished) return;
    this.finished = true;

    const duration = this.trialStartTime > 0
      ? Math.round(Math.max(0, this.simulationTime - this.trialStartTime))
      : 0;
    const validEvents = this.eventResults.filter((event) => event.valid);
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
      correct: response === 'completed' && collisions === 0,
      target: this.text.deliveryTarget,
      response,
      duration_ms: duration,
      average_rt: reactionSummary.averageMs,
      median_rt: reactionSummary.medianMs,
      valid_event_count: validEvents.length,
      reaction_event_count: validRts.length,
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
      driving_events: this.eventResults,
    });
  }

  private detachGlobalListeners() {
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

  private detachResizeSync() {
    this.viewportController?.stop();
    this.viewportController = null;
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
    for (const target of Object.values(this.rearviewRenderTargets)) {
      target?.dispose?.();
    }
    this.rearviewRenderTargets = {};
    this.rearviewPixelBuffers = {};
    this.rearviewImageData = new WeakMap<HTMLCanvasElement, ImageData>();
    this.asphaltMaterials.clear();
    this.signTextureCache.clear();
    this.asphaltTexture = null;
    this.miniMapLastUpdateTime = 0;
    this.miniMapLastDirectionText = '';
    this.miniMapRouteSamples = [];
    this.sideRearviewMirrorsEnabled = true;
    this.rearviewQualityLevel = 'high';
    this.needsFirstFrameCameraSnap = false;
    if (this.scene) {
      this.disposeObject(this.scene);
      this.scene.clear?.();
      this.scene = null;
    }
    if (this.renderer) {
      this.renderer.dispose?.();
      this.renderer.forceContextLoss?.();
      this.renderer.domElement?.remove?.();
      this.renderer = null;
    }
    this.touchControlsRoot?.remove();
    this.touchControlsRoot = null;
    this.inputPauseOverlay?.remove();
    this.inputPauseOverlay = null;
    this.inputPausedAt = 0;
    this.visibilityPausedAt = null;
    this.camera = null;
    this.rearviewCamera = null;
    this.rearviewLookAt = null;
    this.vehicleRoot = null;
    this.vehicleModel = null;
    this.fallbackVehicle = null;
    this.vehicleBlobShadow = null;
    this.blobShadowTexture = null;
    this.wheelBindings = [];
    this.ambientTrafficActors = [];
    this.hud = null;
    this.miniMapCanvas = null;
    this.miniMapCtx = null;
    this.miniMapDirectionLabel = null;
    this.rearviewMirrorCanvases = {};
    this.cockpitSteeringWheel = null;
    this.cockpitSpeedNeedle = null;
    this.cockpitSpeedText = null;
  }

  private disposeObject(object: any) {
    object?.traverse?.((child: any) => {
      child.geometry?.dispose?.();
      this.disposeMaterial(child.material);
    });
  }

  private disposeMaterial(material: any) {
    if (!material) return;
    const materials = Array.isArray(material) ? material : [material];
    for (const item of materials) {
      for (const key of ['map', 'alphaMap', 'aoMap', 'bumpMap', 'emissiveMap', 'metalnessMap', 'normalMap', 'roughnessMap']) {
        item[key]?.dispose?.();
      }
      item.dispose?.();
    }
  }

  private requireThree(): ThreeModule {
    return three;
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

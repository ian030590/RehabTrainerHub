import { JsPsych, ParameterType } from 'jspsych';
import type { JsPsychPlugin, TrialType } from 'jspsych';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { typography } from '@rehab-trainer/ui/trainerTheme';
import { SoundManager } from '../../utils/soundManager';
import { DIFFICULTY_PRESETS, HAZARD_TEMPLATES } from './driving/driving-hazards';
import {
  DRIVING_ROUTE,
  buildDrivingRoute,
  pickRandomDrivingRoute,
  projectTaipeiLonLat,
  type DrivingRouteVariant,
} from './driving/driving-route';
import { THREE, type ThreeModule } from './driving/driving-scene';
import { DRIVING_TEXT, type DrivingText } from './driving/driving-text';
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

type DrivingCameraMode = 'third-person' | 'first-person';
type DrivingRenderQualityLevel = 'low' | 'medium' | 'high';

interface DrivingRenderQuality {
  level: DrivingRenderQualityLevel;
  pixelRatioCap: number;
  antialias: boolean;
  cameraFar: number;
  fogNear: number;
  fogFar: number;
  roadTextureSize: number;
  roadNoiseSamples: number;
  vehicleTextureSize: number;
  useReferenceVehicleModel: boolean;
  useOsmCity: boolean;
  osmRoadSegmentLimit: number;
  osmBuildingLimit: number;
  ambientTrafficCount: number;
}

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
    collisions: { type: ParameterType.INT },
    lane_deviations: { type: ParameterType.INT },
    average_fps: { type: ParameterType.INT },
    rendering_quality: { type: ParameterType.STRING },
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
  private finished = false;
  private routeLength = 0;
  private routeSegmentStarts: number[] = [];
  private miniMapRouteSamples: MiniMapRouteSample[] = [];
  private lastFrameTime = 0;
  private trialStartTime = 0;
  private fpsSamples: number[] = [];
  private activeHazards: ActiveHazard[] = [];
  private eventResults: DrivingEventResult[] = [];
  private lastBrakePressed = false;
  private ambientTrafficActors: AmbientTrafficActor[] = [];
  private renderQuality: DrivingRenderQuality = this.createRenderQuality('medium');
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
  private cameraFov = 68;
  private cameraMode: DrivingCameraMode = 'first-person';
  private wheelSpin = 0;

  // Intersection / turning state
  private intersections: IntersectionZone[] = [];

  // Difficulty
  private difficultyPreset: DifficultyPreset = DIFFICULTY_PRESETS.beginner;

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
  private rearviewMirrorUpdateIndex = 0;
  private sideRearviewMirrorsEnabled = true;
  private performanceDowngraded = false;
  private lastPerformanceCheckTime = 0;
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
  private resizeListener: (() => void) | null = null;
  private gamepadConnectedListener: ((event: GamepadEvent) => void) | null = null;
  private gamepadDisconnectedListener: ((event: GamepadEvent) => void) | null = null;
  private gamepadConnected = false;
  private controlMode: DrivingControlMode = 'arrow';
  private language: DrivingLanguage = 'zh';
  private text: DrivingText = DRIVING_TEXT.zh;

  private hud: {
    status: HTMLDivElement;
    speed: HTMLDivElement;
    distance: HTMLDivElement;
    view?: HTMLDivElement;
    event: HTMLDivElement;
    redFlash: HTMLDivElement;
    blackout?: HTMLDivElement;
    cockpit?: HTMLDivElement;
    miniMapWrapper?: HTMLDivElement;
  } | null = null;

  private roadCollisionBoxes: CollisionBox2D[] = [];
  private buildingCollisionBoxes: CollisionBox2D[] = [];

  private readonly defaultRoadWidth = 10.95;
  private readonly defaultLaneWidth = 3.45;
  private readonly vehicleHalfWidth = 1.18;
  private readonly vehicleHalfLength = 2.45;
  private readonly wheelBase = 2.72;
  private readonly maxVehicleSpeed = 18;
  private readonly baseCameraFov = 68;
  private readonly initialRouteDistance = 18;
  private readonly firstPersonCameraForwardOffset = 0.45;
  private readonly firstPersonCameraHeight = 2.05;
  private readonly firstPersonCameraLookAhead = 35;
  private readonly firstPersonCameraLookHeight = 1.65;
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
  private readonly referenceVehicleUrl = '/assets/driving/reference-car-game/vehicals/car.glb';
  private readonly taipeiOsmUrl = '/assets/driving/taipei-osm/taipei-xinyi-osm.json';

  private route: RouteSegment[] = [...DRIVING_ROUTE];
  private readonly hazardTemplates: HazardTemplate[] = [...HAZARD_TEMPLATES];

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

  private createRenderQuality(level: DrivingRenderQualityLevel): DrivingRenderQuality {
    if (level === 'low') {
      return {
        level,
        pixelRatioCap: 1,
        antialias: false,
        cameraFar: 420,
        fogNear: 120,
        fogFar: 360,
        roadTextureSize: 256,
        roadNoiseSamples: 650,
        vehicleTextureSize: 512,
        useReferenceVehicleModel: false,
        useOsmCity: false,
        osmRoadSegmentLimit: 0,
        osmBuildingLimit: 0,
        ambientTrafficCount: 10,
      };
    }

    if (level === 'high') {
      return {
        level,
        pixelRatioCap: 1.5,
        antialias: true,
        cameraFar: 900,
        fogNear: 260,
        fogFar: 780,
        roadTextureSize: 512,
        roadNoiseSamples: 1800,
        vehicleTextureSize: 1024,
        useReferenceVehicleModel: true,
        useOsmCity: false,
        osmRoadSegmentLimit: 230,
        osmBuildingLimit: 120,
        ambientTrafficCount: 18,
      };
    }

    return {
      level,
      pixelRatioCap: 1.25,
      antialias: true,
      cameraFar: 650,
      fogNear: 180,
      fogFar: 560,
      roadTextureSize: 512,
      roadNoiseSamples: 1200,
      vehicleTextureSize: 512,
      useReferenceVehicleModel: true,
      useOsmCity: false,
      osmRoadSegmentLimit: 150,
      osmBuildingLimit: 72,
      ambientTrafficCount: 14,
    };
  }

  private detectRenderQuality(root: HTMLElement): DrivingRenderQuality {
    const nav = navigator as Navigator & { deviceMemory?: number };
    const cores = nav.hardwareConcurrency ?? 4;
    const memory = nav.deviceMemory ?? 4;
    const dpr = window.devicePixelRatio || 1;
    const pixelCount = Math.max(1, root.clientWidth * root.clientHeight * dpr * dpr);

    let maxTextureSize = 2048;
    let maxRenderbufferSize = 2048;
    let hasWebGl2 = false;
    const probeCanvas = document.createElement('canvas');
    const gl = (
      probeCanvas.getContext('webgl2', { failIfMajorPerformanceCaveat: true }) ||
      probeCanvas.getContext('webgl', { failIfMajorPerformanceCaveat: true }) ||
      probeCanvas.getContext('experimental-webgl', { failIfMajorPerformanceCaveat: true })
    ) as WebGLRenderingContext | WebGL2RenderingContext | null;

    if (gl) {
      hasWebGl2 = typeof WebGL2RenderingContext !== 'undefined' && gl instanceof WebGL2RenderingContext;
      maxTextureSize = gl.getParameter(gl.MAX_TEXTURE_SIZE) ?? maxTextureSize;
      maxRenderbufferSize = gl.getParameter(gl.MAX_RENDERBUFFER_SIZE) ?? maxRenderbufferSize;
    }

    const cpuStart = performance.now();
    let cpuSink = 0;
    for (let i = 0; i < 48_000; i += 1) {
      cpuSink += Math.sqrt((i % 97) + 1);
    }
    const cpuMs = performance.now() - cpuStart;
    if (cpuSink < 0) console.info(cpuSink);

    let score = 0;
    score += Math.min(2.4, cores * 0.35);
    score += Math.min(2.2, memory * 0.42);
    score += hasWebGl2 ? 1.6 : 0.5;
    score += maxTextureSize >= 8192 ? 1.2 : maxTextureSize >= 4096 ? 0.8 : 0.2;
    score += maxRenderbufferSize >= 8192 ? 0.6 : 0.2;
    score += cpuMs < 4 ? 1.0 : cpuMs < 8 ? 0.45 : -0.35;
    if (pixelCount > 4_000_000) score -= 1.1;
    if (dpr > 2) score -= 0.7;

    const level: DrivingRenderQualityLevel = score >= 7.2
      ? 'high'
      : score >= 4.7
        ? 'medium'
        : 'low';
    const quality = this.createRenderQuality(level);
    console.info('[DrivingRehab] render quality', {
      level: quality.level,
      score: Math.round(score * 10) / 10,
      cores,
      memory,
      dpr,
      maxTextureSize,
      maxRenderbufferSize,
      cpuMs: Math.round(cpuMs * 10) / 10,
    });
    return quality;
  }

  trial(display_element: HTMLElement, trial: TrialType<Info>) {
    display_element.replaceChildren();
    this.resetTrialState(trial);
    SoundManager.init();

    const root = document.createElement('div');
    root.className = 'driving-rehab-root';
    root.tabIndex = 0;
    Object.assign(root.style, {
      position: 'relative',
      width: '100%',
      height: '100%',
      overflow: 'hidden',
      background: '#0f1720',
      color: '#fff',
      fontFamily: typography.fontFamily,
      userSelect: 'none',
      visibility: 'hidden',
    });
    display_element.appendChild(root);
    root.focus();

    const startDriving = async () => {
      if (this.finished || this.renderer) return;
      try {
        this.renderQuality = this.detectRenderQuality(root);
        this.initScene(root);
        this.initHud(root, trial.red_flash_enabled ?? true);
        if (this.renderQuality.useReferenceVehicleModel) {
          await this.loadReferenceVehicleModel();
        }
        if (this.finished) return;
        if (!display_element.isConnected) {
          this.finishTrial(trial, display_element, 'aborted');
          return;
        }
        this.trialStartTime = performance.now();
        this.lastFrameTime = this.trialStartTime;
        const initialInput = this.readInput();
        this.updateVehicleFree(initialInput, 0, this.trialStartTime);
        this.updateVehicleVisual(0, this.trialStartTime);
        this.updateTrafficLights(this.trialStartTime);
        this.lastBrakePressed = initialInput.brake > 0.35;
        this.renderFirstFrameBeforeReveal(this.trialStartTime);
        root.style.visibility = 'visible';
        root.focus();
        this.raf = requestAnimationFrame((time) => this.loop(time, trial, display_element));
      } catch (error) {
        console.error(error);
        this.finishTrial(trial, display_element, 'load-error');
      }
    };

    this.attachKeyboardListeners(trial, display_element);
    this.attachGamepadListeners();
    void startDriving();
  }

  private resetTrialState(trial?: TrialType<Info>) {
    this.cleanupRenderResources();
    this.selectedRouteVariant = pickRandomDrivingRoute();
    this.route = this.ensureRoute(buildDrivingRoute(this.selectedRouteVariant));
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
    this.cameraFov = this.baseCameraFov;
    this.cameraMode = 'first-person';
    this.wheelSpin = 0;
    this.trialStartTime = 0;
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
    this.fpsSamples = [];
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
    this.rearviewMirrorUpdateIndex = 0;
    this.sideRearviewMirrorsEnabled = true;
    this.performanceDowngraded = false;
    this.lastPerformanceCheckTime = 0;
    this.miniMapLastUpdateTime = 0;
    this.miniMapLastDirectionText = '';
    this.asphaltTexture = null;
    this.asphaltMaterials = new Map<number, any>();
    this.signTextureCache = new Map<string, any>();
    this.miniMapDirectionLabel = null;
    this.cockpitSteeringWheel = null;
    this.cockpitSpeedNeedle = null;
    this.cockpitSpeedText = null;
    this.gamepadConnected = Array.from(navigator.getGamepads?.() ?? []).some(Boolean);
    this.controlMode = this.getControlMode((trial as any)?.control_mode);
    this.language = this.getLanguage((trial as any)?.language);
    this.text = DRIVING_TEXT[this.language];
    this.renderQuality = this.createRenderQuality('medium');

    // Difficulty
    const diffKey = (trial as any)?.driving_difficulty ?? 'beginner';
    this.difficultyPreset = DIFFICULTY_PRESETS[diffKey] ?? DIFFICULTY_PRESETS.beginner;

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

  private attachKeyboardListeners(
    trial: TrialType<Info>,
    display_element: HTMLElement,
  ) {
    this.keydownListener = (event: KeyboardEvent) => {
      if (this.shouldPreventKeyDefault(event.code)) {
        event.preventDefault();
      }
      this.setKeyboardInput(event.code, true);
      if (event.code === 'KeyC' || event.code === 'KeyV') {
        event.preventDefault();
        this.cycleCameraMode();
      }
      if (event.code === 'Escape') this.finishTrial(trial, display_element, 'aborted');
    };
    this.keyupListener = (event: KeyboardEvent) => {
      this.setKeyboardInput(event.code, false);
    };
    window.addEventListener('keydown', this.keydownListener);
    window.addEventListener('keyup', this.keyupListener);
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

  private setKeyboardInput(code: string, pressed: boolean) {
    if (this.controlMode === 'arrow') {
      if (code === 'ArrowLeft') this.keyState.left = pressed;
      if (code === 'ArrowRight') this.keyState.right = pressed;
      if (code === 'ArrowUp') this.keyState.up = pressed;
      if (code === 'ArrowDown') this.keyState.down = pressed;
      return;
    }
    if (this.controlMode === 'wasd') {
      if (code === 'KeyA') this.keyState.left = pressed;
      if (code === 'KeyD') this.keyState.right = pressed;
      if (code === 'KeyW') this.keyState.up = pressed;
      if (code === 'KeyS') this.keyState.down = pressed;
    }
  }

  private attachGamepadListeners() {
    this.gamepadConnectedListener = (event: GamepadEvent) => {
      this.gamepadConnected = true;
      if (this.hud?.event) this.hud.event.textContent = this.format(this.text.controllerConnected, { id: event.gamepad.id });
    };
    this.gamepadDisconnectedListener = () => {
      this.gamepadConnected = Array.from(navigator.getGamepads?.() ?? []).some(Boolean);
      if (this.hud?.event && !this.gamepadConnected) this.hud.event.textContent = this.text.controllerDisconnected;
    };
    window.addEventListener('gamepadconnected', this.gamepadConnectedListener);
    window.addEventListener('gamepaddisconnected', this.gamepadDisconnectedListener);
  }

  private initScene(root: HTMLDivElement) {
    const THREE = this.requireThree();
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0xd9eaf1);
    this.scene.fog = new THREE.Fog(0xcbd7d9, this.renderQuality.fogNear, this.renderQuality.fogFar);

    const width = Math.max(1, root.clientWidth);
    const height = Math.max(1, root.clientHeight);
    this.camera = new THREE.PerspectiveCamera(this.baseCameraFov, width / height, 0.1, this.renderQuality.cameraFar);
    this.rearviewCamera = new THREE.PerspectiveCamera(66, 3.2, 0.1, Math.min(this.renderQuality.cameraFar, 360));
    this.rearviewLookAt = new THREE.Vector3();

    this.renderer = new THREE.WebGLRenderer({
      antialias: this.renderQuality.antialias,
      alpha: false,
      powerPreference: 'high-performance',
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, this.renderQuality.pixelRatioCap));
    this.renderer.setSize(width, height, false);
    this.renderer.shadowMap.enabled = false;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.domElement.style.width = '100%';
    this.renderer.domElement.style.height = '100%';
    root.appendChild(this.renderer.domElement);

    this.resizeListener = () => {
      if (!this.renderer || !this.camera) return;
      const nextWidth = Math.max(1, root.clientWidth);
      const nextHeight = Math.max(1, root.clientHeight);
      this.camera.aspect = nextWidth / nextHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(nextWidth, nextHeight, false);
    };
    window.addEventListener('resize', this.resizeListener);

    this.createSceneEnvironment();
    this.buildWorld();
    this.createVehicleVisual();
    this.createAmbientTraffic();
    this.preloadHazardEvents();
    if (this.renderQuality.useOsmCity) void this.loadTaipeiOsmCity();
  }

  private createSceneEnvironment() {
    const THREE = this.requireThree();
    if (!this.scene) return;

    const fogRange = this.getDifficultyFogRange();
    this.scene.fog = new THREE.Fog(0xcbd7d9, fogRange.near, fogRange.far);

    const ambient = new THREE.AmbientLight(0xffffff, 1.28);
    const sun = new THREE.DirectionalLight(0xffe7c2, 1.55);
    sun.position.set(38, 62, 26);
    sun.castShadow = false;

    const hemi = new THREE.HemisphereLight(0xbfd4df, 0x4d6b50, 0.92);
    this.scene.add(ambient, sun, hemi);
    this.addSkyDome();
  }

  private getDifficultyFogRange(): { near: number; far: number } {
    if (this.difficultyPreset === DIFFICULTY_PRESETS.advanced) {
      return {
        near: this.renderQuality.fogNear * 0.46,
        far: this.renderQuality.fogFar * 0.54,
      };
    }

    if (this.difficultyPreset === DIFFICULTY_PRESETS.intermediate) {
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
    const THREE = this.requireThree();
    if (!this.scene) return;

    const routeBounds = this.getRouteBounds();
    const sky = new THREE.Mesh(
      new THREE.SphereGeometry(1200, 32, 16),
      new THREE.MeshBasicMaterial({
        map: this.createSkyTexture(),
        side: THREE.DoubleSide,
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
    const THREE = this.requireThree();
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
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
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
    const speed = document.createElement('div');
    const distance = document.createElement('div');
    const view = document.createElement('div');
    const event = document.createElement('div');
    status.textContent = this.text.taskDelivery;
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
    hudPanel.append(status, metrics, event);

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

    this.sideRearviewMirrorsEnabled = this.renderQuality.level !== 'low';

    // Create mini-map
    const miniMapWrapper = this.createMiniMap();

    const cockpit = this.createCockpitMask();
    hud.append(redFlash, cockpit, hudPanel, miniMapWrapper, blackout);
    root.appendChild(hud);

    this.hud = { status, speed, distance, view, event, redFlash, blackout, cockpit, miniMapWrapper };
    this.updateCameraModeHud();
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

      const firstPoint = this.getRoutePoint(from);
      const firstScreen = toScreen(firstPoint.x, firstPoint.z);
      ctx.moveTo(firstScreen.sx, firstScreen.sy);

      this.forEachMiniMapRouteSample(from, to, (sample) => {
        const screen = toScreen(sample.x, sample.z);
        ctx.lineTo(screen.sx, screen.sy);
      });

      const endPoint = this.getRoutePoint(to);
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
      const point = this.getRoutePoint(nextInter.distance);
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

    const destPt = this.getRoutePoint(this.routeLength - 2);
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
      const point = this.getRoutePoint(distance);
      samples.push({ distance, x: point.x, z: point.z });
    }

    const last = this.getRoutePoint(this.routeLength);
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
    canvas.width = isCenter ? 320 : 192;
    canvas.height = isCenter ? 82 : 108;
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
    const previousTarget = this.renderer.getRenderTarget?.() ?? null;
    const previousVehicleVisible = this.vehicleRoot?.visible;
    if (this.vehicleRoot) this.vehicleRoot.visible = false;

    try {
      if (centerConnected && centerCanvas) {
        this.renderRearviewMirror('center', centerCanvas, vehicleBox, forward, right);
      }

      if (leftConnected || rightConnected) {
        const sidePosition: 'left' | 'right' = leftConnected && rightConnected
          ? (this.rearviewMirrorUpdateIndex % 2 === 0 ? 'left' : 'right')
          : leftConnected
            ? 'left'
            : 'right';
        const sideCanvas = sidePosition === 'left' ? leftCanvas : rightCanvas;
        this.rearviewMirrorUpdateIndex += 1;
        if (sideCanvas) {
          this.renderRearviewMirror(sidePosition, sideCanvas, vehicleBox, forward, right);
        }
      }
    } finally {
      this.renderer.setRenderTarget(previousTarget);
      if (!previousTarget) {
        this.renderer.setViewport(0, 0, this.renderer.domElement.width, this.renderer.domElement.height);
        this.renderer.setScissorTest(false);
      }
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

    const THREE = this.requireThree();
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
    const lookAt = this.rearviewLookAt ?? new THREE.Vector3();
    this.rearviewLookAt = lookAt;
    lookAt.set(
      vehicleBox.centerX - forward.x * lookDistance + right.x * sideLook,
      1.28,
      vehicleBox.centerZ - forward.z * lookDistance + right.z * sideLook,
    );
    this.rearviewCamera.lookAt(lookAt);

    this.renderer.setRenderTarget(target);
    this.renderer.setViewport(0, 0, width, height);
    this.renderer.setScissorTest(false);
    this.renderer.clear(true, true, true);
    this.renderer.render(this.scene, this.rearviewCamera);
    const pixels = this.getRearviewPixelBuffer(position, width, height);
    this.renderer.readRenderTargetPixels(target, 0, 0, width, height, pixels);
    this.copyRearviewPixelsToCanvas(pixels, canvas);
  }

  private getRearviewUpdateIntervalMs(): number {
    if (this.performanceDowngraded) return 350;
    if (this.renderQuality.level === 'low') return 420;
    if (this.renderQuality.level === 'medium') return 300;
    return 180;
  }

  private getRearviewRenderTarget(position: 'center' | 'left' | 'right', width: number, height: number) {
    const existing = this.rearviewRenderTargets[position];
    if (existing?.width === width && existing?.height === height) return existing;
    existing?.dispose?.();
    const THREE = this.requireThree();
    const target = new THREE.WebGLRenderTarget(width, height, { depthBuffer: true, stencilBuffer: false });
    target.texture.colorSpace = THREE.SRGBColorSpace;
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
    const THREE = this.requireThree();
    if (!this.scene) return;

    this.roadCollisionBoxes = [];
    this.buildingCollisionBoxes = [];

    const roadBaseMat = new THREE.MeshStandardMaterial({ color: 0x2b3035, roughness: 0.9, metalness: 0.08 });
    const centerLineMat = new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.76, metalness: 0.05 });
    const laneDividerMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.72, metalness: 0.03 });
    const stopLineMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.68, metalness: 0.04 });
    const edgeMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.7,
      metalness: 0.08,
      emissive: 0xaa1111,
      emissiveIntensity: 0.24,
    });
    const grassMat = new THREE.MeshStandardMaterial({
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
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(groundSize, groundSize, 64, 64), grassMat);
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

      const roadBase = new THREE.Mesh(new THREE.BoxGeometry(roadWidth + 0.44, 0.08, segment.length), roadBaseMat);
      roadBase.position.set(mid.x, -0.03, mid.z);
      roadBase.rotation.y = angle;
      roadBase.receiveShadow = false;
      this.scene.add(roadBase);

      const road = new THREE.Mesh(
        new THREE.BoxGeometry(roadWidth, 0.045, segment.length),
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
      const cross = new THREE.Mesh(
        new THREE.BoxGeometry(approachWidth + 18, 0.04, intersectionWidth),
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
    const THREE = this.requireThree();
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
      const stopLine = new THREE.Mesh(new THREE.BoxGeometry(laneWidth, 0.052, 0.72), material);
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
    const THREE = this.requireThree();
    if (!this.scene) return;

    const postMat = new THREE.MeshStandardMaterial({ color: 0x29323a, roughness: 0.58, metalness: 0.35 });
    const housingMat = new THREE.MeshStandardMaterial({ color: 0x111827, roughness: 0.62, metalness: 0.18 });
    const pedestrianMat = new THREE.MeshStandardMaterial({ color: 0x0b1720, roughness: 0.62, metalness: 0.14 });
    const walkMat = new THREE.MeshBasicMaterial({ color: 0x21e66f });

    for (const inter of this.intersections) {
      const segment = this.route[inter.segmentIndex];
      if (!segment) continue;

      const normal = this.getRouteRightVector(segment.dir);
      const angle = this.getSceneYawForDirection(segment.dir);
      const localDistance = Math.max(2, segment.length - this.stopLineSetback - 2.4);
      const roadWidth = this.getSegmentRoadWidth(segment);
      const baseX = segment.start.x + segment.dir.x * localDistance + normal.x * (roadWidth / 2 + 1.2);
      const baseZ = segment.start.z + segment.dir.z * localDistance + normal.z * (roadWidth / 2 + 1.2);

      const group = new THREE.Group();
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, 4.4, 10), postMat);
      post.position.y = 2.2;
      const housing = new THREE.Mesh(new THREE.BoxGeometry(0.78, 2.25, 0.36), housingMat);
      housing.position.set(0, 4.35, 0);
      const red = new THREE.Mesh(new THREE.SphereGeometry(0.28, 16, 10), new THREE.MeshBasicMaterial({ color: 0x451414 }));
      const yellow = new THREE.Mesh(new THREE.SphereGeometry(0.28, 16, 10), new THREE.MeshBasicMaterial({ color: 0x4a3a16 }));
      const green = new THREE.Mesh(new THREE.SphereGeometry(0.28, 16, 10), new THREE.MeshBasicMaterial({ color: 0x123d24 }));
      red.position.set(0, 4.9, 0.2);
      yellow.position.set(0, 4.35, 0.2);
      green.position.set(0, 3.8, 0.2);
      const pedestrianBox = new THREE.Mesh(new THREE.BoxGeometry(0.68, 0.58, 0.18), pedestrianMat);
      pedestrianBox.position.set(0, 2.62, 0.18);
      const littleGreenHead = new THREE.Mesh(new THREE.SphereGeometry(0.07, 10, 8), walkMat);
      littleGreenHead.position.set(0, 2.72, 0.29);
      const littleGreenBody = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.16, 0.03), walkMat);
      littleGreenBody.position.set(0, 2.56, 0.29);
      const littleGreenLeg = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.04, 0.03), walkMat);
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
    const THREE = this.requireThree();
    if (!this.scene) return;

    const scooterBoxMat = new THREE.MeshStandardMaterial({ color: 0x0f8b57, roughness: 0.72, metalness: 0.04 });
    const laneMarkMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.62, metalness: 0.02 });
    const poleMat = new THREE.MeshStandardMaterial({ color: 0x27272a, roughness: 0.74, metalness: 0.08 });
    const yellowMat = new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.65, metalness: 0.04 });
    const utilityMat = new THREE.MeshStandardMaterial({ color: 0x9aa3a9, roughness: 0.76, metalness: 0.12 });
    const arcadeMat = new THREE.MeshStandardMaterial({ color: 0xd9d4c8, roughness: 0.82, metalness: 0.02 });
    const columnMat = new THREE.MeshStandardMaterial({ color: 0xb9b3a7, roughness: 0.86, metalness: 0.02 });

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

      const waitingBox = new THREE.Mesh(new THREE.BoxGeometry(Math.max(3.4, roadWidth / 2 - 1.4), 0.036, 4.8), scooterBoxMat);
      waitingBox.position.set(center.x, 0.105, center.z);
      waitingBox.rotation.y = angle;
      this.scene.add(waitingBox);

      for (const side of [-1, 1]) {
        const line = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.048, 4.8), laneMarkMat);
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
          const pole = new THREE.Group();
          const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.16, 5.2, 10), poleMat);
          shaft.position.y = 2.6;
          pole.add(shaft);
          for (let band = 0; band < 4; band += 1) {
            const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.18, 0.04), yellowMat);
            stripe.position.set(0, 0.75 + band * 0.32, -0.16);
            stripe.rotation.z = band % 2 ? -0.25 : 0.25;
            pole.add(stripe);
          }
          const arm = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.08, 0.08), poleMat);
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
        const arcade = new THREE.Group();
        const canopy = new THREE.Mesh(new THREE.BoxGeometry(12, 0.28, 3.2), arcadeMat);
        canopy.position.y = 3.05;
        arcade.add(canopy);
        for (const x of [-4.8, -2.4, 0, 2.4, 4.8]) {
          const column = new THREE.Mesh(new THREE.BoxGeometry(0.22, 3.0, 0.22), columnMat);
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
    const THREE = this.requireThree();
    const geometry = new THREE.BoxGeometry(width, height, length);
    const mesh = new THREE.InstancedMesh(geometry, material, instances.length);
    const transform = new THREE.Object3D();

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
    const THREE = this.requireThree();
    const repeatBucket = Math.max(1, Math.round(length / 20));
    const cached = this.asphaltMaterials.get(repeatBucket);
    if (cached) return cached;

    const map = this.createLowResolutionRoadTexture(repeatBucket);
    const material = new THREE.MeshStandardMaterial({
      map,
      color: 0x686868,
      roughness: 0.92,
      metalness: 0.02,
    });
    this.asphaltMaterials.set(repeatBucket, material);
    return material;
  }

  private createLowResolutionRoadTexture(repeatY: number) {
    const THREE = this.requireThree();
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

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(1.15, repeatY);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.needsUpdate = true;
    this.asphaltTexture = texture;
    return texture;
  }

  private addBuildings() {
    const THREE = this.requireThree();
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
    const THREE = this.requireThree();
    const group = new THREE.Group();
    const bodyMat = new THREE.MeshStandardMaterial({ color, roughness: 0.82, metalness: 0.03 });
    const roofMat = new THREE.MeshStandardMaterial({ color: 0x4b5563, roughness: 0.78, metalness: 0.08 });
    const windowMat = new THREE.MeshBasicMaterial({ color: 0xc7e7ff, transparent: true, opacity: 0.62 });
    const signMat = new THREE.MeshBasicMaterial({ color: accent });
    const awningMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.7, metalness: 0.02 });

    const body = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), bodyMat);
    body.position.y = height / 2;
    group.add(body);

    const roof = new THREE.Mesh(new THREE.BoxGeometry(width + 0.35, 0.32, depth + 0.35), roofMat);
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
          const window = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.72, 0.045), windowMat);
          window.position.set(startX + column * 1.18, 3.25 + row * 2.0, frontZ);
          group.add(window);
        }
      }

      const storefront = new THREE.Mesh(new THREE.BoxGeometry(width * 0.72, 0.62, 0.055), signMat);
      storefront.position.set(0, 2.25, frontZ + 0.02);
      group.add(storefront);

      const awning = new THREE.Mesh(new THREE.BoxGeometry(width * 0.82, 0.18, 1.05), awningMat);
      awning.position.set(0, 2.95, frontZ + 0.42);
      group.add(awning);

      if (height > 13) {
        const balconyMat = new THREE.MeshBasicMaterial({ color: 0x263238 });
        for (let floor = 0; floor < Math.min(4, rowCount - 1); floor += 1) {
          const rail = new THREE.Mesh(new THREE.BoxGeometry(width * 0.62, 0.08, 0.12), balconyMat);
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
    const THREE = this.requireThree();
    if (!this.scene) return;

    for (const inter of this.intersections) {
      if (!inter.turnDir) continue;

      const signDist = Math.max(5, inter.distance - 20);
      const point = this.getRoutePoint(signDist);
      const group = new THREE.Group();

      // Post
      const postMat = new THREE.MeshBasicMaterial({ color: 0x888888 });
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.2, 4, 0.2), postMat);
      post.position.y = 2;
      group.add(post);

      // Sign board
      const signMat = new THREE.MeshBasicMaterial({ color: 0x2563eb });
      const sign = new THREE.Mesh(new THREE.BoxGeometry(2.8, 1.8, 0.12), signMat);
      sign.position.y = 4.2;
      group.add(sign);

      // Arrow on sign
      const arrowLabel = this.getNavigationArrow(inter.turnDir);
      const texture = this.createSignTexture(arrowLabel);
      const arrowMat = new THREE.MeshBasicMaterial({ map: texture, transparent: true, depthWrite: false });
      const arrowPlane = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 1.4), arrowMat);
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

    const THREE = this.requireThree();
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
    const texture = new THREE.CanvasTexture(canvas);
    texture.needsUpdate = true;
    this.signTextureCache.set(label, texture);
    return texture;
  }

  private addDestinationMarker() {
    const THREE = this.requireThree();
    if (!this.scene) return;
    const point = this.getRoutePoint(this.routeLength - 5);
    const group = new THREE.Group();
    const postMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const flagMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8 });
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.35, 5, 0.35), postMat);
    post.position.y = 2.5;
    const flag = new THREE.Mesh(new THREE.BoxGeometry(4, 2.2, 0.18), flagMat);
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
    const THREE = this.requireThree();
    if (!this.scene) return;

    const nodeMap = new Map<number, { lat: number; lon: number }>();
    for (const element of elements) {
      if (element?.type === 'node' && Number.isFinite(element.lat) && Number.isFinite(element.lon)) {
        nodeMap.set(element.id, { lat: element.lat, lon: element.lon });
      }
    }

    const group = new THREE.Group();
    group.name = 'taipei-xinyi-osm-city';
    const roadMat = new THREE.MeshStandardMaterial({ color: 0x4b5563, roughness: 0.88, metalness: 0.03 });
    const buildingMats = [
      new THREE.MeshStandardMaterial({ color: 0xbec7cf, roughness: 0.82, metalness: 0.02 }),
      new THREE.MeshStandardMaterial({ color: 0xc8beb1, roughness: 0.84, metalness: 0.02 }),
      new THREE.MeshStandardMaterial({ color: 0xaeb8bd, roughness: 0.8, metalness: 0.03 }),
      new THREE.MeshStandardMaterial({ color: 0xd3d0c8, roughness: 0.86, metalness: 0.01 }),
    ];
    const arcadeShadowMat = new THREE.MeshStandardMaterial({ color: 0x30343a, roughness: 0.88, metalness: 0.02 });
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
          const road = new THREE.Mesh(new THREE.BoxGeometry(width, 0.024, length), roadMat);
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
        const building = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), mat);
        building.position.set(collisionBox.centerX, height / 2 - 0.45, collisionBox.centerZ);
        group.add(building);
        this.buildingCollisionBoxes.push(collisionBox);

        if (height > 7 && Math.min(width, depth) > 4) {
          const arcade = new THREE.Mesh(new THREE.BoxGeometry(width * 0.78, 2.25, 1.1), arcadeShadowMat);
          arcade.position.set(building.position.x, 0.72, bbox.minZ + 0.55);
          group.add(arcade);
        }
        buildingCount += 1;
      }
    }

    this.scene.add(group);
  }

  private projectTaipeiLonLat(lon: number, lat: number): Vec2 {
    return projectTaipeiLonLat(lon, lat);
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
    const THREE = this.requireThree();
    if (!this.scene) return;

    const root = new THREE.Group();
    root.name = 'driving-reference-vehicle-root';
    this.vehicleRoot = root;
    this.scene.add(root);

    const fallback = this.createFallbackVehicle();
    this.fallbackVehicle = fallback.group;
    this.wheelBindings = fallback.wheels;
    root.add(fallback.group);
    this.vehicleBlobShadow = this.createBlobShadowMesh(3.55, 5.9, 0.42);
    this.scene.add(this.vehicleBlobShadow);
    this.updateVehicleVisual(0, performance.now());
  }

  private createBlobShadowMesh(width: number, length: number, opacity: number) {
    const THREE = this.requireThree();
    const material = new THREE.MeshBasicMaterial({
      map: this.getBlobShadowTexture(),
      transparent: true,
      opacity,
      depthWrite: false,
    });
    const shadow = new THREE.Mesh(new THREE.PlaneGeometry(width, length), material);
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.y = 0.118;
    shadow.renderOrder = 1;
    return shadow;
  }

  private getBlobShadowTexture() {
    if (this.blobShadowTexture) return this.blobShadowTexture;

    const THREE = this.requireThree();
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
    this.blobShadowTexture = new THREE.CanvasTexture(canvas);
    this.blobShadowTexture.needsUpdate = true;
    return this.blobShadowTexture;
  }

  private createFallbackVehicle(bodyColor = 0x1d4ed8): { group: any; wheels: VehicleWheelBinding[] } {
    const THREE = this.requireThree();
    const group = new THREE.Group();
    group.name = 'driving-reference-fallback-car';

    const bodyMat = new THREE.MeshStandardMaterial({ color: bodyColor, roughness: 0.42, metalness: 0.26 });
    const glassMat = new THREE.MeshStandardMaterial({ color: 0x172554, roughness: 0.18, metalness: 0.12 });
    const tireMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.72, metalness: 0.12 });
    const rimMat = new THREE.MeshStandardMaterial({ color: 0xb9c2cc, roughness: 0.42, metalness: 0.55 });

    const body = new THREE.Mesh(new THREE.BoxGeometry(2.5, 0.92, 4.85), bodyMat);
    body.position.y = 0.82;
    body.castShadow = false;
    body.receiveShadow = false;
    const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.84, 0.88, 1.86), glassMat);
    cabin.position.set(0, 1.44, -0.28);
    cabin.castShadow = false;
    group.add(body, cabin);

    const wheels: VehicleWheelBinding[] = [];
    for (const [x, z, front] of [
      [-1.25, -1.56, true],
      [1.25, -1.56, true],
      [-1.25, 1.48, false],
      [1.25, 1.48, false],
    ] as const) {
      const wheel = new THREE.Group();
      const tire = new THREE.Mesh(new THREE.TorusGeometry(0.41, 0.14, 8, 18), tireMat);
      tire.rotation.y = Math.PI / 2;
      const rim = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.24, 0.17, 16), rimMat);
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
      loader.load(
        this.referenceVehicleUrl,
        (gltf) => {
          if (this.finished || !this.vehicleRoot) {
            this.disposeObject(gltf.scene);
            resolve(false);
            return;
          }

          const THREE = this.requireThree();
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
          let box = new THREE.Box3().setFromObject(model);
          const size = new THREE.Vector3();
          box.getSize(size);
          const modelLength = Math.max(size.z, size.x, 1);
          const scale = 4.9 / modelLength;
          model.scale.setScalar(scale);
          model.updateMatrixWorld(true);

          box = new THREE.Box3().setFromObject(model);
          const center = new THREE.Vector3();
          box.getCenter(center);
          model.position.set(-center.x, -box.min.y, -center.z);
          model.rotation.y = this.referenceVehicleModelYawOffset;

          this.vehicleRoot.remove(this.fallbackVehicle);
          this.vehicleRoot.add(model);
          this.vehicleModel = model;
          this.fallbackVehicle = null;
          this.bindReferenceWheels(model);
          this.updateVehicleVisual(0, performance.now());
          resolve(true);
        },
        undefined,
        (error) => {
          console.warn('Unable to load reference driving vehicle model.', error);
          resolve(false);
        },
      );
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

    const THREE = this.requireThree();
    const scale = maxSize / sourceMax;
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(sourceWidth * scale));
    canvas.height = Math.max(1, Math.round(sourceHeight * scale));
    const ctx = canvas.getContext('2d');
    if (!ctx) return texture;
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);

    const capped = new THREE.CanvasTexture(canvas);
    capped.wrapS = texture.wrapS;
    capped.wrapT = texture.wrapT;
    capped.flipY = texture.flipY;
    capped.colorSpace = texture.colorSpace ?? THREE.SRGBColorSpace;
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

  private updateVehicleVisual(dt: number, time: number) {
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
  private loop(time: number, trial: TrialType<Info>, display_element: HTMLElement) {
    if (this.finished || !this.renderer || !this.scene || !this.camera) return;
    if (!display_element.isConnected) {
      this.finishTrial(trial, display_element, 'aborted');
      return;
    }

    const dt = Math.min(0.05, Math.max(0.001, (time - this.lastFrameTime) / 1000));
    this.lastFrameTime = time;
    this.fpsSamples.push(1 / dt);
    if (this.fpsSamples.length > 240) this.fpsSamples.shift();
    this.monitorRuntimePerformance(time);

    const input = this.readInput();
    const brakePressed = input.brake > 0.35;
    if (!this.laneResetActive && brakePressed && !this.lastBrakePressed) {
      this.handleBrakePressed(time);
    }
    this.lastBrakePressed = brakePressed;

    if (!this.laneResetActive) {
      this.updateVehicleFree(input, dt, time);
      this.updateTrafficLights(time);
      this.updateIntersections();
      this.activateScheduledHazards(time);
      this.updateHazards(time);
      this.updateAmbientTraffic(dt);
    } else {
      this.vehicleSpeed = 0;
      this.lastYawRate = 0;
      this.updateTrafficLights(time);
      this.updateAmbientTraffic(dt);
    }
    this.updateVehicleVisual(dt, time);
    this.updateCameraFree(dt);
    if (this.needsFirstFrameCameraSnap) {
      this.needsFirstFrameCameraSnap = false;
      this.snapCameraToVehicle();
    }
    this.updateHud();
    this.updateCockpitHud();
    this.updateMiniMap();
    this.updateRearviewMirrors(time);

    this.renderer.render(this.scene, this.camera);

    if (this.isTrialTimedOut(time, trial)) {
      SoundManager.playRunEnd();
      this.finishTrial(trial, display_element, 'timeout');
      return;
    }

    if (this.isDestinationReached()) {
      SoundManager.playRunEnd();
      this.finishTrial(trial, display_element, 'completed');
      return;
    }
    this.raf = requestAnimationFrame((nextTime) => this.loop(nextTime, trial, display_element));
  }

  private renderFirstFrameBeforeReveal(time: number) {
    if (!this.renderer || !this.scene || !this.camera) return;
    this.snapCameraToVehicle();
    this.needsFirstFrameCameraSnap = false;
    this.updateHud();
    this.updateCockpitHud();
    this.updateMiniMap();
    this.updateRearviewMirrors(time);
    this.renderer.render(this.scene, this.camera);
  }

  private isTrialTimedOut(time: number, trial: TrialType<Info>): boolean {
    const durationSec = Number((trial as any).driving_duration_sec ?? 80);
    const durationMs = Math.max(5_000, durationSec * 1000);
    return this.trialStartTime > 0 && time - this.trialStartTime >= durationMs;
  }

  private monitorRuntimePerformance(time: number) {
    if (this.performanceDowngraded || this.fpsSamples.length < 120) return;
    if (time - this.lastPerformanceCheckTime < 1500) return;
    this.lastPerformanceCheckTime = time;
    const recent = this.fpsSamples.slice(-120);
    const averageFps = recent.reduce((sum, fps) => sum + fps, 0) / recent.length;
    const threshold = this.renderQuality.level === 'high' ? 48 : 42;
    if (averageFps >= threshold) return;

    this.performanceDowngraded = true;
    this.disableSideRearviewMirrors();
    if (this.renderer) {
      const canvas = this.renderer.domElement;
      this.renderer.setPixelRatio(1);
      this.renderer.setSize(Math.max(1, canvas.clientWidth), Math.max(1, canvas.clientHeight), false);
    }
  }

  private disableSideRearviewMirrors() {
    this.sideRearviewMirrorsEnabled = false;
    for (const position of ['left', 'right'] as const) {
      const canvas = this.rearviewMirrorCanvases[position];
      const wrapper = canvas?.closest?.('[data-rearview-wrapper]');
      if (wrapper instanceof HTMLElement) wrapper.style.display = 'none';
      this.rearviewRenderTargets[position]?.dispose?.();
      delete this.rearviewRenderTargets[position];
      delete this.rearviewPixelBuffers[position];
    }
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
    SoundManager.playIncorrect();
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
      const shadow = this.createBlobShadowMesh(isScooter ? 1.25 : 3.55, isScooter ? 2.0 : 5.75, isScooter ? 0.28 : 0.36);
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
    const targetLateral = this.getCurrentVehicleLaneLateral();
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
    hazard.brakeTime = preheldBrake ? time : null;
    hazard.rt = null;
    hazard.preheldBrake = preheldBrake;
    hazard.collision = false;
    hazard.resolved = false;
    hazard.removeAt = null;
    hazard.currentDistance = hazardDistance;
    hazard.currentLateral = targetLateral;
    hazard.targetLateral = targetLateral;
    hazard.crossingStartLateral = crossingStartLateral;
    hazard.crossingEndLateral = crossingEndLateral;
    hazard.result.distance_m = Math.round(this.progress);
    hazard.result.rt_ms = null;
    hazard.result.valid = !preheldBrake;
    hazard.result.collision = false;
    hazard.result.brake_preheld = preheldBrake;
    hazard.result.response = preheldBrake ? 'invalid-preheld-brake' : 'pending';
    hazard.group.visible = true;
    hazard.group.position.set(point.x + point.normal.x * targetLateral, 0, point.z + point.normal.z * targetLateral);
    hazard.group.rotation.y = this.getSceneYawForDirection(point.dir);

    this.eventResults.push(hazard.result);
    this.flashRed();
    if (this.hud) this.hud.event.textContent = hazard.result.label;
  }

  private getHazardLeadDistance(id: HazardId): number {
    if (id === 'child-crossing') {
      return 42;
    }
    if (id === 'elder-stopped') {
      return 54;
    }
    if (id === 'drunk-driver') {
      return 130;
    }
    if (id === 'wrong-way-driver') {
      return 185;
    }
    if (id === 'plane-crash') {
      return 112;
    }
    return 38;
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
      let lateral = 0;

      if (hazard.template.id === 'child-crossing') {
        lateral = this.lerp(hazard.crossingStartLateral, hazard.crossingEndLateral, Math.min(1, age / 2600));
      } else if (hazard.template.id === 'drunk-driver') {
        lateral = hazard.targetLateral;
      } else if (hazard.template.id === 'wrong-way-driver') {
        const minimumWrongWayDistance = Math.max(0, hazard.triggerDistance - 62);
        hazard.currentDistance = Math.max(minimumWrongWayDistance, hazard.hazardDistance - age * 0.018);
        const movingPoint = this.getRoutePoint(hazard.currentDistance);
        hazard.group.position.set(
          movingPoint.x + movingPoint.normal.x * hazard.targetLateral,
          0,
          movingPoint.z + movingPoint.normal.z * hazard.targetLateral,
        );
        hazard.currentLateral = hazard.targetLateral;
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
      SoundManager.playIncorrect();
      this.vehicleSpeed = Math.min(this.vehicleSpeed, 2.5);
    } else {
      SoundManager.playCorrect();
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
        halfWidth: isScooter ? 0.55 : 1.05,
        halfLength: isScooter ? 0.95 : 2.0,
      };
      return this.boxesOverlap(vehicleBox, trafficBox);
    });
  }

  private recordCollisionEvent(time: number) {
    if (time - this.lastCollisionEventTime < 1200) return;
    this.lastCollisionEventTime = time;
    this.recordDrivingRuleEvent('vehicle-collision', 'collision', { collision: true });
    SoundManager.playIncorrect();
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
        return { halfWidth: 1.2, halfLength: 2.5 };
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
    if (!hazard || hazard.preheldBrake) return;
    hazard.brakeTime = time;
    hazard.rt = Math.round(time - hazard.startTime);
    hazard.result.rt_ms = hazard.rt;
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
    const THREE = this.requireThree();
    const group = new THREE.Group();
    const bodyMat = new THREE.MeshStandardMaterial({ color, roughness: 0.45, metalness: 0.18 });
    const darkMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.7, metalness: 0.08 });
    const metalMat = new THREE.MeshStandardMaterial({ color: 0xd1d5db, roughness: 0.36, metalness: 0.48 });

    const body = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.36, 1.55), bodyMat);
    body.position.y = 0.58;
    const seat = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.14, 0.72), darkMat);
    seat.position.set(0, 0.86, -0.08);
    const handle = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.08, 0.08), metalMat);
    handle.position.set(0, 1.02, -0.62);
    const front = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.72, 0.28), bodyMat);
    front.position.set(0, 0.76, -0.54);
    group.add(body, seat, handle, front);

    for (const z of [-0.62, 0.58]) {
      const wheel = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.065, 8, 16), darkMat);
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
    const THREE = this.requireThree();
    const group = new THREE.Group();
    const skin = new THREE.MeshStandardMaterial({ color: 0xf2c6a0, roughness: 0.78, metalness: 0.02 });
    const bodyMat = new THREE.MeshStandardMaterial({ color, roughness: 0.72, metalness: 0.02 });
    const dark = new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.7, metalness: 0.04 });
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.45 * scale, 8, 6), skin);
    head.position.y = 2.1 * scale;
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.8 * scale, 1.15 * scale, 0.45 * scale), bodyMat);
    body.position.y = 1.25 * scale;
    const leftArm = new THREE.Mesh(new THREE.BoxGeometry(0.16 * scale, 0.82 * scale, 0.16 * scale), bodyMat);
    leftArm.position.set(-0.52 * scale, 1.3 * scale, 0);
    leftArm.rotation.z = options.cane ? -0.25 : 0.38;
    const rightArm = new THREE.Mesh(new THREE.BoxGeometry(0.16 * scale, 0.82 * scale, 0.16 * scale), bodyMat);
    rightArm.position.set(0.52 * scale, 1.3 * scale, 0);
    rightArm.rotation.z = options.backpack ? -0.42 : 0.25;
    const leftLeg = new THREE.Mesh(new THREE.BoxGeometry(0.22 * scale, 0.9 * scale, 0.22 * scale), dark);
    leftLeg.position.set(-0.22 * scale, 0.45 * scale, 0);
    leftLeg.rotation.z = options.backpack ? 0.18 : 0;
    const rightLeg = new THREE.Mesh(new THREE.BoxGeometry(0.22 * scale, 0.9 * scale, 0.22 * scale), dark);
    rightLeg.position.set(0.22 * scale, 0.45 * scale, 0);
    rightLeg.rotation.z = options.backpack ? -0.18 : 0;
    group.add(head, body, leftArm, rightArm, leftLeg, rightLeg);
    if (options.backpack) {
      const packMat = new THREE.MeshStandardMaterial({ color: 0x2563eb, roughness: 0.62, metalness: 0.05 });
      const pack = new THREE.Mesh(new THREE.BoxGeometry(0.52 * scale, 0.68 * scale, 0.22 * scale), packMat);
      pack.position.set(0, 1.35 * scale, -0.34 * scale);
      group.add(pack);
    }
    if (options.cane) {
      const caneMat = new THREE.MeshStandardMaterial({ color: 0x7c4a2d, roughness: 0.66, metalness: 0.08 });
      const cane = new THREE.Mesh(new THREE.CylinderGeometry(0.035 * scale, 0.035 * scale, 1.35 * scale, 8), caneMat);
      cane.position.set(-0.68 * scale, 0.72 * scale, 0.18 * scale);
      cane.rotation.z = -0.16;
      group.add(cane);
    }
    return group;
  }

  private createCarMesh(color: number) {
    const group = new THREE.Group();
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
    const THREE = this.requireThree();
    const group = new THREE.Group();
    const bodyMat = new THREE.MeshBasicMaterial({ color: 0xd6dde4 });
    const wingMat = new THREE.MeshBasicMaterial({ color: 0x94a3b8 });
    const smokeMat = new THREE.MeshBasicMaterial({ color: 0x4b5563, transparent: true, opacity: 0.42 });
    const debrisMat = new THREE.MeshBasicMaterial({ color: 0x1f2937 });
    const body = new THREE.Mesh(new THREE.BoxGeometry(1.4, 1.2, 7), bodyMat);
    const wing = new THREE.Mesh(new THREE.BoxGeometry(8, 0.18, 1.4), wingMat);
    const tail = new THREE.Mesh(new THREE.BoxGeometry(4, 0.16, 1.1), wingMat);
    tail.position.z = -2.8;
    tail.position.y = 0.75;
    group.add(body, wing, tail);
    for (const [x, y, z, radius] of [
      [-1.7, 0.9, -3.3, 0.7],
      [1.6, 1.15, -3.9, 0.55],
      [0.2, 1.35, -4.6, 0.82],
    ] as const) {
      const smoke = new THREE.Mesh(new THREE.SphereGeometry(radius, 10, 8), smokeMat);
      smoke.position.set(x, y, z);
      group.add(smoke);
    }
    for (const [x, z, w] of [
      [-3.1, 2.8, 1.1],
      [2.8, 1.9, 0.8],
      [0.8, -3.8, 0.9],
    ] as const) {
      const debris = new THREE.Mesh(new THREE.BoxGeometry(w, 0.16, 0.42), debrisMat);
      debris.position.set(x, 0.12, z);
      debris.rotation.y = x * 0.7;
      group.add(debris);
    }
    group.scale.set(1.2, 1.2, 1.2);
    return group;
  }

  /* ================================================================
   * CAMERA - reference-style follow camera with view switching
   * ================================================================ */
  private updateCameraFree(dt: number) {
    if (!this.camera) return;

    const speedRatio = this.clamp(this.vehicleSpeed / this.maxVehicleSpeed, 0, 1);
    const clock = performance.now() / 1000;
    const firstPersonBob = this.cameraMode === 'first-person'
      ? (Math.sin(clock * 13.5) * 0.014 + Math.sin(clock * 21.0) * 0.006) * speedRatio
      : 0;
    const brakeNod = this.cameraMode === 'first-person' && this.lastBrakePressed
      ? this.lerp(0.012, 0.038, speedRatio)
      : 0;
    const forward = this.getForwardVector(this.vehicleHeading);
    const THREE = this.requireThree();
    const targetPosition = new THREE.Vector3();
    const lookAt = new THREE.Vector3();

    // vehicleX/Z is the single source of truth for the rendered and physical
    // vehicle center, so both camera modes stay centered on the same heading axis.
    if (this.cameraMode === 'third-person') {
      const distance = 9.0;
      const height = 3.35;
      targetPosition.set(
        this.vehicleX - forward.x * distance,
        height,
        this.vehicleZ - forward.z * distance,
      );
      lookAt.set(
        this.vehicleX + forward.x * 10.5,
        1.45,
        this.vehicleZ + forward.z * 10.5,
      );
    } else {
      targetPosition.set(
        this.vehicleX + forward.x * this.firstPersonCameraForwardOffset,
        this.firstPersonCameraHeight + firstPersonBob - brakeNod,
        this.vehicleZ + forward.z * this.firstPersonCameraForwardOffset,
      );
      lookAt.set(
        this.vehicleX + forward.x * this.firstPersonCameraLookAhead,
        this.firstPersonCameraLookHeight + firstPersonBob * 0.45 - brakeNod * 0.35,
        this.vehicleZ + forward.z * this.firstPersonCameraLookAhead,
      );
    }

    if (this.cameraMode === 'third-person') {
      const followResponse = 5.8;
      const t = 1 - Math.exp(-followResponse * dt);
      this.camera.position.lerp(targetPosition, t);
    } else {
      this.camera.position.copy(targetPosition);
    }
    this.camera.up.set(0, 1, 0);
    this.camera.lookAt(lookAt);

    const targetFov = this.cameraMode === 'third-person'
      ? this.baseCameraFov - 3
      : this.baseCameraFov + speedRatio * 2.4;
    this.cameraFov = this.expSmoothing(this.cameraFov, targetFov, 3.2, dt);
    if (Math.abs(this.camera.fov - this.cameraFov) > 0.01) {
      this.camera.fov = this.cameraFov;
      this.camera.updateProjectionMatrix();
    }
  }

  /**
   * Teleport the camera instantly to the correct follow position without lerp.
   * Use this after initScene() and lane resets so the next rendered frame already
   * shows the correct perspective instead of lerping from a stale camera pose.
   */
  private snapCameraToVehicle() {
    if (!this.camera) return;
    const THREE = this.requireThree();
    const forward = this.getForwardVector(this.vehicleHeading);
    const lookAt = new THREE.Vector3();

    if (this.cameraMode === 'third-person') {
      this.camera.position.set(
        this.vehicleX - forward.x * 9.0,
        3.35,
        this.vehicleZ - forward.z * 9.0,
      );
      lookAt.set(
        this.vehicleX + forward.x * 10.5,
        1.45,
        this.vehicleZ + forward.z * 10.5,
      );
    } else {
      this.camera.position.set(
        this.vehicleX + forward.x * this.firstPersonCameraForwardOffset,
        this.firstPersonCameraHeight,
        this.vehicleZ + forward.z * this.firstPersonCameraForwardOffset,
      );
      lookAt.set(
        this.vehicleX + forward.x * this.firstPersonCameraLookAhead,
        this.firstPersonCameraLookHeight,
        this.vehicleZ + forward.z * this.firstPersonCameraLookAhead,
      );
    }
    this.camera.up.set(0, 1, 0);
    this.camera.lookAt(lookAt);
    const targetFov = this.cameraMode === 'third-person' ? this.baseCameraFov - 3 : this.baseCameraFov;
    this.cameraFov = targetFov;
    this.camera.fov = targetFov;
    this.camera.updateProjectionMatrix();
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
    let gamepadName = '';

    if (this.keyState.left) steering -= 1;
    if (this.keyState.right) steering += 1;

    const gamepads = navigator.getGamepads?.() ?? [];
    const gamepad = Array.from(gamepads).find((pad): pad is Gamepad => Boolean(pad));
    this.gamepadConnected = Boolean(gamepad);
    if (this.controlMode === 'wheel' && gamepad) {
      gamepadName = gamepad.id;
      const axisSteering = Math.abs(gamepad.axes[0] ?? 0) > 0.08 ? gamepad.axes[0] : 0;
      const throttleButton = Math.max(gamepad.buttons[7]?.value ?? 0, gamepad.buttons[0]?.value ?? 0);
      const brakeButton = Math.max(gamepad.buttons[6]?.value ?? 0, gamepad.buttons[1]?.value ?? 0);
      const throttleAxis = this.normalizePedalAxis(gamepad.axes[2] ?? gamepad.axes[5] ?? 1);
      const brakeAxis = this.normalizePedalAxis(gamepad.axes[3] ?? gamepad.axes[4] ?? 1);
      steering = Math.abs(axisSteering) > Math.abs(steering) ? axisSteering : steering;
      throttle = Math.max(throttle, throttleButton, throttleAxis);
      brake = Math.max(brake, brakeButton, brakeAxis);
    }

    return {
      steering: Math.max(-1, Math.min(1, steering)),
      throttle: Math.max(0, Math.min(1, throttle)),
      brake: Math.max(0, Math.min(1, brake)),
      gamepadName,
    };
  }

  private getControlMode(value: unknown): DrivingControlMode {
    return value === 'wasd' || value === 'wheel' ? value : 'arrow';
  }

  private getLanguage(value: unknown): DrivingLanguage {
    return value === 'en' ? 'en' : 'zh';
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

  private normalizePedalAxis(value: number): number {
    if (!Number.isFinite(value)) return 0;
    return Math.max(0, Math.min(1, (1 - value) / 2));
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
    return this.clamp(this.initialRouteDistance, 2, Math.max(2, this.routeLength - 12));
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
    return Math.min(point.roadWidth / 2 - laneWidth / 2, laneWidth * 0.5);
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
    const { segment, index, local } = at;
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
    const blendDistance = 14;
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
  private finishTrial(trial: TrialType<Info>, display_element: HTMLElement, response: string) {
    if (this.finished) return;
    this.finished = true;

    const duration = this.trialStartTime > 0
      ? Math.round(performance.now() - this.trialStartTime)
      : 0;
    const validEvents = this.eventResults.filter((event) => event.valid);
    const validRts = validEvents
      .filter((event) => event.rt_ms !== null)
      .map((event) => event.rt_ms as number)
      .sort((a, b) => a - b);
    const averageRt = validRts.length
      ? Math.round(validRts.reduce((sum, rt) => sum + rt, 0) / validRts.length)
      : 0;
    const medianRt = validRts.length
      ? (validRts.length % 2
        ? validRts[Math.floor(validRts.length / 2)]
        : Math.round((validRts[validRts.length / 2 - 1] + validRts[validRts.length / 2]) / 2))
      : 0;
    const collisions = this.eventResults.filter((event) => event.collision).length;
    const averageFps = this.fpsSamples.length
      ? Math.round(this.fpsSamples.reduce((sum, fps) => sum + fps, 0) / this.fpsSamples.length)
      : 0;

    this.detachGlobalListeners();
    this.cleanupRenderResources();
    display_element.replaceChildren();

    this.jsPsych.finishTrial({
      rt: averageRt,
      correct: response === 'completed' && collisions === 0,
      target: this.text.deliveryTarget,
      response,
      duration_ms: duration,
      average_rt: averageRt,
      median_rt: medianRt,
      valid_event_count: validEvents.length,
      collisions,
      lane_deviations: this.laneDeviationCount,
      average_fps: averageFps,
      rendering_quality: this.renderQuality.level,
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
    if (this.resizeListener) {
      window.removeEventListener('resize', this.resizeListener);
      this.resizeListener = null;
    }
    if (this.gamepadConnectedListener) {
      window.removeEventListener('gamepadconnected', this.gamepadConnectedListener);
      this.gamepadConnectedListener = null;
    }
    if (this.gamepadDisconnectedListener) {
      window.removeEventListener('gamepaddisconnected', this.gamepadDisconnectedListener);
      this.gamepadDisconnectedListener = null;
    }
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
    cancelAnimationFrame(this.raf);
    this.clearLaneResetTimers();
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
    this.performanceDowngraded = false;
    this.lastPerformanceCheckTime = 0;
    this.sideRearviewMirrorsEnabled = true;
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
    this.rearviewMirrorUpdateIndex = 0;
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
    return THREE;
  }
}

export default ThreeDrivingRehabPlugin;

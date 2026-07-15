import { JsPsych, ParameterType } from 'jspsych';
import type { JsPsychPlugin, TrialType } from 'jspsych';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { typography } from '@rehab-trainer/ui/trainerTheme';
import { SoundManager } from '../../utils/soundManager';
import { DIFFICULTY_PRESETS, HAZARD_TEMPLATES } from './driving/driving-hazards';
import { DRIVING_ROUTE } from './driving/driving-route';
import { THREE, type ThreeModule } from './driving/driving-scene';
import { DRIVING_TEXT, type DrivingText } from './driving/driving-text';
import type {
  ActiveHazard,
  CollisionBox2D,
  CollisionFootprint,
  DifficultyPreset,
  DrivingControlMode,
  DrivingEventResult,
  DrivingInput,
  DrivingLanguage,
  HazardId,
  HazardTemplate,
  IntersectionZone,
  RoutePoint,
  RouteSegment,
  Vec2,
  VehicleResetPose,
} from './driving/types';

type DrivingCameraMode = 'third-person' | 'first-person';

interface VehicleWheelBinding {
  node: any;
  initialY: number;
  baseRotationX: number;
  baseRotationY: number;
  baseRotationZ: number;
  front: boolean;
}

const info = {
  name: 'three-driving-rehab',
  version: '3.0.0',
  parameters: {
    duration_ms: {
      type: ParameterType.INT,
      default: 90_000,
    },
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
  private wheelBindings: VehicleWheelBinding[] = [];
  private raf = 0;
  private finished = false;
  private routeLength = 0;
  private lastFrameTime = 0;
  private trialStartTime = 0;
  private fpsSamples: number[] = [];
  private activeHazards: ActiveHazard[] = [];
  private eventResults: DrivingEventResult[] = [];
  private hazardSpawnCount = 0;
  private lastBrakePressed = false;

  // Free-steering vehicle state
  private vehicleX = 0;
  private vehicleZ = 0;
  private vehicleHeading = 0; // radians, 0 = +Z direction
  private vehicleSpeed = 0;
  private steeringInput = 0;
  private frontWheelAngle = 0;
  private lastYawRate = 0;
  private progress = 0;        // projected distance along route (for hazards/HUD)
  private lateralOffset = 0;   // signed distance from route center (+ = right)
  private laneDeviationCount = 0;
  private laneDeviationActive = false;
  private laneDepartureStartTime: number | null = null;
  private lastInLanePose: VehicleResetPose | null = null;
  private laneDeparturePose: VehicleResetPose | null = null;
  private laneResetActive = false;
  private laneResetBlackoutTimer: number | null = null;
  private laneResetClearTimer: number | null = null;
  private cameraRoll = 0;
  private cameraFov = 68;
  private cameraMode: DrivingCameraMode = 'third-person';
  private wheelSpin = 0;
  private suspensionPhase = 0;

  // Random event scheduling
  private nextHazardDistance = 0;
  private hazardPool: HazardTemplate[] = [];

  // Intersection / turning state
  private intersections: IntersectionZone[] = [];

  // Difficulty
  private difficultyPreset: DifficultyPreset = DIFFICULTY_PRESETS.beginner;

  // Mini-map
  private miniMapCanvas: HTMLCanvasElement | null = null;
  private miniMapCtx: CanvasRenderingContext2D | null = null;

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
  private gameOverOverlay: HTMLDivElement | null = null;

  private hud: {
    status: HTMLDivElement;
    speed: HTMLDivElement;
    distance: HTMLDivElement;
    view?: HTMLDivElement;
    event: HTMLDivElement;
    redFlash: HTMLDivElement;
    blackout?: HTMLDivElement;
    cockpit?: HTMLDivElement;
    inputBars?: HTMLDivElement;
    miniMapWrapper?: HTMLDivElement;
  } | null = null;

  private roadCollisionBoxes: CollisionBox2D[] = [];
  private buildingCollisionBoxes: CollisionBox2D[] = [];

  private readonly roadWidth = 16;
  private readonly laneOffset = 4.0;
  private readonly vehicleHalfWidth = 1.05;
  private readonly vehicleHalfLength = 2.2;
  private readonly wheelBase = 2.72;
  private readonly maxVehicleSpeed = 18;
  private readonly baseCameraFov = 68;
  private readonly sidewalkWidth = 3;
  private readonly buildingRoadGap = 1.2;
  private readonly buildingRoadMargin = 0.35;
  private readonly buildingIntersectionClearance = 24;
  private readonly laneDeviationLimit = 7.0;
  private readonly laneDeviationGraceMs = 1500;
  private readonly laneResetBlackoutMs = 180;
  private readonly laneResetHoldMs = 220;
  private readonly referenceRoadWidth = 16;
  private readonly referenceVehicleUrl = '/assets/driving/reference-car-game/vehicals/car.glb';
  private readonly referenceRoadTextureUrl = '/assets/driving/reference-car-game/road.jpg';
  private readonly referenceRoadNormalUrl = '/assets/driving/reference-car-game/road_normal.jpg';
  private readonly referenceRoadRoughnessUrl = '/assets/driving/reference-car-game/road_roughness.jpg';

  private readonly route: RouteSegment[] = [...DRIVING_ROUTE];
  private readonly hazardTemplates: HazardTemplate[] = [...HAZARD_TEMPLATES];

  constructor(private jsPsych: JsPsych) {
    this.routeLength = this.route.reduce((sum, segment) => sum + segment.length, 0);
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
    });
    display_element.appendChild(root);
    root.focus();

    const startDriving = () => {
      if (this.finished || this.renderer) return;
      try {
        this.initScene(root);
        this.initHud(root, trial.red_flash_enabled ?? true);
        this.trialStartTime = performance.now();
        this.lastFrameTime = this.trialStartTime;
        this.lastBrakePressed = this.readInput().brake > 0.35;
        this.raf = requestAnimationFrame((time) => this.loop(time, trial, display_element));
      } catch (error) {
        console.error(error);
        this.finishTrial(trial, display_element, 'load-error');
      }
    };

    this.attachKeyboardListeners(() => {}, trial, display_element);
    this.attachGamepadListeners();
    startDriving();
  }

  private resetTrialState(trial?: TrialType<Info>) {
    this.cleanupRenderResources();
    this.finished = false;
    this.vehicleX = 0;
    this.vehicleZ = 2; // start a bit ahead of the route origin
    this.vehicleHeading = 0; // facing +Z
    this.vehicleSpeed = 0;
    this.steeringInput = 0;
    this.frontWheelAngle = 0;
    this.lastYawRate = 0;
    this.progress = 0;
    this.lateralOffset = 0;
    this.cameraRoll = 0;
    this.cameraFov = this.baseCameraFov;
    this.cameraMode = 'third-person';
    this.wheelSpin = 0;
    this.suspensionPhase = 0;
    this.trialStartTime = 0;
    this.lastFrameTime = 0;
    this.laneDeviationCount = 0;
    this.laneDeviationActive = false;
    this.laneDepartureStartTime = null;
    this.lastInLanePose = { x: this.vehicleX, z: this.vehicleZ, progress: this.progress, lateral: this.lateralOffset };
    this.laneDeparturePose = null;
    this.laneResetActive = false;
    this.clearLaneResetTimers();
    this.lastBrakePressed = false;
    this.fpsSamples = [];
    this.activeHazards = [];
    this.eventResults = [];
    this.hazardSpawnCount = 0;
    this.roadCollisionBoxes = [];
    this.buildingCollisionBoxes = [];
    this.keyState = { left: false, right: false, up: false, down: false };
    this.miniMapCanvas = null;
    this.miniMapCtx = null;
    this.gamepadConnected = Array.from(navigator.getGamepads?.() ?? []).some(Boolean);
    this.controlMode = this.getControlMode((trial as any)?.control_mode);
    this.language = this.getLanguage((trial as any)?.language);
    this.text = DRIVING_TEXT[this.language];
    this.gameOverOverlay = null;

    // Difficulty
    const diffKey = (trial as any)?.driving_difficulty ?? 'beginner';
    this.difficultyPreset = DIFFICULTY_PRESETS[diffKey] ?? DIFFICULTY_PRESETS.beginner;

    // Initialize hazard pool (shuffle order for randomness)
    this.hazardPool = [...this.hazardTemplates].sort(() => Math.random() - 0.5);

    // First hazard spawns between 30-65m
    this.nextHazardDistance = 30 + Math.random() * 35;

    // Build intersection zones from route
    this.intersections = [];
    let cumulativeDist = 0;
    for (let i = 0; i < this.route.length; i++) {
      cumulativeDist += this.route[i].length;
      if (i < this.route.length - 1) {
        const turnDir = this.getRouteTurn(this.route[i].dir, this.route[i + 1].dir);
        this.intersections.push({
          distance: cumulativeDist,
          segmentIndex: i,
          instruction: this.getTurnInstruction(turnDir),
          turnDir,
          entered: false,
          announced: false,
        });
      }
    }
  }

  /* ================================================================
   * CALIBRATION OVERLAY - redesigned: info items are NOT styled as buttons
   * ================================================================ */
  private createCalibrationOverlay(root: HTMLDivElement): HTMLDivElement {
    const overlay = document.createElement('div');
    Object.assign(overlay.style, {
      position: 'absolute',
      inset: '0',
      zIndex: '20',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '32px',
      background: 'linear-gradient(135deg, rgba(6, 22, 36, 0.96), rgba(20, 38, 52, 0.96))',
    });

    const text = this.text;
    const diffKey = this.getDifficultyLabel();

    const card = document.createElement('div');
    Object.assign(card.style, {
      width: 'min(760px, 100%)',
      border: '1px solid rgba(255,255,255,0.18)',
      borderRadius: '24px',
      padding: '40px 36px 32px',
      background: 'rgba(255,255,255,0.06)',
      boxShadow: '0 30px 90px rgba(0,0,0,0.36)',
    });

    const eyebrow = document.createElement('div');
    Object.assign(eyebrow.style, {
      fontSize: '13px',
      letterSpacing: '2px',
      textTransform: 'uppercase',
      color: '#7dd3fc',
      fontWeight: '700',
      marginBottom: '6px',
    });
    eyebrow.textContent = text.eyebrow;

    const title = document.createElement('h1');
    Object.assign(title.style, {
      fontSize: '34px',
      lineHeight: '1.15',
      margin: '0 0 16px',
      fontWeight: '800',
    });
    title.textContent = text.title;

    const intro = document.createElement('p');
    Object.assign(intro.style, {
      fontSize: '15px',
      lineHeight: '1.85',
      color: 'rgba(255,255,255,0.75)',
      margin: '0 0 28px',
    });
    intro.append(
      text.introA,
      this.createInlineStrong(text.routeMap, '#7dd3fc'),
      text.introB,
      document.createElement('br'),
      text.hazardIntroA,
      this.createInlineStrong(text.randomHazards, '#fbbf24'),
      text.hazardIntroB,
      `${text.difficultyLabel}: `,
      this.createInlineStrong(diffKey, '#38bdf8'),
    );

    const controls = document.createElement('div');
    Object.assign(controls.style, {
      display: 'grid',
      gridTemplateColumns: 'repeat(3, 1fr)',
      gap: '14px',
      marginBottom: '28px',
    });
    controls.append(
      this.createControlInfo(text.steering, this.getSteeringHint()),
      this.createControlInfo(text.throttle, this.getThrottleHint()),
      this.createControlInfo(text.emergencyBrake, this.getBrakeHint()),
    );

    const inputBars = document.createElement('div');
    inputBars.dataset.drivingInputBars = '';
    Object.assign(inputBars.style, { display: 'grid', gap: '10px', marginBottom: '22px' });

    const ready = document.createElement('div');
    ready.dataset.drivingReady = '';
    Object.assign(ready.style, {
      fontSize: '13px',
      color: 'rgba(255,255,255,0.55)',
      marginBottom: '22px',
    });
    ready.textContent = text.loading3d;

    const start = document.createElement('button');
    start.dataset.drivingStart = '';
    start.type = 'button';
    Object.assign(start.style, {
      width: '100%',
      minHeight: '58px',
      border: '0',
      borderRadius: '16px',
      background: 'linear-gradient(135deg, #38bdf8, #0ea5e9)',
      color: '#062338',
      fontSize: '18px',
      fontWeight: '800',
      cursor: 'pointer',
      boxShadow: '0 4px 20px rgba(56, 189, 248, 0.35)',
      transition: 'transform 0.12s, box-shadow 0.12s',
    });
    start.textContent = text.startMission;
    start.addEventListener('mouseenter', () => {
      start.style.transform = 'scale(1.02)';
      start.style.boxShadow = '0 6px 28px rgba(56, 189, 248, 0.45)';
    });
    start.addEventListener('mouseleave', () => {
      start.style.transform = 'scale(1)';
      start.style.boxShadow = '0 4px 20px rgba(56, 189, 248, 0.35)';
    });

    const hint = document.createElement('div');
    Object.assign(hint.style, {
      marginTop: '14px',
      textAlign: 'center',
      fontSize: '12px',
      color: 'rgba(255,255,255,0.42)',
    });
    hint.textContent = text.startHint;

    card.append(eyebrow, title, intro, controls, inputBars, ready, start, hint);
    overlay.appendChild(card);

    if (inputBars) this.hud = { status: document.createElement('div'), speed: document.createElement('div'), distance: document.createElement('div'), event: document.createElement('div'), redFlash: document.createElement('div'), inputBars };

    root.appendChild(overlay);
    return overlay;
  }

  private createInlineStrong(text: string, color: string): HTMLElement {
    const strong = document.createElement('b');
    strong.style.color = color;
    strong.textContent = text;
    return strong;
  }

  private createControlInfo(label: string, hint: string): HTMLElement {
    const item = document.createElement('div');
    Object.assign(item.style, {
      padding: '16px 14px',
      borderRadius: '14px',
      background: 'rgba(255,255,255,0.05)',
      border: '1px solid rgba(255,255,255,0.08)',
    });
    const title = document.createElement('div');
    Object.assign(title.style, {
      fontSize: '11px',
      letterSpacing: '1px',
      textTransform: 'uppercase',
      color: '#7dd3fc',
      fontWeight: '700',
      marginBottom: '6px',
    });
    title.textContent = label;
    const body = document.createElement('div');
    Object.assign(body.style, {
      fontSize: '14px',
      color: 'rgba(255,255,255,0.62)',
    });
    body.textContent = hint;
    item.append(title, body);
    return item;
  }

  private startCalibrationPreview(overlay: HTMLDivElement) {
    const update = () => {
      if (!overlay.isConnected || this.finished || this.renderer) return;
      const inputBars = overlay.querySelector<HTMLDivElement>('[data-driving-input-bars]');
      if (inputBars) {
        const input = this.readInput();
        inputBars.replaceChildren();
        inputBars.appendChild(this.createInputBar(this.text.steering, input.steering, -1, 1));
        inputBars.appendChild(this.createInputBar(this.text.throttle, input.throttle, 0, 1));
        inputBars.appendChild(this.createInputBar(this.text.brake, input.brake, 0, 1));
        const device = document.createElement('div');
        device.style.fontSize = '12px';
        device.style.color = 'rgba(255,255,255,0.50)';
        device.textContent = this.getInputDeviceText(input);
        inputBars.appendChild(device);
      }
      requestAnimationFrame(update);
    };
    requestAnimationFrame(update);
  }

  private createInputBar(label: string, value: number, min: number, max: number): HTMLDivElement {
    const wrapper = document.createElement('div');
    const normalized = Math.max(0, Math.min(1, (value - min) / (max - min)));
    const header = document.createElement('div');
    Object.assign(header.style, {
      display: 'flex',
      justifyContent: 'space-between',
      fontSize: '12px',
      color: 'rgba(255,255,255,0.60)',
      marginBottom: '4px',
    });
    const labelElement = document.createElement('span');
    labelElement.textContent = label;
    const valueElement = document.createElement('span');
    valueElement.textContent = value.toFixed(2);
    header.append(labelElement, valueElement);

    const track = document.createElement('div');
    Object.assign(track.style, {
      height: '6px',
      borderRadius: '999px',
      background: 'rgba(255,255,255,0.10)',
      overflow: 'hidden',
    });
    const fill = document.createElement('div');
    Object.assign(fill.style, {
      height: '100%',
      width: `${normalized * 100}%`,
      background: '#38bdf8',
      borderRadius: '999px',
    });
    track.appendChild(fill);
    wrapper.append(header, track);
    return wrapper;
  }

  private attachKeyboardListeners(
    onStart: () => void,
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
      if (event.code === 'Enter' || event.code === 'Space') onStart();
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
    this.scene.background = new THREE.Color(0x9bd5ef);
    this.scene.fog = new THREE.Fog(0x9bd5ef, 140, 460);

    const width = Math.max(1, root.clientWidth);
    const height = Math.max(1, root.clientHeight);
    this.camera = new THREE.PerspectiveCamera(this.baseCameraFov, width / height, 0.1, 520);

    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: false,
      powerPreference: 'high-performance',
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    this.renderer.setSize(width, height, false);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
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
    this.loadReferenceVehicleModel();
  }

  private createSceneEnvironment() {
    const THREE = this.requireThree();
    if (!this.scene) return;

    const ambient = new THREE.AmbientLight(0xffffff, 1.35);
    const sun = new THREE.DirectionalLight(0xffe7c2, 2.2);
    sun.position.set(38, 62, 26);
    sun.castShadow = true;
    sun.shadow.mapSize.width = 2048;
    sun.shadow.mapSize.height = 2048;
    sun.shadow.camera.left = -95;
    sun.shadow.camera.right = 95;
    sun.shadow.camera.top = 95;
    sun.shadow.camera.bottom = -95;
    sun.shadow.bias = -0.00012;

    const hemi = new THREE.HemisphereLight(0xa7d8ff, 0x2f7a4a, 0.9);
    this.scene.add(ambient, sun, hemi);
  }

  private initHud(root: HTMLDivElement, redFlashEnabled: boolean) {
    const hud = document.createElement('div');
    Object.assign(hud.style, {
      position: 'absolute',
      inset: '0',
      zIndex: '10',
      pointerEvents: 'none',
    });

    const top = document.createElement('div');
    Object.assign(top.style, {
      position: 'absolute',
      top: '18px',
      left: '18px',
      right: '18px',
      display: 'grid',
      gridTemplateColumns: '1.2fr auto auto auto',
      gap: '12px',
      alignItems: 'start',
      color: '#fff',
      textShadow: '0 2px 8px rgba(0,0,0,0.55)',
    });

    const status = this.createHudChip(this.text.taskDelivery);
    const speed = this.createHudChip('0 km/h');
    const distance = this.createHudChip('0 m');
    const view = this.createHudChip(this.getCameraModeText());
    top.append(status, speed, distance, view);

    const event = this.createHudChip(this.text.watchRoad);
    Object.assign(event.style, {
      position: 'absolute',
      top: '82px',
      left: '50%',
      transform: 'translateX(-50%)',
      minWidth: 'min(560px, calc(100vw - 48px))',
      textAlign: 'center',
      background: 'rgba(5, 17, 28, 0.52)',
    });

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

    // Create mini-map
    const miniMapWrapper = this.createMiniMap();

    const cockpit = this.createCockpitMask();
    hud.append(redFlash, cockpit, top, event, miniMapWrapper, blackout);
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
    dirLabel.textContent = `↑ ${this.text.straight}`;

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
    this.miniMapCanvas = canvas;
    this.miniMapCtx = canvas.getContext('2d');

    return wrapper;
  }

  /** Render the mini-map each frame */
  private updateMiniMap() {
    const ctx = this.miniMapCtx;
    const canvas = this.miniMapCanvas;
    if (!ctx || !canvas) return;

    const w = canvas.width;
    const h = canvas.height;
    const vehicleBox = this.getVehicleCollisionBox();
    const forward = this.getForwardVector(this.vehicleHeading);
    const right = this.getVisualRightVector(this.vehicleHeading);
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

      let first = true;
      for (let distance = from; distance <= to; distance += 3) {
        const point = this.getRoutePoint(distance);
        const screen = toScreen(point.x, point.z);
        if (first) {
          ctx.moveTo(screen.sx, screen.sy);
          first = false;
        } else {
          ctx.lineTo(screen.sx, screen.sy);
        }
      }

      const endPoint = this.getRoutePoint(to);
      const endScreen = toScreen(endPoint.x, endPoint.z);
      if (first) {
        ctx.moveTo(endScreen.sx, endScreen.sy);
      } else {
        ctx.lineTo(endScreen.sx, endScreen.sy);
      }
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
        ctx.fillText(nextInter.turnDir === 'right' ? '→' : nextInter.turnDir === 'left' ? '←' : '↑', screen.sx, screen.sy + 0.5);
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
    const pulse = 0.5 + 0.5 * Math.sin(performance.now() / 300);

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
    const dirLabel = this.hud?.miniMapWrapper?.querySelector('[data-minimap-dir]');
    if (dirLabel) {
      if (nextInter) {
        const dist = Math.round(nextInter.distance - this.progress);
        const arrow = nextInter.turnDir === 'right' ? '\u2192' : nextInter.turnDir === 'left' ? '\u2190' : '\u2191';
        dirLabel.textContent = `${arrow} ${this.format(this.text.turnAfterMeters, { dist, instruction: nextInter.instruction })}`;
      } else {
        dirLabel.textContent = `\u2191 ${this.text.straightToDestination}`;
      }
    }
  }

  private createHudChip(text: string): HTMLDivElement {
    const div = document.createElement('div');
    div.textContent = text;
    Object.assign(div.style, {
      padding: '10px 14px',
      borderRadius: '14px',
      border: '1px solid rgba(255,255,255,0.16)',
      background: 'rgba(5, 17, 28, 0.64)',
      backdropFilter: 'blur(8px)',
      fontSize: '14px',
      fontWeight: '700',
      lineHeight: '1.35',
    });
    return div;
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
      border: '18px solid rgba(9, 14, 18, 0.96)',
      borderBottom: '0',
      borderRadius: '140px 140px 0 0',
      boxShadow: '0 0 0 2px rgba(255,255,255,0.08), inset 0 8px 24px rgba(255,255,255,0.06)',
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

    cockpit.append(dash, wheel, leftPillar, rightPillar);
    return cockpit;
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
    const stopLineMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.68, metalness: 0.04 });
    const edgeMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.7,
      metalness: 0.08,
      emissive: 0xaa1111,
      emissiveIntensity: 0.24,
    });
    const postMat = new THREE.MeshStandardMaterial({ color: 0x575f68, roughness: 0.62, metalness: 0.42 });
    const railMat = new THREE.MeshStandardMaterial({
      color: 0xe03b3b,
      roughness: 0.58,
      metalness: 0.32,
      emissive: 0x8b1111,
      emissiveIntensity: 0.32,
    });
    const reflectorMat = new THREE.MeshStandardMaterial({
      color: 0xffb000,
      roughness: 0.35,
      metalness: 0.08,
      emissive: 0xff9500,
      emissiveIntensity: 0.8,
    });
    const grassMat = new THREE.MeshStandardMaterial({
      color: 0x4f8d55,
      roughness: 0.86,
      metalness: 0.02,
      dithering: true,
    });

    const ground = new THREE.Mesh(new THREE.PlaneGeometry(1000, 1000, 64, 64), grassMat);
    ground.rotation.x = -Math.PI / 2;
    ground.position.set(60, -0.52, 185);
    ground.receiveShadow = true;
    this.scene.add(ground);

    let segmentStartDistance = 0;
    for (const segment of this.route) {
      const mid = {
        x: segment.start.x + segment.dir.x * segment.length / 2,
        z: segment.start.z + segment.dir.z * segment.length / 2,
      };
      const angle = Math.atan2(segment.dir.x, segment.dir.z);
      const normal = { x: -segment.dir.z, z: segment.dir.x };

      const roadBase = new THREE.Mesh(new THREE.BoxGeometry(this.referenceRoadWidth + 0.44, 0.08, segment.length), roadBaseMat);
      roadBase.position.set(mid.x, -0.03, mid.z);
      roadBase.rotation.y = angle;
      roadBase.receiveShadow = true;
      this.scene.add(roadBase);

      const road = new THREE.Mesh(
        new THREE.BoxGeometry(this.referenceRoadWidth, 0.045, segment.length),
        this.createReferenceRoadMaterial(segment.length),
      );
      road.position.set(mid.x, 0.015, mid.z);
      road.rotation.y = angle;
      road.receiveShadow = true;
      this.scene.add(road);
      this.roadCollisionBoxes.push({
        centerX: mid.x,
        centerZ: mid.z,
        angle,
        halfWidth: this.roadWidth / 2,
        halfLength: segment.length / 2,
      });

      this.addRoadEdgeMarkings(segment, segmentStartDistance, angle, normal, edgeMat);

      for (let d = 12; d < segment.length; d += 18) {
        if (this.isNearIntersection(segmentStartDistance + d, 17)) continue;
        const center = {
          x: segment.start.x + segment.dir.x * d,
          z: segment.start.z + segment.dir.z * d,
        };
        const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.035, 7.2), centerLineMat);
        stripe.position.set(center.x, 0.045, center.z);
        stripe.rotation.y = angle;
        this.scene.add(stripe);
      }

      this.addReferenceRoadBarriers(segment, segmentStartDistance, angle, normal, postMat, railMat, reflectorMat);
      segmentStartDistance += segment.length;
    }

    this.addLeftDriveStopLines(stopLineMat);

    for (const inter of this.intersections) {
      const point = this.getRoutePoint(inter.distance);
      const cross = new THREE.Mesh(
        new THREE.BoxGeometry(76, 0.04, this.referenceRoadWidth),
        this.createReferenceRoadMaterial(76),
      );
      cross.position.set(point.x, 0.025, point.z);
      const crossAngle = Math.atan2(point.normal.x, point.normal.z);
      cross.rotation.y = crossAngle;
      cross.receiveShadow = true;
      this.scene.add(cross);
      this.roadCollisionBoxes.push({
        centerX: point.x,
        centerZ: point.z,
        angle: crossAngle,
        halfWidth: 38,
        halfLength: this.roadWidth / 2,
      });
    }

    this.addReferenceScenery();
    this.addTurnSignage();
    this.addDestinationMarker();
  }

  private addLeftDriveStopLines(material: any) {
    const THREE = this.requireThree();
    if (!this.scene) return;

    const laneWidth = this.roadWidth / 2 - 1.6;
    const stopLineSetback = 10.5;
    for (const inter of this.intersections) {
      const segment = this.route[inter.segmentIndex];
      if (!segment) continue;

      const localDistance = Math.max(1, segment.length - stopLineSetback);
      const normal = { x: -segment.dir.z, z: segment.dir.x };
      const angle = Math.atan2(segment.dir.x, segment.dir.z);
      const stopLine = new THREE.Mesh(new THREE.BoxGeometry(laneWidth, 0.052, 0.72), material);
      stopLine.position.set(
        segment.start.x + segment.dir.x * localDistance + normal.x * this.laneOffset,
        0.085,
        segment.start.z + segment.dir.z * localDistance + normal.z * this.laneOffset,
      );
      stopLine.rotation.y = angle;
      this.scene.add(stopLine);
    }
  }

  private addRoadEdgeMarkings(
    segment: RouteSegment,
    segmentStartDistance: number,
    angle: number,
    normal: Vec2,
    material: any,
  ) {
    const THREE = this.requireThree();
    if (!this.scene) return;

    const edgeLength = 10;
    for (let d = edgeLength / 2; d < segment.length; d += edgeLength + 1.5) {
      if (this.isNearIntersection(segmentStartDistance + d, 18)) continue;
      const center = {
        x: segment.start.x + segment.dir.x * d,
        z: segment.start.z + segment.dir.z * d,
      };
      for (const side of [-1, 1]) {
        const edge = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.055, edgeLength), material);
        edge.position.set(
          center.x + normal.x * side * (this.referenceRoadWidth / 2 - 0.1),
          0.06,
          center.z + normal.z * side * (this.referenceRoadWidth / 2 - 0.1),
        );
        edge.rotation.y = angle;
        this.scene.add(edge);
      }
    }
  }

  private createReferenceRoadMaterial(length: number) {
    const THREE = this.requireThree();
    const loader = new THREE.TextureLoader();
    const map = loader.load(this.referenceRoadTextureUrl);
    const normalMap = loader.load(this.referenceRoadNormalUrl);
    const roughnessMap = loader.load(this.referenceRoadRoughnessUrl);
    for (const texture of [map, normalMap, roughnessMap]) {
      texture.wrapS = THREE.RepeatWrapping;
      texture.wrapT = THREE.RepeatWrapping;
      texture.repeat.set(1.25, Math.max(1, length / 18));
    }
    map.colorSpace = THREE.SRGBColorSpace;
    return new THREE.MeshStandardMaterial({
      map,
      normalMap,
      roughnessMap,
      color: 0x686868,
      roughness: 0.84,
      metalness: 0.08,
    });
  }

  private addReferenceRoadBarriers(
    segment: RouteSegment,
    segmentStartDistance: number,
    angle: number,
    normal: Vec2,
    postMat: any,
    railMat: any,
    reflectorMat: any,
  ) {
    const THREE = this.requireThree();
    if (!this.scene) return;
    for (let d = 6; d < segment.length; d += 8) {
      if (this.isNearIntersection(segmentStartDistance + d, 22)) continue;
      const point = {
        x: segment.start.x + segment.dir.x * d,
        z: segment.start.z + segment.dir.z * d,
      };
      for (const side of [-1, 1]) {
        const x = point.x + normal.x * side * (this.referenceRoadWidth / 2 + 0.42);
        const z = point.z + normal.z * side * (this.referenceRoadWidth / 2 + 0.42);
        const post = new THREE.Mesh(new THREE.BoxGeometry(0.2, 1.0, 0.2), postMat);
        post.position.set(x, 0.48, z);
        post.castShadow = true;
        post.receiveShadow = true;
        this.scene.add(post);

        const rail = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.28, 6.0), railMat);
        rail.position.set(
          point.x + normal.x * side * (this.referenceRoadWidth / 2 + 0.52),
          0.78,
          point.z + normal.z * side * (this.referenceRoadWidth / 2 + 0.52),
        );
        rail.rotation.y = angle;
        rail.castShadow = true;
        this.scene.add(rail);

        const reflector = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.14, 0.18), reflectorMat);
        reflector.position.set(
          point.x + normal.x * side * (this.referenceRoadWidth / 2 + 0.2),
          0.82,
          point.z + normal.z * side * (this.referenceRoadWidth / 2 + 0.2),
        );
        reflector.rotation.y = angle;
        this.scene.add(reflector);
      }
    }
  }

  private addReferenceScenery() {
    const THREE = this.requireThree();
    if (!this.scene) return;
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x7c4f2f, roughness: 0.82 });
    const crownMats = [
      new THREE.MeshStandardMaterial({ color: 0x2f7d42, roughness: 0.85 }),
      new THREE.MeshStandardMaterial({ color: 0x3f9250, roughness: 0.82 }),
      new THREE.MeshStandardMaterial({ color: 0x276b3a, roughness: 0.88 }),
    ];
    const rockMat = new THREE.MeshStandardMaterial({ color: 0x7a838a, roughness: 0.9, metalness: 0.04 });

    for (let d = 20; d < this.routeLength - 8; d += 24) {
      if (this.isNearIntersection(d, 18)) continue;
      const point = this.getRoutePoint(d);
      for (const side of [-1, 1]) {
        const spread = 13 + ((d + side * 11) % 12);
        const x = point.x + point.normal.x * side * spread;
        const z = point.z + point.normal.z * side * spread;
        if (Math.floor(d / 24 + side) % 3 === 0) {
          const rock = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.9, 1.6), rockMat);
          rock.position.set(x, -0.08, z);
          rock.rotation.set(0.18, d * 0.03, -0.08);
          rock.castShadow = true;
          rock.receiveShadow = true;
          this.scene.add(rock);
          continue;
        }

        const tree = new THREE.Group();
        const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.34, 2.2, 8), trunkMat);
        trunk.position.y = 0.55;
        const crown = new THREE.Mesh(
          new THREE.ConeGeometry(1.8 + (d % 4) * 0.18, 3.4, 8),
          crownMats[Math.abs(Math.floor(d + side)) % crownMats.length],
        );
        crown.position.y = 2.8;
        tree.add(trunk, crown);
        tree.position.set(x, 0, z);
        tree.rotation.y = d * 0.07;
        tree.traverse?.((child: any) => {
          child.castShadow = true;
          child.receiveShadow = true;
        });
        this.scene.add(tree);
      }
    }
  }

  private addBuildings() {
    const THREE = this.requireThree();
    if (!this.scene) return;
    const colors = [0xb8c1cc, 0xd9b38c, 0x98b7a1, 0xc9a4a4, 0xb0a6cf];

    for (let d = 15; d < this.routeLength - 10; d += 20) {
      const point = this.getRoutePoint(d);
      for (const side of [-1, 1]) {
        const height = 7 + ((d * (side + 3)) % 13);
        const width = 8 + (d % 5);
        const depth = 8 + ((d + 3) % 6);
        if (this.isNearIntersection(d, this.buildingIntersectionClearance + depth / 2)) continue;

        const angle = Math.atan2(point.dir.x, point.dir.z);
        const setback = this.roadWidth / 2 + this.sidewalkWidth + this.buildingRoadGap + width / 2 + (d % 8);
        const centerX = point.x + point.normal.x * side * setback;
        const centerZ = point.z + point.normal.z * side * setback;
        const collisionBox: CollisionBox2D = {
          centerX,
          centerZ,
          angle,
          halfWidth: width / 2,
          halfLength: depth / 2,
        };
        if (!this.isBuildingFootprintClear(collisionBox)) continue;

        const color = colors[Math.floor((d + side * 7) % colors.length)];
        const material = new THREE.MeshBasicMaterial({ color });
        const building = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), material);
        building.position.set(centerX, height / 2, centerZ);
        building.rotation.y = angle;
        this.scene.add(building);
        this.buildingCollisionBoxes.push(collisionBox);
      }
    }
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
      const arrowLabel = inter.turnDir === 'right' ? '\u2192' : '\u2190';
      const texture = this.createSignTexture(arrowLabel);
      const arrowMat = new THREE.MeshBasicMaterial({ map: texture, transparent: true, depthWrite: false });
      const arrowPlane = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 1.4), arrowMat);
      arrowPlane.position.set(0, 4.2, 0.07);
      group.add(arrowPlane);

      // Place on the right side of the road for left-hand-drive traffic.
      group.position.set(
        point.x + point.normal.x * (this.roadWidth / 2 + 1),
        0,
        point.z + point.normal.z * (this.roadWidth / 2 + 1),
      );
      group.rotation.y = Math.atan2(point.dir.x, point.dir.z);
      this.scene.add(group);
    }
  }

  private createSignTexture(label: string) {
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
    group.position.set(point.x + point.normal.x * 6, 0, point.z + point.normal.z * 6);
    this.scene.add(group);
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
    this.updateVehicleVisual(0, performance.now());
  }

  private createFallbackVehicle(): { group: any; wheels: VehicleWheelBinding[] } {
    const THREE = this.requireThree();
    const group = new THREE.Group();
    group.name = 'driving-reference-fallback-car';

    const bodyMat = new THREE.MeshStandardMaterial({ color: 0x1d4ed8, roughness: 0.42, metalness: 0.26 });
    const glassMat = new THREE.MeshStandardMaterial({ color: 0x172554, roughness: 0.18, metalness: 0.12 });
    const tireMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.72, metalness: 0.12 });
    const rimMat = new THREE.MeshStandardMaterial({ color: 0xb9c2cc, roughness: 0.42, metalness: 0.55 });

    const body = new THREE.Mesh(new THREE.BoxGeometry(2.35, 0.82, 4.5), bodyMat);
    body.position.y = 0.78;
    body.castShadow = true;
    body.receiveShadow = true;
    const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.72, 0.82, 1.72), glassMat);
    cabin.position.set(0, 1.35, -0.26);
    cabin.castShadow = true;
    group.add(body, cabin);

    const wheels: VehicleWheelBinding[] = [];
    for (const [x, z, front] of [
      [-1.18, 1.45, true],
      [1.18, 1.45, true],
      [-1.18, -1.38, false],
      [1.18, -1.38, false],
    ] as const) {
      const wheel = new THREE.Group();
      const tire = new THREE.Mesh(new THREE.TorusGeometry(0.38, 0.13, 8, 18), tireMat);
      tire.rotation.y = Math.PI / 2;
      const rim = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.16, 16), rimMat);
      rim.rotation.z = Math.PI / 2;
      wheel.add(tire, rim);
      wheel.position.set(x, 0.42, z);
      wheel.castShadow = true;
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

  private loadReferenceVehicleModel() {
    const root = this.vehicleRoot;
    if (!root) return;

    const loader = new GLTFLoader();
    loader.load(
      this.referenceVehicleUrl,
      (gltf) => {
        if (this.finished || !this.vehicleRoot) {
          this.disposeObject(gltf.scene);
          return;
        }

        const THREE = this.requireThree();
        const model = gltf.scene;
        model.name = 'driving-reference-car-glb';
        model.traverse?.((child: any) => {
          child.castShadow = true;
          child.receiveShadow = true;
          const material = child.material;
          if (material) {
            const materials = Array.isArray(material) ? material : [material];
            for (const item of materials) {
              item.roughness = Math.min(0.78, item.roughness ?? 0.58);
              item.metalness = Math.max(0.08, item.metalness ?? 0.08);
            }
          }
        });

        model.updateMatrixWorld(true);
        let box = new THREE.Box3().setFromObject(model);
        const size = new THREE.Vector3();
        box.getSize(size);
        const modelLength = Math.max(size.z, size.x, 1);
        const scale = 4.65 / modelLength;
        model.scale.setScalar(scale);
        model.updateMatrixWorld(true);

        box = new THREE.Box3().setFromObject(model);
        const center = new THREE.Vector3();
        box.getCenter(center);
        model.position.set(-center.x, -box.min.y, -center.z);

        this.vehicleRoot.remove(this.fallbackVehicle);
        this.vehicleRoot.add(model);
        this.vehicleModel = model;
        this.fallbackVehicle = null;
        this.bindReferenceWheels(model);
      },
      undefined,
      (error) => {
        console.warn('Unable to load reference driving vehicle model.', error);
      },
    );
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
    this.suspensionPhase += dt * (4.6 + speedRatio * 7.5);
    this.wheelSpin += this.vehicleSpeed * dt * 2.7;
    const pitch = this.lastBrakePressed
      ? this.lerp(-0.012, -0.026, speedRatio)
      : this.lerp(0.004, -0.004, speedRatio);
    const roll = this.clamp(-this.steeringInput * 0.022 - this.lastYawRate * 0.018, -0.035, 0.035);

    this.vehicleRoot.position.set(vehicleBox.centerX, 0.018, vehicleBox.centerZ);
    this.vehicleRoot.rotation.set(
      pitch,
      this.vehicleHeading,
      roll,
    );

    for (const wheel of this.wheelBindings) {
      wheel.node.position.y = wheel.initialY;
      wheel.node.rotation.x = wheel.baseRotationX + this.wheelSpin;
      wheel.node.rotation.y = wheel.baseRotationY + (wheel.front ? this.frontWheelAngle * 0.72 : 0);
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

    const elapsed = time - this.trialStartTime;
    const input = this.readInput();
    const brakePressed = input.brake > 0.35;
    if (!this.laneResetActive && brakePressed && !this.lastBrakePressed) {
      this.handleBrakePressed(time);
    }
    this.lastBrakePressed = brakePressed;

    if (!this.laneResetActive) {
      this.updateVehicleFree(input, dt, time);
      this.updateIntersections();
      this.spawnRandomHazards(time);
      this.updateHazards(time);
    } else {
      this.vehicleSpeed = 0;
      this.lastYawRate = 0;
    }
    this.updateVehicleVisual(dt, time);
    this.updateCameraFree(dt);
    this.updateHud(trial.duration_ms ?? 90_000, elapsed);
    this.updateMiniMap();

    this.renderer.render(this.scene, this.camera);

    if (this.progress >= this.routeLength - 2) {
      SoundManager.playRunEnd();
      this.finishTrial(trial, display_element, 'completed');
      return;
    }
    if (elapsed >= (trial.duration_ms ?? 90_000)) {
      this.showGameOverOverlay(trial, display_element);
      return;
    }

    this.raf = requestAnimationFrame((nextTime) => this.loop(nextTime, trial, display_element));
  }

  private showGameOverOverlay(trial: TrialType<Info>, display_element: HTMLElement) {
    if (this.gameOverOverlay) return;
    this.detachGlobalListeners();

    const root = display_element.querySelector<HTMLDivElement>('.driving-rehab-root') ?? display_element;
    const overlay = document.createElement('div');
    overlay.tabIndex = 0;
    Object.assign(overlay.style, {
      position: 'absolute',
      inset: '0',
      zIndex: '30',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'rgba(2, 6, 23, 0.72)',
      color: '#fff',
      cursor: 'pointer',
      pointerEvents: 'auto',
      textAlign: 'center',
      fontFamily: typography.fontFamily,
    });
    const panel = document.createElement('div');
    Object.assign(panel.style, {
      display: 'grid',
      gap: '14px',
      justifyItems: 'center',
      padding: '32px',
    });
    const title = document.createElement('div');
    Object.assign(title.style, {
      fontSize: 'clamp(54px, 10vw, 112px)',
      lineHeight: '0.9',
      fontWeight: '900',
      letterSpacing: '0',
      color: '#f87171',
      textShadow: '0 10px 40px rgba(248,113,113,0.32)',
    });
    title.textContent = this.text.timeUp;
    const message = document.createElement('div');
    Object.assign(message.style, {
      fontSize: '18px',
      fontWeight: '700',
      color: 'rgba(255,255,255,0.88)',
    });
    message.textContent = this.text.timeoutMessage;
    const hint = document.createElement('div');
    Object.assign(hint.style, {
      fontSize: '14px',
      color: 'rgba(255,255,255,0.58)',
    });
    hint.textContent = this.text.timeoutHint;
    panel.append(title, message, hint);
    overlay.appendChild(panel);

    const finishTimeout = () => {
      overlay.removeEventListener('pointerdown', finishTimeout);
      this.gameOverOverlay = null;
      this.finishTrial(trial, display_element, 'timeout');
    };
    overlay.addEventListener('pointerdown', finishTimeout);
    root.appendChild(overlay);
    this.gameOverOverlay = overlay;
    overlay.focus();
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
    this.steeringInput = maxSteerAngle > 0
      ? this.clamp(this.frontWheelAngle / maxSteerAngle, -1, 1)
      : 0;

    // Kinematic bicycle model with speed-dependent steering. Keep enough grip at
    // medium speed so turns feel like road driving rather than a sliding camera.
    const lateralGrip = this.lerp(1.0, 0.84, Math.pow(speedRatio, 0.9));
    this.lastYawRate = this.vehicleSpeed > 0.03
      ? -(this.vehicleSpeed * Math.tan(this.frontWheelAngle) / this.wheelBase) * lateralGrip
      : 0;
    this.vehicleHeading += this.lastYawRate * dt;

    // Move forward in heading direction
    // heading=0 -> moving in +Z, heading=PI/2 -> moving in +X
    const forward = this.getForwardVector(this.vehicleHeading);
    this.vehicleX += forward.x * this.vehicleSpeed * dt;
    this.vehicleZ += forward.z * this.vehicleSpeed * dt;

    if (this.isVehicleCollidingWithBuilding()) {
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
    const proj = this.projectOntoRoute(vehicleBox.centerX, vehicleBox.centerZ);
    this.progress = proj.distance;
    this.lateralOffset = proj.lateral;

    // Lane deviation check - deviation is being too far from route center
    this.updateLaneDepartureState(Math.abs(this.lateralOffset) > this.laneDeviationLimit, time);
  }

  private updateLaneDepartureState(deviating: boolean, time: number) {
    const currentPose = this.getCurrentResetPose();

    if (deviating) {
      if (!this.laneDeviationActive) {
        this.laneDeviationCount += 1;
        this.laneDepartureStartTime = time;
        this.laneDeparturePose = this.lastInLanePose ?? currentPose;
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
    const routePoint = this.getRoutePoint(pose.progress);
    const safeLateral = this.clamp(
      pose.lateral,
      -this.laneDeviationLimit + this.vehicleHalfWidth,
      this.laneDeviationLimit - this.vehicleHalfWidth,
    );
    const resetHeading = this.getRouteHeading(pose.progress);
    const visualRight = this.getVisualRightVector(resetHeading);
    const vehicleCenterX = routePoint.x + routePoint.normal.x * safeLateral;
    const vehicleCenterZ = routePoint.z + routePoint.normal.z * safeLateral;

    this.vehicleX = vehicleCenterX - visualRight.x * this.laneOffset;
    this.vehicleZ = vehicleCenterZ - visualRight.z * this.laneOffset;
    this.vehicleHeading = resetHeading;
    this.vehicleSpeed = 0;
    this.frontWheelAngle = 0;
    this.steeringInput = 0;
    this.lastYawRate = 0;

    const vehicleBox = this.getVehicleCollisionBox();
    const projected = this.projectOntoRoute(vehicleBox.centerX, vehicleBox.centerZ);
    this.progress = projected.distance;
    this.lateralOffset = projected.lateral;
  }

  /** Project a world point onto the nearest point on the route.
   *  Returns the route distance and signed lateral offset (+ = right of road). */
  private projectOntoRoute(wx: number, wz: number): { distance: number; lateral: number } {
    let bestDist = Infinity;
    let bestRouteD = 0;
    let bestLateral = 0;
    let traveled = 0;

    for (const segment of this.route) {
      // Vector from segment start to world point
      const dx = wx - segment.start.x;
      const dz = wz - segment.start.z;

      // Project onto segment direction
      const dot = dx * segment.dir.x + dz * segment.dir.z;
      const clampedT = Math.max(0, Math.min(segment.length, dot));

      // Closest point on this segment
      const closestX = segment.start.x + segment.dir.x * clampedT;
      const closestZ = segment.start.z + segment.dir.z * clampedT;

      const distSq = (wx - closestX) ** 2 + (wz - closestZ) ** 2;
      if (distSq < bestDist) {
        bestDist = distSq;
        bestRouteD = traveled + clampedT;

        // With this +Z-forward scene convention, road-right is (-dir.z, dir.x).
        const normal = { x: -segment.dir.z, z: segment.dir.x };
        bestLateral = (wx - closestX) * normal.x + (wz - closestZ) * normal.z;
      }

      traveled += segment.length;
    }

    return { distance: bestRouteD, lateral: bestLateral };
  }

  /** Update intersection crossing detection */
  private updateIntersections() {
    for (const inter of this.intersections) {
      if (inter.entered) continue;

      const distToInter = inter.distance - this.progress;
      if (!inter.announced && distToInter < 50 && distToInter > 0) {
        inter.announced = true;
        if (this.hud && inter.turnDir) {
          const arrow = inter.turnDir === 'right' ? '\u2192' : '\u2190';
          this.hud.status.textContent = this.format(this.text.upcomingTurn, { instruction: inter.instruction, arrow });
        }
      }

      if (this.progress >= inter.distance) {
        inter.entered = true;
      }
    }
  }

  /** Spawn hazards at randomized distances */
  private spawnRandomHazards(time: number) {
    if (this.progress >= this.routeLength - 40) return;
    if (this.activeHazards.some((h) => !h.resolved)) return;
    if (this.progress < this.nextHazardDistance) return;

    // Pick next hazard from pool
    if (this.hazardPool.length === 0) {
      this.hazardPool = [...this.hazardTemplates].sort(() => Math.random() - 0.5);
    }
    const template = this.hazardPool.pop()!;
    const hazardLabel = this.getHazardLabel(template.id);
    this.hazardSpawnCount++;

    const input = this.readInput();
    const hazardDistance = Math.min(this.routeLength - 8, this.progress + this.difficultyPreset.hazardLeadDistance);
    const group = this.createHazardMesh(template.id);
    const point = this.getRoutePoint(hazardDistance);
    const targetLateral = this.getCurrentVehicleLaneLateral();
    const crossingSide = targetLateral >= 0 ? 1 : -1;
    const crossingStartLateral = crossingSide * (this.roadWidth / 2 + 0.8);
    const crossingEndLateral = -crossingSide * (this.roadWidth / 2 + 0.8);
    group.position.set(point.x + point.normal.x * targetLateral, 0, point.z + point.normal.z * targetLateral);
    group.rotation.y = Math.atan2(point.dir.x, point.dir.z);
    this.scene?.add(group);

    const preheldBrake = input.brake > 0.35;
    const result: DrivingEventResult = {
      event_id: template.id,
      label: hazardLabel,
      distance_m: Math.round(this.progress),
      rt_ms: null,
      valid: !preheldBrake,
      collision: false,
      brake_preheld: preheldBrake,
      response: preheldBrake ? 'invalid-preheld-brake' : 'pending',
    };

    const hazard: ActiveHazard = {
      template,
      group,
      triggerDistance: this.progress,
      hazardDistance,
      startTime: time,
      brakeTime: preheldBrake ? time : null,
      rt: null,
      preheldBrake,
      collision: false,
      resolved: false,
      removeAt: null,
      currentDistance: hazardDistance,
      currentLateral: targetLateral,
      targetLateral,
      crossingStartLateral,
      crossingEndLateral,
      result,
    };
    this.activeHazards.push(hazard);
    this.eventResults.push(result);
    this.flashRed();
    if (this.hud) this.hud.event.textContent = hazardLabel;

    // Schedule next hazard
    const { minHazardInterval, maxHazardInterval } = this.difficultyPreset;
    this.nextHazardDistance = this.progress + minHazardInterval + Math.random() * (maxHazardInterval - minHazardInterval);
  }

  private updateHazards(time: number) {
    const timeoutMs = this.difficultyPreset.hazardTimeoutMs;

    for (const hazard of this.activeHazards) {
      const age = time - hazard.startTime;
      const point = this.getRoutePoint(hazard.currentDistance);
      const baseY = hazard.template.id === 'plane-crash' ? Math.max(0.3, 18 - age * 0.018) : 0;
      let lateral = 0;

      if (hazard.template.id === 'child-crossing') {
        lateral = this.lerp(hazard.crossingStartLateral, hazard.crossingEndLateral, Math.min(1, age / 1800));
      } else if (hazard.template.id === 'drunk-driver') {
        lateral = hazard.targetLateral;
      } else if (hazard.template.id === 'wrong-way-driver') {
        hazard.currentDistance = Math.max(hazard.triggerDistance, hazard.hazardDistance - age * 0.012);
        const movingPoint = this.getRoutePoint(hazard.currentDistance);
        hazard.group.position.set(
          movingPoint.x + movingPoint.normal.x * hazard.targetLateral,
          0,
          movingPoint.z + movingPoint.normal.z * hazard.targetLateral,
        );
        hazard.currentLateral = hazard.targetLateral;
        hazard.group.rotation.y = Math.atan2(-movingPoint.dir.x, -movingPoint.dir.z);
      }

      if (hazard.template.id !== 'wrong-way-driver') {
        hazard.currentLateral = lateral;
        hazard.group.position.set(
          point.x + point.normal.x * lateral,
          baseY,
          point.z + point.normal.z * lateral,
        );
        hazard.group.rotation.y = Math.atan2(point.dir.x, point.dir.z) + (hazard.template.id === 'drunk-driver' ? Math.sin(age / 300) * 0.5 : 0);
      }

      if (hazard.template.id === 'plane-crash') {
        hazard.group.rotation.z = Math.min(1.15, age / 900);
      }

      const distanceToHazard = hazard.currentDistance - this.progress;
      const collisionNow = !hazard.resolved && this.isHazardColliding(hazard);
      const safeBrake = hazard.brakeTime !== null && this.vehicleSpeed < 2.4 && !collisionNow && distanceToHazard > -1;
      const passedHazard = !hazard.resolved && !collisionNow && this.hasPassedHazard(hazard);

      if (collisionNow) {
        this.resolveHazard(hazard, time, true, hazard.brakeTime ? 'collision-after-brake' : 'collision-no-brake');
      } else if (safeBrake) {
        this.resolveHazard(hazard, time, false, hazard.preheldBrake ? 'invalid-preheld-brake' : 'brake');
      } else if (passedHazard) {
        const response = hazard.preheldBrake
          ? 'invalid-preheld-brake'
          : hazard.brakeTime
            ? 'dodge-after-brake'
            : 'dodge';
        this.resolveHazard(hazard, time, false, response);
      }

      if (!hazard.resolved && age > timeoutMs && hazard.brakeTime !== null && this.vehicleSpeed < 2.4 && !collisionNow) {
        this.resolveHazard(hazard, time, false, hazard.preheldBrake ? 'invalid-preheld-brake' : 'brake');
      }

      if (hazard.removeAt !== null && time >= hazard.removeAt) {
        this.scene?.remove(hazard.group);
        this.disposeObject(hazard.group);
        hazard.removeAt = null;
      }
    }

    this.activeHazards = this.activeHazards.filter((hazard) => hazard.removeAt !== null || !hazard.resolved);
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

  private getVehicleCollisionBox(): CollisionBox2D {
    const right = this.getVisualRightVector(this.vehicleHeading);
    return {
      centerX: this.vehicleX + right.x * this.laneOffset,
      centerZ: this.vehicleZ + right.z * this.laneOffset,
      angle: this.vehicleHeading,
      halfWidth: this.vehicleHalfWidth,
      halfLength: this.vehicleHalfLength,
    };
  }

  private getCurrentVehicleLaneLateral(): number {
    const vehicleBox = this.getVehicleCollisionBox();
    const projected = this.projectOntoRoute(vehicleBox.centerX, vehicleBox.centerZ);
    const maxLaneLateral = this.roadWidth / 2 - this.vehicleHalfWidth;
    return this.clamp(projected.lateral, -maxLaneLateral, maxLaneLateral);
  }

  private getHazardCollisionBox(hazard: ActiveHazard): CollisionBox2D {
    const footprint = this.getHazardFootprint(hazard.template.id);
    return {
      centerX: hazard.group.position.x,
      centerZ: hazard.group.position.z,
      angle: hazard.group.rotation.y || 0,
      ...footprint,
    };
  }

  private getHazardFootprint(id: HazardId): CollisionFootprint {
    switch (id) {
      case 'child-crossing':
        return { halfWidth: 0.45, halfLength: 0.45 };
      case 'elder-stopped':
        return { halfWidth: 0.55, halfLength: 0.55 };
      case 'plane-crash':
        return { halfWidth: 4.8, halfLength: 4.2 };
      case 'drunk-driver':
      case 'wrong-way-driver':
        return { halfWidth: 1.35, halfLength: 2.25 };
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
    const hazard = this.activeHazards.find((item) => !item.resolved && item.brakeTime === null);
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
        return this.createPersonMesh(0xffd166, 0.72);
      case 'elder-stopped':
        return this.createPersonMesh(0xd9d9d9, 0.9);
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

  private createPersonMesh(color: number, scale: number) {
    const THREE = this.requireThree();
    const group = new THREE.Group();
    const skin = new THREE.MeshBasicMaterial({ color: 0xf2c6a0 });
    const bodyMat = new THREE.MeshBasicMaterial({ color });
    const dark = new THREE.MeshBasicMaterial({ color: 0x222222 });
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.45 * scale, 8, 6), skin);
    head.position.y = 2.1 * scale;
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.8 * scale, 1.15 * scale, 0.45 * scale), bodyMat);
    body.position.y = 1.25 * scale;
    const leftLeg = new THREE.Mesh(new THREE.BoxGeometry(0.22 * scale, 0.9 * scale, 0.22 * scale), dark);
    leftLeg.position.set(-0.22 * scale, 0.45 * scale, 0);
    const rightLeg = new THREE.Mesh(new THREE.BoxGeometry(0.22 * scale, 0.9 * scale, 0.22 * scale), dark);
    rightLeg.position.set(0.22 * scale, 0.45 * scale, 0);
    group.add(head, body, leftLeg, rightLeg);
    return group;
  }

  private createCarMesh(_color: number) {
    const group = new THREE.Group();
    const referenceCar = this.vehicleModel?.clone?.(true);
    if (referenceCar) {
      referenceCar.rotation.set(0, 0, 0);
      referenceCar.traverse?.((child: any) => {
        child.castShadow = true;
        child.receiveShadow = true;
      });
      group.add(referenceCar);
      return group;
    }

    const fallback = this.createFallbackVehicle();
    group.add(fallback.group);
    return group;
  }

  private createPlaneMesh() {
    const THREE = this.requireThree();
    const group = new THREE.Group();
    const bodyMat = new THREE.MeshBasicMaterial({ color: 0xd6dde4 });
    const wingMat = new THREE.MeshBasicMaterial({ color: 0x94a3b8 });
    const body = new THREE.Mesh(new THREE.BoxGeometry(1.4, 1.2, 7), bodyMat);
    const wing = new THREE.Mesh(new THREE.BoxGeometry(8, 0.18, 1.4), wingMat);
    const tail = new THREE.Mesh(new THREE.BoxGeometry(4, 0.16, 1.1), wingMat);
    tail.position.z = -2.8;
    tail.position.y = 0.75;
    group.add(body, wing, tail);
    group.scale.set(1.2, 1.2, 1.2);
    return group;
  }

  /* ================================================================
   * CAMERA - reference-style follow camera with view switching
   * ================================================================ */
  private updateCameraFree(dt: number) {
    if (!this.camera) return;

    const cabinSway = this.steeringInput * 0.08;
    const right = this.getVisualRightVector(this.vehicleHeading);
    const forward = this.getForwardVector(this.vehicleHeading);
    const vehicleBox = this.getVehicleCollisionBox();
    const THREE = this.requireThree();
    const targetPosition = new THREE.Vector3();
    const lookAt = new THREE.Vector3();

    if (this.cameraMode === 'third-person') {
      const distance = 9.0;
      const height = 3.35;
      targetPosition.set(
        vehicleBox.centerX - forward.x * distance + right.x * 0.45,
        height,
        vehicleBox.centerZ - forward.z * distance + right.z * 0.45,
      );
      lookAt.set(
        vehicleBox.centerX + forward.x * 10.5,
        1.45,
        vehicleBox.centerZ + forward.z * 10.5,
      );
    } else {
      const driverLeftOffset = -0.62;
      targetPosition.set(
        vehicleBox.centerX + forward.x * 0.45 + right.x * (driverLeftOffset + cabinSway),
        2.05,
        vehicleBox.centerZ + forward.z * 0.45 + right.z * (driverLeftOffset + cabinSway),
      );
      lookAt.set(
        vehicleBox.centerX + forward.x * 35 + right.x * (driverLeftOffset * 0.35 + this.steeringInput * 0.65),
        1.65,
        vehicleBox.centerZ + forward.z * 35 + right.z * (driverLeftOffset * 0.35 + this.steeringInput * 0.65),
      );
    }

    const followResponse = this.cameraMode === 'third-person' ? 5.8 : 9.5;
    const t = 1 - Math.exp(-followResponse * dt);
    this.camera.position.lerp(targetPosition, t);
    this.camera.lookAt(lookAt);

    const targetRoll = this.cameraMode === 'first-person'
      ? this.clamp(this.lastYawRate * 0.01, -0.014, 0.014)
      : 0;
    this.cameraRoll = this.expSmoothing(this.cameraRoll, targetRoll, 6.5, dt);
    if (this.cameraMode === 'first-person') this.camera.rotateZ(this.cameraRoll);

    const targetFov = this.cameraMode === 'third-person' ? this.baseCameraFov - 3 : this.baseCameraFov;
    this.cameraFov = this.expSmoothing(this.cameraFov, targetFov, 3.2, dt);
    if (Math.abs(this.camera.fov - this.cameraFov) > 0.01) {
      this.camera.fov = this.cameraFov;
      this.camera.updateProjectionMatrix();
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
  }

  private updateHud(durationMs: number, elapsedMs: number) {
    if (!this.hud) return;
    const remaining = Math.max(0, Math.ceil((durationMs - elapsedMs) / 1000));

    // Show navigation instruction with distance to next turn
    const nextInter = this.intersections.find((iz) => !iz.entered && this.progress < iz.distance);
    if (nextInter && nextInter.turnDir) {
      const dist = Math.round(nextInter.distance - this.progress);
      const arrow = nextInter.turnDir === 'right' ? '\u2192' : '\u2190';
      this.hud.status.textContent = this.format(this.text.navTurn, {
        dist,
        instruction: nextInter.instruction,
        arrow,
        remaining,
      });
    } else {
      this.hud.status.textContent = this.format(this.text.navStraight, { remaining });
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

  private getInputDeviceText(input: DrivingInput): string {
    if (this.controlMode === 'arrow') return this.text.controlArrow;
    if (this.controlMode === 'wasd') return this.text.controlWasd;
    if (!('getGamepads' in navigator)) return this.text.gamepadUnsupported;
    if (input.gamepadName) return this.format(this.text.gamepadConnected, { id: input.gamepadName });
    if (this.gamepadConnected) return this.text.gamepadWaiting;
    return this.text.wheelWaiting;
  }

  private getControlMode(value: unknown): DrivingControlMode {
    return value === 'wasd' || value === 'wheel' ? value : 'arrow';
  }

  private getLanguage(value: unknown): DrivingLanguage {
    return value === 'en' ? 'en' : 'zh';
  }

  private getDifficultyLabel(): string {
    if (this.difficultyPreset === DIFFICULTY_PRESETS.advanced) return this.text.difficultyAdvanced;
    if (this.difficultyPreset === DIFFICULTY_PRESETS.intermediate) return this.text.difficultyIntermediate;
    return this.text.difficultyBeginner;
  }

  private getSteeringHint(): string {
    if (this.controlMode === 'wasd') return this.text.wasdSteerHint;
    if (this.controlMode === 'wheel') return this.text.wheelSteerHint;
    return this.text.arrowSteerHint;
  }

  private getThrottleHint(): string {
    if (this.controlMode === 'wasd') return this.text.wasdThrottleHint;
    if (this.controlMode === 'wheel') return this.text.wheelThrottleHint;
    return this.text.arrowThrottleHint;
  }

  private getBrakeHint(): string {
    if (this.controlMode === 'wasd') return this.text.wasdBrakeHint;
    if (this.controlMode === 'wheel') return this.text.wheelBrakeHint;
    return this.text.arrowBrakeHint;
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

  private getForwardVector(angle: number): Vec2 {
    return { x: Math.sin(angle), z: Math.cos(angle) };
  }

  private getVisualRightVector(angle: number): Vec2 {
    return { x: -Math.cos(angle), z: Math.sin(angle) };
  }

  private getBoxWidthAxis(angle: number): Vec2 {
    return this.getVisualRightVector(angle);
  }

  /* ================================================================
   * ROUTE HELPERS (used for hazard placement, minimap, etc.)
   * ================================================================ */
  private getRouteHeading(distance: number): number {
    const point = this.getRoutePoint(distance);
    return Math.atan2(point.dir.x, point.dir.z);
  }

  private getRoutePoint(distance: number): RoutePoint {
    const clamped = Math.max(0, Math.min(this.routeLength, distance));
    let traveled = 0;
    for (let i = 0; i < this.route.length; i += 1) {
      const segment = this.route[i];
      if (clamped <= traveled + segment.length || i === this.route.length - 1) {
        const local = Math.max(0, Math.min(segment.length, clamped - traveled));
        const dir = this.getSmoothedDirection(i, local);
        const normal = { x: -dir.z, z: dir.x };
        return {
          x: segment.start.x + segment.dir.x * local,
          z: segment.start.z + segment.dir.z * local,
          dir,
          normal,
          segmentIndex: i,
          localDistance: local,
        };
      }
      traveled += segment.length;
    }
    const last = this.route[this.route.length - 1];
    return {
      x: last.start.x + last.dir.x * last.length,
      z: last.start.z + last.dir.z * last.length,
      dir: last.dir,
      normal: { x: -last.dir.z, z: last.dir.x },
      segmentIndex: this.route.length - 1,
      localDistance: last.length,
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
    const signedTurn = from.z * to.x - from.x * to.z;
    if (Math.abs(signedTurn) < 0.1) return null;
    return signedTurn > 0 ? 'left' : 'right';
  }

  private getTurnInstruction(turnDir: 'left' | 'right' | null): string {
    if (turnDir === 'left') return this.text.turnLeft;
    if (turnDir === 'right') return this.text.turnRight;
    return this.text.straight;
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
      duration_ms: duration > 0 ? duration : trial.duration_ms,
      average_rt: averageRt,
      median_rt: medianRt,
      valid_event_count: validEvents.length,
      collisions,
      lane_deviations: this.laneDeviationCount,
      average_fps: averageFps,
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
    this.gameOverOverlay?.remove();
    this.gameOverOverlay = null;
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
    this.vehicleRoot = null;
    this.vehicleModel = null;
    this.fallbackVehicle = null;
    this.wheelBindings = [];
    this.hud = null;
    this.miniMapCanvas = null;
    this.miniMapCtx = null;
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

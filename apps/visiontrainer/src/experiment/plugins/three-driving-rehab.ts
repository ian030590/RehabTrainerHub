import { JsPsych, ParameterType } from 'jspsych';
import type { JsPsychPlugin, TrialType } from 'jspsych';
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
    /** 'beginner' | 'intermediate' | 'advanced' – controls hazard reaction window */
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

  // ── Free-steering vehicle state ──
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
    event: HTMLDivElement;
    redFlash: HTMLDivElement;
    blackout?: HTMLDivElement;
    inputBars?: HTMLDivElement;
    miniMapWrapper?: HTMLDivElement;
  } | null = null;

  private roadCollisionBoxes: CollisionBox2D[] = [];
  private buildingCollisionBoxes: CollisionBox2D[] = [];

  private readonly roadWidth = 12;
  private readonly laneOffset = 1.5;
  private readonly vehicleHalfWidth = 1.05;
  private readonly vehicleHalfLength = 2.2;
  private readonly wheelBase = 2.85;
  private readonly maxVehicleSpeed = 18;
  private readonly baseCameraFov = 68;
  private readonly maxCameraFov = 76;
  private readonly sidewalkWidth = 3;
  private readonly buildingRoadGap = 1.2;
  private readonly buildingRoadMargin = 0.35;
  private readonly buildingIntersectionClearance = 24;
  private readonly laneDeviationLimit = 5.0;
  private readonly laneDeviationGraceMs = 1500;
  private readonly laneResetBlackoutMs = 180;
  private readonly laneResetHoldMs = 220;

  private readonly route: RouteSegment[] = [...DRIVING_ROUTE];
  private readonly hazardTemplates: HazardTemplate[] = [...HAZARD_TEMPLATES];

  constructor(private jsPsych: JsPsych) {
    this.routeLength = this.route.reduce((sum, segment) => sum + segment.length, 0);
  }

  trial(display_element: HTMLElement, trial: TrialType<Info>) {
    display_element.innerHTML = '';
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
      fontFamily: 'Inter, Noto Sans TC, sans-serif',
      userSelect: 'none',
    });
    display_element.appendChild(root);
    root.focus();

    const overlay = this.createCalibrationOverlay(root);
    const ready = overlay.querySelector<HTMLDivElement>('[data-driving-ready]');
    if (ready) ready.textContent = this.text.readyLoaded;

    this.attachKeyboardListeners(() => {
      void startDriving();
    }, trial, display_element);
    this.attachGamepadListeners();
    this.startCalibrationPreview(overlay);

    const startButton = overlay.querySelector<HTMLButtonElement>('[data-driving-start]');
    const startDriving = async () => {
      if (this.finished || this.renderer) return;
      startButton?.setAttribute('disabled', 'true');
      startButton && (startButton.textContent = this.text.loadingButton);
      try {
        overlay.remove();
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

    startButton?.addEventListener('click', () => {
      void startDriving();
    });
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
   * CALIBRATION OVERLAY – redesigned: info items are NOT styled as buttons
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

    overlay.innerHTML = `
      <div style="width:min(760px, 100%); border:1px solid rgba(255,255,255,0.18); border-radius:24px; padding:40px 36px 32px; background:rgba(255,255,255,0.06); box-shadow:0 30px 90px rgba(0,0,0,0.36);">

        <div style="font-size:13px; letter-spacing:2px; text-transform:uppercase; color:#7dd3fc; font-weight:700; margin-bottom:6px;">${text.eyebrow}</div>
        <h1 style="font-size:34px; line-height:1.15; margin:0 0 16px; font-weight:800;">${text.title}</h1>

        <p style="font-size:15px; line-height:1.85; color:rgba(255,255,255,0.75); margin:0 0 28px;">
          ${text.introA}<b style="color:#7dd3fc;">${text.routeMap}</b>${text.introB}<br>
          ${text.hazardIntroA}<b style="color:#fbbf24;">${text.randomHazards}</b>${text.hazardIntroB}
          ${text.difficultyLabel}: <b style="color:#38bdf8;">${diffKey}</b>
        </p>

        <!-- Controls info — styled as plain info, NOT as clickable buttons -->
        <div style="display:grid; grid-template-columns:repeat(3, 1fr); gap:14px; margin-bottom:28px;">
          <div style="padding:16px 14px; border-radius:14px; background:rgba(255,255,255,0.05); border:1px solid rgba(255,255,255,0.08);">
            <div style="font-size:11px; letter-spacing:1px; text-transform:uppercase; color:#7dd3fc; font-weight:700; margin-bottom:6px;">${text.steering}</div>
            <div style="font-size:14px; color:rgba(255,255,255,0.62);">${this.getSteeringHint()}</div>
          </div>
          <div style="padding:16px 14px; border-radius:14px; background:rgba(255,255,255,0.05); border:1px solid rgba(255,255,255,0.08);">
            <div style="font-size:11px; letter-spacing:1px; text-transform:uppercase; color:#7dd3fc; font-weight:700; margin-bottom:6px;">${text.throttle}</div>
            <div style="font-size:14px; color:rgba(255,255,255,0.62);">${this.getThrottleHint()}</div>
          </div>
          <div style="padding:16px 14px; border-radius:14px; background:rgba(255,255,255,0.05); border:1px solid rgba(255,255,255,0.08);">
            <div style="font-size:11px; letter-spacing:1px; text-transform:uppercase; color:#7dd3fc; font-weight:700; margin-bottom:6px;">${text.emergencyBrake}</div>
            <div style="font-size:14px; color:rgba(255,255,255,0.62);">${this.getBrakeHint()}</div>
          </div>
        </div>

        <div data-driving-input-bars style="display:grid; gap:10px; margin-bottom:22px;"></div>
        <div data-driving-ready style="font-size:13px; color:rgba(255,255,255,0.55); margin-bottom:22px;">${text.loading3d}</div>

        <button data-driving-start style="
          width:100%; min-height:58px; border:0; border-radius:16px;
          background:linear-gradient(135deg, #38bdf8, #0ea5e9);
          color:#062338; font-size:18px; font-weight:800; cursor:pointer;
          box-shadow:0 4px 20px rgba(56, 189, 248, 0.35);
          transition: transform 0.12s, box-shadow 0.12s;
        " onmouseenter="this.style.transform='scale(1.02)'; this.style.boxShadow='0 6px 28px rgba(56, 189, 248, 0.45)';"
           onmouseleave="this.style.transform='scale(1)'; this.style.boxShadow='0 4px 20px rgba(56, 189, 248, 0.35)';"
        >${text.startMission}</button>

        <div style="margin-top:14px; text-align:center; font-size:12px; color:rgba(255,255,255,0.42);">${text.startHint}</div>
      </div>
    `;

    const inputBars = overlay.querySelector<HTMLDivElement>('[data-driving-input-bars]');
    if (inputBars) this.hud = { status: document.createElement('div'), speed: document.createElement('div'), distance: document.createElement('div'), event: document.createElement('div'), redFlash: document.createElement('div'), inputBars };

    root.appendChild(overlay);
    return overlay;
  }

  private startCalibrationPreview(overlay: HTMLDivElement) {
    const update = () => {
      if (!overlay.isConnected || this.finished || this.renderer) return;
      const inputBars = overlay.querySelector<HTMLDivElement>('[data-driving-input-bars]');
      if (inputBars) {
        const input = this.readInput();
        inputBars.innerHTML = '';
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
    wrapper.innerHTML = `
      <div style="display:flex; justify-content:space-between; font-size:12px; color:rgba(255,255,255,0.60); margin-bottom:4px;">
        <span>${label}</span><span>${value.toFixed(2)}</span>
      </div>
      <div style="height:6px; border-radius:999px; background:rgba(255,255,255,0.10); overflow:hidden;">
        <div style="height:100%; width:${normalized * 100}%; background:#38bdf8; border-radius:999px;"></div>
      </div>
    `;
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
    this.scene.background = new THREE.Color(0x8fc7df);
    this.scene.fog = new THREE.Fog(0x8fc7df, 90, 260);

    const width = Math.max(1, root.clientWidth);
    const height = Math.max(1, root.clientHeight);
    this.camera = new THREE.PerspectiveCamera(this.baseCameraFov, width / height, 0.1, 520);

    this.renderer = new THREE.WebGLRenderer({
      antialias: false,
      alpha: false,
      powerPreference: 'high-performance',
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    this.renderer.setSize(width, height, false);
    this.renderer.shadowMap.enabled = false;
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

    this.buildWorld();
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
      gridTemplateColumns: '1.2fr auto auto',
      gap: '12px',
      alignItems: 'start',
      color: '#fff',
      textShadow: '0 2px 8px rgba(0,0,0,0.55)',
    });

    const status = this.createHudChip(this.text.taskDelivery);
    const speed = this.createHudChip('0 km/h');
    const distance = this.createHudChip('0 m');
    top.append(status, speed, distance);

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

    this.hud = { status, speed, distance, event, redFlash, blackout, miniMapWrapper };
  }

  /** Create the GPS-style mini-map navigation panel */
  private createMiniMap(): HTMLDivElement {
    const wrapper = document.createElement('div');
    Object.assign(wrapper.style, {
      position: 'absolute',
      bottom: '28px',
      right: '18px',
      width: '200px',
      height: '240px',
      borderRadius: '18px',
      overflow: 'hidden',
      border: '2px solid rgba(255,255,255,0.22)',
      background: 'rgba(8, 18, 28, 0.82)',
      backdropFilter: 'blur(12px)',
      boxShadow: '0 8px 32px rgba(0,0,0,0.45), 0 0 0 1px rgba(56, 189, 248, 0.15)',
      zIndex: '15',
      display: 'flex',
      flexDirection: 'column',
    });

    // Title bar
    const titleBar = document.createElement('div');
    Object.assign(titleBar.style, {
      padding: '8px 12px',
      background: 'linear-gradient(180deg, rgba(56, 189, 248, 0.25), rgba(56, 189, 248, 0.08))',
      borderBottom: '1px solid rgba(255,255,255,0.12)',
      display: 'flex',
      alignItems: 'center',
      gap: '6px',
      fontSize: '11px',
      fontWeight: '700',
      color: '#7dd3fc',
      letterSpacing: '0.5px',
    });
    titleBar.innerHTML = `
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#38bdf8" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
        <polygon points="3 11 22 2 13 21 11 13 3 11"/>
      </svg>
      <span>${this.text.navigation}</span>
    `;

    // Direction instruction
    const dirLabel = document.createElement('div');
    dirLabel.setAttribute('data-minimap-dir', '');
    Object.assign(dirLabel.style, {
      padding: '6px 12px',
      fontSize: '13px',
      fontWeight: '700',
      color: '#fff',
      textAlign: 'center',
      background: 'rgba(56, 189, 248, 0.12)',
      borderBottom: '1px solid rgba(255,255,255,0.06)',
    });
    dirLabel.textContent = this.text.straight;

    // Canvas
    const canvas = document.createElement('canvas');
    canvas.width = 200;
    canvas.height = 172;
    Object.assign(canvas.style, {
      width: '100%',
      flex: '1',
    });

    wrapper.append(titleBar, dirLabel, canvas);
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

    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = 'rgba(12, 25, 38, 1)';
    ctx.fillRect(0, 0, w, h);

    // Compute bounding box
    let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
    for (const seg of this.route) {
      const endX = seg.start.x + seg.dir.x * seg.length;
      const endZ = seg.start.z + seg.dir.z * seg.length;
      minX = Math.min(minX, seg.start.x, endX);
      maxX = Math.max(maxX, seg.start.x, endX);
      minZ = Math.min(minZ, seg.start.z, endZ);
      maxZ = Math.max(maxZ, seg.start.z, endZ);
    }

    const padding = 24;
    const rangeX = maxX - minX || 1;
    const rangeZ = maxZ - minZ || 1;
    const scale = Math.min((w - padding * 2) / rangeX, (h - padding * 2) / rangeZ);
    const offsetX = (w - rangeX * scale) / 2;
    const offsetZ = (h - rangeZ * scale) / 2;

    const toScreen = (px: number, pz: number) => ({
      sx: offsetX + (px - minX) * scale,
      sy: offsetZ + (pz - minZ) * scale,
    });

    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // Road shadow
    ctx.strokeStyle = 'rgba(0,0,0,0.4)';
    ctx.lineWidth = 10;
    ctx.beginPath();
    for (let i = 0; i < this.route.length; i++) {
      const seg = this.route[i];
      const s = toScreen(seg.start.x, seg.start.z);
      const endX = seg.start.x + seg.dir.x * seg.length;
      const endZ = seg.start.z + seg.dir.z * seg.length;
      const e = toScreen(endX, endZ);
      if (i === 0) ctx.moveTo(s.sx, s.sy);
      ctx.lineTo(e.sx, e.sy);
    }
    ctx.stroke();

    // Road body
    ctx.strokeStyle = 'rgba(80, 95, 110, 0.9)';
    ctx.lineWidth = 7;
    ctx.beginPath();
    for (let i = 0; i < this.route.length; i++) {
      const seg = this.route[i];
      const s = toScreen(seg.start.x, seg.start.z);
      const endX = seg.start.x + seg.dir.x * seg.length;
      const endZ = seg.start.z + seg.dir.z * seg.length;
      const e = toScreen(endX, endZ);
      if (i === 0) ctx.moveTo(s.sx, s.sy);
      ctx.lineTo(e.sx, e.sy);
    }
    ctx.stroke();

    // Already-traveled portion
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.45)';
    ctx.lineWidth = 5;
    ctx.beginPath();
    let traveled = 0;
    let started = false;
    for (let i = 0; i < this.route.length; i++) {
      const seg = this.route[i];
      const s = toScreen(seg.start.x, seg.start.z);
      if (!started) {
        ctx.moveTo(s.sx, s.sy);
        started = true;
      } else {
        ctx.lineTo(s.sx, s.sy);
      }
      const segEnd = traveled + seg.length;
      if (this.progress <= segEnd) {
        const localD = Math.max(0, this.progress - traveled);
        const px = seg.start.x + seg.dir.x * localD;
        const pz = seg.start.z + seg.dir.z * localD;
        const p = toScreen(px, pz);
        ctx.lineTo(p.sx, p.sy);
        break;
      } else {
        const endX = seg.start.x + seg.dir.x * seg.length;
        const endZ = seg.start.z + seg.dir.z * seg.length;
        const e = toScreen(endX, endZ);
        ctx.lineTo(e.sx, e.sy);
      }
      traveled += seg.length;
    }
    ctx.stroke();

    // Intersection dots
    for (const inter of this.intersections) {
      const pt = this.getRoutePoint(inter.distance);
      const s = toScreen(pt.x, pt.z);
      ctx.fillStyle = inter.entered ? 'rgba(56, 189, 248, 0.4)' : 'rgba(250, 204, 21, 0.7)';
      ctx.beginPath();
      ctx.arc(s.sx, s.sy, 4, 0, Math.PI * 2);
      ctx.fill();
    }

    // Start marker (A)
    const startPt = toScreen(this.route[0].start.x, this.route[0].start.z);
    ctx.fillStyle = '#34d399';
    ctx.beginPath();
    ctx.arc(startPt.sx, startPt.sy, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 9px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('A', startPt.sx, startPt.sy);

    // Destination marker (B)
    const destPt = this.getRoutePoint(this.routeLength - 2);
    const destScreen = toScreen(destPt.x, destPt.z);
    ctx.fillStyle = '#f87171';
    ctx.beginPath();
    ctx.arc(destScreen.sx, destScreen.sy, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.fillText('B', destScreen.sx, destScreen.sy);

    // Current position (use actual vehicle XZ, not route-projected)
    const cs = toScreen(this.vehicleX, this.vehicleZ);
    const pulse = 0.5 + 0.5 * Math.sin(performance.now() / 300);

    // Pulse ring
    ctx.strokeStyle = `rgba(56, 189, 248, ${0.3 + pulse * 0.3})`;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(cs.sx, cs.sy, 6 + pulse * 3, 0, Math.PI * 2);
    ctx.stroke();

    // Player dot
    ctx.fillStyle = '#38bdf8';
    ctx.beginPath();
    ctx.arc(cs.sx, cs.sy, 4, 0, Math.PI * 2);
    ctx.fill();

    // Direction arrow from vehicle heading
    const arrowLen = 12;
    const ndx = Math.sin(this.vehicleHeading);
    const ndy = Math.cos(this.vehicleHeading);
    // Map world to screen: +X → +sx, +Z → +sy
    const screenDx = ndx * scale;
    const screenDy = ndy * scale;
    const screenLen = Math.hypot(screenDx, screenDy) || 1;
    const normDx = screenDx / screenLen;
    const normDy = screenDy / screenLen;

    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(cs.sx, cs.sy);
    ctx.lineTo(cs.sx + normDx * arrowLen, cs.sy + normDy * arrowLen);
    ctx.stroke();

    // Arrowhead
    const headLen = 5;
    const headAngle = Math.atan2(normDy, normDx);
    ctx.fillStyle = '#38bdf8';
    ctx.beginPath();
    ctx.moveTo(cs.sx + normDx * arrowLen, cs.sy + normDy * arrowLen);
    ctx.lineTo(
      cs.sx + normDx * arrowLen - headLen * Math.cos(headAngle - 0.5),
      cs.sy + normDy * arrowLen - headLen * Math.sin(headAngle - 0.5),
    );
    ctx.lineTo(
      cs.sx + normDx * arrowLen - headLen * Math.cos(headAngle + 0.5),
      cs.sy + normDy * arrowLen - headLen * Math.sin(headAngle + 0.5),
    );
    ctx.closePath();
    ctx.fill();

    // Update direction label
    const dirLabel = this.hud?.miniMapWrapper?.querySelector('[data-minimap-dir]');
    if (dirLabel) {
      const nextInter = this.intersections.find((iz) => !iz.entered && this.progress < iz.distance);
      if (nextInter) {
        const dist = Math.round(nextInter.distance - this.progress);
        const arrow = nextInter.turnDir === 'right' ? '➡️' : nextInter.turnDir === 'left' ? '⬅️' : '⬆️';
        dirLabel.textContent = `${arrow} ${this.format(this.text.turnAfterMeters, { dist, instruction: nextInter.instruction })}`;
      } else {
        dirLabel.textContent = `⬆️ ${this.text.straightToDestination}`;
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

    // Steering wheel offset slightly left for left-hand drive (Taiwan)
    const wheel = document.createElement('div');
    Object.assign(wheel.style, {
      position: 'absolute',
      left: 'calc(50% - 30px)',
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

    const roadMat = new THREE.MeshBasicMaterial({ color: 0x2f3438 });
    const sidewalkMat = new THREE.MeshBasicMaterial({ color: 0xb8b0a2 });
    const laneMat = new THREE.MeshBasicMaterial({ color: 0xf4e86d });
    const grassMat = new THREE.MeshBasicMaterial({ color: 0x6f9a63 });

    const ground = new THREE.Mesh(new THREE.PlaneGeometry(620, 620), grassMat);
    ground.rotation.x = -Math.PI / 2;
    ground.position.set(60, -0.02, 200);
    this.scene.add(ground);

    for (const segment of this.route) {
      const mid = {
        x: segment.start.x + segment.dir.x * segment.length / 2,
        z: segment.start.z + segment.dir.z * segment.length / 2,
      };
      const angle = Math.atan2(segment.dir.x, segment.dir.z);

      const road = new THREE.Mesh(new THREE.BoxGeometry(this.roadWidth, 0.04, segment.length), roadMat);
      road.position.set(mid.x, 0, mid.z);
      road.rotation.y = angle;
      this.scene.add(road);
      this.roadCollisionBoxes.push({
        centerX: mid.x,
        centerZ: mid.z,
        angle,
        halfWidth: this.roadWidth / 2,
        halfLength: segment.length / 2,
      });

      // Sidewalks
      const leftSidewalk = new THREE.Mesh(new THREE.BoxGeometry(this.sidewalkWidth, 0.08, segment.length), sidewalkMat);
      leftSidewalk.position.set(
        mid.x - segment.dir.z * (this.roadWidth / 2 + this.sidewalkWidth / 2),
        0.01,
        mid.z + segment.dir.x * (this.roadWidth / 2 + this.sidewalkWidth / 2),
      );
      leftSidewalk.rotation.y = angle;
      this.scene.add(leftSidewalk);

      const rightSidewalk = new THREE.Mesh(new THREE.BoxGeometry(this.sidewalkWidth, 0.08, segment.length), sidewalkMat);
      rightSidewalk.position.set(
        mid.x + segment.dir.z * (this.roadWidth / 2 + this.sidewalkWidth / 2),
        0.01,
        mid.z - segment.dir.x * (this.roadWidth / 2 + this.sidewalkWidth / 2),
      );
      rightSidewalk.rotation.y = angle;
      this.scene.add(rightSidewalk);

      // Center lane markings (yellow dashed center line)
      for (let d = 12; d < segment.length; d += 18) {
        const center = {
          x: segment.start.x + segment.dir.x * d,
          z: segment.start.z + segment.dir.z * d,
        };
        const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.035, 6), laneMat);
        stripe.position.set(center.x, 0.045, center.z);
        stripe.rotation.y = angle;
        this.scene.add(stripe);
      }
    }

    // Intersection cross-roads
    for (const inter of this.intersections) {
      const point = this.getRoutePoint(inter.distance);
      const cross = new THREE.Mesh(new THREE.BoxGeometry(76, 0.035, this.roadWidth), roadMat);
      cross.position.set(point.x, 0.025, point.z);
      const crossAngle = Math.atan2(point.normal.x, point.normal.z);
      cross.rotation.y = crossAngle;
      this.scene.add(cross);
      this.roadCollisionBoxes.push({
        centerX: point.x,
        centerZ: point.z,
        angle: crossAngle,
        halfWidth: 38,
        halfLength: this.roadWidth / 2,
      });
    }

    this.addBuildings();
    this.addTurnSignage();
    this.addDestinationMarker();
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
      const arrowLabel = inter.turnDir === 'right' ? '→' : '←';
      const texture = this.createSignTexture(arrowLabel);
      const arrowMat = new THREE.MeshBasicMaterial({ map: texture, transparent: true, depthWrite: false });
      const arrowPlane = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 1.4), arrowMat);
      arrowPlane.position.set(0, 4.2, 0.07);
      group.add(arrowPlane);

      // Place on right side of road (Taiwan drives on right)
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
      ctx.font = 'bold 92px sans-serif';
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
      fontFamily: 'Inter, Noto Sans TC, sans-serif',
    });
    overlay.innerHTML = `
      <div style="display:grid; gap:14px; justify-items:center; padding:32px;">
        <div style="font-size:clamp(54px, 10vw, 112px); line-height:0.9; font-weight:900; letter-spacing:0; color:#f87171; text-shadow:0 10px 40px rgba(248,113,113,0.32);">${this.text.timeUp}</div>
        <div style="font-size:18px; font-weight:700; color:rgba(255,255,255,0.88);">
          ${this.text.timeoutMessage}
        </div>
        <div style="font-size:14px; color:rgba(255,255,255,0.58);">
          ${this.text.timeoutHint}
        </div>
      </div>
    `;

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
    const throttleAccel = 7.5;
    const brakeDecel = 20;
    const rollingDrag = 1.7;
    const previousX = this.vehicleX;
    const previousZ = this.vehicleZ;
    const previousHeading = this.vehicleHeading;

    // Speed update
    this.vehicleSpeed += input.throttle * throttleAccel * dt;
    this.vehicleSpeed -= input.brake * brakeDecel * dt;
    this.vehicleSpeed -= rollingDrag * dt;
    this.vehicleSpeed = this.clamp(this.vehicleSpeed, 0, this.maxVehicleSpeed);

    const speedRatio = this.clamp(this.vehicleSpeed / this.maxVehicleSpeed, 0, 1);
    const maxSteerAngle = this.lerp(0.54, 0.16, Math.pow(speedRatio, 0.75));
    const targetWheelAngle = input.steering * maxSteerAngle;
    const steeringResponse = Math.abs(input.steering) > 0.01 ? 5.8 : 8.4;
    this.frontWheelAngle = this.expSmoothing(this.frontWheelAngle, targetWheelAngle, steeringResponse, dt);
    this.steeringInput = maxSteerAngle > 0
      ? this.clamp(this.frontWheelAngle / maxSteerAngle, -1, 1)
      : 0;

    // Kinematic bicycle model: no body rotation while stationary.
    this.lastYawRate = this.vehicleSpeed > 0.03
      ? -(this.vehicleSpeed * Math.tan(this.frontWheelAngle) / this.wheelBase)
      : 0;
    this.vehicleHeading += this.lastYawRate * dt;

    // Move forward in heading direction
    // heading=0 → moving in +Z, heading=PI/2 → moving in +X
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

    // Lane deviation check – deviation is being too far from route center
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

        // Lateral offset: cross product to get signed distance
        // normal = (-dir.z, dir.x) → positive on the left side
        // We want + = right for Taiwan driving, so negate
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
          const arrow = inter.turnDir === 'right' ? '→' : '←';
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

  private createCarMesh(color: number) {
    const THREE = this.requireThree();
    const group = new THREE.Group();
    const bodyMat = new THREE.MeshBasicMaterial({ color });
    const glassMat = new THREE.MeshBasicMaterial({ color: 0x1e3a5f });
    const tireMat = new THREE.MeshBasicMaterial({ color: 0x111111 });
    const body = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.9, 4.2), bodyMat);
    body.position.y = 0.75;
    const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.8, 1.7), glassMat);
    cabin.position.set(0, 1.35, -0.25);
    group.add(body, cabin);
    for (const x of [-1.25, 1.25]) {
      for (const z of [-1.35, 1.35]) {
        const wheel = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.55, 0.75), tireMat);
        wheel.position.set(x, 0.4, z);
        group.add(wheel);
      }
    }
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
   * CAMERA – follows vehicle world position & heading
   * Camera positioned slightly RIGHT of vehicle center (right-lane Taiwan driving)
   * ================================================================ */
  private updateCameraFree(dt: number) {
    if (!this.camera) return;

    const speedRatio = this.clamp(this.vehicleSpeed / this.maxVehicleSpeed, 0, 1);
    const cabinSway = this.steeringInput * 0.28;
    const right = this.getVisualRightVector(this.vehicleHeading);
    const forward = this.getForwardVector(this.vehicleHeading);

    // Right-lane offset: shift camera ~1.5m to the right of road center
    const camX = this.vehicleX + right.x * (this.laneOffset + cabinSway);
    const camZ = this.vehicleZ + right.z * (this.laneOffset + cabinSway);

    this.camera.position.set(camX, 2.15, camZ);

    // Look ahead in heading direction
    const lookDist = 35;
    const lookX = this.vehicleX + forward.x * lookDist + right.x * this.laneOffset;
    const lookZ = this.vehicleZ + forward.z * lookDist + right.z * this.laneOffset;
    this.camera.lookAt(lookX, 1.65, lookZ);

    const targetRoll = this.clamp(this.lastYawRate * 0.035, -0.052, 0.052);
    this.cameraRoll = this.expSmoothing(this.cameraRoll, targetRoll, 5.5, dt);
    this.camera.rotateZ(this.cameraRoll);

    const targetFov = this.baseCameraFov
      + (this.maxCameraFov - this.baseCameraFov) * Math.pow(speedRatio, 1.25);
    this.cameraFov = this.expSmoothing(this.cameraFov, targetFov, 3.2, dt);
    if (Math.abs(this.camera.fov - this.cameraFov) > 0.01) {
      this.camera.fov = this.cameraFov;
      this.camera.updateProjectionMatrix();
    }
  }

  private updateHud(durationMs: number, elapsedMs: number) {
    if (!this.hud) return;
    const remaining = Math.max(0, Math.ceil((durationMs - elapsedMs) / 1000));

    // Show navigation instruction with distance to next turn
    const nextInter = this.intersections.find((iz) => !iz.entered && this.progress < iz.distance);
    if (nextInter && nextInter.turnDir) {
      const dist = Math.round(nextInter.distance - this.progress);
      const arrow = nextInter.turnDir === 'right' ? '→' : '←';
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
    return { x: Math.cos(angle), z: -Math.sin(angle) };
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
    display_element.innerHTML = '';

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

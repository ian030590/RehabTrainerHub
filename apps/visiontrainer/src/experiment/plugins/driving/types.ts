export type DrivingControlMode = 'arrow' | 'wasd' | 'wheel';
export type DrivingLanguage = 'zh' | 'en';

export interface Vec2 {
  x: number;
  z: number;
}

export interface RouteSegment {
  start: Vec2;
  dir: Vec2;
  length: number;
}

export interface RoutePoint {
  x: number;
  z: number;
  dir: Vec2;
  normal: Vec2;
  segmentIndex: number;
  localDistance: number;
}

export interface DrivingInput {
  steering: number;
  throttle: number;
  brake: number;
  gamepadName: string;
}

export type HazardId = 'child-crossing' | 'plane-crash' | 'drunk-driver' | 'elder-stopped' | 'wrong-way-driver';

export interface HazardTemplate {
  id: HazardId;
}

export interface DrivingEventResult {
  event_id: HazardId;
  label: string;
  distance_m: number;
  rt_ms: number | null;
  valid: boolean;
  collision: boolean;
  brake_preheld: boolean;
  response: string;
}

export interface ActiveHazard {
  template: HazardTemplate;
  group: any;
  triggerDistance: number;
  hazardDistance: number;
  startTime: number;
  brakeTime: number | null;
  rt: number | null;
  preheldBrake: boolean;
  collision: boolean;
  resolved: boolean;
  removeAt: number | null;
  currentDistance: number;
  currentLateral: number;
  targetLateral: number;
  crossingStartLateral: number;
  crossingEndLateral: number;
  result: DrivingEventResult;
}

export interface CollisionFootprint {
  halfWidth: number;
  halfLength: number;
}

export interface CollisionBox2D extends CollisionFootprint {
  centerX: number;
  centerZ: number;
  angle: number;
}

export interface VehicleResetPose {
  x: number;
  z: number;
  progress: number;
  lateral: number;
}

export interface IntersectionZone {
  distance: number;
  segmentIndex: number;
  instruction: string;
  turnDir: 'left' | 'right' | null;
  entered: boolean;
  announced: boolean;
}

export interface DifficultyPreset {
  hazardTimeoutMs: number;
  hazardLeadDistance: number;
  minHazardInterval: number;
  maxHazardInterval: number;
}

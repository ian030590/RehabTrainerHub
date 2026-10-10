export type DrillId = 'bounce' | 'vertical' | 'horizontal' | 'random';
export type DifficultyId = 'beginner' | 'intermediate' | 'advanced';
export type HandChoice = 'any' | 'left' | 'right';
export type GamePhase = 'menu' | 'rules' | 'ready' | 'initializing' | 'playing' | 'results';
export interface MotorCortexRehabGameProps {
  onExit: () => void;
}
export interface DrillDefinition {
  id: DrillId;
  referenceName: string;
  accent: string;
}
export interface DifficultyDefinition {
  id: DifficultyId;
  radius: number;
  speed: number;
  holdMs: number;
}
export interface TargetState {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  level: number;
  holdTargetMs: number;
}
export interface HandState {
  x: number;
  y: number;
  visible: boolean;
  handedness: HandChoice | null;
  lastSeenAt: number;
}
export interface SessionMetrics {
  startedAt: number;
  lastTickAt: number;
  handVisibleMs: number;
  inTargetMs: number;
  successes: number;
  misses: number;
  currentHoldMs: number;
  bestHoldMs: number;
  streak: number;
  events: DrillEventRecord[];
}
export interface DrillEventRecord {
  Event_Number: number;
  Drill: string;
  Result: 'success' | 'interrupted';
  Time_Seconds: number;
  Hold_Seconds: number;
  Accuracy_Percent: number;
  Target_Size_Px: number;
  Adaptive_Level: number;
}
export interface SessionRecord {
  Test_Date: string;
  Participant_ID: string;
  Drill: string;
  Reference_Module: string;
  Difficulty: DifficultyId;
  Duration_Seconds: number;
  Tracking_Hand: HandChoice;
  Target_Size_Scale: number;
  Speed_Scale: number;
  Adaptive_Level: number;
  Accuracy_Percent: number;
  Hand_Visible_Percent: number;
  Successful_Reps: number;
  Interrupted_Holds: number;
  Best_Hold_Seconds: number;
  Event_Records: DrillEventRecord[];
}
export interface LiveState {
  timeRemaining: number;
  accuracy: number;
  visibility: number;
  successes: number;
  misses: number;
  currentHoldPercent: number;
  level: number;
  targetX: number;
  targetY: number;
  targetRadius: number;
  handX: number;
  handY: number;
  handVisible: boolean;
  insideTarget: boolean;
}

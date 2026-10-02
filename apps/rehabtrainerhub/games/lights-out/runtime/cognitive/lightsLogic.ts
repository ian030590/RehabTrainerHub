export type Difficulty = 'Beginner' | 'Intermediate' | 'Advanced';
export type GameResult = 'Victory' | 'Defeat';

export interface LightsOutState {
  kind: 'lights-out';
  size: number;
  lights: boolean[][];
  moves: number;
}

const configs: Record<Difficulty, { size: number; shuffles: number }> = {
  Beginner: { size: 3, shuffles: 8 },
  Intermediate: { size: 4, shuffles: 14 },
  Advanced: { size: 5, shuffles: 24 },
};

function ToggleLights(lights: boolean[][], row: number, col: number) {
  const size = lights.length;
  for (const [dy, dx] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]]) {
    const y = row + dy;
    const x = col + dx;
    if (y >= 0 && y < size && x >= 0 && x < size) lights[y][x] = !lights[y][x];
  }
}

export function IsLightsAutoSuccess(state: LightsOutState) {
  return state.lights.every(row => row.every(light => !light));
}

export function CreateLightsState(difficulty: Difficulty, random = Math.random): LightsOutState {
  const { size, shuffles } = configs[difficulty];
  const state: LightsOutState = {
    kind: 'lights-out', size, moves: 0,
    lights: Array.from({ length: size }, () => Array(size).fill(false)),
  };
  for (let i = 0; i < shuffles; i += 1) {
    ToggleLights(state.lights, Math.floor(random() * size), Math.floor(random() * size));
  }
  if (IsLightsAutoSuccess(state)) ToggleLights(state.lights, Math.floor(size / 2), Math.floor(size / 2));
  return state;
}

export function HandleLightsTap(state: LightsOutState, index: number, finishGame: (result: GameResult) => void) {
  if (!Number.isInteger(index) || index < 0 || index >= state.size * state.size) return;
  ToggleLights(state.lights, Math.floor(index / state.size), index % state.size);
  state.moves += 1;
  if (IsLightsAutoSuccess(state)) finishGame('Victory');
}

export function GetLightsTimedOutcome(state: LightsOutState, startedMs: number, nowMs: number, limitSec: number): GameResult | null {
  if (limitSec <= 0 || nowMs - startedMs < limitSec * 1000) return null;
  return IsLightsAutoSuccess(state) ? 'Victory' : 'Defeat';
}

export function BuildLightsResultData(state: LightsOutState, durationSec: number, result: GameResult) {
  return {
    Total_Duration_Seconds: durationSec,
    Moves: state.moves,
    Completed: result === 'Victory',
    Board_Size: state.size,
  };
}

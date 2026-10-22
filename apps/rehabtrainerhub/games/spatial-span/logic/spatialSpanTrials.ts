export interface SpatialSpanSegment { kind: 'practice' | 'forward' | 'reverse'; reverse: boolean; count: number }
export interface Level { load: number; errors: number }
export interface ScheduleEvent { at: number; state: 'count' | 'blank' | 'grid' | 'square'; cell?: number }

export const startLoad = 3;
export const practiceCount = 2;
export const countMs = 1000;

export function CreateRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

// Any square on the board, but never the one that just lit, as in the original.
export function CreateCells(count: number, boardSize: number, random: () => number): number[] {
  const cells: number[] = [];
  for (let index = 0; index < count; index++) {
    const previous = index ? cells[index - 1] : 0;
    const options = Array.from({ length: boardSize ** 2 }, (_, cell) => cell + 1).filter(cell => cell !== previous);
    cells.push(options[Math.floor(random() * options.length)]);
  }
  return cells;
}

// A correct answer adds a square. Every second error since the last drop removes one, down to 1.
export function NextLevel(level: Level, correct: boolean): Level {
  if (correct) return { load: level.load + 1, errors: level.errors };
  const errors = level.errors + 1;
  return errors === 2 ? { load: Math.max(1, level.load - 1), errors: 0 } : { load: level.load, errors };
}

// Practice uses 3 forward squares. Reverse starts again at 3 squares.
export function CreateSpatialSpanPlan(settings: { rounds: number; practice: boolean }): SpatialSpanSegment[] {
  const segments: SpatialSpanSegment[] = [];
  if (settings.practice) segments.push({ kind: 'practice', reverse: false, count: practiceCount });
  segments.push({ kind: 'forward', reverse: false, count: settings.rounds / 2 });
  segments.push({ kind: 'reverse', reverse: true, count: settings.rounds / 2 });
  return segments;
}

// The empty board shows for 1 s, then each square lights for the set time with no gap, as in the original.
export function CreateSquareSchedule(cells: number[], exposureMs: number): { events: ScheduleEvent[]; answerAt: number } {
  const events: ScheduleEvent[] = [{ at: 0, state: 'count' }, { at: countMs, state: 'blank' }, { at: 2 * countMs, state: 'grid' }];
  cells.forEach((cell, index) => events.push({ at: 3 * countMs + index * exposureMs, state: 'square', cell }));
  return { events, answerAt: 3 * countMs + cells.length * exposureMs };
}

export function IsRecallCorrect(sequence: number[], response: number[], reverse: boolean): boolean {
  const expected = reverse ? [...sequence].reverse() : sequence;
  return response.length === expected.length && expected.every((digit, index) => response[index] === digit);
}

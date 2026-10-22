export interface DigitSpanSegment { kind: 'practice' | 'forward' | 'reverse'; reverse: boolean; count: number }
export interface Level { load: number; errors: number }
export interface ScheduleEvent { at: number; state: 'count' | 'blank' | 'digit'; digit?: number }

export const startLoad = 3;
export const practiceCount = 2;
export const countMs = 1000;
export const gapMs = 200;

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

// As in the original, each digit differs from the previous one by more than 2, and the first is compared with 0.
export function CreateDigits(count: number, random: () => number): number[] {
  const digits: number[] = [];
  for (let index = 0; index < count; index++) {
    const previous = index ? digits[index - 1] : 0;
    const options = [1, 2, 3, 4, 5, 6, 7, 8, 9].filter(digit => Math.abs(digit - previous) > 2);
    digits.push(options[Math.floor(random() * options.length)]);
  }
  return digits;
}

// A correct answer adds a digit. Every second error since the last drop removes one, down to 1.
export function NextLevel(level: Level, correct: boolean): Level {
  if (correct) return { load: level.load + 1, errors: level.errors };
  const errors = level.errors + 1;
  return errors === 2 ? { load: Math.max(1, level.load - 1), errors: 0 } : { load: level.load, errors };
}

// Practice uses 3 forward digits. Reverse starts again at 3 digits.
export function CreateDigitSpanPlan(settings: { rounds: number; practice: boolean }): DigitSpanSegment[] {
  const segments: DigitSpanSegment[] = [];
  if (settings.practice) segments.push({ kind: 'practice', reverse: false, count: practiceCount });
  segments.push({ kind: 'forward', reverse: false, count: settings.rounds / 2 });
  segments.push({ kind: 'reverse', reverse: true, count: settings.rounds / 2 });
  return segments;
}

export function CreateDigitSchedule(digits: number[], exposureMs: number): { events: ScheduleEvent[]; answerAt: number } {
  const events: ScheduleEvent[] = [{ at: 0, state: 'count' }, { at: countMs, state: 'blank' }];
  digits.forEach((digit, index) => {
    const at = 2 * countMs + index * (exposureMs + gapMs);
    events.push({ at, state: 'digit', digit }, { at: at + exposureMs, state: 'blank' });
  });
  return { events, answerAt: 2 * countMs + digits.length * (exposureMs + gapMs) };
}

export function IsRecallCorrect(sequence: number[], response: number[], reverse: boolean): boolean {
  const expected = reverse ? [...sequence].reverse() : sequence;
  return response.length === expected.length && expected.every((digit, index) => response[index] === digit);
}

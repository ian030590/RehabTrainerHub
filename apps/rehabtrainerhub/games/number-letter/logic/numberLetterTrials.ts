import type { TrialStep } from './trialRun';

export type Answer = 'z' | 'm';
export type Position = 'topleft' | 'topright' | 'bottomright' | 'bottomleft';
export interface NumberLetterTrial { letter: string; number: number; position: Position; condition: 0 | 1 | 2; practice: boolean; switched: boolean | null }
export interface NumberLetterSegment { kind: 'practice' | 'number' | 'letter' | 'mixed'; condition: 0 | 1 | 2; trials: NumberLetterTrial[] }

export const consonants = 'GKMR';
export const vowels = 'AEIU';
export const letterCodes = consonants + vowels;
export const practiceLength = 12;
export const singleLength = 32;
export const clockwise: Position[] = ['topleft', 'topright', 'bottomright', 'bottomleft'];

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

const Pick = <T>(items: readonly T[], random: () => number) => items[Math.floor(random() * items.length)];
const IsTop = (position: Position) => position.startsWith('top');

// As in the original, a group (consonant or vowel, even or odd) is drawn first, then one item from it.
function Pair(random: () => number) {
  const letter = Pick([...Pick([consonants, vowels], random)], random);
  const number = Pick(Pick([[2, 4, 6, 8], [3, 5, 7, 9]], random), random);
  return { letter, number };
}

export function CorrectAnswer(trial: Pick<NumberLetterTrial, 'letter' | 'number' | 'position'>): Answer {
  if (IsTop(trial.position)) return trial.number % 2 ? 'z' : 'm';
  return vowels.includes(trial.letter) ? 'm' : 'z';
}

function Single(condition: 0 | 1, random: () => number): NumberLetterTrial[] {
  const sides: Position[] = condition === 0 ? ['topleft', 'topright'] : ['bottomleft', 'bottomright'];
  return Array.from({ length: singleLength }, () => ({ ...Pair(random), position: Pick(sides, random), condition, practice: false, switched: null }));
}

function Rotating(count: number, practice: boolean, random: () => number): NumberLetterTrial[] {
  const start = Math.floor(random() * 4);
  const positions = Array.from({ length: count }, (_, index) => clockwise[(start + index) % 4]);
  return positions.map((position, index) => ({ ...Pair(random), position, condition: 2, practice,
    switched: index ? IsTop(position) !== IsTop(positions[index - 1]) : null }));
}

// Number rule on top, then letter rule below, then the pair turns clockwise so the rule changes every two items.
// Shorter sessions shorten only the turning part.
export function CreateNumberLetterPlan(settings: { rounds: number; practice: boolean }, random: () => number): NumberLetterSegment[] {
  const segments: NumberLetterSegment[] = [];
  if (settings.practice) segments.push({ kind: 'practice', condition: 2, trials: Rotating(practiceLength, true, random) });
  segments.push({ kind: 'number', condition: 0, trials: Single(0, random) });
  segments.push({ kind: 'letter', condition: 1, trials: Single(1, random) });
  segments.push({ kind: 'mixed', condition: 2, trials: Rotating(settings.rounds - 2 * singleLength, false, random) });
  return segments;
}

export function CreateNumberLetterStep(trial: NumberLetterTrial, settings: { responseWindowMs: number }): TrialStep<NumberLetterTrial> {
  return { trial, timing: { lead: [], exposureMs: null, windowMs: settings.responseWindowMs || null, endOnResponse: true, feedbackMs: trial.practice ? 1000 : 0, gapMs: 150 } };
}

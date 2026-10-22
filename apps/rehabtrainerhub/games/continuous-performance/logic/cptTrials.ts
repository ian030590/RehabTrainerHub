import type { CptSettings } from '../settings';

export const trialKinds = { filler: 0, target: 1, cue: 2, ay: 3, bx: 4 } as const;
export type TrialKind = typeof trialKinds[keyof typeof trialKinds];
export interface CptTrial { letter: string; kind: TrialKind }

// I, O and Q are left out because they are easy to mistake for 1, 0 and O at a glance.
const fillerLetters = 'BCDEFGHJKLMNPRSTUVWYZ'.split('');

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

function Shuffle<T>(items: T[], random: () => number): T[] {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index--) {
    const swap = Math.floor(random() * (index + 1));
    [result[index], result[swap]] = [result[swap], result[index]];
  }
  return result;
}

// Picks filler letters so no letter shows twice in a row, including across the unit next to it.
function FillLetters(units: CptTrial[][], random: () => number): CptTrial[] {
  const trials: CptTrial[] = [];
  for (const unit of units) {
    for (const trial of unit) {
      if (trial.letter) { trials.push(trial); continue; }
      const previous = trials.at(-1)?.letter;
      const following = unit[unit.indexOf(trial) + 1]?.letter;
      const choices = fillerLetters.filter(letter => letter !== previous && letter !== following);
      trials.push({ ...trial, letter: choices[Math.floor(random() * choices.length)] });
    }
  }
  return trials;
}

const Filler = (kind: TrialKind = trialKinds.filler): CptTrial => ({ letter: '', kind });

export function CreateCptTrials(settings: Pick<CptSettings, 'variant' | 'trials' | 'targetPercent'>, random: () => number): CptTrial[] {
  const targets = Math.round(settings.trials * settings.targetPercent / 100);
  if (settings.variant === 'x') {
    // Each X goes into its own gap between fillers, so two X never sit side by side.
    const fillers = settings.trials - targets;
    const gaps = Shuffle(Array.from({ length: fillers + 1 }, (_, index) => index), random).slice(0, targets);
    const marked = new Set(gaps);
    const units: CptTrial[][] = [];
    for (let gap = 0; gap <= fillers; gap++) {
      if (marked.has(gap)) units.push([{ letter: 'X', kind: trialKinds.target }]);
      if (gap < fillers) units.push([Filler()]);
    }
    return FillLetters(units, random);
  }
  // A then X is the target; A then another letter and another letter then X are the near-misses.
  const nearMisses = Math.round(settings.trials * 5 / 100);
  const units: CptTrial[][] = [
    ...Array.from({ length: targets }, () => [{ letter: 'A', kind: trialKinds.cue }, { letter: 'X', kind: trialKinds.target }]),
    ...Array.from({ length: nearMisses }, () => [{ letter: 'A', kind: trialKinds.cue }, Filler(trialKinds.ay)]),
    ...Array.from({ length: nearMisses }, () => [Filler(), { letter: 'X', kind: trialKinds.bx }]),
  ] as CptTrial[][];
  const fillers = settings.trials - units.reduce((sum, unit) => sum + unit.length, 0);
  return FillLetters(Shuffle([...units, ...Array.from({ length: fillers }, () => [Filler()])], random), random);
}

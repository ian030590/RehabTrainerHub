export type Side = 'left' | 'right';
export type Shape = 'circle' | 'square';
export interface SimonTrial { shape: Shape; side: Side; answer: Side; congruent: boolean }

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

const combinations: [Shape, Side][] = [['circle', 'left'], ['circle', 'right'], ['square', 'left'], ['square', 'right']];

// The circle always means left and the square always means right; the side it appears on is irrelevant.
export function CreateSimonTrials(count: number, random: () => number): SimonTrial[] {
  const trials: SimonTrial[] = [];
  while (trials.length < count) {
    for (const [shape, side] of Shuffle(combinations, random)) {
      const answer: Side = shape === 'circle' ? 'left' : 'right';
      trials.push({ shape, side, answer, congruent: side === answer });
    }
  }
  return trials.slice(0, count);
}

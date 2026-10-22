export interface SartTrial { digit: number; noGo: boolean; size: number }

// Relative font sizes; varying the size keeps the digit's shape from becoming the cue.
export const digitSizes = [.7, .85, 1, 1.15, 1.3];

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

// Each block of nine holds every digit once, so the skip digit appears one time in nine.
export function CreateSartTrials(count: number, noGoDigit: number, random: () => number): SartTrial[] {
  const digits: number[] = [];
  while (digits.length < count) {
    const block = Shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9], random);
    if (block[0] === digits.at(-1)) [block[0], block[1]] = [block[1], block[0]];
    digits.push(...block);
  }
  return digits.slice(0, count).map(digit => ({
    digit, noGo: digit === noGoDigit, size: digitSizes[Math.floor(random() * digitSizes.length)],
  }));
}

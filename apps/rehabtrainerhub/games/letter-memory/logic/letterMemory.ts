export interface LetterMemoryBlock { practice: boolean; letters: string[] }

export const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
export const recallCount = 4;
export const practiceLengths = [5, 7];
export const lengths = [5, 7, 9, 11];
export const pauseMs = 500;

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

// Letters are drawn at random as in the original, except that a letter never follows itself:
// with no gap between letters, a repeat would look like one letter shown for twice as long.
function CreateLetters(length: number, random: () => number): string[] {
  const result: string[] = [];
  while (result.length < length) {
    const letter = letters[Math.floor(random() * letters.length)];
    if (letter !== result.at(-1)) result.push(letter);
  }
  return result;
}

// Practice: 5 then 7 letters. Counted lengths come in shuffled cycles of 5, 7, 9 and 11, so the end stays hard to predict.
export function CreateLetterMemoryBlocks(plan: { rounds: number; practice: boolean }, random: () => number): LetterMemoryBlock[] {
  const practice = plan.practice ? practiceLengths.map(length => ({ practice: true, letters: CreateLetters(length, random) })) : [];
  const counted: number[] = [];
  while (counted.length < plan.rounds) counted.push(...Shuffle(lengths, random));
  return [...practice, ...counted.slice(0, plan.rounds).map(length => ({ practice: false, letters: CreateLetters(length, random) }))];
}

export function ExpectedLetters(sequence: string[]): string[] { return sequence.slice(-recallCount); }

// As in the original, each letter counts when it is in its right place.
export function ScoreLetters(sequence: string[], response: string[]) {
  const expected = ExpectedLetters(sequence);
  const correctItems = expected.filter((letter, index) => response[index] === letter).length;
  return { correctItems, requiredItems: expected.length, correct: correctItems === expected.length && response.length === expected.length };
}

// A short pause, then the letters back to back.
export function CreateLetterSchedule(count: number, exposureMs: number): { events: { at: number; index: number | null }[]; answerAt: number } {
  const events: { at: number; index: number | null }[] = [{ at: 0, index: null }];
  for (let index = 0; index < count; index++) events.push({ at: pauseMs + index * exposureMs, index });
  return { events, answerAt: pauseMs + count * exposureMs };
}

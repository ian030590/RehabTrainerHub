// condition: -1 copy practice, 0 add 3, 1 subtract 3, 2 alternate (add first). question counts from 1 within its list.
export interface PlusMinusItem { condition: number; question: number; number: number }

export const conditions = [0, 1, 2];
export const practiceCount = 15;
export const listSize = 30;
export const maxDigits = 3;

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

// As in the original: 10 to 99 shuffled once, split into three lists of 30, and 15 copy numbers drawn from the same set.
// Shorter lists keep the start of each list.
export function CreatePlusMinusItems(plan: { itemsPerList: number; practice: boolean }, random: () => number): PlusMinusItem[] {
  const numbers = Shuffle(Array.from({ length: 90 }, (_, index) => index + 10), random);
  const practice = plan.practice ? Shuffle(numbers, random).slice(0, practiceCount).map((number, index) => ({ condition: -1, question: index + 1, number })) : [];
  return [...practice, ...conditions.flatMap(condition => numbers.slice(condition * listSize, condition * listSize + plan.itemsPerList)
    .map((number, index) => ({ condition, question: index + 1, number })))];
}

export function ExpectedAnswer(item: PlusMinusItem): number {
  if (item.condition === -1) return item.number;
  const add = item.condition === 0 || (item.condition === 2 && item.question % 2 === 1);
  return item.number + (add ? 3 : -3);
}

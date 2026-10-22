export type Category = 'animals' | 'colors' | 'countries' | 'distances' | 'metals' | 'relatives';
export interface KeepTrackWord { category: Category; word: string }
export interface KeepTrackBlock { practice: boolean; load: number; targets: Category[]; words: KeepTrackWord[] }
type Label = { zh: string; en: string };

export const categories: Category[] = ['animals', 'colors', 'countries', 'distances', 'metals', 'relatives'];
export const exemplars: Record<Category, string[]> = {
  animals: ['fish', 'bird', 'snake', 'cow', 'whale'],
  colors: ['red', 'yellow', 'green', 'blue', 'brown'],
  countries: ['china', 'us', 'england', 'india', 'brazil'],
  distances: ['mile', 'kilometer', 'meter', 'foot', 'inch'],
  metals: ['iron', 'titanium', 'aluminum', 'lead', 'brass'],
  relatives: ['mother', 'father', 'brother', 'sister', 'aunt'],
};
export const categoryLabels: Record<Category, Label> = {
  animals: { zh: '動物', en: 'Animals' }, colors: { zh: '顏色', en: 'Colors' }, countries: { zh: '國家', en: 'Countries' },
  distances: { zh: '長度單位', en: 'Distances' }, metals: { zh: '金屬', en: 'Metals' }, relatives: { zh: '親屬', en: 'Relatives' },
};
// Soft hyphens let the longest English words break cleanly on narrow phone buttons.
export const wordLabels: Record<string, Label> = {
  fish: { zh: '魚', en: 'Fish' }, bird: { zh: '鳥', en: 'Bird' }, snake: { zh: '蛇', en: 'Snake' }, cow: { zh: '牛', en: 'Cow' }, whale: { zh: '鯨魚', en: 'Whale' },
  red: { zh: '紅色', en: 'Red' }, yellow: { zh: '黃色', en: 'Yellow' }, green: { zh: '綠色', en: 'Green' }, blue: { zh: '藍色', en: 'Blue' }, brown: { zh: '棕色', en: 'Brown' },
  china: { zh: '中國', en: 'China' }, us: { zh: '美國', en: 'US' }, england: { zh: '英國', en: 'England' }, india: { zh: '印度', en: 'India' }, brazil: { zh: '巴西', en: 'Brazil' },
  mile: { zh: '英里', en: 'Mile' }, kilometer: { zh: '公里', en: 'Kilo\u00admeter' }, meter: { zh: '公尺', en: 'Meter' }, foot: { zh: '英尺', en: 'Foot' }, inch: { zh: '英寸', en: 'Inch' },
  iron: { zh: '鐵', en: 'Iron' }, titanium: { zh: '鈦', en: 'Tita\u00adnium' }, aluminum: { zh: '鋁', en: 'Alu\u00adminum' }, lead: { zh: '鉛', en: 'Lead' }, brass: { zh: '黃銅', en: 'Brass' },
  mother: { zh: '媽媽', en: 'Mother' }, father: { zh: '爸爸', en: 'Father' }, brother: { zh: '哥哥', en: 'Brother' }, sister: { zh: '姊姊', en: 'Sister' }, aunt: { zh: '阿姨', en: 'Aunt' },
};
export const loads = [3, 4, 5];
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

// As in the original: 2 or 3 words from every category (15 in all), shuffled, with no word twice.
function CreateBlock(load: number, practice: boolean, random: () => number): KeepTrackBlock {
  const targets = Shuffle(categories, random).slice(0, load);
  const repeats = Shuffle([2, 2, 2, 3, 3, 3], random);
  const words = categories.flatMap((category, index) => Shuffle(exemplars[category], random).slice(0, repeats[index]).map(word => ({ category, word })));
  return { practice, load, targets, words: Shuffle(words, random) };
}

// One practice block of 3 targets, then the counted blocks: 3, 4 and 5 targets equally often, blocks of one size together.
export function CreateKeepTrackBlocks(plan: { rounds: number; practice: boolean }, random: () => number): KeepTrackBlock[] {
  const practice = plan.practice ? [CreateBlock(3, true, random)] : [];
  const order = Shuffle(loads, random);
  return [...practice, ...order.flatMap(load => Array.from({ length: plan.rounds / loads.length }, () => CreateBlock(load, false, random)))];
}

export function LastWords(block: KeepTrackBlock): Partial<Record<Category, string>> {
  const last: Partial<Record<Category, string>> = {};
  for (const item of block.words) if (block.targets.includes(item.category)) last[item.category] = item.word;
  return Object.fromEntries(block.targets.map(target => [target, last[target]]));
}

export function ScoreAnswer(block: KeepTrackBlock, choices: Partial<Record<Category, string>>) {
  const last = LastWords(block);
  const correctItems = block.targets.filter(target => choices[target] !== undefined && choices[target] === last[target]).length;
  return { correctItems, requiredItems: block.targets.length, correct: correctItems === block.targets.length };
}

// A short pause with only the targets on screen, then the words back to back.
export function CreateWordSchedule(count: number, exposureMs: number): { events: { at: number; index: number | null }[]; answerAt: number } {
  const events: { at: number; index: number | null }[] = [{ at: 0, index: null }];
  for (let index = 0; index < count; index++) events.push({ at: pauseMs + index * exposureMs, index });
  return { events, answerAt: pauseMs + count * exposureMs };
}

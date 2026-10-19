// Chinese characters for the Hart chart and decoder. The English chart in hartChart.ts keeps its original algorithm.
import type { HartCell, HartDecoderToken } from './hartChart';

const gridSize = 10;

// Each phrase is listed word by word, so the decoder can keep a word on one line.
export const chinesePhrases: readonly (readonly string[])[] = [
  ['早上', '喝了', '一杯', '溫熱的', '豆漿'],
  ['小狗', '在', '門口', '等', '主人', '回家'],
  ['秋天', '的', '樹葉', '一片片', '落下來'],
  ['我們', '週末', '一起', '去', '市場', '買菜'],
  ['下雨天', '記得', '帶', '一把', '雨傘'],
  ['他', '把', '書', '放回', '第三層', '書架'],
  ['海風', '吹過', '長長的', '海岸'],
  ['妹妹', '畫了', '一條', '紅色的', '小魚'],
  ['晚餐', '有', '番茄', '炒蛋', '和', '青菜湯'],
  ['火車', '準時', '在', '八點', '出發'],
  ['奶奶', '在', '陽台', '種了', '很多', '花'],
  ['路口', '的', '早餐店', '今天', '休息'],
  ['月亮', '從', '山後', '慢慢', '升起來'],
];

// Common characters with clear, different shapes fill the cells the phrase does not use.
const fillerCharacters = Array.from('山水火木土日月田口目人大小天王中工上下左右心手足白石竹米羊牛馬鳥雲雨風雪光門車船林草花果茶刀力文方立用耳衣東西南北春夏秋冬年生牙毛皮角貝走半古平正朋友江河地');

function SeededRandom(seed: number): () => number {
  const modulus = 2 ** 35 - 31;
  const multiplier = 185852;
  // A zero state would repeat forever, so states start at 1.
  let state = Math.abs(Math.trunc(seed)) % (modulus - 1) + 1;
  return () => {
    state = (state * multiplier) % modulus;
    return state / modulus;
  };
}

function PickPhrase(random: () => number): readonly string[] {
  return chinesePhrases[Math.floor(random() * chinesePhrases.length)];
}

function HasSameNeighbour(chars: string[], index: number): boolean {
  const col = index % gridSize;
  return (col > 0 && chars[index - 1] === chars[index]) || (col < gridSize - 1 && chars[index + 1] === chars[index]);
}

export function CreateHartChineseChart(seed: number): HartCell[] {
  const words = PickPhrase(SeededRandom(seed + 48_271));
  const random = SeededRandom(seed);
  const required = [...new Set(Array.from(words.join('')))];
  const fillers = fillerCharacters.filter(char => !required.includes(char));
  for (let index = fillers.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(random() * (index + 1));
    [fillers[index], fillers[swap]] = [fillers[swap], fillers[index]];
  }
  // Two copies of every phrase character give the decoder a choice of cells.
  const chars = required.flatMap(char => [char, char]);
  for (let index = 0; chars.length < gridSize * gridSize; index += 1) chars.push(fillers[index % fillers.length]);
  for (let index = chars.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(random() * (index + 1));
    [chars[index], chars[swap]] = [chars[swap], chars[index]];
  }
  for (let index = 0; index < chars.length; index += 1) {
    if (!HasSameNeighbour(chars, index)) continue;
    const start = Math.floor(random() * chars.length);
    for (let step = 0; step < chars.length; step += 1) {
      const other = (start + step) % chars.length;
      if (chars[other] === chars[index]) continue;
      [chars[index], chars[other]] = [chars[other], chars[index]];
      if (!HasSameNeighbour(chars, index) && !HasSameNeighbour(chars, other)) break;
      [chars[index], chars[other]] = [chars[other], chars[index]];
    }
  }
  return chars.map((char, index) => ({ char, row: Math.floor(index / gridSize) + 1, col: (index % gridSize) + 1 }));
}

export function CreateHartChineseDecoder(chart: HartCell[], seed: number, rounds?: number): {
  phrase: string;
  tokens: HartDecoderToken[];
} {
  const random = SeededRandom(seed + 48_271);
  const words = PickPhrase(random);
  const phrase = words.join('');
  const positionsByCharacter = new Map<string, HartCell[]>();
  chart.forEach((cell) => {
    const positions = positionsByCharacter.get(cell.char) ?? [];
    positions.push(cell);
    positionsByCharacter.set(cell.char, positions);
  });

  // A space token separates words; it is a layout boundary, not a character to decode.
  const tokens = words.flatMap<HartDecoderToken>((word, wordIndex) => [
    ...(wordIndex ? [{ char: ' ' }] : []),
    ...Array.from(word).map<HartDecoderToken>((char) => {
      const matches = positionsByCharacter.get(char);
      if (!matches?.length) return { char };
      const match = matches[Math.floor(random() * matches.length)];
      return { char, coordinate: { row: match.row, col: match.col } };
    }),
  ]);

  if (rounds === undefined) return { phrase, tokens };
  const available = tokens.filter((token) => token.coordinate).length;
  if (!available) return { phrase, tokens };
  const repetitions = Math.ceil(rounds / available);
  let remaining = rounds;
  const configuredTokens = Array.from({ length: repetitions }, () => tokens)
    .flatMap((part, index) => index ? [{ char: ' ' }, ...part] : part)
    .map((token) => token.coordinate && remaining-- > 0 ? token : { char: token.char });
  return { phrase: Array(repetitions).fill(phrase).join(' '), tokens: configuredTokens };
}

// The answer is the last Chinese character typed; phonetic symbols and letters are ignored.
export function LastHanCharacter(value: string): string {
  return Array.from(value).reverse().find((char) => /\p{Script=Han}/u.test(char)) ?? '';
}

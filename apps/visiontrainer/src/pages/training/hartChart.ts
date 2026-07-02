export const HART_GRID_SIZE = 10;

const HART_ALPHABET = 'ABCDEFGHKLMNOPQRSTUVWXYZ';

const DECODER_PHRASES = [
  'A glittering gem is not enough',
  'Art does not have to be intentional',
  'Dan ate the clouds like cotton candy',
  'Do not step on the broken glass',
  'He excelled at firing people nicely',
  'I am never at home on Sundays',
  'I hear that Nancy is very pretty',
  'It was the best sandcastle he had ever seen',
  'Please wait outside of the house',
  'The hand sanitizer was actually clear glue',
  'The lake is a long way from here',
  'The stranger officiates the meal',
  'Today I heard something new and unmemorable',
] as const;

export interface HartCell {
  char: string;
  row: number;
  col: number;
}

export interface HartDecoderToken {
  char: string;
  coordinate?: {
    row: number;
    col: number;
  };
}

function seededRandom(seed: number): () => number {
  const modulus = 2 ** 35 - 31;
  const multiplier = 185852;
  let state = Math.abs(Math.trunc(seed)) % modulus;

  return () => {
    state = (state * multiplier) % modulus;
    return state / modulus;
  };
}

export function createHartSeed(): number {
  if (typeof crypto !== 'undefined' && 'getRandomValues' in crypto) {
    const value = new Uint32Array(1);
    crypto.getRandomValues(value);
    return value[0] % 100_000_000;
  }

  return Math.floor(Math.random() * 100_000_000);
}

export function createHartChart(seed: number): HartCell[] {
  const random = seededRandom(seed);
  const cells: HartCell[] = [];
  let previous = '';

  for (let row = 1; row <= HART_GRID_SIZE; row += 1) {
    for (let col = 1; col <= HART_GRID_SIZE; col += 1) {
      let char = previous;
      let attempts = 0;

      while (char === previous && attempts < 6) {
        char = HART_ALPHABET[Math.floor(random() * HART_ALPHABET.length)];
        attempts += 1;
      }

      previous = char;
      cells.push({ char, row, col });
    }
  }

  return cells;
}

export function createHartDecoder(chart: HartCell[], seed: number): {
  phrase: string;
  tokens: HartDecoderToken[];
} {
  const random = seededRandom(seed + 48_271);
  const phrase = DECODER_PHRASES[Math.floor(random() * DECODER_PHRASES.length)];
  const positionsByCharacter = new Map<string, HartCell[]>();

  chart.forEach((cell) => {
    const positions = positionsByCharacter.get(cell.char) ?? [];
    positions.push(cell);
    positionsByCharacter.set(cell.char, positions);
  });

  const tokens = phrase.toUpperCase().split('').map<HartDecoderToken>((char) => {
    const matches = positionsByCharacter.get(char);
    if (!matches?.length) return { char };

    const match = matches[Math.floor(random() * matches.length)];
    return {
      char,
      coordinate: {
        row: match.row,
        col: match.col,
      },
    };
  });

  return { phrase, tokens };
}

export function parseHartSeed(value: string | null): number {
  const parsed = Number.parseInt(value ?? '', 10);
  return Number.isFinite(parsed) ? Math.abs(parsed) % 100_000_000 : createHartSeed();
}

export function clampHartScale(value: number): number {
  if (!Number.isFinite(value)) return 1;
  return Math.max(0.65, Math.min(1.45, value));
}

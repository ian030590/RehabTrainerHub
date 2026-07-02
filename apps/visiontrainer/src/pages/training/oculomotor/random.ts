export interface Rng {
  seed: number;
  randomAt(index: number): number;
  rangeAt(index: number, min: number, max: number): number;
}

const normalizeSeed = (seed: number) => {
  const normalized = Math.trunc(Math.abs(seed)) % 2_147_483_647;
  return normalized === 0 ? 1 : normalized;
};

export const seededRandom = (seed: number, index: number) => {
  let value = normalizeSeed(seed + index * 374_761_393);
  value = (value ^ (value >>> 13)) * 1_274_126_177;
  value = (value ^ (value >>> 16)) >>> 0;
  return value / 4_294_967_295;
};

export const createRng = (seed: number): Rng => ({
  seed: normalizeSeed(seed),
  randomAt: (index) => seededRandom(seed, index),
  rangeAt: (index, min, max) => min + (max - min) * seededRandom(seed, index),
});

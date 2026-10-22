export interface HexCell { q: number; r: number; value: number }
export interface HexRow { round: number; rings: number; timeMs: number; errors: number; centerChecks: number; centerHits: number; centerMissed: number }
export interface SearchTap { correct: boolean; done: boolean; ignored?: boolean }

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

// Axial hexagon coordinates within the given ring distance, leaving the centre free.
export function CreateHexBoard(rings: number, random: () => number): HexCell[] {
  const positions: { q: number; r: number }[] = [];
  for (let r = -rings; r <= rings; r++) {
    for (let q = -rings; q <= rings; q++) {
      if (Math.abs(q + r) <= rings && (q !== 0 || r !== 0)) positions.push({ q, r });
    }
  }
  const values = positions.map((_, index) => index + 1);
  for (let index = values.length - 1; index > 0; index--) {
    const swap = Math.floor(random() * (index + 1));
    [values[index], values[swap]] = [values[swap], values[index]];
  }
  return positions.map((position, index) => ({ ...position, value: values[index] }));
}

export class OrderedSearch {
  readonly found = new Set<number>();
  errors = 0;
  next = 1;
  private finishedAt: number | null = null;

  constructor(private count: number, readonly startedAt: number) {}

  get done() { return this.finishedAt !== null; }

  tap(value: number, now: number): SearchTap {
    if (this.done || this.found.has(value)) return { correct: false, done: this.done, ignored: true };
    if (value !== this.next) { this.errors++; return { correct: false, done: false }; }
    this.found.add(value);
    this.next++;
    if (this.found.size === this.count) this.finishedAt = now;
    return { correct: true, done: this.done };
  }

  result() {
    return { timeMs: Math.round((this.finishedAt ?? this.startedAt) - this.startedAt), errors: this.errors };
  }
}

export function SummarizeHex(rows: HexRow[], roundsPlanned: number) {
  const times = rows.map(row => row.timeMs);
  const totalTimeMs = times.reduce((sum, value) => sum + value, 0);
  const centerChecks = rows.reduce((sum, row) => sum + row.centerChecks, 0);
  const centerHits = rows.reduce((sum, row) => sum + row.centerHits, 0);
  return {
    roundsPlanned, roundsCompleted: rows.length, rings: rows[0]?.rings ?? null, totalTimeMs,
    meanRoundMs: rows.length ? Math.round(totalTimeMs / rows.length) : null,
    bestRoundMs: rows.length ? Math.min(...times) : null,
    totalErrors: rows.reduce((sum, row) => sum + row.errors, 0),
    centerChecks, centerHits, centerHitPercent: centerChecks ? Math.round(centerHits / centerChecks * 1000) / 10 : null,
  };
}

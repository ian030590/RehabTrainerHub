import { GapFor, ModelFor } from './physics.js';
import type { Scenario, Settings } from './settings.js';

type Random = () => number;
type Lane = -1 | 0 | 1;
type Move = { from: Lane; to: Lane; signal: number; start: number; end: number };
type Decoy = { lane: Lane; gap: number; speedDelta: number; appears: number; brakes: [number, number][] };

export function RandomFrom(seed: number) {
  return () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
}

function Between(random: Random, low: number, high: number) {
  return low + Math.floor(random() * (high - low + 1));
}

export function ScenarioFor(setting: Settings['scenario'], index: number, previous: Scenario, random: Random): Scenario {
  if (setting !== 'mixed') return setting;
  if (index < 2) return 'plain';
  const choices: Scenario[] = index === 5 ? ['plain', 'swerve-away'] : ['plain', 'swerve-away', 'out-and-back'];
  const allowed = index === 5 ? choices : choices.filter(choice => choice !== previous);
  return allowed[Between(random, 0, allowed.length - 1)];
}

export function MakeRound(settings: Settings, scenario: Scenario, index: number, random: Random) {
  const gap = GapFor(ModelFor(settings), index);
  const wait = index === 5 ? Between(random, 4200, 8500) : Between(random, 1400, 5000);
  const moves: Move[] = [];
  const side: Lane = random() < .5 ? -1 : 1;
  const makeMove = (from: Lane, to: Lane, signal: number) => ({ from, to, signal, start: signal + 800, end: signal + 2000 });
  let onset = 1500 + wait;
  if (scenario === 'swerve-away') {
    moves.push(makeMove(0, side, 1800));
    onset = moves[0].end + wait;
  } else if (scenario === 'out-and-back') {
    const first = makeMove(0, side, 1500 + wait);
    moves.push(first, makeMove(side, 0, first.end + Between(random, 1500, 2500)));
    onset = moves[1].end;
  }
  const leadGap = scenario === 'swerve-away' ? Math.max(8, gap - 8) : gap;
  const decoys: Decoy[] = [];
  if (settings.traffic === 'light') {
    for (let appears = 1500; appears < onset + 2500; appears += Between(random, 6000, 12000)) {
      decoys.push({ lane: random() < .5 ? -1 : 1, gap: gap + Between(random, 36, 55),
        speedDelta: Between(random, -1, 2), appears, brakes: [] });
    }
  } else if (settings.traffic === 'busy') {
    for (const lane of [-1, 1] as const) {
      const count = Between(random, 2, 4);
      for (let car = 0; car < count; car++) {
        const first = Between(random, 1500, onset - 400);
        const brakes: Decoy['brakes'] = [[first, first + Between(random, 400, 800)]];
        if (random() < .5) {
          const second = Between(random, brakes[0][1], onset + 1600);
          brakes.push([second, second + Between(random, 400, 800)]);
        }
        decoys.push({ lane, gap: gap + 35 + 19 * car + Between(random, 0, 4),
          speedDelta: Between(random, 0, 2), appears: 0, brakes });
      }
    }
  }
  return { scenario, gap, leadGap, moves, onset, target: scenario === 'swerve-away' ? 'far' : 'lead', decoys,
    messageSeed: Between(random, 0, 0xffffffff) } as const;
}

export function LaneAt(moves: readonly Move[], time: number) {
  let lane: Lane = 0;
  for (const move of moves) {
    if (time < move.start) break;
    if (time < move.end) {
      const progress = (time - move.start) / (move.end - move.start);
      return move.from + (move.to - move.from) * progress ** 2 * (3 - 2 * progress);
    }
    lane = move.to;
  }
  return lane;
}

export function Judge(onset: number, input: number) {
  const elapsed = input - onset;
  if (elapsed < 100) return { kind: 'falseStart' } as const;
  if (elapsed >= 2500) return { kind: 'timeout', r: 2.5 } as const;
  return { kind: 'response', r: elapsed / 1000 } as const;
}

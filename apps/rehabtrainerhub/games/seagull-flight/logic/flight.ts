import type { PlayConfig } from '../settings';

// Positions are normalized: x runs from -1 (full turn left) to 1 (full turn right); altitude from 0 (the sea) to 1 (the top).
export const flight = {
  countdownSec: 3,
  firstRingSec: 3,
  lookaheadSec: 12,
  // The nearest ring needs 30% of the set head turn, the farthest all of it.
  minReach: 0.3,
  maxReach: 1,
  ringRadius: 0.2,
  ringAltitude: 0.6,
  startAltitude: 0.8,
  flapLift: 0.16,
  flapRiseSec: 0.35,
  glideSmoothingSec: 0.18,
  keyboardGlideSpeed: 1.4,
} as const;

export type Ring = { index: number; side: -1 | 1; reach: number; x: number; at: number; headAngle: number };
export type RingResult = Ring & { passed: boolean; offset: number; altitude: number };
export type FlightInput = {
  dt: number; tracking: boolean; targetX: number | null; keyboardDirection: -1 | 0 | 1; flap: boolean;
  head: { yaw: number; pitch: number } | null;
};
export type FlightEvents = { passed: RingResult[]; missed: RingResult[]; flapped: boolean; crashed: boolean; finished: boolean };
export type FlightSession = ReturnType<typeof CreateFlightSession>;

function Clamp(value: number, min: number, max: number) { return Math.min(Math.max(value, min), max); }
function Round1(value: number) { return Math.round(value * 10) / 10; }

// A normal curve centred on the middle of the reach, cut at both ends: about 1 ring in 80 would fall outside and is drawn again.
export function SampleRingReach(random: () => number) {
  const mean = (flight.minReach + flight.maxReach) / 2;
  const deviation = (flight.maxReach - flight.minReach) / 5;
  for (let attempt = 0; attempt < 64; attempt++) {
    const radius = Math.sqrt(-2 * Math.log(1 - random()));
    const reach = mean + radius * Math.cos(2 * Math.PI * random()) * deviation;
    if (reach >= flight.minReach && reach <= flight.maxReach) return reach;
  }
  return mean;
}

// Rings come on alternate sides, so every ring asks for a turn across the middle.
export function CreateRingPlanner(config: PlayConfig, random: () => number) {
  const firstSide: -1 | 1 = random() < 0.5 ? -1 : 1;
  let index = 0;
  return {
    Next(): Ring | null {
      const at = flight.firstRingSec + index * config.ringIntervalSec;
      if (at > config.durationSec) return null;
      const side = (index % 2 === 0 ? firstSide : -firstSide) as -1 | 1;
      const reach = SampleRingReach(random);
      return { index: index++, side, reach, x: side * reach, at, headAngle: Round1(reach * config.turnRangeDeg) };
    },
  };
}

export function CreateFlightSession(config: PlayConfig, random: () => number) {
  const planner = CreateRingPlanner(config, random);
  const session = {
    config, planner, nextRing: planner.Next(), rings: [] as Ring[], results: [] as RingResult[],
    countdown: flight.countdownSec as number, elapsed: 0, clock: 0,
    altitude: flight.startAltitude as number, sinceFlap: 0, liftPending: 0, flaps: 0, lastFlapClock: -Infinity,
    x: 0, targetX: 0, velocityX: 0,
    crashed: false, ended: false, frozen: false,
    maxTurnDeg: config.headControl ? 0 : null as number | null,
    maxNodDeg: config.headControl ? 0 : null as number | null,
  };
  PlanRings(session);
  return session;
}

function PlanRings(session: { nextRing: Ring | null; rings: Ring[]; elapsed: number; planner: { Next(): Ring | null } }) {
  while (session.nextRing && session.nextRing.at <= session.elapsed + flight.lookaheadSec) {
    session.rings.push(session.nextRing);
    session.nextRing = session.planner.Next();
  }
}

export function StepFlight(session: FlightSession, input: FlightInput, config: PlayConfig): FlightEvents {
  const events: FlightEvents = { passed: [], missed: [], flapped: false, crashed: false, finished: false };
  if (session.ended) return events;
  // Without a fresh head reading the flight pauses: nothing moves and the clock stops.
  if (!input.tracking) { session.frozen = true; return events; }
  session.frozen = false;
  const dt = Clamp(input.dt, 0, 0.1);
  session.clock += dt;
  if (input.head && session.maxTurnDeg !== null && session.maxNodDeg !== null) {
    session.maxTurnDeg = Math.max(session.maxTurnDeg, Round1(Math.abs(input.head.yaw)));
    session.maxNodDeg = Math.max(session.maxNodDeg, Round1(Math.abs(input.head.pitch)));
  }
  session.targetX = input.targetX !== null ? Clamp(input.targetX, -1, 1)
    : Clamp(session.targetX + input.keyboardDirection * flight.keyboardGlideSpeed * dt, -1, 1);
  const previousX = session.x;
  session.x += (session.targetX - session.x) * (1 - Math.exp(-dt / flight.glideSmoothingSec));
  session.velocityX = dt > 0 ? (session.x - previousX) / dt : 0;
  if (input.flap) { events.flapped = true; session.lastFlapClock = session.clock; }
  // The countdown lets the player try a nod and a turn; flaps animate but do not lift or count.
  if (session.countdown > 0) {
    session.countdown = session.countdown - dt <= 1e-6 ? 0 : session.countdown - dt;
    return events;
  }
  if (input.flap) { session.flaps++; session.liftPending += flight.flapLift; session.sinceFlap = 0; }
  const step = Math.min(dt, config.durationSec - session.elapsed);
  // Sinking speeds up the longer the gull goes without a flap; from the top it reaches the sea after glideSec.
  const glide = config.glideSec;
  const since = session.sinceFlap;
  const sink = (0.4 * step + 0.6 * ((since + step) ** 2 - since ** 2) / glide) / glide;
  const lift = Math.min(session.liftPending, flight.flapLift / flight.flapRiseSec * step);
  session.liftPending -= lift;
  session.sinceFlap += step;
  session.elapsed += step;
  session.altitude = Math.min(1, session.altitude + lift - sink);
  if (session.altitude >= 1) session.liftPending = 0;
  while (session.rings.length && session.rings[0].at <= session.elapsed + 1e-9) {
    const ring = session.rings.shift()!;
    const offset = Math.hypot(session.x - ring.x, session.altitude - flight.ringAltitude) / flight.ringRadius;
    const result = { ...ring, passed: offset <= 1, offset, altitude: Math.max(0, session.altitude) };
    session.results.push(result);
    (result.passed ? events.passed : events.missed).push(result);
  }
  if (session.altitude <= 0) {
    session.altitude = 0;
    session.crashed = true;
    session.ended = true;
    events.crashed = true;
    return events;
  }
  if (session.elapsed >= config.durationSec - 1e-9) {
    session.elapsed = config.durationSec;
    session.ended = true;
    events.finished = true;
    return events;
  }
  PlanRings(session);
  return events;
}

export function SummarizeFlight(session: FlightSession) {
  const passed = session.results.filter(result => result.passed).length;
  const total = session.results.length;
  return {
    durationSeconds: Round1(session.elapsed), passed, missed: total - passed, passRate: total ? Math.round(passed / total * 100) : null,
    flaps: session.flaps, crashed: session.crashed ? 1 : 0, maxTurnDeg: session.maxTurnDeg, maxNodDeg: session.maxNodDeg,
    rounds: session.results,
  };
}
export type FlightSummary = ReturnType<typeof SummarizeFlight>;

// Car-following and rear-traffic rules for ambient vehicles. Distances are
// metres along the route; direction 1 travels with the player.

export interface TrafficBody {
  distance: number;
  lateral: number;
  direction: 1 | -1;
  speed: number;
  halfLength: number;
  halfWidth: number;
}

export interface RearTrafficSlot {
  slot: number;
  distance: number;
  cruiseSpeed: number;
  waiting: boolean;
}

export const minimumFollowingGap = 2;
const followingHeadwaySeconds = 1.1;
const lateralClearance = 0.3;
const acceleratingResponse = 2.2;
const brakingResponse = 5.8;
const rearSpawnBehind = 70;
const rearSpawnSpacing = 25;
const rearRespawnAhead = 160;
const rearRespawnBehind = 150;

// Nearest body ahead in the same direction whose footprint overlaps sideways.
export function FindTrafficLeaderGap<T extends TrafficBody>(follower: TrafficBody, bodies: readonly T[]): { leader: T; gap: number } | null {
  let best: { leader: T; gap: number } | null = null;
  for (const body of bodies) {
    if (body === follower || body.direction !== follower.direction) continue;
    if (Math.abs(body.lateral - follower.lateral) >= body.halfWidth + follower.halfWidth + lateralClearance) continue;
    const ahead = (body.distance - follower.distance) * follower.direction;
    if (ahead <= 0) continue;
    const gap = ahead - body.halfLength - follower.halfLength;
    if (!best || gap < best.gap) best = { leader: body, gap };
  }
  return best;
}

// Eases towards the cruise speed but never faster than the speed that keeps
// the minimum gap to the leader, so a follower cannot run into it.
export function CalculateFollowingSpeed(cruiseSpeed: number, gap: number, leaderSpeed: number, currentSpeed: number, dt: number): number {
  const safeSpeed = Number.isFinite(gap)
    ? Math.max(0, leaderSpeed + (gap - minimumFollowingGap) / followingHeadwaySeconds)
    : Infinity;
  const target = Math.min(cruiseSpeed, safeSpeed);
  const response = target > currentSpeed ? acceleratingResponse : brakingResponse;
  const eased = currentSpeed + (target - currentSpeed) * (1 - Math.exp(-response * Math.max(0, dt)));
  return Math.max(0, Math.min(eased, safeSpeed));
}

export function PlanRearTraffic(count: number, playerDistance: number): RearTrafficSlot[] {
  return Array.from({ length: Math.max(0, count) }, (_, slot) => {
    const distance = playerDistance - 10 - slot * 18;
    return {
      slot,
      distance: Math.max(4, distance),
      cruiseSpeed: 13.2 + (slot % 3) * 1.4,
      waiting: distance < 4,
    };
  });
}

export function ShouldRespawnRearTraffic(actorDistance: number, playerDistance: number): boolean {
  return actorDistance - playerDistance > rearRespawnAhead || playerDistance - actorDistance > rearRespawnBehind;
}

// Returns null while the route start leaves no room behind the player.
export function CalculateRearSpawnDistance(playerDistance: number, slot: number): number | null {
  const distance = playerDistance - rearSpawnBehind - slot * rearSpawnSpacing;
  return distance >= 4 ? distance : null;
}

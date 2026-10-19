// Car-following and rear-traffic rules for ambient vehicles. Distances are
// metres along the route; direction 1 travels with the player.
import type { CollisionBox2D } from '../types/types';

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
// Past the 110 m the mirrors draw.
const hiddenBehind = 150;
const routeEndMargin = 4;
const contactTolerance = 0.25;

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
  return actorDistance - playerDistance > rearRespawnAhead || playerDistance - actorDistance > hiddenBehind;
}

export function ShouldRespawnAmbientTraffic(actorDistance: number, playerDistance: number, routeLength: number): boolean {
  return actorDistance < routeEndMargin
    || actorDistance > routeLength - routeEndMargin
    || playerDistance - actorDistance > hiddenBehind;
}

// Ambient cars come back on the road past the player's view. Returns null
// once that stretch runs beyond the destination, so nothing new appears in
// front of a player who is about to arrive.
export function CalculateAmbientSpawnDistance(playerDistance: number, routeLength: number, hiddenAhead: number): number | null {
  const distance = playerDistance + hiddenAhead;
  return distance <= routeLength - routeEndMargin - 2 ? distance : null;
}

// Separating-axis test for two rotated boxes; angle 0 faces -Z.
export function CollisionBoxesOverlap(a: CollisionBox2D, b: CollisionBox2D): boolean {
  for (const angle of [a.angle, b.angle]) {
    for (const axis of [{ x: Math.cos(angle), z: Math.sin(angle) }, { x: Math.sin(angle), z: -Math.cos(angle) }]) {
      const centerGap = Math.abs((a.centerX - b.centerX) * axis.x + (a.centerZ - b.centerZ) * axis.z);
      if (centerGap > ProjectedRadius(a, axis) + ProjectedRadius(b, axis)) return false;
    }
  }
  return true;
}

function ProjectedRadius(box: CollisionBox2D, axis: { x: number; z: number }): number {
  return box.halfWidth * Math.abs(Math.cos(box.angle) * axis.x + Math.sin(box.angle) * axis.z)
    + box.halfLength * Math.abs(Math.sin(box.angle) * axis.x - Math.cos(box.angle) * axis.z);
}

// Decides whether a vehicle moving from one box to the next runs into
// `other`. Two vehicles that already overlap may still move apart, and a
// vehicle touching one that is waiting for it may drive off in any direction,
// so neither ends up stuck waiting for the other.
export function IsTrafficMoveBlocked(from: CollisionBox2D, to: CollisionBox2D, other: CollisionBox2D, otherWaitsForMover = false): boolean {
  if (!CollisionBoxesOverlap(to, other)) return false;
  if (otherWaitsForMover && CollisionBoxesOverlap(from, {
    ...other,
    halfWidth: other.halfWidth + contactTolerance,
    halfLength: other.halfLength + contactTolerance,
  })) return false;
  if (!CollisionBoxesOverlap(from, other)) return true;
  return CenterDistance(to, other) < CenterDistance(from, other);
}

function CenterDistance(a: CollisionBox2D, b: CollisionBox2D): number {
  return Math.hypot(a.centerX - b.centerX, a.centerZ - b.centerZ);
}

// Returns null while the route start leaves no room behind the player.
export function CalculateRearSpawnDistance(playerDistance: number, slot: number): number | null {
  const distance = playerDistance - rearSpawnBehind - slot * rearSpawnSpacing;
  return distance >= 4 ? distance : null;
}

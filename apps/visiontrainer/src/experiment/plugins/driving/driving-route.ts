import type { RouteSegment } from './types';

export const DRIVING_ROUTE: readonly RouteSegment[] = [
  { start: { x: 0, z: 0 }, dir: { x: 0, z: 1 }, length: 110 },
  { start: { x: 0, z: 110 }, dir: { x: 1, z: 0 }, length: 120 },
  { start: { x: 120, z: 110 }, dir: { x: 0, z: 1 }, length: 100 },
  { start: { x: 120, z: 210 }, dir: { x: -1, z: 0 }, length: 100 },
  { start: { x: 20, z: 210 }, dir: { x: 0, z: 1 }, length: 135 },
];

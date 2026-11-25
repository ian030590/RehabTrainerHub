import type { TrainerCategoryId } from '@rehab-trainer/hub-modules/catalog';
import type { TrainingThemeStyle } from '../trainingThemeStyle';
import type { ActivityLink } from '../activityLinks';
import type { HubLabel } from '../i18n/types';

export type MapPoint = readonly [number, number];
type MapPosition = { id: string; point: MapPoint };

export type ActivityMapEntry = ActivityLink & MapPosition & {
  category: TrainerCategoryId;
  primaryTags: readonly HubLabel[];
  neighborIds: readonly string[];
};

export type ActivityMapCategory = {
  id: TrainerCategoryId;
  label: HubLabel;
  style: TrainingThemeStyle;
};

export function ReadActivityMapPoints(map: unknown, ids: readonly string[]) {
  if (!map || typeof map !== 'object' || Array.isArray(map) || Object.keys(map).length !== ids.length) return null;
  const points = new Map<string, MapPoint>();
  const used = new Set<string>();
  for (const id of ids) {
    const point = (map as Record<string, unknown>)[id];
    if (!Array.isArray(point) || point.length !== 2 || !point.every(value =>
      typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1 && value === Number(value.toFixed(4)))) return null;
    const position = point.join(',');
    if (used.has(position)) return null;
    used.add(position);
    points.set(id, [point[0], point[1]]);
  }
  return points;
}

export function GetDirectionalActivityId(points: readonly MapPosition[], focusedId: string, key: string) {
  if (key === 'Home') return points[0]?.id ?? null;
  if (key === 'End') return points.at(-1)?.id ?? null;
  const directions: Readonly<Record<string, MapPoint | undefined>> = {
    ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1],
  };
  const direction = directions[key];
  const origin = points.find(({ id }) => id === focusedId)?.point;
  if (!direction || !origin) return null;

  let nearest = focusedId;
  let bestDistance = Infinity;
  for (const { id, point: [x, y] } of points) {
    const dx = x - origin[0];
    const dy = y - origin[1];
    if (dx * direction[0] + dy * direction[1] <= 0) continue;
    const distance = dx * dx + dy * dy;
    if (distance >= bestDistance) continue;
    nearest = id;
    bestDistance = distance;
  }
  return nearest;
}

export function GetNearestActivityId(points: readonly MapPosition[], [x, y]: MapPoint, radius: number) {
  let nearest: string | null = null;
  let bestDistance = Infinity;
  for (const { id, point } of points) {
    const distance = Math.hypot(point[0] - x, point[1] - y);
    if (distance > radius || distance >= bestDistance) continue;
    nearest = id;
    bestDistance = distance;
  }
  return nearest;
}

import type { RouteSegment, Vec2 } from './types';

const taipeiCenterLon = 121.5618;
const taipeiCenterLat = 25.0345;
const taipeiCenterX = 60;
const taipeiCenterZ = 178;
const metersPerLatitudeDegree = 111_320;
const metersPerLongitudeDegree = metersPerLatitudeDegree * Math.cos(taipeiCenterLat * Math.PI / 180);
const osmToSceneScale = 1;
const urbanLaneWidthM = 3.2;

interface RouteControlPoint {
  lon: number;
  lat: number;
  roadWidth: number;
  laneCount: number;
  oneWay: boolean;
  name: string;
}

export interface DrivingRouteVariant {
  id: string;
  label: string;
  points: readonly RouteControlPoint[];
}

export function ProjectTaipeiLonLat(lon: number, lat: number): Vec2 {
  return {
    x: taipeiCenterX + (lon - taipeiCenterLon) * metersPerLongitudeDegree * osmToSceneScale,
    z: taipeiCenterZ - (lat - taipeiCenterLat) * metersPerLatitudeDegree * osmToSceneScale,
  };
}

function RoadWidthFromLanes(lanes: number, shoulderWidth = 1.2): number {
  return lanes * urbanLaneWidthM + shoulderWidth;
}

const xinyi6Lane = RoadWidthFromLanes(6, 2.4);
const xinyi8Lane = RoadWidthFromLanes(8, 2.8);
const keelung6Lane = RoadWidthFromLanes(6, 2.4);
const cityHall4Lane = RoadWidthFromLanes(4, 1.8);
const songshou4Lane = RoadWidthFromLanes(4, 1.8);
const songzhi6Lane = RoadWidthFromLanes(6, 2.0);
const lastRouteStorageKey = 'visiontrainer.driving.lastRouteId';

const xinyi3Lane = xinyi6Lane;
const xinyi4Lane = xinyi8Lane;
const keelung3Lane = keelung6Lane;
const cityHall2Lane = cityHall4Lane;

let lastPickedRouteId: string | null = null;

function GetRenderedRoadProfile(point: RouteControlPoint): Pick<RouteControlPoint, 'roadWidth' | 'laneCount' | 'oneWay'> {
  if (point.name.includes('Xinyi Road')) {
    const laneCount = point.laneCount >= 4 ? 8 : 6;
    return {
      roadWidth: laneCount === 8 ? xinyi8Lane : xinyi6Lane,
      laneCount,
      oneWay: false,
    };
  }

  if (point.name.includes('Keelung Road')) {
    return { roadWidth: keelung6Lane, laneCount: 6, oneWay: false };
  }

  if (point.name.includes('City Hall Road')) {
    return { roadWidth: cityHall4Lane, laneCount: 4, oneWay: false };
  }

  if (point.name.includes('Songzhi Road')) {
    return { roadWidth: songzhi6Lane, laneCount: 6, oneWay: false };
  }

  if (point.name.includes('Songshou Road')) {
    return { roadWidth: songshou4Lane, laneCount: 4, oneWay: false };
  }

  return {
    roadWidth: point.roadWidth,
    laneCount: point.laneCount,
    oneWay: false,
  };
}

const keelungToXinyiEastDelivery: readonly RouteControlPoint[] = [
  {
    lon: 121.5576717,
    lat: 25.0297961,
    roadWidth: keelung3Lane,
    laneCount: 3,
    oneWay: true,
    name: 'Keelung Road Section 2',
  },
  {
    lon: 121.5589772,
    lat: 25.0318959,
    roadWidth: keelung3Lane,
    laneCount: 3,
    oneWay: true,
    name: 'Keelung Road Section 2',
  },
  {
    lon: 121.5590422,
    lat: 25.0320558,
    roadWidth: keelung3Lane,
    laneCount: 3,
    oneWay: true,
    name: 'Keelung Road Section 2',
  },
  {
    lon: 121.5596234,
    lat: 25.0329882,
    roadWidth: xinyi3Lane,
    laneCount: 3,
    oneWay: true,
    name: 'Xinyi Road Section 5',
  },
  {
    lon: 121.5597077,
    lat: 25.0331059,
    roadWidth: xinyi3Lane,
    laneCount: 3,
    oneWay: true,
    name: 'Xinyi Road Section 5',
  },
  {
    lon: 121.5599064,
    lat: 25.0330834,
    roadWidth: xinyi3Lane,
    laneCount: 3,
    oneWay: true,
    name: 'Xinyi Road Section 5',
  },
  {
    lon: 121.5654166,
    lat: 25.032958,
    roadWidth: xinyi4Lane,
    laneCount: 4,
    oneWay: true,
    name: 'Xinyi Road Section 5',
  },
  {
    lon: 121.568228,
    lat: 25.0327688,
    roadWidth: xinyi4Lane,
    laneCount: 4,
    oneWay: true,
    name: 'Xinyi Road Section 5',
  },
];

const songzhiNorthDelivery: readonly RouteControlPoint[] = [
  {
    lon: 121.5596234,
    lat: 25.0329882,
    roadWidth: xinyi3Lane,
    laneCount: 3,
    oneWay: true,
    name: 'Xinyi Road Section 5',
  },
  {
    lon: 121.5599064,
    lat: 25.0330834,
    roadWidth: xinyi3Lane,
    laneCount: 3,
    oneWay: true,
    name: 'Xinyi Road Section 5',
  },
  {
    lon: 121.5654166,
    lat: 25.032958,
    roadWidth: xinyi4Lane,
    laneCount: 4,
    oneWay: true,
    name: 'Xinyi Road Section 5',
  },
  {
    lon: 121.5654166,
    lat: 25.032958,
    roadWidth: songzhi6Lane,
    laneCount: 6,
    oneWay: false,
    name: 'Songzhi Road',
  },
  {
    lon: 121.5654635,
    lat: 25.0358704,
    roadWidth: songshou4Lane,
    laneCount: 4,
    oneWay: false,
    name: 'Songshou Road',
  },
  {
    lon: 121.5635641,
    lat: 25.035905,
    roadWidth: cityHall2Lane,
    laneCount: 2,
    oneWay: true,
    name: 'City Hall Road',
  },
];

const songshouToCityHallDelivery: readonly RouteControlPoint[] = [
  {
    lon: 121.5654635,
    lat: 25.0358704,
    roadWidth: songshou4Lane,
    laneCount: 4,
    oneWay: false,
    name: 'Songshou Road',
  },
  {
    lon: 121.5635641,
    lat: 25.035905,
    roadWidth: songshou4Lane,
    laneCount: 4,
    oneWay: false,
    name: 'Songshou Road',
  },
  {
    lon: 121.5636052,
    lat: 25.0357702,
    roadWidth: cityHall2Lane,
    laneCount: 2,
    oneWay: true,
    name: 'City Hall Road',
  },
  {
    lon: 121.5635362,
    lat: 25.0330043,
    roadWidth: xinyi3Lane,
    laneCount: 3,
    oneWay: true,
    name: 'Xinyi Road Section 5',
  },
];

export const drivingRouteVariants: readonly DrivingRouteVariant[] = [
  { id: 'keelung-to-xinyi-east', label: 'Keelung to Xinyi east', points: keelungToXinyiEastDelivery },
  { id: 'songzhi-north-delivery', label: 'Songzhi north delivery', points: songzhiNorthDelivery },
  { id: 'songshou-to-city-hall', label: 'Songshou to City Hall', points: songshouToCityHallDelivery },
];

function BuildRoute(points: readonly RouteControlPoint[]): RouteSegment[] {
  const segments: RouteSegment[] = [];
  for (let i = 0; i < points.length - 1; i += 1) {
    const start = ProjectTaipeiLonLat(points[i].lon, points[i].lat);
    const end = ProjectTaipeiLonLat(points[i + 1].lon, points[i + 1].lat);
    const roadProfile = GetRenderedRoadProfile(points[i]);
    const dx = end.x - start.x;
    const dz = end.z - start.z;
    const length = Math.hypot(dx, dz);
    if (length < 0.5) continue;
    segments.push({
      start,
      dir: { x: dx / length, z: dz / length },
      length,
      roadWidth: roadProfile.roadWidth,
      laneCount: roadProfile.laneCount,
      oneWay: roadProfile.oneWay,
      name: points[i].name,
    });
  }
  return AlignRouteStartToNegativeZ(segments);
}

function RotateVec2(point: Vec2, radians: number): Vec2 {
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  return {
    x: point.x * cos - point.z * sin,
    z: point.x * sin + point.z * cos,
  };
}

function NormalizeVec2(point: Vec2): Vec2 {
  const length = Math.hypot(point.x, point.z) || 1;
  return {
    x: point.x / length,
    z: point.z / length,
  };
}

function AlignRouteStartToNegativeZ(segments: RouteSegment[]): RouteSegment[] {
  const first = segments[0];
  if (!first) return segments;

  const origin = first.start;
  const firstHeading = Math.atan2(first.dir.x, -first.dir.z);
  const rotation = -firstHeading;

  return segments.map((segment) => ({
    ...segment,
    start: RotateVec2(
      {
        x: segment.start.x - origin.x,
        z: segment.start.z - origin.z,
      },
      rotation,
    ),
    dir: NormalizeVec2(RotateVec2(segment.dir, rotation)),
  }));
}

export function BuildDrivingRoute(variant: DrivingRouteVariant): RouteSegment[] {
  return BuildRoute(variant.points);
}

export function PickRandomDrivingRoute(): DrivingRouteVariant {
  let storedLastRouteId: string | null = null;
  try {
    storedLastRouteId = typeof window !== 'undefined'
      ? window.localStorage?.getItem(lastRouteStorageKey)
      : null;
  } catch {
    storedLastRouteId = null;
  }
  const previousRouteId = lastPickedRouteId ?? storedLastRouteId;
  const candidates = drivingRouteVariants.length > 1
    ? drivingRouteVariants.filter((route) => route.id !== previousRouteId)
    : drivingRouteVariants;
  const selected = candidates[Math.floor(Math.random() * candidates.length)] ?? drivingRouteVariants[0];
  lastPickedRouteId = selected.id;
  try {
    if (typeof window !== 'undefined') {
      window.localStorage?.setItem(lastRouteStorageKey, selected.id);
    }
  } catch {
    // Private browsing or storage policy can reject localStorage.
  }
  return selected;
}

export const drivingRoute: readonly RouteSegment[] = BuildDrivingRoute(drivingRouteVariants[0]);

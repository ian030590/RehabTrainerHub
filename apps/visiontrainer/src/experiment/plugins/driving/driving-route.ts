import type { RouteSegment, Vec2 } from './types';

const TAIPEI_CENTER_LON = 121.5618;
const TAIPEI_CENTER_LAT = 25.0345;
const TAIPEI_CENTER_X = 60;
const TAIPEI_CENTER_Z = 178;
const METERS_PER_LATITUDE_DEGREE = 111_320;
const METERS_PER_LONGITUDE_DEGREE = METERS_PER_LATITUDE_DEGREE * Math.cos(TAIPEI_CENTER_LAT * Math.PI / 180);
const OSM_TO_SCENE_SCALE = 1;
const URBAN_LANE_WIDTH_M = 3.25;

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

export function projectTaipeiLonLat(lon: number, lat: number): Vec2 {
  return {
    x: TAIPEI_CENTER_X + (lon - TAIPEI_CENTER_LON) * METERS_PER_LONGITUDE_DEGREE * OSM_TO_SCENE_SCALE,
    z: TAIPEI_CENTER_Z - (lat - TAIPEI_CENTER_LAT) * METERS_PER_LATITUDE_DEGREE * OSM_TO_SCENE_SCALE,
  };
}

function roadWidthFromLanes(lanes: number, shoulderWidth = 1.2): number {
  return lanes * URBAN_LANE_WIDTH_M + shoulderWidth;
}

const XINYI_3_LANE = roadWidthFromLanes(3);
const XINYI_4_LANE = roadWidthFromLanes(4, 1.4);
const KEELUNG_3_LANE = roadWidthFromLanes(3);
const CITY_HALL_2_LANE = roadWidthFromLanes(2, 1.2);
const SONGSHOU_4_LANE = roadWidthFromLanes(4, 1.8);
const SONGZHI_6_LANE = roadWidthFromLanes(6, 2.0);

const xinyiKeelungLoop: readonly RouteControlPoint[] = [
  {
    lon: 121.5576717,
    lat: 25.0297961,
    roadWidth: KEELUNG_3_LANE,
    laneCount: 3,
    oneWay: true,
    name: 'Keelung Road Section 2',
  },
  {
    lon: 121.5589772,
    lat: 25.0318959,
    roadWidth: KEELUNG_3_LANE,
    laneCount: 3,
    oneWay: true,
    name: 'Keelung Road Section 2',
  },
  {
    lon: 121.5590422,
    lat: 25.0320558,
    roadWidth: KEELUNG_3_LANE,
    laneCount: 3,
    oneWay: true,
    name: 'Keelung Road Section 2',
  },
  {
    lon: 121.5596234,
    lat: 25.0329882,
    roadWidth: XINYI_3_LANE,
    laneCount: 3,
    oneWay: true,
    name: 'Xinyi Road Section 5',
  },
  {
    lon: 121.5597077,
    lat: 25.0331059,
    roadWidth: XINYI_3_LANE,
    laneCount: 3,
    oneWay: true,
    name: 'Xinyi Road Section 5',
  },
  {
    lon: 121.5599064,
    lat: 25.0330834,
    roadWidth: XINYI_3_LANE,
    laneCount: 3,
    oneWay: true,
    name: 'Xinyi Road Section 5',
  },
  {
    lon: 121.5654166,
    lat: 25.032958,
    roadWidth: XINYI_4_LANE,
    laneCount: 4,
    oneWay: true,
    name: 'Xinyi Road Section 5',
  },
  {
    lon: 121.5654148,
    lat: 25.0328457,
    roadWidth: SONGZHI_6_LANE,
    laneCount: 6,
    oneWay: false,
    name: 'Songzhi Road',
  },
  {
    lon: 121.5654635,
    lat: 25.0358704,
    roadWidth: SONGSHOU_4_LANE,
    laneCount: 4,
    oneWay: false,
    name: 'Songshou Road',
  },
  {
    lon: 121.5635641,
    lat: 25.035905,
    roadWidth: CITY_HALL_2_LANE,
    laneCount: 2,
    oneWay: true,
    name: 'City Hall Road',
  },
  {
    lon: 121.5636052,
    lat: 25.0357702,
    roadWidth: CITY_HALL_2_LANE,
    laneCount: 2,
    oneWay: true,
    name: 'City Hall Road',
  },
  {
    lon: 121.5635362,
    lat: 25.0330043,
    roadWidth: XINYI_3_LANE,
    laneCount: 3,
    oneWay: true,
    name: 'Xinyi Road Section 5',
  },
  {
    lon: 121.5654166,
    lat: 25.032958,
    roadWidth: XINYI_4_LANE,
    laneCount: 4,
    oneWay: true,
    name: 'Xinyi Road Section 5',
  },
  {
    lon: 121.5654148,
    lat: 25.0328457,
    roadWidth: XINYI_4_LANE,
    laneCount: 4,
    oneWay: true,
    name: 'Xinyi Road Section 5',
  },
  {
    lon: 121.568228,
    lat: 25.0327688,
    roadWidth: XINYI_4_LANE,
    laneCount: 4,
    oneWay: true,
    name: 'Xinyi Road Section 5',
  },
];

const cityHallLoop: readonly RouteControlPoint[] = [
  {
    lon: 121.5596234,
    lat: 25.0329882,
    roadWidth: XINYI_3_LANE,
    laneCount: 3,
    oneWay: true,
    name: 'Xinyi Road Section 5',
  },
  {
    lon: 121.5599064,
    lat: 25.0330834,
    roadWidth: XINYI_3_LANE,
    laneCount: 3,
    oneWay: true,
    name: 'Xinyi Road Section 5',
  },
  {
    lon: 121.5654166,
    lat: 25.032958,
    roadWidth: XINYI_4_LANE,
    laneCount: 4,
    oneWay: true,
    name: 'Xinyi Road Section 5',
  },
  {
    lon: 121.5654148,
    lat: 25.0328457,
    roadWidth: SONGZHI_6_LANE,
    laneCount: 6,
    oneWay: false,
    name: 'Songzhi Road',
  },
  {
    lon: 121.5654635,
    lat: 25.0358704,
    roadWidth: SONGSHOU_4_LANE,
    laneCount: 4,
    oneWay: false,
    name: 'Songshou Road',
  },
  {
    lon: 121.5635641,
    lat: 25.035905,
    roadWidth: CITY_HALL_2_LANE,
    laneCount: 2,
    oneWay: true,
    name: 'City Hall Road',
  },
  {
    lon: 121.5636052,
    lat: 25.0357702,
    roadWidth: CITY_HALL_2_LANE,
    laneCount: 2,
    oneWay: true,
    name: 'City Hall Road',
  },
  {
    lon: 121.5635362,
    lat: 25.0330043,
    roadWidth: XINYI_3_LANE,
    laneCount: 3,
    oneWay: true,
    name: 'Xinyi Road Section 5',
  },
  {
    lon: 121.5654166,
    lat: 25.032958,
    roadWidth: XINYI_4_LANE,
    laneCount: 4,
    oneWay: true,
    name: 'Xinyi Road Section 5',
  },
  {
    lon: 121.5654148,
    lat: 25.0328457,
    roadWidth: XINYI_4_LANE,
    laneCount: 4,
    oneWay: true,
    name: 'Xinyi Road Section 5',
  },
  {
    lon: 121.568228,
    lat: 25.0327688,
    roadWidth: XINYI_4_LANE,
    laneCount: 4,
    oneWay: true,
    name: 'Xinyi Road Section 5',
  },
];

const xinyiEastDelivery: readonly RouteControlPoint[] = [
  {
    lon: 121.5597077,
    lat: 25.0331059,
    roadWidth: XINYI_3_LANE,
    laneCount: 3,
    oneWay: true,
    name: 'Xinyi Road Section 5',
  },
  {
    lon: 121.5599064,
    lat: 25.0330834,
    roadWidth: XINYI_3_LANE,
    laneCount: 3,
    oneWay: true,
    name: 'Xinyi Road Section 5',
  },
  {
    lon: 121.5635362,
    lat: 25.0330043,
    roadWidth: XINYI_3_LANE,
    laneCount: 3,
    oneWay: true,
    name: 'Xinyi Road Section 5',
  },
  {
    lon: 121.5654166,
    lat: 25.032958,
    roadWidth: XINYI_4_LANE,
    laneCount: 4,
    oneWay: true,
    name: 'Xinyi Road Section 5',
  },
  {
    lon: 121.5654148,
    lat: 25.0328457,
    roadWidth: SONGZHI_6_LANE,
    laneCount: 6,
    oneWay: false,
    name: 'Songzhi Road',
  },
  {
    lon: 121.5654635,
    lat: 25.0358704,
    roadWidth: SONGSHOU_4_LANE,
    laneCount: 4,
    oneWay: false,
    name: 'Songshou Road',
  },
  {
    lon: 121.5635641,
    lat: 25.035905,
    roadWidth: SONGSHOU_4_LANE,
    laneCount: 4,
    oneWay: false,
    name: 'Songshou Road',
  },
  {
    lon: 121.5636052,
    lat: 25.0357702,
    roadWidth: CITY_HALL_2_LANE,
    laneCount: 2,
    oneWay: true,
    name: 'City Hall Road',
  },
  {
    lon: 121.5635362,
    lat: 25.0330043,
    roadWidth: XINYI_3_LANE,
    laneCount: 3,
    oneWay: true,
    name: 'Xinyi Road Section 5',
  },
  {
    lon: 121.5654166,
    lat: 25.032958,
    roadWidth: XINYI_4_LANE,
    laneCount: 4,
    oneWay: true,
    name: 'Xinyi Road Section 5',
  },
  {
    lon: 121.568228,
    lat: 25.0327688,
    roadWidth: XINYI_4_LANE,
    laneCount: 4,
    oneWay: true,
    name: 'Xinyi Road Section 5',
  },
];

export const DRIVING_ROUTE_VARIANTS: readonly DrivingRouteVariant[] = [
  { id: 'xinyi-keelung-loop', label: 'Xinyi-Keelung loop', points: xinyiKeelungLoop },
  { id: 'city-hall-loop', label: 'City Hall loop', points: cityHallLoop },
  { id: 'xinyi-east-delivery', label: 'Xinyi east delivery', points: xinyiEastDelivery },
];

function buildRoute(points: readonly RouteControlPoint[]): RouteSegment[] {
  const segments: RouteSegment[] = [];
  for (let i = 0; i < points.length - 1; i += 1) {
    const start = projectTaipeiLonLat(points[i].lon, points[i].lat);
    const end = projectTaipeiLonLat(points[i + 1].lon, points[i + 1].lat);
    const dx = end.x - start.x;
    const dz = end.z - start.z;
    const length = Math.hypot(dx, dz);
    if (length < 0.5) continue;
    segments.push({
      start,
      dir: { x: dx / length, z: dz / length },
      length,
      roadWidth: points[i].roadWidth,
      laneCount: points[i].laneCount,
      oneWay: points[i].oneWay,
      name: points[i].name,
    });
  }
  return segments;
}

export function buildDrivingRoute(variant: DrivingRouteVariant): RouteSegment[] {
  return buildRoute(variant.points);
}

export function pickRandomDrivingRoute(): DrivingRouteVariant {
  return DRIVING_ROUTE_VARIANTS[Math.floor(Math.random() * DRIVING_ROUTE_VARIANTS.length)] ?? DRIVING_ROUTE_VARIANTS[0];
}

export const DRIVING_ROUTE: readonly RouteSegment[] = buildDrivingRoute(DRIVING_ROUTE_VARIANTS[0]);

export const eyeOffset = 2.5;
export const cameraHeight = 1;
export const laneWidth = 3.75;
export const laneDividers = [-laneWidth / 2, laneWidth / 2];
export const roadSurfaces = { grass: 'grass', shoulder: 'shoulder', dry: 'road', wet: 'wet-road' } as const;
const segmentLength = 5;
const dashLength = 4;
const dashCycle = 10;

export function SceneMetrics(width: number, height: number) {
  return { width, height, horizon: .445 * height, focal: Math.min(2.1 * height, 4.3 * width) };
}

export function ProjectPoint(scene: ReturnType<typeof SceneMetrics>, laneX: number, z: number, elevation = 0) {
  const scale = scene.focal / z;
  return { x: scene.width / 2 + laneX * scale, y: scene.horizon + (cameraHeight - elevation) * scale, scale };
}

export function ProjectCar(scene: ReturnType<typeof SceneMetrics>, laneX: number, z: number, widthMeters: number, aspect: number) {
  const point = ProjectPoint(scene, laneX, z);
  const width = widthMeters * point.scale;
  const height = width * aspect;
  return { x: point.x - width / 2, y: point.y - height, width, height };
}

export function ProjectTargetCar(scene: ReturnType<typeof SceneMetrics>, laneX: number, z: number, widthMeters: number,
  aspect: number, dashboardTop: number) {
  const contactWidth = 1.05 * Math.min(scene.width, .7 * scene.height);
  const contactDepth = widthMeters * scene.focal / contactWidth;
  const depth = Math.max(z, contactDepth);
  const car = ProjectCar(scene, laneX, depth, widthMeters, aspect);
  const contactBottom = scene.horizon + cameraHeight * contactWidth / widthMeters;
  const bumperInset = .08 * contactWidth;
  // Blend into the dashboard framing as the target approaches its contact size.
  const approach = Math.max(0, 2 - depth / contactDepth);
  const offset = Math.max(0, dashboardTop + bumperInset - contactBottom) * approach;
  return { ...car, y: car.y + offset };
}

export function ProjectLamp(car: ReturnType<typeof ProjectCar>, fractions: readonly number[], outward = 0) {
  const [fx, fy, fw, fh] = fractions;
  const extension = outward ? Math.max(1, car.width * fw * .12) : 0;
  const width = Math.max(2, car.width * fw) + extension;
  const height = Math.max(2, car.height * fh);
  const centerX = car.x + car.width * (fx + fw / 2) + outward * extension / 2;
  const centerY = car.y + car.height * (fy + fh / 2);
  return [centerX - width / 2, centerY - height / 2, width, height] as const;
}

export function SceneGeometry(scene: ReturnType<typeof SceneMetrics>, controlsTop = scene.height) {
  const { width, height, focal, horizon } = scene;
  const roadEdge = 1.5 * laneWidth;
  const railX = roadEdge + .65;
  const edgeDepth = 2 * railX * focal / width;
  const mountainDepth = 400;
  const mountain = [[0, 6], [.09, 9], [.19, 5], [.29, 8], [.36, 4], [.47, 6], [.58, 4],
    [.68, 9], [.77, 7], [.87, 11], [1, 6], [1, 1], [0, 1]].map(([x, elevation]) => ({
    x: x * width,
    y: ProjectPoint(scene, 0, mountainDepth, elevation).y,
  }));
  const rise = Math.min(10, .016 * height);
  const centerY = Math.max(0, Math.min(.86 * height, controlsTop - rise - 6));
  return {
    roadEdge, shoulderEdge: roadEdge + .8, railX,
    nearZ: focal * cameraHeight / (height - horizon),
    railStart: Math.min(5, edgeDepth),
    lampStart: Math.min(35, edgeDepth),
    mountain,
    dashboard: {
      left: { x: 0, y: centerY + rise },
      control: { x: width / 2, y: centerY - rise },
      right: { x: width, y: centerY + rise },
      centerY,
    },
  };
}

type Dashboard = ReturnType<typeof SceneGeometry>['dashboard'];

export function DashboardTopAt(dashboard: Dashboard, x: number) {
  const offset = x / dashboard.control.x - 1;
  return dashboard.centerY + (dashboard.left.y - dashboard.centerY) * offset ** 2;
}

export function VisibleCarRect(car: ReturnType<typeof ProjectCar>, canvasWidth: number, clip: number, dashboard: Dashboard) {
  const left = Math.max(0, car.x);
  const right = Math.min(canvasWidth, car.x + car.width);
  const top = Math.max(0, car.y);
  const bottom = Math.min(clip, car.y + car.height, Math.max(DashboardTopAt(dashboard, left), DashboardTopAt(dashboard, right)));
  if (right <= left || bottom <= top) return;
  return [left, top, right - left, bottom - top] as const;
}

export function BuildSegments(cameraPosition: number, near: number, far: number) {
  const first = Math.floor((cameraPosition + near) / segmentLength);
  const last = Math.ceil((cameraPosition + far) / segmentLength);
  return Array.from({ length: last - first }, (_, offset) => {
    const index = first + offset;
    return {
      near: index * segmentLength - cameraPosition,
      far: (index + 1) * segmentLength - cameraPosition,
      surfaces: roadSurfaces,
    };
  });
}

export function LaneDashes(cameraPosition: number, near: number, far: number) {
  const dashes: [number, number][] = [];
  const phase = cameraPosition % dashCycle;
  let start = Math.floor((near + phase) / dashCycle) * dashCycle - phase;
  for (; start < far; start += dashCycle) {
    const end = Math.min(start + dashLength, far);
    if (end > near) dashes.push([Math.max(start, near), end]);
  }
  return dashes;
}

import type { Settings } from '../settings.js';
import type { DrivingFrame } from './drivePresentation.js';
import { PaintImpact, type ImpactFrame } from './impact.js';
import { BuildRoadside, CompareDepth, eyeOffset, LaneDashes, laneDividers, laneWidth, ProjectCar,
  ProjectPoint, ProjectTargetCar, SceneGeometry, SceneMetrics, VisibleCarRect } from './projection.js';
import { LaneAt, type MakeRound } from './round.js';
import { Alpha, Bloom, palette } from './scenePalette.js';
import { LampGlow, PaintVehicle, VehicleTypes, vehicleStyles } from './vehicles.js';

type Point = { x: number; y: number };
type SceneFrame = { time: number; elapsed: number; reducedMotion: boolean; impact?: ImpactFrame };
type DepthItem = { kind: 'car' | 'rail' | 'post' | 'reflector' | 'lamp'; z: number; paint: () => void };

export function MakeRoad(canvas: HTMLCanvasElement, round: ReturnType<typeof MakeRound>, settings: Settings, controls: HTMLElement) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return () => {};
  const vehicles = VehicleTypes(settings.leadType, round.messageSeed, round.decoys.length);
  const dentSide = round.messageSeed % 2 ? 1 : -1;

  return function Draw(drive: ReturnType<typeof DrivingFrame>, frame: SceneFrame) {
    const { x: canvasX, y: canvasY, width, height } = canvas.getBoundingClientRect();
    const ratio = Math.min(2, devicePixelRatio);
    const pixelsWide = Math.round(width * ratio);
    const pixelsHigh = Math.round(height * ratio);
    if (!pixelsWide || !pixelsHigh) return;
    if (canvas.width !== pixelsWide || canvas.height !== pixelsHigh) {
      canvas.width = pixelsWide;
      canvas.height = pixelsHigh;
    }
    const context = ctx!;
    context.setTransform(pixelsWide / width, 0, 0, pixelsHigh / height, 0, 0);
    const { time, elapsed, reducedMotion, impact } = frame;
    const base = SceneMetrics(width, height);
    const zoom = impact?.zoom ?? 1;
    const shake = impact?.shake ?? 0;
    const bob = reducedMotion ? 0 : Math.sin(drive.distance * .28) * Math.min(1, drive.speed / 18) * height * .0028;
    const pitch = reducedMotion ? 0 : height * drive.pitch * .025;
    const scene = { ...base, focal: base.focal * zoom, horizon: base.horizon + bob + pitch };
    const { horizon } = scene;
    const geometry = SceneGeometry(scene, controls.getBoundingClientRect().top - canvasY);
    const { dashboard, roadEdge, shoulderEdge, railX, railStart } = geometry;
    const cameraDistance = drive.distance - eyeOffset;
    const near = Math.max(.7, geometry.nearZ * .9);
    const far = 650;
    const project = (x: number, z: number, elevation = 0) => ProjectPoint(scene, x, z, elevation);
    const items: DepthItem[] = [];
    let targetRect: ReturnType<typeof VisibleCarRect>;
    let targetLamps: ReturnType<typeof PaintVehicle> = [];

    PaintLandscape();
    context.save();
    context.translate(shake, shake * .35);
    const topZ = far;
    Polygon([project(-shoulderEdge, near), project(shoulderEdge, near), project(shoulderEdge, topZ),
      project(-shoulderEdge, topZ)], palette.shoulder);
    const wet = settings.road === 'wet';
    Polygon([project(-roadEdge, near), project(roadEdge, near), project(roadEdge, topZ),
      project(-roadEdge, topZ)], Gradient(project(0, topZ).y, height, wet ? palette.wetFar : palette.roadFar, wet ? palette.wetNear : palette.roadNear));
    context.save();
    context.clip();
    context.globalCompositeOperation = 'lighter';
    Bloom(context, width * .50, height * .745, Math.min(width * .48, height * .67), palette.headlight, wet ? .15 : .21, .57);
    context.restore();
    Stripe(-roadEdge + .075, near, far, .075, palette.edgeYellow);
    Stripe(roadEdge - .075, near, far, .075, palette.lane);
    for (const [start, end] of LaneDashes(cameraDistance, near, far)) {
      for (const lane of laneDividers) Stripe(lane, start, end, .075, palette.lane);
    }

    for (const object of BuildRoadside(cameraDistance, near, 300, Math.max(.7, Math.min(near, railStart)))) {
      const { kind, side, z, far: end } = object;
      items.push({ kind, z, paint: () => PaintRoadside(kind, side, z, end) });
    }
    const gap = impact ? impact.push : Math.max(0, drive.motion?.gap ?? round.gap);
    const moving = round.moves.find(move => move.signal <= time && time < move.end);
    const blink = moving && (reducedMotion || (time - moving.signal) % (1000 / 1.5) < 500 / 1.5);
    for (const [index, car] of round.decoys.entries()) {
      if (car.appears > time) continue;
      const decoyGap = car.gap + car.speedDelta * (time - car.appears) / 1000;
      const brakes = car.brakes.some(([start, end]) => start <= time && time < end);
      AddVehicle(vehicles.decoys[index], car.lane, decoyGap, brakes);
    }
    const braking = Boolean(drive.motion);
    if (round.target === 'far') AddVehicle(vehicles.far, 0, gap, braking, 0, true);
    AddVehicle(vehicles.lead, LaneAt(round.moves, time),
      round.target === 'lead' ? gap : round.leadGap + 3 * elapsed, braking && round.target === 'lead',
      blink ? Math.sign(moving.to - moving.from) : 0, round.target === 'lead');

    context.beginPath();
    context.rect(-shake, -shake * .35, width, height);
    context.clip();
    items.sort(CompareDepth).forEach(item => item.paint());
    context.restore();
    PaintHood(braking, impact);
    if (impact) PaintImpact(context, width, height, dashboard.centerY, impact, round.messageSeed, dentSide);

    canvas.dataset.dashboardTop = String(canvasY + dashboard.centerY);
    canvas.dataset.worldDistance = String(drive.distance);
    canvas.dataset.cameraZoom = String(zoom);
    if (impact) canvas.dataset.impact = impact.grade;
    else delete canvas.dataset.impact;
    if (targetRect) {
      const [left, top, visibleWidth, visibleHeight] = targetRect;
      canvas.dataset.targetRect = [canvasX + left, canvasY + top, visibleWidth, visibleHeight].join(',');
      canvas.dataset.targetLamps = JSON.stringify(targetLamps.map(([x, y, w, h]) => [canvasX + x + shake, canvasY + y + shake * .35, w, h]));
    } else {
      delete canvas.dataset.targetRect;
      delete canvas.dataset.targetLamps;
    }

    function Gradient(start: number, end: number, top: string, bottom: string) {
      const gradient = context.createLinearGradient(0, start, 0, end);
      gradient.addColorStop(0, top);
      gradient.addColorStop(1, bottom);
      return gradient;
    }

    function Polygon(points: readonly Point[], color: string | CanvasGradient) {
      context.fillStyle = color;
      context.beginPath();
      context.moveTo(points[0].x, points[0].y);
      for (const point of points.slice(1)) context.lineTo(point.x, point.y);
      context.closePath();
      context.fill();
    }

    function Line(points: readonly Point[], color: string, weight: number) {
      context.strokeStyle = color;
      context.lineWidth = weight;
      context.beginPath();
      context.moveTo(points[0].x, points[0].y);
      for (const point of points.slice(1)) context.lineTo(point.x, point.y);
      context.stroke();
    }

    function Stripe(x: number, start: number, end: number, half: number, color: string) {
      Polygon([project(x - half, start), project(x + half, start), project(x + half, end), project(x - half, end)], color);
    }

    function PaintLandscape() {
      const sky = Gradient(0, horizon, palette.sky, palette.skyHorizon);
      sky.addColorStop(.65, palette.skyMiddle);
      context.fillStyle = sky;
      context.fillRect(0, 0, width, height);
      for (let i = 0; i < 29; i++) {
        const x = ((i * .6180339 + .13) % 1) * width;
        const y = ((i * .37805 + .06) % 1) * horizon * .82;
        context.globalAlpha = reducedMotion ? .51 : .55 + .24 * Math.sin(i * 3.1 + time * .0017);
        context.fillStyle = palette.star;
        const size = i % 5 === 0 ? 1.7 : 1;
        context.fillRect(x, y, size, size);
      }
      context.globalAlpha = 1;
      Bloom(context, width * .54, horizon, Math.max(width * .53, height * .45), palette.horizonGlow, .24, .25);
      context.fillStyle = Gradient(horizon, height, palette.ground, palette.groundNear);
      context.fillRect(0, horizon, width, height - horizon);
      const mountains = geometry.mountain.slice(0, -2);
      for (const [index, color] of [palette.mountainFar, palette.mountainNear].entries()) {
        const ridge = mountains.map((point, i) => ({
          x: point.x, y: horizon + (point.y - horizon) * (index ? .57 + .24 * Math.sin(i * 2) : 1.16),
        }));
        context.globalAlpha = index ? .26 : .55;
        Line(ridge, palette.mountainRim, index ? 1 : .75);
        context.globalAlpha = 1;
        Polygon([...ridge, { x: width, y: horizon + 2 }, { x: 0, y: horizon + 2 }], color);
      }
      context.fillStyle = palette.city;
      for (let i = 0; i < 31; i++) {
        const x = ((i * .3187 + .11) % 1) * width;
        if (Math.abs(x - width / 2) < width * .06) continue;
        context.globalAlpha = .24 + (i % 5) * .11;
        context.fillRect(x, horizon - 2 + (i % 4), i % 6 === 0 ? 2 : 1, 1);
      }
      context.globalAlpha = 1;
    }

    function PaintRoadside(kind: Exclude<DepthItem['kind'], 'car'>, side: number, z: number, end: number) {
      const edge = side * railX;
      if (kind === 'rail') {
        const top = side < 0 ? .76 : .62;
        const bottom = side < 0 ? .08 : .35;
        const upperNear = project(edge, z, top);
        const upperFar = project(edge, end, top);
        const lowerFar = project(edge, end, bottom);
        Polygon([upperNear, upperFar, lowerFar, project(edge, z, bottom)], side < 0 ? palette.median : palette.rail);
        Line([upperNear, upperFar], side < 0 ? palette.medianRim : palette.railRim, Math.min(3, Math.max(.45, upperNear.scale * .028)));
        Line([upperFar, lowerFar], palette.shade, Math.min(2, Math.max(.45, upperFar.scale * .034)));
        return;
      }
      if (kind === 'lamp') {
        const foot = project(side * 8.3, z);
        const top = project(side * 8.3, z, 9.5);
        const arm = project(side * 7.45, z, 9.55);
        const lamp = project(side * 6.2, z, 9.35);
        const radius = Math.min(55, Math.max(3, lamp.scale * .60));
        Line([foot, top, arm, lamp], palette.pole, Math.min(5, Math.max(.65, foot.scale * .062)));
        if (lamp.x + radius < 0 || lamp.x - radius > width || lamp.y + radius < 0) return;
        context.save();
        context.globalCompositeOperation = 'lighter';
        Bloom(context, lamp.x, lamp.y, radius, palette.lampGlow, .74, .78);
        context.restore();
        context.fillStyle = palette.lampCore;
        const core = Math.max(1, radius * .35);
        context.fillRect(lamp.x - core / 2, lamp.y - 1, core, Math.max(1.2, radius * .085));
        return;
      }
      const reflector = kind === 'reflector';
      const x = reflector ? shoulderEdge + .14 : edge;
      const bottom = project(x, z);
      const top = project(x, z, reflector ? 1.05 : .59);
      Line([bottom, top], reflector ? palette.reflectorPost : palette.rail, Math.min(8, Math.max(.65, top.scale * .085)));
      if (reflector) {
        const size = Math.min(8, Math.max(1.3, top.scale * .10));
        context.fillStyle = palette.reflector;
        context.fillRect(top.x - size / 2, top.y + size * .45, size, size * .78);
      }
    }

    function AddVehicle(type: Settings['leadType'], lane: number, vehicleGap: number, brakes: boolean, signal = 0, target = false) {
      const z = vehicleGap + eyeOffset;
      if (z <= 0 || z > far) return;
      items.push({ kind: 'car', z, paint: () => {
        const style = vehicleStyles[type];
        const x = lane * laneWidth;
        const car = target
          ? ProjectTargetCar(scene, x, z, style.widthMeters, style.aspect, dashboard.centerY, zoom)
          : ProjectCar(scene, x, z, style.widthMeters, style.aspect);
        if (car.x + car.width < 0 || car.x > width || car.y + car.height < 0 || car.y > height) return;
        const lamps = PaintVehicle(context, car, type, car.width / style.widthMeters, LampGlow(scene.focal, z),
          brakes, signal, target ? impact?.grade : undefined, dentSide);
        if (!target) return;
        targetRect = VisibleCarRect({ ...car, x: car.x + shake, y: car.y + shake * .35 }, width, height, dashboard);
        targetLamps = lamps;
      } });
    }

    function PaintHood(brakes: boolean, damage: ImpactFrame | undefined) {
      const { centerY, left, right, control } = dashboard;
      const dent = damage?.grade === 'severe' ? height * .047 : damage?.grade === 'moderate' ? height * .025 : 0;
      context.save();
      context.fillStyle = Gradient(centerY - dent - 10, height, palette.hoodFar, palette.hoodNear);
      HoodLine();
      context.lineTo(width, height);
      context.lineTo(0, height);
      context.closePath();
      context.fill();
      context.save();
      context.clip();
      context.globalCompositeOperation = 'lighter';
      Bloom(context, width * .50, centerY + height * .047, width * .43, palette.hoodWarm, .14, .20);
      if (brakes) Bloom(context, width * .50, centerY, width * .33, palette.brakeGlow, .12, .24);
      context.restore();
      HoodLine();
      context.strokeStyle = palette.hoodRim;
      context.lineWidth = 1.5;
      context.stroke();
      for (const side of [-1, 1]) {
        context.beginPath();
        context.moveTo(width * (.50 + side * .14), centerY + 3);
        context.quadraticCurveTo(width * (.50 + side * .29), centerY + height * .035, width * (.50 + side * .45), height);
        context.strokeStyle = Alpha(palette.hoodReflection, .22);
        context.lineWidth = 1.5;
        context.stroke();
      }
      if (dent) {
        const x = width * (.50 + dentSide * .14);
        Line([{ x: x - width * .16, y: centerY + dent * .7 }, { x, y: centerY - dent * .3 },
          { x: x + width * .10, y: centerY + dent * 1.6 }, { x: x + width * .23, y: centerY + dent * 2.2 }], palette.crease, 3);
      }
      context.restore();

      function HoodLine() {
        context.beginPath();
        context.moveTo(left.x, left.y);
        if (dent) {
          const x = width * (.50 + dentSide * .14);
          context.bezierCurveTo(width * .18, control.y, x - width * .09, centerY + dent, x, centerY - dent * .55);
          context.bezierCurveTo(x + width * .09, centerY + dent, width * .84, control.y, right.x, right.y);
        } else context.quadraticCurveTo(control.x, control.y, right.x, right.y);
      }
    }
  };
}

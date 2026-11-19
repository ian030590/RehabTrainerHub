import atlasUrl from '../sprites/cars.webp?url';
import { frames } from '../sprites/cars.json';
import type { Settings } from '../settings.js';
import { CarFrames } from './carFrames.js';
import { BuildSegments, cameraHeight, eyeOffset, LaneDashes, laneDividers, laneWidth, ProjectCar, ProjectLamp,
  ProjectPoint, ProjectTargetCar, SceneGeometry, SceneMetrics, VisibleCarRect } from './projection.js';
import { LaneAt, type MakeRound } from './round.js';
import type { ModelFor, Motion } from './physics.js';

type Sprite = { z: number; paint: (clip: number) => void };
type Point = { x: number; y: number };

let atlasPromise: Promise<HTMLImageElement | null> | undefined;

export function LoadCarAtlas() {
  atlasPromise ??= new Promise(resolve => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => resolve(null);
    image.src = atlasUrl;
  });
  return atlasPromise;
}

export function MakeRoad(canvas: HTMLCanvasElement, atlas: HTMLImageElement | null, round: ReturnType<typeof MakeRound>,
  leadType: Settings['leadType'], controls?: HTMLElement) {
  const context = canvas.getContext('2d');
  if (!context) return () => {};
  const styles = getComputedStyle(canvas);
  const palette = new Map<string, string>();
  const keys = CarFrames(leadType, round.messageSeed, round.decoys.length);

  function Color(token: string) {
    if (!palette.has(token)) palette.set(token, styles.getPropertyValue('--' + token).trim());
    return palette.get(token)!;
  }

  function Draw(model: ReturnType<typeof ModelFor>, time: number, motion: ReturnType<typeof Motion> | undefined,
    elapsed: number, wet: boolean, highlight = false) {
    const { x: canvasX, y: canvasY, width, height } = canvas.getBoundingClientRect();
    const ratio = Math.min(2, devicePixelRatio);
    const pixelsWide = Math.round(width * ratio);
    const pixelsHigh = Math.round(height * ratio);
    if (!pixelsWide || !pixelsHigh) {
      delete canvas.dataset.targetRect;
      delete canvas.dataset.targetLamps;
      delete canvas.dataset.dashboardTop;
      return;
    }
    if (canvas.width !== pixelsWide || canvas.height !== pixelsHigh) {
      canvas.width = pixelsWide;
      canvas.height = pixelsHigh;
    }
    const pixelScaleY = pixelsHigh / height;
    const ctx = context!;
    ctx.setTransform(pixelsWide / width, 0, 0, pixelScaleY, 0, 0);
    ctx.imageSmoothingQuality = 'high';
    const scene = SceneMetrics(width, height);
    const { horizon } = scene;
    const controlsTop = controls ? controls.getBoundingClientRect().top - canvasY : height;
    const { roadEdge, shoulderEdge, nearZ, railX, railStart, lampStart, mountain, dashboard } = SceneGeometry(scene, controlsTop);
    const project = (x: number, z: number, y = 0) => ProjectPoint(scene, x, z, y);
    const rasterY = (y: number) => Math.round(y * pixelScaleY) / pixelScaleY;
    const roadX = (x: number, y: number) => width / 2 + x * (y - horizon) / cameraHeight;
    const farZ = 650;
    const ownDistance = motion ? model.speed * round.onset / 1000 + motion.ownDistance : model.speed * time / 1000;
    const cameraPosition = ownDistance - eyeOffset;
    let targetRect: ReturnType<typeof VisibleCarRect>;
    const targetLamps: ReturnType<typeof ProjectLamp>[] = [];

    function Rect(token: string, x: number, y: number, w: number, h: number) {
      ctx.fillStyle = Color(token);
      ctx.fillRect(x, y, w, h);
    }

    function Polygon(token: string, points: Point[]) {
      ctx.fillStyle = Color(token);
      ctx.beginPath();
      ctx.moveTo(points[0].x, points[0].y);
      for (const { x, y } of points.slice(1)) ctx.lineTo(x, y);
      ctx.closePath();
      ctx.fill();
    }

    function Stripe(token: string, laneX: number, near: number, far: number, halfWidth: number) {
      Polygon(token, [
        project(laneX - halfWidth, near), project(laneX + halfWidth, near),
        project(laneX + halfWidth, far), project(laneX - halfWidth, far),
      ]);
    }

    const sky = ctx.createLinearGradient(0, 0, 0, horizon);
    sky.addColorStop(0, Color('sky'));
    sky.addColorStop(.72, Color('sky-low'));
    sky.addColorStop(1, Color('dusk'));
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, width, height);
    for (const [x, y, size] of [[.08, .33, 1.4], [.24, .18, 1], [.39, .46, 1], [.62, .21, 1.5], [.76, .37, 1], [.88, .12, 1.5]]) {
      Rect('star', width * x, horizon * y, size, size);
    }
    Rect('grass', 0, horizon, width, height - horizon);
    Polygon('mountain', mountain);

    const segments = BuildSegments(cameraPosition, nearZ, farZ).map(segment => ({ ...segment, clip: height }));
    let maxY = height;
    for (const segment of segments) {
      segment.clip = maxY;
      const far = Math.min(segment.far, farZ);
      const farY = project(0, far).y;
      if (farY >= maxY) continue;
      const top = rasterY(farY);
      const bottom = rasterY(maxY);
      const { grass, shoulder, dry, wet: wetRoad } = segment.surfaces;
      Rect(grass, 0, top, width, bottom - top);
      for (const [token, halfWidth] of [[shoulder, shoulderEdge], [wet ? wetRoad : dry, roadEdge]] as const) {
        Polygon(token, [
          { x: roadX(-halfWidth, bottom), y: bottom }, { x: roadX(halfWidth, bottom), y: bottom },
          { x: roadX(halfWidth, top), y: top }, { x: roadX(-halfWidth, top), y: top },
        ]);
      }
      maxY = farY;
    }

    function BelowClip(z: number, paint: (clip: number) => void) {
      const segment = segments.find(item => z < item.far);
      const clip = segment?.clip ?? maxY;
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, 0, width, clip);
      ctx.clip();
      paint(clip);
      ctx.restore();
    }

    // On a flat road a whole dash can use its nearest segment's clip, even across a segment boundary.
    Stripe('edge-yellow', -roadEdge + .075, nearZ, farZ, .075);
    Stripe('lane', roadEdge - .075, nearZ, farZ, .075);
    for (const [near, far] of LaneDashes(cameraPosition, nearZ, farZ)) {
      BelowClip(near, () => {
        for (const lane of laneDividers) Stripe('lane', lane, near, far, .075);
      });
    }

    const sprites: Sprite[] = [];
    for (const side of [-1, 1]) {
      const edgeX = side * railX;
      const railEnd = 194;
      sprites.push({ z: railStart, paint: () => Polygon('guardrail', [
        project(edgeX, railStart, .48), project(edgeX, railStart, .72),
        project(edgeX, railEnd, .72), project(edgeX, railEnd, .48),
      ]) });
      for (let z = railStart; z <= railEnd; z += 7) {
        sprites.push({ z, paint: () => {
          const ground = project(edgeX, z);
          const poleWidth = .12 * ground.scale;
          Rect('post', ground.x - poleWidth / 2, project(edgeX, z, .67).y, poleWidth, .67 * ground.scale);
        } });
      }
      // Roadside objects stay at fixed camera depths so only lane dashes indicate cruising speed.
      for (let z = lampStart; z <= 245; z += 35) {
        sprites.push({ z, paint: () => {
          const ground = project(edgeX, z);
          const top = project(edgeX, z, 10);
          const lamp = project(side * 3.65, z, 9.35);
          ctx.strokeStyle = Color('lamp-pole');
          ctx.lineWidth = Math.max(.75, .095 * ground.scale);
          ctx.beginPath();
          ctx.moveTo(ground.x, ground.y);
          ctx.lineTo(top.x, top.y);
          ctx.lineTo(lamp.x, lamp.y);
          ctx.stroke();
          const radius = .36 * lamp.scale;
          if (lamp.x + radius < 0 || lamp.x - radius > width || lamp.y + radius < 0) return;
          const glow = ctx.createRadialGradient(lamp.x, lamp.y, 0, lamp.x, lamp.y, radius);
          glow.addColorStop(0, Color('lamp-light'));
          glow.addColorStop(1, Color('lamp-clear'));
          ctx.fillStyle = glow;
          ctx.fillRect(lamp.x - radius, lamp.y - radius, radius * 2, radius * 2);
          Rect('lamp-light', lamp.x - radius / 4, lamp.y - 1, radius / 2, 2);
        } });
      }
    }

    const brakingGap = Math.max(0, motion?.gap ?? round.gap);
    const moving = round.moves.find(move => move.signal <= time && time < move.end);
    const blink = moving && (time - moving.signal) % (1000 / 1.5) < 500 / 1.5;
    for (const [index, car] of round.decoys.entries()) {
      if (car.appears > time) continue;
      const gap = car.gap + car.speedDelta * (time - car.appears) / 1000;
      const brakes = car.brakes.some(([start, end]) => start <= time && time < end);
      AddCar(keys.decoys[index], car.lane, gap, brakes);
    }
    if (round.target === 'far') AddCar(keys.far, 0, brakingGap, Boolean(motion), 0, true);
    AddCar(keys.lead, LaneAt(round.moves, time),
      round.target === 'lead' ? brakingGap : round.leadGap + (motion ? 3 * elapsed : 0),
      Boolean(motion) && round.target === 'lead', blink ? Math.sign(moving.to - moving.from) : 0, round.target === 'lead');

    function AddCar(key: keyof typeof frames, lane: number, gap: number, brakes: boolean, signal = 0, target = false) {
      const frame = frames[key];
      const z = gap + eyeOffset;
      if (z <= 0 || z > farZ) return;
      sprites.push({ z, paint: clip => {
        const laneX = lane * laneWidth;
        const aspect = frame.h / frame.w;
        const car = target
          ? ProjectTargetCar(scene, laneX, z, frame.widthMeters, aspect, dashboard.centerY)
          : ProjectCar(scene, laneX, z, frame.widthMeters, aspect);
        const { x, y, width: w, height: h } = car;
        if (x + w <= 0 || x >= width || y + h <= 0 || y >= clip) return;
        if (target) targetRect = VisibleCarRect(car, width, clip, dashboard);
        if (atlas) ctx.drawImage(atlas, frame.x, frame.y, frame.w, frame.h, x, y, w, h);
        else {
          Rect('car-roof', x + w * .17, y, w * .66, h * .45);
          Rect('car', x, y + h * .4, w, h * .6);
        }

        function Lamp(rect: number[], token: string, outward = 0) {
          const lamp = ProjectLamp(car, rect, outward);
          Rect(token, ...lamp);
          if (target) targetLamps.push(lamp);
        }

        if (brakes) {
          ctx.shadowColor = Color('brake');
          ctx.shadowBlur = 5;
          Lamp(frame.lamps.third, 'brake');
        }
        Lamp(frame.lamps.tailLeft, brakes ? 'brake' : 'tail');
        Lamp(frame.lamps.tailRight, brakes ? 'brake' : 'tail');
        ctx.shadowBlur = 0;
        if (signal) Lamp(signal < 0 ? frame.lamps.tailLeft : frame.lamps.tailRight, 'signal', signal);
        if (highlight && brakes) {
          ctx.strokeStyle = Color('signal');
          ctx.lineWidth = 2;
          ctx.strokeRect(x - 4, y - 4, w + 8, h + 8);
        }
      } });
    }

    sprites.sort((first, second) => second.z - first.z);
    for (const { z, paint } of sprites) BelowClip(z, paint);

    ctx.fillStyle = Color('dash');
    ctx.beginPath();
    ctx.moveTo(dashboard.left.x, dashboard.left.y);
    ctx.quadraticCurveTo(dashboard.control.x, dashboard.control.y, dashboard.right.x, dashboard.right.y);
    ctx.lineTo(width, height);
    ctx.lineTo(0, height);
    ctx.closePath();
    ctx.fill();

    canvas.dataset.dashboardTop = String(canvasY + dashboard.centerY);
    if (targetRect) {
      const [left, top, visibleWidth, visibleHeight] = targetRect;
      canvas.dataset.targetRect = [canvasX + left, canvasY + top, visibleWidth, visibleHeight].join(',');
      canvas.dataset.targetLamps = JSON.stringify(targetLamps.map(([x, y, w, h]) => [canvasX + x, canvasY + y, w, h]));
    } else {
      delete canvas.dataset.targetRect;
      delete canvas.dataset.targetLamps;
    }
  }

  return Draw;
}

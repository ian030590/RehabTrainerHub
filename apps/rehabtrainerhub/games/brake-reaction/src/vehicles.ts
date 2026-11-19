import { options, type Settings } from '../settings.js';
import type { Severity } from './physics.js';
import { ProjectLamp, type ProjectCar } from './projection.js';
import { RandomFrom } from './round.js';
import { Alpha, Bloom, palette } from './scenePalette.js';

type Vehicle = Settings['leadType'];
type Lamp = readonly [number, number, number, number];
type Point = readonly [number, number];
type Style = {
  widthMeters: number;
  aspect: number;
  cabin: readonly Point[];
  window: readonly Point[];
  rear: readonly [Point, Point, Point, Point, Point, Point];
  bumperTop: number;
  tyre: readonly [number, number, number];
  spoiler?: boolean;
  lightBar?: boolean;
  lamps: { tailLeft: Lamp; tailRight: Lamp; third: Lamp };
};

export const vehicleStyles: Record<Vehicle, Style> = {
  // Each outline runs up or down the left side and is mirrored on the right.
  sedan: {
    widthMeters: 1.8, aspect: .84,
    cabin: [[.19, .49], [.295, .155], [.35, .116]],
    window: [[.246, .397], [.328, .171]],
    rear: [[.109, .454], [.041, .491], [.025, .56], [.03, .755], [.048, .845], [.105, .905]],
    bumperTop: .747, tyre: [.072, .70, .155],
    lamps: { tailLeft: [.078, .524, .227, .074], tailRight: [.695, .524, .227, .074], third: [.40, .346, .20, .041] },
  },
  suv: {
    widthMeters: 1.9, aspect: .96,
    cabin: [[.086, .57], [.127, .135], [.174, .095]],
    window: [[.178, .456], [.199, .158]],
    rear: [[.105, .49], [.059, .52], [.047, .60], [.014, .69], [.021, .779], [.084, .839]],
    bumperTop: .716, tyre: [.055, .63, .18],
    lamps: { tailLeft: [.136, .304, .064, .245], tailRight: [.80, .304, .064, .245], third: [.38, .116, .24, .037] },
  },
  ev: {
    widthMeters: 1.78, aspect: .81, lightBar: true,
    cabin: [[.145, .49], [.235, .222], [.288, .14], [.36, .1]],
    window: [[.199, .425], [.258, .235], [.32, .174]],
    rear: [[.142, .454], [.08, .462], [.04, .49], [.026, .71], [.048, .835], [.13, .902]],
    bumperTop: .767, tyre: [.069, .71, .145],
    lamps: { tailLeft: [.067, .514, .175, .069], tailRight: [.758, .514, .175, .069], third: [.40, .181, .20, .036] },
  },
  sport: {
    widthMeters: 1.85, aspect: .65, spoiler: true,
    cabin: [[.249, .52], [.308, .185], [.366, .135]],
    window: [[.285, .355], [.351, .198]],
    rear: [[.149, .481], [.071, .49], [.014, .552], [.026, .768], [.051, .87], [.124, .925]],
    bumperTop: .736, tyre: [.049, .69, .177],
    lamps: { tailLeft: [.068, .515, .19, .084], tailRight: [.742, .515, .19, .084], third: [.40, .238, .20, .040] },
  },
};

function MirrorOutline(left: readonly Point[]): Point[] {
  return [...left, ...left.map(([x, y]): Point => [1 - x, y]).reverse()];
}

export function VehicleTypes(lead: Vehicle, seed: number, decoyCount: number) {
  const random = RandomFrom(seed);
  const otherBodies = options.leadType.filter(body => body !== lead);
  const far = otherBodies[Math.floor(random() * otherBodies.length)];
  const decoys = Array.from({ length: decoyCount }, () => options.leadType[Math.floor(random() * options.leadType.length)]);
  return { lead, far, decoys };
}

export function LampGlow(focal: number, z: number) {
  return Math.max(12, Math.min(90, focal * .8 / z));
}

export function PaintVehicle(ctx: CanvasRenderingContext2D, car: ReturnType<typeof ProjectCar>, type: Vehicle,
  scale: number, glow: number, brakes: boolean, signal: number, damage: ReturnType<typeof Severity> | undefined,
  dentSide: number) {
  const style = vehicleStyles[type];
  const { x, y, width, height } = car;
  const lamps: ReturnType<typeof ProjectLamp>[] = [];
  const dent = damage === 'severe' ? .09 : damage === 'moderate' ? .047 : 0;
  const dentLeft = dentSide < 0 ? dent : 0;
  const dentRight = dentSide > 0 ? dent : 0;
  const brokenLeft = damage === 'severe' || (damage === 'moderate' && dentSide < 0);
  const brokenRight = damage === 'severe' || (damage === 'moderate' && dentSide > 0);
  const body = ctx.createLinearGradient(0, y + height * .12, 0, y + height * .90);
  const [roofTone, panelTone, lowerTone] = palette[type];
  body.addColorStop(0, roofTone);
  body.addColorStop(.62, panelTone);
  body.addColorStop(1, lowerTone);
  const glass = ctx.createLinearGradient(0, y + height * .12, 0, y + height * .48);
  glass.addColorStop(0, palette.glass[1]);
  glass.addColorStop(1, palette.glass[0]);

  ctx.save();
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  if (brakes) {
    ctx.globalCompositeOperation = 'lighter';
    Bloom(ctx, x + width * .5, y + height * .97, Math.max(width * .65, glow), palette.brakeGlow, .23, .30);
    ctx.globalCompositeOperation = 'source-over';
  }
  ctx.fillStyle = palette.tyre;
  ctx.beginPath();
  ctx.ellipse(x + width * .5, y + height * .985, width * .50, height * .05, 0, 0, 2 * Math.PI);
  ctx.fill();
  const [tyreLeft, tyreTop, tyreWidth] = style.tyre;
  Box(palette.tyre, tyreLeft, tyreTop, tyreWidth, 1 - tyreTop);
  Box(palette.tyre, 1 - tyreLeft - tyreWidth, tyreTop, tyreWidth, 1 - tyreTop);

  if (type === 'suv') {
    for (const side of [.20, .65]) {
      Stroke([[side, .102], [side + .025, .047], [side + .125, .047], [side + .15, .102]],
        palette.hoodRim, Math.max(.8, scale * .042));
    }
  }
  const bodyOutline = Math.max(.6, Math.min(4, scale * .032));
  Shape(MirrorOutline(style.cabin), body, palette.shade, bodyOutline, type === 'ev');

  const [glassLeft, glassBottom] = style.window[0];
  const [, glassTop] = style.window[style.window.length - 1];
  const glassHeight = glassBottom - glassTop;
  ctx.save();
  Shape(MirrorOutline(style.window), glass, palette.shade, Math.max(.5, scale * .024), type === 'ev');
  ctx.clip();
  for (const offset of [0, .11]) {
    Stroke([[glassLeft + .10 + offset, glassBottom], [glassLeft + .24 + offset, glassTop]],
      Alpha(palette.glassReflection, offset ? .15 : .26), Math.max(.55, scale * .04));
  }
  if (damage === 'severe') {
    const center: Point = [.48, glassTop + glassHeight * .58];
    Stroke([center, [.43, glassTop + glassHeight * .36], [.41, glassTop]], palette.scratch, 1.1);
    Stroke([center, [.54, glassTop + glassHeight * .32], [.59, glassTop]], palette.scratch, 1.1);
    Stroke([center, [.57, glassBottom - glassHeight * .20], [.66, glassBottom]], palette.scratch, 1.1);
    Stroke([center, [.40, glassBottom - glassHeight * .24], [.35, glassBottom]], palette.scratch, 1.1);
  }
  ctx.restore();

  const [deck, corner, shoulder, flank, [cornerX, cornerY], [sillX, sillY]] = style.rear;
  const rear = (sideDent: number): Point[] => [deck, corner, shoulder, flank,
    [cornerX + sideDent * .55, cornerY + sideDent * .36],
    [sillX + sideDent * .38, sillY + sideDent * .30]];
  const rearBody = [...rear(dentLeft), ...rear(dentRight).reverse().map(([px, py]): Point => [1 - px, py])];
  Shape(rearBody, body, palette.shade, bodyOutline, type === 'ev');
  const [deckX, deckY] = deck;
  Stroke([[deckX, deckY + .02], [.32, deckY + .031], [.68, deckY + .031], [1 - deckX, deckY + .02]],
    Alpha(palette.glassReflection, .32), Math.max(.6, scale * .026));
  const seam = deckY + .116;
  Stroke([[.12, seam], [.29, seam + .02], [.50, seam + .022 + dent * .35], [.71, seam + .02], [.88, seam]],
    palette.seam, Math.max(.55, scale * .025));

  const bumper = style.bumperTop;
  const cladding = type === 'suv' ? .028 : .061;
  Shape([[cladding, bumper], [.32, bumper + .03], [.68, bumper + .03], [1 - cladding, bumper],
    [1 - cornerX - dentRight * .55, cornerY + dentRight * .36], [1 - sillX, sillY + dentRight * .22],
    [sillX, sillY + dentLeft * .22], [cornerX + dentLeft * .55, cornerY + dentLeft * .36]],
    type === 'ev' ? lowerTone : palette.shade, undefined, 1, type === 'ev');
  if (style.spoiler) {
    for (const post of [.195, .765]) Box(palette.shade, post, .383, .04, .126);
    Shape(MirrorOutline([[.064, .359], [.09, .423]]), palette.shade, palette.hoodRim, bodyOutline);
    Shape(MirrorOutline([[.13, .786], [.17, .884]]), palette.tyre);
    for (const tip of [.16, .73]) {
      Box(palette.hoodRim, tip, .817, .11, .049);
      Box(palette.tyre, tip + .022, .827, .066, .026);
    }
  }
  Box(palette.plate, .37, .65, .26, .096);
  if (width >= 62) {
    ctx.fillStyle = palette.plateText;
    ctx.font = `700 ${Math.max(6, width * .054)}px monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('RTH 42', x + width * .5, y + height * .70, width * .23);
  }
  if (damage) {
    const center = .5 + dentSide * .21;
    Stroke([[center - .1, .79], [center - .045, .81], [center - .02, .78], [center + .055, .81], [center + .09, .79]],
      palette.scratch, Math.max(.8, scale * .025));
    if (dent) {
      Stroke([[center - .16, .58], [center - .09, .62], [center + .025, .61 + dent * .55], [center + .14, .57]],
        palette.crease, Math.max(1.2, scale * .05));
    }
  }

  if (style.lightBar) {
    const state = brakes ? 'brake' : 'tail';
    if (brokenLeft !== brokenRight) {
      LampAt([.21, .533, .29, .032], brokenLeft ? 'broken' : state, false);
      LampAt([.50, .533, .29, .032], brokenRight ? 'broken' : state, false);
    } else {
      LampAt([.21, .533, .58, .032], brokenLeft ? 'broken' : state, false);
    }
  }
  LampAt(style.lamps.tailLeft, brokenLeft ? 'broken' : brakes ? 'brake' : signal < 0 ? 'signal' : 'tail');
  LampAt(style.lamps.tailRight, brokenRight ? 'broken' : brakes ? 'brake' : signal > 0 ? 'signal' : 'tail');
  LampAt(style.lamps.third, brakes ? 'brake' : 'tail');
  ctx.restore();
  return lamps;

  function Box(color: string, left: number, top: number, w: number, h: number) {
    ctx.fillStyle = color;
    ctx.fillRect(x + left * width, y + top * height, w * width, h * height);
  }

  function Path(points: readonly Point[]) {
    ctx.beginPath();
    ctx.moveTo(x + points[0][0] * width, y + points[0][1] * height);
    for (const [px, py] of points.slice(1)) ctx.lineTo(x + px * width, y + py * height);
  }

  function Shape(points: readonly Point[], fill: string | CanvasGradient, outline?: string, weight = 1, smooth = false) {
    if (smooth) RoundedPath(points);
    else Path(points);
    ctx.closePath();
    ctx.fillStyle = fill;
    ctx.fill();
    if (outline) {
      ctx.strokeStyle = outline;
      ctx.lineWidth = weight;
      ctx.stroke();
    }
  }

  function RoundedPath(points: readonly Point[]) {
    const inset = ([px, py]: Point, [nx, ny]: Point): Point => [x + (px + (nx - px) * .20) * width,
      y + (py + (ny - py) * .20) * height];
    ctx.beginPath();
    points.forEach((point, index) => {
      const start = inset(point, points.at(index - 1)!);
      if (index === 0) ctx.moveTo(...start);
      else ctx.lineTo(...start);
      ctx.quadraticCurveTo(x + point[0] * width, y + point[1] * height, ...inset(point, points[(index + 1) % points.length]));
    });
  }

  function Stroke(points: readonly Point[], color: string, weight: number) {
    Path(points);
    ctx.strokeStyle = color;
    ctx.lineWidth = weight;
    ctx.stroke();
  }

  function LampAt(fractions: Lamp, state: 'tail' | 'signal' | 'brake' | 'broken', record = true) {
    const rect = ProjectLamp(car, fractions);
    if (record) lamps.push(rect);
    const [left, top, w, h] = rect;
    const lit = state === 'brake' || state === 'signal';
    ctx.save();
    ctx.fillStyle = state === 'broken' ? palette.brokenLamp : palette[state];
    if (lit) {
      const rgb = state === 'brake' ? palette.brakeGlow : palette.signalGlow;
      ctx.globalCompositeOperation = 'lighter';
      Bloom(ctx, left + w * .5, top + h * .5, 1.6 * glow, rgb, .40, .78);
      ctx.globalCompositeOperation = 'source-over';
      ctx.shadowBlur = glow;
      ctx.shadowColor = palette[state];
    }
    ctx.fillRect(left, top, w, h);
    if (lit) {
      ctx.shadowBlur = 0;
      ctx.fillStyle = state === 'brake' ? palette.brakeCore : palette.signalCore;
      ctx.fillRect(left + w * .16, top + h * .23, w * .68, Math.max(1, h * .43));
    }
    if (state === 'broken') {
      const [fx, fy, fw, fh] = fractions;
      Stroke([[fx + fw * .25, fy], [fx + fw * .57, fy + fh * .43], [fx + fw * .40, fy + fh]], palette.scratch, 1);
      Stroke([[fx + fw * .57, fy + fh * .43], [fx + fw * .95, fy + fh * .6]], palette.scratch, 1);
    }
    ctx.restore();
  }
}

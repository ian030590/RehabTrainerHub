import { options, type Settings } from '../settings.js';
import type { Severity } from './physics.js';
import { ProjectLamp, type ProjectCar } from './projection.js';
import { RandomFrom } from './round.js';
import { Alpha, Bloom, palette } from './scenePalette.js';

type Vehicle = Settings['leadType'];
type Lamp = readonly [number, number, number, number];
type Style = { widthMeters: number; aspect: number; roof: number; spoiler?: boolean; lightBar?: boolean;
  lamps: { tailLeft: Lamp; tailRight: Lamp; third: Lamp } };

export const vehicleStyles: Record<Vehicle, Style> = {
  sedan: { widthMeters: 1.8, aspect: .90, roof: .28,
    lamps: { tailLeft: [.105, .53, .20, .077], tailRight: [.695, .53, .20, .077], third: [.39, .18, .22, .031] } },
  suv: { widthMeters: 1.9, aspect: .96, roof: .19,
    lamps: { tailLeft: [.11, .48, .084, .16], tailRight: [.806, .48, .084, .16], third: [.38, .15, .24, .033] } },
  ev: { widthMeters: 1.78, aspect: .89, roof: .27, lightBar: true,
    lamps: { tailLeft: [.11, .48, .18, .055], tailRight: [.71, .48, .18, .055], third: [.40, .17, .20, .03] } },
  sport: { widthMeters: 1.85, aspect: .82, roof: .34, spoiler: true,
    lamps: { tailLeft: [.09, .53, .18, .065], tailRight: [.73, .53, .18, .065], third: [.38, .21, .24, .032] } },
};

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
  const brokenLeft = damage === 'severe' || (damage === 'moderate' && dentSide < 0);
  const brokenRight = damage === 'severe' || (damage === 'moderate' && dentSide > 0);
  const body = ctx.createLinearGradient(0, y + height * .12, 0, y + height * .90);
  palette[type].forEach((tone, index) => body.addColorStop(index * .5, tone));
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
  ctx.ellipse(x + width * .5, y + height * .94, width * .55, height * .085, 0, 0, 2 * Math.PI);
  ctx.fill();
  Box(palette.tyre, .08, .68, .13, .28);
  Box(palette.tyre, .79, .68, .13, .28);

  const roof = style.roof;
  Shape([[.06, .82 + (dentSide < 0 ? dent : 0)], [.025, .65], [.09, .45], [roof, .12],
    [roof + .07, .08], [.93 - roof, .08], [1 - roof, .12], [.91, .45], [.975, .65],
    [.94, .82 + (dentSide > 0 ? dent : 0)], [.71, .87], [.29, .87]], body, palette.shade, Math.max(.6, Math.min(5, scale * .039)));

  ctx.save();
  Shape([[roof + .025, .15], [.975 - roof, .15], [.83, .43], [.17, .43]], glass, palette.shade, Math.max(.5, scale * .024));
  ctx.clip();
  for (const offset of [0, .11]) {
    Stroke([[.33 + offset, .45], [.48 + offset, .12]], Alpha(palette.glassReflection, offset ? .15 : .26), Math.max(.55, scale * .04));
  }
  if (damage === 'severe') {
    Stroke([[.48, .31], [.43, .25], [.41, .17]], palette.scratch, 1.1);
    Stroke([[.48, .31], [.54, .27], [.59, .18]], palette.scratch, 1.1);
    Stroke([[.48, .31], [.57, .37], [.66, .42]], palette.scratch, 1.1);
    Stroke([[.48, .31], [.40, .36], [.35, .42]], palette.scratch, 1.1);
  }
  ctx.restore();

  Stroke([[.15, .49], [.31, .50], [.52, .50 + dent * .5], [.72, .50], [.85, .49]], palette.seam, Math.max(.6, scale * .025));
  Shape([[.065, .73], [.35, .755], [.64, .75], [.935, .73 + (dentSide > 0 ? dent : 0)],
    [.92, .835 + (dentSide > 0 ? dent * .65 : 0)], [.7, .86], [.28, .86 + (dentSide < 0 ? dent * .7 : 0)],
    [.08, .82 + (dentSide < 0 ? dent : 0)]], palette.shade);
  if (style.spoiler) {
    Box(palette.shade, .17, .375, .037, .1);
    Box(palette.shade, .793, .375, .037, .1);
    Shape([[.075, .355], [.925, .355], [.87, .412], [.13, .412]], palette.shade);
    Box(palette.hoodRim, .15, .802, .10, .033);
    Box(palette.hoodRim, .75, .802, .10, .033);
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
    const state = brokenLeft || brokenRight ? 'broken' : brakes ? 'brake' : 'tail';
    const width = state === 'broken' ? .27 : .56;
    const start = brokenLeft && !brokenRight ? .50 : .22;
    LampAt([start, .492, width, .033], state === 'broken' && brokenLeft !== brokenRight && brakes ? 'brake' : state, false);
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

  function Path(points: readonly (readonly [number, number])[]) {
    ctx.beginPath();
    ctx.moveTo(x + points[0][0] * width, y + points[0][1] * height);
    for (const [px, py] of points.slice(1)) ctx.lineTo(x + px * width, y + py * height);
  }

  function Shape(points: readonly (readonly [number, number])[], fill: string | CanvasGradient, outline?: string, weight = 1) {
    Path(points);
    ctx.closePath();
    ctx.fillStyle = fill;
    ctx.fill();
    if (outline) {
      ctx.strokeStyle = outline;
      ctx.lineWidth = weight;
      ctx.stroke();
    }
  }

  function Stroke(points: readonly (readonly [number, number])[], color: string, weight: number) {
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

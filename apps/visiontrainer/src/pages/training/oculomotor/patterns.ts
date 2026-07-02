import type { Arena, OculomotorPattern, PatternParams, TargetFrame } from './types';
import type { Rng } from './random';

const TAU = Math.PI * 2;

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

const positiveModulo = (value: number, divisor: number) =>
  ((value % divisor) + divisor) % divisor;

const pingPong = (value: number, length: number) => {
  if (length <= 0) return 0;
  const wrapped = positiveModulo(value, length * 2);
  return wrapped <= length ? wrapped : length * 2 - wrapped;
};

const interpolate = (a: number, b: number, t: number) => a + (b - a) * t;

const pointOnSegment = (points: Array<[number, number]>, travelPx: number) => {
  let totalLength = 0;
  for (let i = 0; i < points.length; i += 1) {
    const start = points[i];
    const end = points[(i + 1) % points.length];
    totalLength += Math.hypot(end[0] - start[0], end[1] - start[1]);
  }
  if (totalLength <= 0) return points[0];

  let remaining = positiveModulo(travelPx, totalLength);
  for (let i = 0; i < points.length; i += 1) {
    const start = points[i];
    const end = points[(i + 1) % points.length];
    const length = Math.hypot(end[0] - start[0], end[1] - start[1]);
    if (remaining <= length) {
      const t = length <= 0 ? 0 : remaining / length;
      return [interpolate(start[0], end[0], t), interpolate(start[1], end[1], t)] satisfies [
        number,
        number,
      ];
    }
    remaining -= length;
  }

  return points[0];
};

const writeFrame = (
  frames: TargetFrame[],
  index: number,
  x: number,
  y: number,
  params: PatternParams,
  color = params.colorA,
  role: TargetFrame['role'] = 'target',
  alpha = params.opacity ?? 1,
) => {
  let finalX = x;
  let finalY = y;
  if (params.jitter && params.jitter > 0) {
    const j = params.jitter;
    finalX += (Math.random() - 0.5) * j;
    finalY += (Math.random() - 0.5) * j;
  }
  frames[index] = {
    x: finalX,
    y: finalY,
    radiusPx: params.radiusPx,
    color,
    alpha,
    role,
  };
  return index + 1;
};

const sampleRandomWalk = (
  rng: Rng,
  travelPx: number,
  left: number,
  top: number,
  right: number,
  bottom: number,
) => {
  const segmentPx = 260;
  const bucket = Math.floor(Math.max(0, travelPx) / segmentPx);
  const local = (travelPx - bucket * segmentPx) / segmentPx;
  const smooth = local * local * (3 - 2 * local);
  const ax = rng.rangeAt(bucket * 2, left, right);
  const ay = rng.rangeAt(bucket * 2 + 1, top, bottom);
  const bx = rng.rangeAt((bucket + 1) * 2, left, right);
  const by = rng.rangeAt((bucket + 1) * 2 + 1, top, bottom);
  return [interpolate(ax, bx, smooth), interpolate(ay, by, smooth)] satisfies [number, number];
};

const sampleSingle = (
  pattern: OculomotorPattern,
  arena: Arena,
  params: PatternParams,
  rng: Rng,
) => {
  const margin = Math.min(
    Math.max(params.radiusPx + 18, 24),
    Math.max(24, Math.min(arena.width, arena.height) / 2),
  );
  const left = margin;
  const top = margin;
  const right = Math.max(left, arena.width - margin);
  const bottom = Math.max(top, arena.height - margin);
  const width = Math.max(1, right - left);
  const height = Math.max(1, bottom - top);
  const cx = arena.width / 2;
  const cy = arena.height / 2;
  const rx = width / 2;
  const ry = height / 2;
  const travelPx = params.travelPx;

  const generatePolygon = (sides: number, angleOffset = -Math.PI / 2): [number, number][] => {
    return Array.from({ length: sides }, (_, i) => {
      const angle = angleOffset + (i / sides) * TAU;
      return [cx + Math.cos(angle) * rx, cy + Math.sin(angle) * ry];
    });
  };

  const generateStar = (points: number, innerRatio = 0.5, angleOffset = -Math.PI / 2): [number, number][] => {
    const sides = points * 2;
    return Array.from({ length: sides }, (_, i) => {
      const angle = angleOffset + (i / sides) * TAU;
      const r = i % 2 === 0 ? 1 : innerRatio;
      return [cx + Math.cos(angle) * rx * r, cy + Math.sin(angle) * ry * r];
    });
  };

  switch (pattern) {
    case 'circle': {
      const radius = Math.max(1, Math.min(rx, ry));
      const angle = travelPx / radius;
      return [cx + Math.cos(angle) * radius, cy + Math.sin(angle) * radius] satisfies [number, number];
    }
    case 'oval': {
      const angle = travelPx / Math.max(1, Math.min(rx, ry));
      return [cx + Math.cos(angle) * rx, cy + Math.sin(angle) * ry] satisfies [number, number];
    }
    case 'figureEight': {
      const angle = (travelPx / Math.max(1, Math.min(rx, ry))) * 0.78;
      return [cx + Math.sin(angle) * rx, cy + Math.sin(angle * 2) * ry * 0.72] satisfies [number, number];
    }
    case 'horizontalSweep':
      return [left + pingPong(travelPx, width), cy] satisfies [number, number];
    case 'verticalSweep':
      return [cx, top + pingPong(travelPx, height)] satisfies [number, number];
    case 'bounce':
      return [
        left + pingPong(travelPx * 0.93 + width * 0.18, width),
        top + pingPong(travelPx * 0.67 + height * 0.41, height),
      ] satisfies [number, number];
    case 'diagonal':
      return [left + pingPong(travelPx * 0.72, width), top + pingPong(travelPx, height)] satisfies [number, number];
    case 'spiralBloom': {
      const angle = (travelPx / Math.max(1, Math.min(rx, ry))) * 0.72;
      const bloom = 0.42 + 0.5 * ((1 - Math.cos(angle)) / 2);
      return [cx + Math.cos(angle) * rx * bloom, cy + Math.sin(angle) * ry * bloom] satisfies [number, number];
    }
    case 'zigZag': {
      const lanes = 5;
      const points = Array.from({ length: lanes }, (_, index) => {
        const x = index % 2 === 0 ? left : right;
        const y = top + (height * index) / (lanes - 1);
        return [x, y] satisfies [number, number];
      });
      return pointOnSegment(points, travelPx * 1.08);
    }
    case 'triangle': return pointOnSegment(generatePolygon(3), travelPx);
    case 'square': return pointOnSegment([
      [cx - rx, cy - ry], [cx + rx, cy - ry], [cx + rx, cy + ry], [cx - rx, cy + ry]
    ], travelPx);
    case 'rectangle': return pointOnSegment([
      [left, top], [right, top], [right, bottom], [left, bottom]
    ], travelPx);
    case 'parallelogram': {
      const offset = rx * 0.4;
      return pointOnSegment([
        [cx - rx + offset, cy - ry], [cx + rx, cy - ry],
        [cx + rx - offset, cy + ry], [cx - rx, cy + ry]
      ], travelPx);
    }
    case 'rhombus': return pointOnSegment([
      [cx, top], [right, cy], [cx, bottom], [left, cy]
    ], travelPx);
    case 'trapezoid': return pointOnSegment([
      [cx - rx * 0.6, cy - ry], [cx + rx * 0.6, cy - ry],
      [cx + rx, cy + ry], [cx - rx, cy + ry]
    ], travelPx);
    case 'kite': return pointOnSegment([
      [cx, top], [right, cy - ry * 0.2], [cx, bottom], [left, cy - ry * 0.2]
    ], travelPx);
    case 'pentagon': return pointOnSegment(generatePolygon(5), travelPx);
    case 'hexagon': return pointOnSegment(generatePolygon(6), travelPx);
    case 'heptagon': return pointOnSegment(generatePolygon(7), travelPx);
    case 'octagon': return pointOnSegment(generatePolygon(8), travelPx);
    case 'nonagon': return pointOnSegment(generatePolygon(9), travelPx);
    case 'decagon': return pointOnSegment(generatePolygon(10), travelPx);
    case 'hexagram': return pointOnSegment(generateStar(6, 0.5), travelPx);
    case 'decagram': return pointOnSegment(generateStar(10, 0.4), travelPx);
    case 'superellipse': {
      const angle = travelPx / Math.max(1, Math.min(rx, ry));
      const n = 2.5; // n > 2 makes it squarish
      const cosT = Math.cos(angle);
      const sinT = Math.sin(angle);
      const x = cx + rx * Math.pow(Math.abs(cosT), 2 / n) * Math.sign(cosT);
      const y = cy + ry * Math.pow(Math.abs(sinT), 2 / n) * Math.sign(sinT);
      return [x, y] satisfies [number, number];
    }
    case 'deltoid': {
      const angle = (travelPx / Math.max(1, Math.min(rx, ry))) * 0.8;
      // standard deltoid: x = 2a cos t + a cos 2t, y = 2a sin t - a sin 2t
      const x = cx + rx * (2 * Math.cos(angle) + Math.cos(2 * angle)) / 3;
      const y = cy + ry * (2 * Math.sin(angle) - Math.sin(2 * angle)) / 3;
      return [x, y] satisfies [number, number];
    }
    case 'randomizedSmooth': {
      // similar to randomWalk but larger segments and smoother
      const segmentPx = Math.max(150, Math.min(rx, ry) * 0.8);
      const bucket = Math.floor(Math.max(0, travelPx) / segmentPx);
      const local = (travelPx - bucket * segmentPx) / segmentPx;
      // quintic smoothstep
      const smooth = local * local * local * (local * (local * 6 - 15) + 10);
      const ax = rng.rangeAt(bucket * 2, left, right);
      const ay = rng.rangeAt(bucket * 2 + 1, top, bottom);
      const bx = rng.rangeAt((bucket + 1) * 2, left, right);
      const by = rng.rangeAt((bucket + 1) * 2 + 1, top, bottom);
      return [interpolate(ax, bx, smooth), interpolate(ay, by, smooth)] satisfies [number, number];
    }
    case 'peekaboo':
      return sampleRandomWalk(rng, travelPx, left, top, right, bottom);
    case 'randomWalk':
    default:
      return sampleRandomWalk(rng, travelPx, left, top, right, bottom);
  }
};

export const sampleOculomotorPatternInto = (
  frames: TargetFrame[],
  pattern: OculomotorPattern,
  arena: Arena,
  params: PatternParams,
  rng: Rng,
) => {
  const getPeekabooAlpha = (travelPx: number, baseAlpha: number) => {
    if (pattern !== 'peekaboo') return baseAlpha;
    const cycle = 800; // pixels per cycle
    const phase = positiveModulo(travelPx, cycle) / cycle;
    // visible for 60%, hidden for 40% with a short fade
    if (phase < 0.5) return baseAlpha;
    if (phase < 0.6) return baseAlpha * (1 - (phase - 0.5) * 10);
    if (phase < 0.9) return 0;
    return baseAlpha * ((phase - 0.9) * 10);
  };

  if ((pattern !== 'randomWalk' && pattern !== 'peekaboo') || params.distractorCount <= 0) {
    const [x, y] = sampleSingle(pattern, arena, params, rng);
    const alpha = getPeekabooAlpha(params.travelPx, params.opacity ?? 1);
    return writeFrame(frames, 0, x, y, params, params.colorA, 'target', alpha);
  }

  const radius = Math.max(1, params.radiusPx);
  const margin = Math.min(
    Math.max(radius + 18, 24),
    Math.max(24, Math.min(arena.width, arena.height) / 2),
  );
  const left = margin;
  const top = margin;
  const width = Math.max(1, arena.width - margin * 2);
  const height = Math.max(1, arena.height - margin * 2);
  const total = clamp(params.targetCount + params.distractorCount, 1, 16);
  let count = 0;

  for (let index = 0; index < total; index += 1) {
    const speedScaleX = rng.rangeAt(index * 8, 0.52, 1.26);
    const speedScaleY = rng.rangeAt(index * 8 + 1, 0.48, 1.18);
    const phaseX = rng.rangeAt(index * 8 + 2, 0, width * 2);
    const phaseY = rng.rangeAt(index * 8 + 3, 0, height * 2);
    const role = index < params.targetCount ? 'target' : 'distractor';

    const alpha = getPeekabooAlpha(params.travelPx * speedScaleX, params.opacity ?? 1);

    count = writeFrame(
      frames,
      count,
      left + pingPong(params.travelPx * speedScaleX + phaseX, width),
      top + pingPong(params.travelPx * speedScaleY + phaseY, height),
      params,
      role === 'target' ? params.colorA : params.colorB,
      role,
      alpha,
    );
  }

  return count;
};

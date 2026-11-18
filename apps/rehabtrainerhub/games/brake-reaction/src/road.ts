import { LaneAt, type MakeRound } from './round.js';
import { Motion, type ModelFor } from './physics.js';

type Round = ReturnType<typeof MakeRound>;
type Model = ReturnType<typeof ModelFor>;

export function MakeRoad(canvas: HTMLCanvasElement) {
  const context = canvas.getContext('2d');
  if (!context) return () => {};
  const colors = getComputedStyle(canvas);
  const color = (token: string) => colors.getPropertyValue('--' + token).trim();

  return (round: Round, model: Model, time: number, cue: boolean, delay: number, elapsed: number, wet: boolean) => {
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    const ratio = Math.min(2, devicePixelRatio);
    const pixelsWide = Math.round(width * ratio);
    const pixelsHigh = Math.round(height * ratio);
    if (canvas.width !== pixelsWide || canvas.height !== pixelsHigh) {
      canvas.width = pixelsWide;
      canvas.height = pixelsHigh;
    }
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    const horizon = height * .34;
    const focal = Math.min(width * .44, height * .8);
    const projection = (lane: number, gap: number) => {
      const scale = focal / (Math.max(0, gap) + 5);
      return { x: width / 2 + lane * 3.75 * scale, y: horizon + 6 * scale, scale };
    };
    function Rect(token: string, x: number, y: number, w: number, h: number) {
      context!.fillStyle = color(token);
      context!.fillRect(x, y, w, h);
    }
    function Stripe(token: string, lane: number, near: number, far: number, size: number) {
      const a = projection(lane - size, near);
      const b = projection(lane + size, near);
      const c = projection(lane + size, far);
      const d = projection(lane - size, far);
      context!.fillStyle = color(token);
      context!.beginPath();
      context!.moveTo(a.x, a.y);
      context!.lineTo(b.x, b.y);
      context!.lineTo(c.x, c.y);
      context!.lineTo(d.x, d.y);
      context!.fill();
    }
    Rect('sky', 0, 0, width, horizon);
    Rect('shoulder', 0, horizon, width, height - horizon);
    Stripe(wet ? 'wet-road' : 'road', 0, 0, 600, 1.6);
    Stripe('edge', -1.5, 0, 600, .016);
    Stripe('edge', 1.5, 0, 600, .016);
    const position = cue ? model.speed * round.onset / 1000 + Motion(model, round.gap, delay, elapsed).ownDistance
      : model.speed * time / 1000;
    for (const lane of [-.5, .5]) {
      for (let mark = 16 - position % 16; mark < 250; mark += 16) Stripe('lane', lane, mark, mark + 5, .018);
    }

    const brakingGap = cue ? Math.max(0, Motion(model, round.gap, delay, elapsed).gap) : round.gap;
    const moving = round.moves.find(move => move.signal <= time && time < move.end);
    const cars = round.decoys.filter(car => car.appears <= time).map(car => ({
      lane: car.lane as number, gap: car.gap + car.speedDelta * (time - car.appears) / 1000,
      brakes: car.brakes.some(([start, end]) => start <= time && time < end), signal: 0, primary: false,
    }));
    if (round.target === 'far') cars.push({ lane: 0, gap: brakingGap, brakes: cue, signal: 0, primary: true });
    cars.push({ lane: LaneAt(round.moves, time), gap: round.target === 'lead' ? brakingGap : round.leadGap + (cue ? 3 * elapsed : 0),
      brakes: cue && round.target === 'lead', signal: moving ? Math.sign(moving.to - moving.from) : 0, primary: true });
    cars.sort((a, b) => {
      const priority = (car: typeof a) => Number(cue && car.primary && car.brakes);
      return priority(a) - priority(b) || b.gap - a.gap;
    });

    for (const car of cars) {
      const { x, y, scale } = projection(car.lane, car.gap);
      const w = Math.max(car.primary ? 27 : 12, scale * 2.8);
      const h = w * .57;
      Rect('car-roof', x - w * .34, y - h, w * .68, h * .45);
      Rect(car.primary ? 'car' : 'decoy', x - w / 2, y - h * .67, w, h * .67);
      Rect('tail', x - w * .43, y - h * .43, w * .19, h * .15);
      Rect('tail', x + w * .24, y - h * .43, w * .19, h * .15);
      if (car.signal) Rect('signal', x + (car.signal < 0 ? -.47 : .29) * w, y - h * .45, w * .18, h * .19);
      if (car.brakes) {
        Rect('brake', x - w * .43, y - h * .45, w * .86, Math.max(3, h * .19));
        Rect('brake', x - w * .19, y - h * .94, w * .38, Math.max(2, h * .12));
      }
    }
    context.fillStyle = color('dash');
    context.beginPath();
    context.ellipse(width / 2, height * 1.22, width * .9, height * .34, 0, Math.PI, Math.PI * 2);
    context.fill();
  };
}

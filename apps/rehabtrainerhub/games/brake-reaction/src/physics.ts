import type { Settings } from './settings.js';

export const budgets = [1.60, 1.25, 1.00, .85, .75, 1.10] as const;
export const step = 1 / 120;
const stoppingDistances = { sedan: 37, suv: 38, ev: 36, sport: 32 };

export function ModelFor(settings: Settings) {
  const acceleration = (type: Settings['ownType']) =>
    (100 / 3.6) ** 2 / (2 * stoppingDistances[type] * (settings.road === 'wet' ? 1.33 : 1));
  return { speed: settings.speedKmh / 3.6, own: acceleration(settings.ownType), target: acceleration(settings.leadType) };
}

type Model = ReturnType<typeof ModelFor>;

function Travel(speed: number, acceleration: number, delay: number, time: number) {
  const brakingTime = Math.min(speed / acceleration, Math.max(0, time - delay));
  return speed * (Math.min(time, delay) + brakingTime) - acceleration * brakingTime ** 2 / 2;
}

export function Motion(model: Model, gap: number, delay: number, time: number) {
  const ownDistance = Travel(model.speed, model.own, delay, time);
  const targetDistance = Travel(model.speed, model.target, 0, time);
  const ownSpeed = Math.max(0, model.speed - model.own * Math.max(0, time - delay));
  const targetSpeed = Math.max(0, model.speed - model.target * time);
  return { ownDistance, ownSpeed, gap: gap + targetDistance - ownDistance, rel: (ownSpeed - targetSpeed) * 3.6 };
}

function Bisection(low: number, high: number, reached: (value: number) => boolean) {
  for (let iteration = 0; iteration < 36; iteration++) {
    const middle = (low + high) / 2;
    if (reached(middle)) high = middle;
    else low = middle;
  }
  return high;
}

function ClosestTime(model: Model, delay: number) {
  const ownStop = delay + model.speed / model.own;
  const targetStop = model.speed / model.target;
  // Closure peaks at equal speeds if the player stops first, or when both cars stop.
  return ownStop < targetStop ? model.own * delay / (model.own - model.target) : ownStop;
}

export function NeedD(model: Model, delay: number) {
  const closest = ClosestTime(model, delay);
  const closure = -Motion(model, 0, delay, closest).gap;
  return Bisection(0, model.speed * closest, distance => distance >= closure);
}

export function GapFor(model: Model, index: number) {
  return Math.ceil(NeedD(model, budgets[index])) + 2;
}

export function Severity(rel: number) {
  return rel < 12 ? 'light' : rel < 30 ? 'moderate' : 'severe';
}

export function Simulate(model: Model, gap: number, delay: number) {
  const closest = ClosestTime(model, delay);
  const remaining = Motion(model, gap, delay, closest).gap;
  const contact = remaining <= 0;
  const end = contact
    ? Bisection(0, closest, time => Motion(model, gap, delay, time).gap <= 0)
    : Math.max(delay + model.speed / model.own, model.speed / model.target);
  const final = Motion(model, gap, delay, end);
  return { contact, end, remaining: contact ? 0 : final.gap, rel: contact ? Math.max(0, final.rel) : null,
    beforeBraking: delay * model.speed };
}

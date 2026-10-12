export function GetSheetDetents(viewportHeight: number, safeTop = 0) {
  const large = Math.max(0, viewportHeight - Math.max(24, safeTop + 12));
  return { medium: Math.min(large, Math.max(320, viewportHeight * 0.55)), large };
}

export function ResolveSheetTarget(
  position: number,
  velocity: number,
  detents: ReturnType<typeof GetSheetDetents>,
) {
  const projected = position + velocity * 200;
  if (projected < detents.medium * 0.65) return 0;
  return projected > (detents.medium + detents.large) / 2 ? detents.large : detents.medium;
}

export function StepSheetSpring(
  motion: { position: number; velocity: number },
  target: number,
  seconds: number,
) {
  let remaining = Math.min(seconds, 1 / 15);
  let { position, velocity } = motion;
  while (remaining > 0) {
    const step = Math.min(remaining, 1 / 120);
    velocity += ((target - position) * 380 - velocity * 34) * step;
    position += velocity * step;
    remaining -= step;
  }
  return Math.abs(position - target) < 0.1 && Math.abs(velocity) < 1
    ? { position: target, velocity: 0 }
    : { position, velocity };
}

export function CreateFlightClock(start: number) {
  let last = start;
  let pausedAt: number | null = null;
  let pausedDuration = 0;
  return {
    Tick(now: number) {
      if (pausedAt !== null) return 0;
      const delta = Math.min(0.1, Math.max(0, (now - last) / 1000));
      last = now;
      return delta;
    },
    Now(now: number) { return (pausedAt ?? now) - pausedDuration; },
    Pause(now: number) { if (pausedAt === null) pausedAt = now; },
    Resume(now: number) {
      if (pausedAt === null) return;
      pausedDuration += now - pausedAt;
      pausedAt = null;
      last = now;
    },
  };
}

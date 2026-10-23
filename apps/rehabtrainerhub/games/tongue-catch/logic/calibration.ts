import type { TongueLabel } from './tongueCatch';

// Values from the original game: each movement is held for 1.9 s and needs at least 10 samples.
export const calibrationSteps: readonly TongueLabel[] = ['Rest', 'Tongue_Left', 'Tongue_Right'];
export const calibrationTiming = { captureMs: 1900, minSamples: 10 } as const;

// The samples stay in the container's classifier; the game only sees how many there are.
export function CreateCalibration() {
  let index = 0;
  let startedAt: number | null = null;
  let progress = 0;
  const label = () => calibrationSteps[Math.min(index, calibrationSteps.length - 1)];
  return {
    State: () => ({ index, label: label(), capturing: startedAt !== null, progress, complete: index >= calibrationSteps.length }),
    Start(now: number) {
      if (startedAt !== null || index >= calibrationSteps.length) return null;
      startedAt = now;
      progress = 0;
      return label();
    },
    Update(samples: Record<TongueLabel, number>, now: number) {
      if (startedAt === null) return null;
      const current = label();
      progress = Math.min(Math.max((now - startedAt) / calibrationTiming.captureMs, 0), 1);
      if (progress < 1 || samples[current] < calibrationTiming.minSamples) return { progress, finished: null };
      startedAt = null;
      index++;
      return { progress, finished: current };
    },
  };
}

import { OneEuroFilter } from './oneEuroFilter';

type Angles = { yaw: number; pitch: number };
type Zone = 'up' | 'down';

// A nod leaves its zone once it comes back under 60% of the set angle, so jitter at the threshold cannot count twice.
const nodRelease = 0.6;
// Half a nod older than this is dropped, so a slow look up and a later look down are not one flap.
const nodCycleSec = 4;

// One flap per full nod: past the set angle one way, then past it the other way.
export function CreateFlapDetector(nodRangeDeg: number) {
  let zone: Zone | null = null;
  let first: Zone | null = null;
  let firstAt = 0;
  const Reset = () => { zone = null; first = null; };
  return {
    Reset,
    Update(pitch: number | null, timeSec: number) {
      if (pitch === null || !Number.isFinite(pitch)) { Reset(); return false; }
      if (first !== null && timeSec - firstAt > nodCycleSec) first = null;
      if (zone === 'up' && pitch < nodRangeDeg * nodRelease) zone = null;
      if (zone === 'down' && pitch > -nodRangeDeg * nodRelease) zone = null;
      if (zone !== null) return false;
      const entered: Zone | null = pitch >= nodRangeDeg ? 'up' : pitch <= -nodRangeDeg ? 'down' : null;
      if (entered === null) return false;
      zone = entered;
      if (first !== null && first !== entered) { first = null; return true; }
      first = entered;
      firstAt = timeSec;
      return false;
    },
  };
}

// The neutral position from FlyingMoo: 2 s of steady samples, taken as the median.
export const neutralCalibration = { windowMs: 2000, minSamples: 20, maxSpreadDeg: 2.5, timeoutMs: 15000 };

function Spread(values: number[]) {
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  return Math.sqrt(values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length);
}
function Median(values: number[]) {
  const ordered = [...values].sort((left, right) => left - right);
  const middle = Math.floor(ordered.length / 2);
  return ordered.length % 2 ? ordered[middle] : (ordered[middle - 1] + ordered[middle]) / 2;
}

export function CreateNeutralCalibration(startMs: number) {
  let samples: (Angles & { time: number })[] = [];
  let status: 'collecting' | 'done' | 'failed' = 'collecting';
  let neutral: Angles | null = null;
  const State = () => ({
    status, neutral,
    progress: status === 'done' ? 1 : samples.length > 1 ? Math.min(1, (samples.at(-1)!.time - samples[0].time) / neutralCalibration.windowMs) : 0,
  });
  return {
    State,
    Add(sample: Angles | null, timeMs: number) {
      if (status !== 'collecting') return State();
      if (timeMs - startMs > neutralCalibration.timeoutMs) { status = 'failed'; samples = []; return State(); }
      // A lost face or a moving head starts the 2 s window again.
      if (!sample) { samples = []; return State(); }
      samples.push({ ...sample, time: timeMs });
      if (Spread(samples.map(item => item.yaw)) > neutralCalibration.maxSpreadDeg
        || Spread(samples.map(item => item.pitch)) > neutralCalibration.maxSpreadDeg) samples = [samples.at(-1)!];
      if (samples.length >= neutralCalibration.minSamples && samples.at(-1)!.time - samples[0].time >= neutralCalibration.windowMs) {
        status = 'done';
        neutral = { yaw: Median(samples.map(item => item.yaw)), pitch: Median(samples.map(item => item.pitch)) };
      }
      return State();
    },
  };
}

export function CreateHeadSmoother() {
  const yaw = new OneEuroFilter();
  const pitch = new OneEuroFilter();
  return {
    Filter(angles: Angles, timeMs: number): Angles { return { yaw: yaw.filter(angles.yaw, timeMs), pitch: pitch.filter(angles.pitch, timeMs) }; },
    Reset() { yaw.reset(); pitch.reset(); },
  };
}

// The set turn reaches the edge of the lane; turning farther keeps the gull there.
export function HeadTargetX(yawDeg: number, turnRangeDeg: number) {
  return Math.min(Math.max(yawDeg / turnRangeDeg, -1), 1);
}

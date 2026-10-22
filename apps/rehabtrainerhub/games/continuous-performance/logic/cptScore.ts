import type { CptRow } from './cptRun';
import { trialKinds } from './cptTrials';

export interface CptSummary {
  trials: number; targets: number; hits: number; omissions: number; commissions: number;
  hitPercent: number | null; falseAlarmPercent: number | null; dPrime: number | null;
  meanHitRtMs: number | null; hitRtSdMs: number | null; nearMissPresses: number; accuracyPercent: number | null;
}

const Round = (value: number | null, digits = 0) => value === null ? null : Math.round(value * 10 ** digits) / 10 ** digits;
const nearMissKinds = new Set<number>([trialKinds.ay, trialKinds.bx]);

export function IsCorrect(row: Pick<CptRow, 'target' | 'responded'>) { return row.target ? row.responded : !row.responded; }

// Inverse of the standard normal distribution (Acklam's rational approximation, error below 1.2e-9).
function InverseNormal(p: number) {
  const a = [-39.69683028665376, 220.9460984245205, -275.9285104469687, 138.357751867269, -30.66479806614716, 2.506628277459239];
  const b = [-54.47609879822406, 161.5858368580409, -155.6989798598866, 66.80131188771972, -13.28068155288572];
  const c = [-.007784894002430293, -.3223964580411365, -2.400758277161838, -2.549732539343734, 4.374664141464968, 2.938163982698783];
  const d = [.007784695709041462, .3224671290700398, 2.445134137142996, 3.754408661907416];
  const tail = (q: number) => (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
  if (p < .02425) return tail(Math.sqrt(-2 * Math.log(p)));
  if (p > 1 - .02425) return -tail(Math.sqrt(-2 * Math.log(1 - p)));
  const q = p - .5, r = q * q;
  return (((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q / (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1);
}

export function SummarizeCpt(rows: CptRow[]): CptSummary {
  const targets = rows.filter(row => row.target);
  const others = rows.filter(row => !row.target);
  const hits = targets.filter(row => row.responded).length;
  const commissions = others.filter(row => row.responded).length;
  const rts = targets.filter(row => row.responded && row.rtMs !== null).map(row => row.rtMs!);
  const mean = rts.length ? rts.reduce((sum, value) => sum + value, 0) / rts.length : null;
  const sd = rts.length > 1 && mean !== null ? Math.sqrt(rts.reduce((sum, value) => sum + (value - mean) ** 2, 0) / (rts.length - 1)) : null;
  // The log-linear correction keeps d' finite when a rate would be 0 or 1.
  const dPrime = targets.length && others.length
    ? InverseNormal((hits + .5) / (targets.length + 1)) - InverseNormal((commissions + .5) / (others.length + 1)) : null;
  return {
    trials: rows.length,
    targets: targets.length,
    hits,
    omissions: targets.length - hits,
    commissions,
    hitPercent: targets.length ? Round(hits / targets.length * 100, 1) : null,
    falseAlarmPercent: others.length ? Round(commissions / others.length * 100, 1) : null,
    dPrime: Round(dPrime, 2),
    meanHitRtMs: Round(mean),
    hitRtSdMs: Round(sd),
    nearMissPresses: others.filter(row => row.responded && nearMissKinds.has(row.kind)).length,
    accuracyPercent: rows.length ? Round(rows.filter(IsCorrect).length / rows.length * 100, 1) : null,
  };
}

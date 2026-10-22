import { trialKinds, type CptTrial, type TrialKind } from './cptTrials';

export interface CptRow { trial: number; letterCode: number; kind: TrialKind; target: boolean; responded: boolean; rtMs: number | null }
export interface CptClock { now(): number; set(callback: () => void, ms: number): number; clear(timer: number): void }
export interface CptView { show(trial: CptTrial, index: number): void; blank(): void }
export interface CptTiming { letterMs: number; isiMs: number; leadInMs: number }

// Runs the letter stream outside React so onsets and presses use the same clock.
// Each onset is scheduled from the planned start, so timer lateness does not accumulate.
export class CptRun {
  private rows: CptRow[] = [];
  private timers = new Set<number>();
  private current = -1;
  private onset = 0;
  private startedAt = 0;
  private stopped = false;

  constructor(private trials: CptTrial[], private timing: CptTiming, private view: CptView,
    private clock: CptClock, private onFinish: (rows: CptRow[]) => void) {}

  start() {
    this.startedAt = this.clock.now();
    this.schedule(() => this.showTrial(0), this.timing.leadInMs);
  }

  respond() {
    const row = this.rows[this.current];
    if (this.stopped || !row || row.responded) return;
    row.responded = true;
    row.rtMs = Math.round(this.clock.now() - this.onset);
  }

  stop() {
    this.stopped = true;
    for (const timer of this.timers) this.clock.clear(timer);
    this.timers.clear();
  }

  private schedule(callback: () => void, delay: number) {
    const timer = this.clock.set(() => { this.timers.delete(timer); if (!this.stopped) callback(); }, delay);
    this.timers.add(timer);
  }

  private plannedOnset(index: number) {
    return this.startedAt + this.timing.leadInMs + index * (this.timing.letterMs + this.timing.isiMs);
  }

  private showTrial(index: number) {
    const trial = this.trials[index];
    this.current = index;
    this.onset = this.clock.now();
    this.rows.push({ trial: index + 1, letterCode: trial.letter.charCodeAt(0), kind: trial.kind,
      target: trial.kind === trialKinds.target, responded: false, rtMs: null });
    this.view.show(trial, index);
    this.schedule(() => this.view.blank(), this.onset + this.timing.letterMs - this.clock.now());
    const next = index + 1;
    const nextAt = this.plannedOnset(next) - this.clock.now();
    if (next < this.trials.length) this.schedule(() => this.showTrial(next), nextAt);
    else this.schedule(() => { this.stopped = true; this.onFinish(this.rows.map(row => ({ ...row }))); }, nextAt);
  }
}

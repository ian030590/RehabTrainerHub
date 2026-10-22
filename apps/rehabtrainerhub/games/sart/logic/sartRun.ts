import type { SartTrial } from './sartTrials';

export interface SartRow { trial: number; digit: number; noGo: boolean; responded: boolean; rtMs: number | null }
export interface SartClock { now(): number; set(callback: () => void, ms: number): number; clear(timer: number): void }
export interface SartView { show(trial: SartTrial, index: number): void; mask(): void }
export interface SartTiming { digitMs: number; maskMs: number; leadInMs: number }

// Runs the digit stream outside React so onsets and presses use the same clock.
// Each onset is scheduled from the planned start, so timer lateness does not accumulate.
export class SartRun {
  private rows: SartRow[] = [];
  private timers = new Set<number>();
  private current = -1;
  private onset = 0;
  private startedAt = 0;
  private stopped = false;

  constructor(private trials: SartTrial[], private timing: SartTiming, private view: SartView,
    private clock: SartClock, private onFinish: (rows: SartRow[]) => void) {}

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
    return this.startedAt + this.timing.leadInMs + index * (this.timing.digitMs + this.timing.maskMs);
  }

  private showTrial(index: number) {
    const trial = this.trials[index];
    this.current = index;
    this.onset = this.clock.now();
    this.rows.push({ trial: index + 1, digit: trial.digit, noGo: trial.noGo, responded: false, rtMs: null });
    this.view.show(trial, index);
    this.schedule(() => this.view.mask(), this.onset + this.timing.digitMs - this.clock.now());
    const next = index + 1;
    const nextAt = this.plannedOnset(next) - this.clock.now();
    if (next < this.trials.length) this.schedule(() => this.showTrial(next), nextAt);
    else this.schedule(() => { this.stopped = true; this.onFinish(this.rows.map(row => ({ ...row }))); }, nextAt);
  }
}

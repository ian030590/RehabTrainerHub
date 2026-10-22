import type { Side, SimonTrial } from './simonTrials';

export interface SimonRow { trial: number; shape: number; side: number; congruent: boolean; response: number | null; correct: boolean; rtMs: number | null }
export interface SimonClock { now(): number; set(callback: () => void, ms: number): number; clear(timer: number): void }
export interface SimonView { show(trial: SimonTrial, index: number): void; clear(row: SimonRow): void }
export interface SimonTiming { responseMs: number; itiMs: number; leadInMs: number }

const sideCode = (side: Side) => side === 'left' ? 0 : 1;

// Each shape stays until the first answer or the time limit, then the gap runs before the next shape.
export class SimonRun {
  private rows: SimonRow[] = [];
  private timers = new Set<number>();
  private windowTimer: number | null = null;
  private active = false;
  private onset = 0;
  private stopped = false;

  constructor(private trials: SimonTrial[], private timing: SimonTiming, private view: SimonView,
    private clock: SimonClock, private onFinish: (rows: SimonRow[]) => void) {}

  start() { this.schedule(() => this.showTrial(0), this.timing.leadInMs); }

  respond(side: Side) {
    const row = this.rows.at(-1);
    if (this.stopped || !this.active || !row) return;
    const trial = this.trials[row.trial - 1];
    row.response = sideCode(side);
    row.correct = side === trial.answer;
    row.rtMs = Math.round(this.clock.now() - this.onset);
    this.endTrial();
  }

  stop() {
    this.stopped = true;
    this.active = false;
    for (const timer of this.timers) this.clock.clear(timer);
    this.timers.clear();
  }

  private schedule(callback: () => void, delay: number) {
    const timer = this.clock.set(() => { this.timers.delete(timer); if (!this.stopped) callback(); }, delay);
    this.timers.add(timer);
    return timer;
  }

  private showTrial(index: number) {
    const trial = this.trials[index];
    this.onset = this.clock.now();
    this.active = true;
    this.rows.push({ trial: index + 1, shape: trial.shape === 'circle' ? 0 : 1, side: sideCode(trial.side), congruent: trial.congruent,
      response: null, correct: false, rtMs: null });
    this.view.show(trial, index);
    this.windowTimer = this.schedule(() => this.endTrial(), this.timing.responseMs);
  }

  private endTrial() {
    if (this.windowTimer !== null) { this.clock.clear(this.windowTimer); this.timers.delete(this.windowTimer); this.windowTimer = null; }
    this.active = false;
    const row = this.rows.at(-1)!;
    this.view.clear({ ...row });
    const next = this.rows.length;
    if (next < this.trials.length) this.schedule(() => this.showTrial(next), this.timing.itiMs);
    else this.schedule(() => { this.stopped = true; this.onFinish(this.rows.map(item => ({ ...item }))); }, this.timing.itiMs);
  }
}

export interface CenterClock { now(): number; set(callback: () => void, ms: number): number; clear(timer: number): void }
export interface CenterTiming { minGapMs: number; maxGapMs: number; windowMs: number }
export interface CenterView { show(): void; hide(hit: boolean): void }

// Flashes the centre mark now and then; a tap while it shows confirms the eyes stayed on the centre.
export class CenterChecks {
  private timer: number | null = null;
  private showing = false;
  private shown = 0;
  private hits = 0;
  private missed = 0;
  private stopped = false;

  constructor(private timing: CenterTiming, private clock: CenterClock, private random: () => number, private view: CenterView) {}

  start() { this.scheduleNext(); }

  respond(): boolean {
    if (this.stopped || !this.showing) return false;
    this.hits++;
    this.end(true);
    return true;
  }

  stop() {
    this.stopped = true;
    // A check cut short by the end of the round counts as neither caught nor missed.
    if (this.showing) { this.showing = false; this.shown--; }
    if (this.timer !== null) this.clock.clear(this.timer);
    this.timer = null;
  }

  counts() { return { shown: this.shown, hits: this.hits, missed: this.missed }; }

  private scheduleNext() {
    const gap = this.timing.minGapMs + this.random() * (this.timing.maxGapMs - this.timing.minGapMs);
    this.timer = this.clock.set(() => this.show(), Math.round(gap));
  }

  private show() {
    if (this.stopped) return;
    this.showing = true;
    this.shown++;
    this.view.show();
    this.timer = this.clock.set(() => { this.missed++; this.end(false); }, this.timing.windowMs);
  }

  private end(hit: boolean) {
    if (this.timer !== null) this.clock.clear(this.timer);
    this.showing = false;
    this.view.hide(hit);
    if (!this.stopped) this.scheduleNext();
  }
}

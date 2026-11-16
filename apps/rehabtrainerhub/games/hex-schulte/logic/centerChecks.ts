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
  private paused = false;
  private due = 0;
  private remaining = 0;
  private callback: (() => void) | null = null;

  constructor(private timing: CenterTiming, private clock: CenterClock, private random: () => number, private view: CenterView) {}

  start() { this.scheduleNext(); }

  respond(): boolean {
    if (this.stopped || this.paused || !this.showing) return false;
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

  pause() {
    if (this.stopped || this.paused) return;
    this.paused = true;
    this.remaining = Math.max(0, this.due - this.clock.now());
    if (this.timer !== null) this.clock.clear(this.timer);
    this.timer = null;
  }

  resume() {
    if (this.stopped || !this.paused) return;
    this.paused = false;
    if (this.callback) this.schedule(this.callback, this.remaining);
  }

  private schedule(callback: () => void, ms: number) {
    this.callback = callback;
    this.due = this.clock.now() + ms;
    this.timer = this.clock.set(callback, ms);
  }

  private scheduleNext() {
    const gap = this.timing.minGapMs + this.random() * (this.timing.maxGapMs - this.timing.minGapMs);
    this.schedule(() => this.show(), Math.round(gap));
  }

  private show() {
    if (this.stopped) return;
    this.showing = true;
    this.shown++;
    this.view.show();
    this.schedule(() => { this.missed++; this.end(false); }, this.timing.windowMs);
  }

  private end(hit: boolean) {
    if (this.timer !== null) this.clock.clear(this.timer);
    this.showing = false;
    this.view.hide(hit);
    if (!this.stopped) this.scheduleNext();
  }
}

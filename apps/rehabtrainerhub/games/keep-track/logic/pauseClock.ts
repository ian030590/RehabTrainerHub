interface Clock { now(): number; set(callback: () => void, ms: number): number; clear(timer: number): void }

export class PauseClock {
  private timers = new Set<{ callback: () => void; due: number; timer: number | null }>();
  private pausedAt: number | null = null;
  private pausedTime = 0;
  private stopped = false;

  constructor(private clock: Clock) {}

  now() { return (this.pausedAt ?? this.clock.now()) - this.pausedTime; }

  set(callback: () => void, ms: number) {
    if (this.stopped) return;
    const item = { callback, due: this.now() + ms, timer: null as number | null };
    this.timers.add(item);
    if (this.pausedAt === null) this.schedule(item);
  }

  pause() {
    if (this.stopped || this.pausedAt !== null) return;
    this.pausedAt = this.clock.now();
    for (const item of this.timers) { if (item.timer !== null) this.clock.clear(item.timer); item.timer = null; }
  }

  resume() {
    if (this.stopped || this.pausedAt === null) return;
    this.pausedTime += this.clock.now() - this.pausedAt;
    this.pausedAt = null;
    for (const item of this.timers) this.schedule(item);
  }

  stop() {
    this.stopped = true;
    for (const item of this.timers) if (item.timer !== null) this.clock.clear(item.timer);
    this.timers.clear();
  }

  private schedule(item: { callback: () => void; due: number; timer: number | null }) {
    item.timer = this.clock.set(() => { this.timers.delete(item); if (!this.stopped) item.callback(); }, Math.max(0, item.due - this.now()));
  }
}

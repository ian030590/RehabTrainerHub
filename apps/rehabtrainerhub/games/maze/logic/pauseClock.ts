interface Clock { now(): number; set(callback: () => void, ms: number): number; clear(timer: number): void }
interface Pending { callback: () => void; due: number; timer: number | null }

export class PauseClock {
  private timers = new Set<Pending>();
  private pausedAt: number | null = null;
  private pausedTime = 0;
  private stopped = false;

  constructor(private clock: Clock) {}
  now() { return (this.pausedAt ?? this.clock.now()) - this.pausedTime; }
  set(callback: () => void, ms: number): Pending | null {
    if (this.stopped) return null;
    const item: Pending = { callback, due: this.now() + ms, timer: null };
    this.timers.add(item);
    if (this.pausedAt === null) this.schedule(item);
    return item;
  }
  clear(item: Pending | null) {
    if (!item || !this.timers.delete(item)) return;
    if (item.timer !== null) this.clock.clear(item.timer);
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
  private schedule(item: Pending) {
    item.timer = this.clock.set(() => { this.timers.delete(item); if (!this.stopped) item.callback(); }, Math.max(0, item.due - this.now()));
  }
}

interface Clock { now(): number; set(callback: () => void, ms: number): number; clear(timer: number): void }
interface Pending { callback: () => void; due: number; timer: number | null }

export class DrivingPauseClock {
  private timers = new Map<number, Pending>();
  private nextId = 1;
  private pausedAt: number | null = null;
  private pausedDuration = 0;
  constructor(private clock: Clock) {}
  now() { return (this.pausedAt ?? this.clock.now()) - this.pausedDuration; }
  set(callback: () => void, ms: number) {
    const id = this.nextId++;
    const item = { callback, due: this.now() + ms, timer: null } as Pending;
    this.timers.set(id, item);
    if (this.pausedAt === null) this.schedule(id, item);
    return id;
  }
  clear(id: number) {
    const item = this.timers.get(id);
    if (!item) return;
    if (item.timer !== null) this.clock.clear(item.timer);
    this.timers.delete(id);
  }
  pause() {
    if (this.pausedAt !== null) return;
    this.pausedAt = this.clock.now();
    for (const item of this.timers.values()) { if (item.timer !== null) this.clock.clear(item.timer); item.timer = null; }
  }
  resume() {
    if (this.pausedAt === null) return;
    this.pausedDuration += this.clock.now() - this.pausedAt;
    this.pausedAt = null;
    for (const [id, item] of this.timers) this.schedule(id, item);
  }
  private schedule(id: number, item: Pending) {
    item.timer = this.clock.set(() => { this.timers.delete(id); item.callback(); }, Math.max(0, item.due - this.now()));
  }
}

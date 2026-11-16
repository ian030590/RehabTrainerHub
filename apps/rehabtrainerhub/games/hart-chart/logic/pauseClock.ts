export class HartClock {
  private startedAt = 0;
  private pausedAt: number | null = null;
  private pausedDuration = 0;

  constructor(private now: () => number) {}
  start() { this.startedAt = this.now(); this.pausedAt = null; this.pausedDuration = 0; }
  pause() { if (this.pausedAt === null) this.pausedAt = this.now(); }
  resume() {
    if (this.pausedAt === null) return;
    this.pausedDuration += this.now() - this.pausedAt;
    this.pausedAt = null;
  }
  elapsed() { return Math.max(0, (this.pausedAt ?? this.now()) - this.startedAt - this.pausedDuration); }
}

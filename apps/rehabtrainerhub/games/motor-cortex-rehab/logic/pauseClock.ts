export class PauseClock {
  private pausedAt: number | null = null;
  private pausedTime = 0;
  private readonly clock: () => number;

  constructor(clock: () => number) { this.clock = clock; }

  now() { return (this.pausedAt ?? this.clock()) - this.pausedTime; }
  pause() { if (this.pausedAt === null) this.pausedAt = this.clock(); }
  resume() {
    if (this.pausedAt === null) return;
    this.pausedTime += this.clock() - this.pausedAt;
    this.pausedAt = null;
  }
}

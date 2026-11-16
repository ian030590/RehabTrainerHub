export class TrialInterrupt {
  private paused = false;
  private active: AbortController | null = null;
  private waiters = new Set<() => void>();

  pause() { if (!this.paused) { this.paused = true; this.active?.abort(); } }
  resume() { if (this.paused) { this.paused = false; for (const wake of this.waiters) wake(); } }

  async run<T>(parent: AbortSignal, trial: (signal: AbortSignal) => Promise<T>): Promise<T> {
    for (;;) {
      if (parent.aborted) throw new DOMException('Stopped', 'AbortError');
      if (this.paused) await new Promise<void>((resolve, reject) => {
        const cleanup = () => { this.waiters.delete(wake); parent.removeEventListener('abort', stop); };
        const wake = () => { cleanup(); resolve(); };
        const stop = () => { cleanup(); reject(new DOMException('Stopped', 'AbortError')); };
        this.waiters.add(wake);
        parent.addEventListener('abort', stop, { once: true });
        if (parent.aborted) stop();
      });
      if (parent.aborted) throw new DOMException('Stopped', 'AbortError');
      const attempt = new AbortController();
      this.active = attempt;
      const stop = () => attempt.abort();
      parent.addEventListener('abort', stop, { once: true });
      try {
        const value = await trial(attempt.signal);
        if (!attempt.signal.aborted) return value;
        if (parent.aborted) throw new DOMException('Stopped', 'AbortError');
      } catch (error) {
        if (parent.aborted || !attempt.signal.aborted) throw error;
      } finally {
        parent.removeEventListener('abort', stop);
        if (this.active === attempt) this.active = null;
      }
    }
  }
}

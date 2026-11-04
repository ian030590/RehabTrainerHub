export interface RunClock { now(): number; set(callback: () => void, ms: number): number; clear(timer: number): void }
export interface LeadScreen { state: string; ms: number }
export interface TrialTiming {
  lead: LeadScreen[];
  /** How long the target stays visible; null keeps it until the trial ends. */
  exposureMs: number | null;
  /** Time allowed to answer from target onset; null waits for an answer. */
  windowMs: number | null;
  endOnResponse: boolean;
  feedbackMs: number;
  gapMs: number;
  /** Stop-signal delay from target onset. */
  signalMs?: number | null;
  /** Pads the whole trial to this length. */
  trialMs?: number;
}
export interface TrialStep<T> { trial: T; timing: TrialTiming }
export interface TrialOutcome<T> { index: number; trial: T; response: string | null; rtMs: number | null; signalled: boolean }
export interface TrialView<T> {
  lead(state: string, step: TrialStep<T>, index: number): void;
  show(step: TrialStep<T>, index: number): void;
  hide(): void;
  signal(): void;
  end(outcome: TrialOutcome<T>, feedback: boolean): void;
  clear(): void;
}

// Runs timed trials outside React so onsets and answers share one clock.
// The next step is requested only when it starts, so it can depend on earlier outcomes.
export class TrialRun<T> {
  private outcomes: TrialOutcome<T>[] = [];
  private timers = new Set<number>();
  private trialTimers: number[] = [];
  private step: TrialStep<T> | null = null;
  private outcome: TrialOutcome<T> | null = null;
  private trialStart = 0;
  private onset = 0;
  private accepting = false;
  private stopped = false;

  constructor(private count: number, private next: (index: number, done: readonly TrialOutcome<T>[]) => TrialStep<T>,
    private view: TrialView<T>, private clock: RunClock, private onFinish: (outcomes: TrialOutcome<T>[]) => void, private leadInMs = 1500) {}

  start() { this.schedule(() => this.begin(0), this.leadInMs); }

  respond(response: string): boolean {
    const outcome = this.outcome;
    if (this.stopped || !this.accepting || !outcome || outcome.response !== null) return false;
    outcome.response = response;
    outcome.rtMs = Math.round(this.clock.now() - this.onset);
    if (this.step!.timing.endOnResponse) this.finishTrial();
    return true;
  }

  stop() {
    this.stopped = true;
    this.accepting = false;
    for (const timer of this.timers) this.clock.clear(timer);
    this.timers.clear();
  }

  private schedule(callback: () => void, delay: number) {
    const timer = this.clock.set(() => { this.timers.delete(timer); if (!this.stopped) callback(); }, delay);
    this.timers.add(timer);
    return timer;
  }

  private begin(index: number) {
    const step = this.next(index, this.outcomes);
    this.step = step;
    this.trialStart = this.clock.now();
    this.runLead(index, 0);
  }

  private runLead(index: number, screen: number) {
    const step = this.step!;
    const lead = step.timing.lead[screen];
    if (!lead) { this.showTarget(index); return; }
    this.view.lead(lead.state, step, index);
    this.schedule(() => this.runLead(index, screen + 1), lead.ms);
  }

  private showTarget(index: number) {
    const step = this.step!;
    const { exposureMs, windowMs, signalMs } = step.timing;
    this.onset = this.clock.now();
    this.outcome = { index, trial: step.trial, response: null, rtMs: null, signalled: false };
    this.accepting = true;
    this.view.show(step, index);
    this.trialTimers = [];
    if (exposureMs !== null) this.trialTimers.push(this.schedule(() => this.view.hide(), exposureMs));
    if (signalMs !== null && signalMs !== undefined) {
      this.trialTimers.push(this.schedule(() => { this.outcome!.signalled = true; this.view.signal(); }, signalMs));
    }
    if (windowMs !== null) this.trialTimers.push(this.schedule(() => this.finishTrial(), windowMs));
  }

  private finishTrial() {
    if (!this.accepting) return;
    this.accepting = false;
    for (const timer of this.trialTimers) { this.clock.clear(timer); this.timers.delete(timer); }
    this.trialTimers = [];
    const outcome = { ...this.outcome! };
    this.outcomes.push(outcome);
    const { feedbackMs, gapMs, trialMs } = this.step!.timing;
    this.view.end({ ...outcome }, feedbackMs > 0);
    const elapsed = this.clock.now() - this.trialStart;
    const gap = trialMs ? Math.max(gapMs, trialMs - elapsed - feedbackMs) : gapMs;
    const advance = () => {
      if (this.outcomes.length < this.count) this.begin(this.outcomes.length);
      else { this.stopped = true; this.onFinish(this.outcomes.map(item => ({ ...item }))); }
    };
    const clear = () => { this.view.clear(); this.schedule(advance, gap); };
    if (feedbackMs > 0) this.schedule(clear, feedbackMs);
    else clear();
  }
}

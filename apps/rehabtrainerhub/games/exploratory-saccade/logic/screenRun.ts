import type { SearchScreen } from './screens';

export interface Clock { now: () => number; set: (callback: () => void, ms: number) => number; clear: (id: number) => void }
export interface Find { itemId: number; foundMs: number; intervalMs: number; order: number }
export interface ScreenRecord extends SearchScreen { number: number; durationMs: number; falseClicks: number; finds: Find[] }
export interface ScreenState { phase: 'ready' | 'search' | 'complete' | 'missed' | 'finished' | 'stopped'; screen: SearchScreen | null; found: number[]; missed: number[] }

export const browserClock: Clock = { now: () => performance.now(), set: (callback, ms) => window.setTimeout(callback, ms), clear: id => window.clearTimeout(id) };

export class ScreenRun {
  readonly screens: ScreenRecord[] = [];
  state: ScreenState = { phase: 'ready', screen: null, found: [], missed: [] };
  private timer: number | null = null;
  private onset = 0;
  private usedMs = 0;
  private finds: Find[] = [];
  private falseClicks = 0;
  private downActivation: string | undefined;

  constructor(private readonly options: { sessionMs: number; screenLimitMs: number },
    private readonly create: (index: number, previous: string | null) => SearchScreen,
    private readonly events: { change: (state: ScreenState) => void; mark: (itemId: number) => void; end: (screens: ScreenRecord[]) => void },
    private readonly clock: Clock) {}

  prepare(): void {
    if (this.state.phase === 'stopped' || this.state.phase === 'finished') return;
    const screen = this.create(this.screens.length, this.screens.at(-1)?.target ?? null);
    this.state = { phase: 'ready', screen, found: [], missed: [] };
    this.events.change(this.state);
  }

  startScreen(): void {
    if (this.state.phase !== 'ready' || !this.state.screen) return;
    this.onset = this.clock.now(); this.finds = []; this.falseClicks = 0; this.downActivation = undefined;
    this.state = { ...this.state, phase: 'search' };
    if (this.options.screenLimitMs > 0) this.timer = this.clock.set(() => this.endScreen(), this.options.screenLimitMs);
    this.events.change(this.state);
  }

  interact(id: number, kind: 'pointerover' | 'pointermove' | 'pointerdown' | 'click', pointerType = 'mouse', activation?: string): boolean {
    if (this.state.phase !== 'search') return false;
    if (this.options.screenLimitMs > 0 && this.clock.now() - this.onset >= this.options.screenLimitMs) { this.endScreen(); return false; }
    const item = this.state.screen?.items.find(candidate => candidate.id === id);
    if (!item) return false;
    const hover = kind === 'pointermove' || kind === 'pointerover';
    if (hover && pointerType !== 'mouse') return false;
    if (kind === 'click' && activation !== undefined && activation === this.downActivation) { this.downActivation = undefined; return false; }
    if (kind === 'pointerdown') this.downActivation = activation;
    if (!item.target) { if (!hover) this.falseClicks++; return false; }
    if (this.state.found.includes(id)) return false;
    const foundMs = this.clock.now() - this.onset;
    this.finds.push({ itemId: id, foundMs, intervalMs: foundMs - (this.finds.at(-1)?.foundMs ?? 0), order: this.finds.length + 1 });
    this.state = { ...this.state, found: [...this.state.found, id] };
    this.events.mark(id);
    if (this.state.found.length === this.state.screen!.items.filter(candidate => candidate.target).length) this.endScreen();
    else this.events.change(this.state);
    return true;
  }

  remainingMs(): number {
    return Math.max(0, this.options.sessionMs - this.usedMs - (this.state.phase === 'search' ? this.clock.now() - this.onset : 0));
  }

  stop(): void {
    this.clearTimer();
    this.state = { ...this.state, phase: 'stopped' };
  }

  private clearTimer(): void {
    if (this.timer !== null) this.clock.clear(this.timer);
    this.timer = null;
  }

  private endScreen(): void {
    if (this.state.phase !== 'search' || !this.state.screen) return;
    this.clearTimer();
    const durationMs = this.clock.now() - this.onset;
    this.usedMs += durationMs;
    const missed = this.state.screen.items.filter(item => item.target && !this.state.found.includes(item.id)).map(item => item.id);
    this.screens.push({ ...this.state.screen, number: this.screens.length + 1, durationMs, falseClicks: this.falseClicks, finds: [...this.finds] });
    this.state = { ...this.state, phase: missed.length ? 'missed' : 'complete', missed };
    this.events.change(this.state);
    this.timer = this.clock.set(() => {
      this.timer = null;
      if (this.usedMs >= this.options.sessionMs) {
        this.state = { ...this.state, phase: 'finished' };
        this.events.change(this.state); this.events.end([...this.screens]);
      } else this.prepare();
    }, missed.length ? 1500 : 600);
  }
}

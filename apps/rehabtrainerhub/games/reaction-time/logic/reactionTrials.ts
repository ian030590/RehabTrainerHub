export type Difficulty = 'easy' | 'medium' | 'hard';
export type Status = 'idle' | 'wait' | 'go' | 'result' | 'early';
export interface ReactionRow { trial: number; falseStart: boolean; responseMs: number | null; earlyMs: number | null; waitMs: number }
export interface ReactionSession { status: Status; waitStartMs: number | null; goMs: number | null; foreperiodMs: number | null; lastMs: number | null; rows: ReactionRow[] }

// Random wait before the green signal, in ms, as in the original module.
export const foreperiods: Record<Difficulty, [number, number]> = { easy: [1400, 3200], medium: [1800, 4400], hard: [2200, 5200] };

export function DrawForeperiod(difficulty: Difficulty, random: () => number): number {
  const [low, high] = foreperiods[difficulty];
  return Math.floor(low + random() * (high - low));
}

export function CreateSession(): ReactionSession {
  return { status: 'idle', waitStartMs: null, goMs: null, foreperiodMs: null, lastMs: null, rows: [] };
}

// One press does what the screen asks: start a wait, end it too early, or stop the clock after the signal.
// The next wait is drawn by the caller so the press stays a pure function.
export function Press(session: ReactionSession, timeMs: number, nextForeperiodMs: number): { session: ReactionSession; row: ReactionRow | null } {
  if (session.status === 'wait') {
    const row = { trial: session.rows.length + 1, falseStart: true, responseMs: null, earlyMs: Math.round(timeMs - session.waitStartMs!), waitMs: session.foreperiodMs! };
    return { session: { ...session, status: 'early', waitStartMs: null, foreperiodMs: null, rows: [...session.rows, row] }, row };
  }
  if (session.status === 'go') {
    const responseMs = Math.round(timeMs - session.goMs!);
    const row = { trial: session.rows.length + 1, falseStart: false, responseMs, earlyMs: null, waitMs: session.foreperiodMs! };
    return { session: { ...session, status: 'result', goMs: null, waitStartMs: null, foreperiodMs: null, lastMs: responseMs, rows: [...session.rows, row] }, row };
  }
  return { session: { ...session, status: 'wait', waitStartMs: timeMs, goMs: null, foreperiodMs: nextForeperiodMs, lastMs: null }, row: null };
}

export function ShowGo(session: ReactionSession, timeMs: number): ReactionSession {
  return session.status === 'wait' ? { ...session, status: 'go', goMs: timeMs } : session;
}

export const Successes = (session: ReactionSession) => session.rows.filter(row => !row.falseStart).length;

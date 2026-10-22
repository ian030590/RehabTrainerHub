import type { CSSProperties, KeyboardEvent, ReactNode } from 'react';

// Time limits run up to 5 minutes, so the countdown reads as m:ss.
export function FormatRemaining(ms: number, en: boolean) {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const text = `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
  return en ? `${text} left` : `剩 ${text}`;
}

// Arrow keys move focus to the neighboring card, so a keyboard player can reach every card.
export function MoveCardFocus(event: KeyboardEvent<HTMLElement>, rows: number, cols: number) {
  const step = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -cols, ArrowDown: cols }[event.key];
  const card = (event.target as HTMLElement).closest<HTMLElement>('.mm-card');
  if (!step || !card) return;
  const index = Number(card.dataset.index);
  const next = index + step;
  const sameRow = Math.abs(step) !== 1 || Math.floor(next / cols) === Math.floor(index / cols);
  if (next < 0 || next >= rows * cols || !sameRow) return;
  event.preventDefault();
  event.currentTarget.querySelector<HTMLElement>(`.mm-card[data-index="${next}"]`)?.focus();
}

// Card faces: a patterned back while hidden, the letter once turned, and a check mark once matched.
export function CardFaces({ value }: { value: string }) {
  return <span className="mm-card-inner">
    <span className="mm-back" />
    <span className="mm-front">{value}<span className="mm-check" /></span>
  </span>;
}

export function CardBoard({ rows, cols, state, label, onKeyDown, children }: {
  rows: number; cols: number; state?: 'running' | 'over'; label?: string;
  onKeyDown?: (event: KeyboardEvent<HTMLDivElement>) => void; children: ReactNode;
}) {
  return <div className="mm-board-area">
    <div className="mm-board" role={label ? 'group' : undefined} aria-label={label} data-state={state}
      style={{ '--rows': rows, '--cols': cols } as CSSProperties} onKeyDown={onKeyDown}>{children}</div>
  </div>;
}

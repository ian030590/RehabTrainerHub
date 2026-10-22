import type { CSSProperties, KeyboardEvent, ReactNode } from 'react';

// Time limits run up to 5 minutes, so the countdown reads as m:ss.
export function FormatRemaining(ms: number, en: boolean) {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const text = `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
  return en ? `${text} left` : `剩 ${text}`;
}

// Arrow keys move focus to the neighboring cell, so a keyboard player can reach every cell.
export function MoveLightsFocus(event: KeyboardEvent<HTMLElement>, size: number) {
  const step = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -size, ArrowDown: size }[event.key];
  const cell = (event.target as HTMLElement).closest<HTMLElement>('.lo-cell');
  if (!step || !cell) return;
  const index = Number(cell.dataset.index);
  const next = index + step;
  const sameRow = Math.abs(step) !== 1 || Math.floor(next / size) === Math.floor(index / size);
  if (next < 0 || next >= size * size || !sameRow) return;
  event.preventDefault();
  event.currentTarget.querySelector<HTMLElement>(`.lo-cell[data-index="${next}"]`)?.focus();
}

export function LightsBoard({ size, state, label, onKeyDown, children }: {
  size: number; state?: 'running' | 'over'; label?: string;
  onKeyDown?: (event: KeyboardEvent<HTMLDivElement>) => void; children: ReactNode;
}) {
  return <div className="lo-board-area">
    <div className="lo-board" role={label ? 'group' : undefined} aria-label={label} data-state={state}
      style={{ '--n': size } as CSSProperties} onKeyDown={onKeyDown}>{children}</div>
  </div>;
}

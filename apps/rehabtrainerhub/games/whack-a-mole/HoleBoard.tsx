import type { CSSProperties, KeyboardEvent, ReactNode } from 'react';

// Sessions run up to 5 minutes, so the countdown reads as m:ss.
export function FormatRemaining(ms: number, en: boolean) {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const text = `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
  return en ? `${text} left` : `剩 ${text}`;
}

// Arrow keys move focus to the neighboring hole, so a keyboard player can reach every hole.
export function MoveHoleFocus(event: KeyboardEvent<HTMLElement>, size: number) {
  const step = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -size, ArrowDown: size }[event.key];
  const hole = (event.target as HTMLElement).closest<HTMLElement>('.wm-hole');
  if (!step || !hole) return;
  const index = Number(hole.dataset.index);
  const next = index + step;
  const sameRow = Math.abs(step) !== 1 || Math.floor(next / size) === Math.floor(index / size);
  if (next < 0 || next >= size * size || !sameRow) return;
  event.preventDefault();
  event.currentTarget.querySelector<HTMLElement>(`.wm-hole[data-index="${next}"]`)?.focus();
}

// The mole rises out of the hole; a hit shows a star and a wrong tap an X, so feedback reads by shape.
export function HoleContents({ flash }: { flash?: 'hit' | 'wrong' }) {
  return <>
    <span className="wm-pit" />
    <svg className="wm-mole" viewBox="0 0 100 100" aria-hidden="true">
      <ellipse className="wm-mole-body" cx="50" cy="62" rx="32" ry="38" />
      <circle className="wm-mole-eye" cx="38" cy="50" r="5" />
      <circle className="wm-mole-eye" cx="62" cy="50" r="5" />
      <ellipse className="wm-mole-nose" cx="50" cy="62" rx="8" ry="6" />
    </svg>
    {flash === 'hit' && <svg className="wm-flash wm-flash-hit" viewBox="0 0 100 100" aria-hidden="true">
      <polygon points="50,6 61,38 95,38 67,58 78,92 50,71 22,92 33,58 5,38 39,38" /></svg>}
    {flash === 'wrong' && <svg className="wm-flash wm-flash-wrong" viewBox="0 0 100 100" aria-hidden="true">
      <path d="M24 24 76 76M76 24 24 76" /></svg>}
  </>;
}

export function HoleBoard({ size, state, label, onKeyDown, children }: {
  size: number; state?: 'running' | 'over'; label?: string;
  onKeyDown?: (event: KeyboardEvent<HTMLDivElement>) => void; children: ReactNode;
}) {
  return <div className="wm-board-area">
    <div className="wm-board" role={label ? 'group' : undefined} aria-label={label} data-state={state}
      style={{ '--n': size } as CSSProperties} onKeyDown={onKeyDown}>{children}</div>
  </div>;
}

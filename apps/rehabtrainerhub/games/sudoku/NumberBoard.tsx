import type { CSSProperties, KeyboardEvent, ReactNode } from 'react';
import type { PuzzleKind } from './logic/numberGrid';

// Time limits run up to 5 minutes, so the countdown reads as m:ss.
export function FormatRemaining(ms: number, en: boolean) {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const text = `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
  return en ? `${text} left` : `剩 ${text}`;
}

export function RuleText(kind: PuzzleKind, en: boolean) {
  if (kind === 'latin-square') return en ? 'Each row and column has 1 to 4 once' : '每一列、每一欄都有 1 到 4 各一次';
  if (kind === 'magic-square') return en ? 'Use 1 to 9 once; each row, column and diagonal adds up to 15' : '1 到 9 各用一次，每列、每欄和對角線加起來都是 15';
  return en ? 'Each row, column and bold box has 1 to 9 once' : '每一列、每一欄和每個粗框都有 1 到 9 各一次';
}

// Sudoku boxes get bold borders; the outer edge is drawn by the board itself.
export function CellEdges(index: number, size: number, kind: PuzzleKind) {
  const row = Math.floor(index / size), col = index % size;
  return {
    'data-box-right': kind === 'sudoku' && col % 3 === 2 && col < size - 1 ? 'true' : undefined,
    'data-box-bottom': kind === 'sudoku' && row % 3 === 2 && row < size - 1 ? 'true' : undefined,
    'data-last-col': col === size - 1 ? 'true' : undefined,
    'data-last-row': row === size - 1 ? 'true' : undefined,
  };
}

// Arrow keys move focus between cells, so a keyboard player can reach every cell.
export function MoveNumberFocus(event: KeyboardEvent<HTMLElement>, size: number) {
  const step = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -size, ArrowDown: size }[event.key];
  const cell = (event.target as HTMLElement).closest<HTMLElement>('.sk-cell');
  if (!step || !cell) return false;
  event.preventDefault();
  const index = Number(cell.dataset.index), next = index + step;
  const sameRow = Math.abs(step) !== 1 || Math.floor(next / size) === Math.floor(index / size);
  if (next >= 0 && next < size * size && sameRow) event.currentTarget.querySelector<HTMLElement>(`.sk-cell[data-index="${next}"]`)?.focus();
  return true;
}

export function NumberBoard({ size, state, label, onKeyDown, children }: {
  size: number; state?: 'running' | 'over'; label?: string;
  onKeyDown?: (event: KeyboardEvent<HTMLDivElement>) => void; children: ReactNode;
}) {
  return <div className="sk-board-area">
    <div className="sk-board" role={label ? 'group' : undefined} aria-label={label} data-state={state}
      style={{ '--n': size } as CSSProperties} onKeyDown={onKeyDown}>{children}</div>
  </div>;
}

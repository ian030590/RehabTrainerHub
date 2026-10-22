import type { CSSProperties, KeyboardEvent as ReactKeyboardEvent, ReactNode } from 'react';

// Pointy-top cells one unit wide: each row sits half a unit right of the row above and sqrt(3)/2 units lower.
const rowStep = Math.sqrt(3) / 2;
const cellHeight = 2 / Math.sqrt(3);
const edgeGap = 0.17;

export function CellStyle(index: number, size: number) {
  return { '--r': Math.floor(index / size), '--c': index % size } as CSSProperties;
}

// Left and right move along the row; up and down move to the touching cell in the same column.
export function MoveHexFocus(event: ReactKeyboardEvent<HTMLDivElement>, size: number) {
  const step = ({ ArrowLeft: [0, -1], ArrowRight: [0, 1], ArrowUp: [-1, 0], ArrowDown: [1, 0] } as Record<string, number[]>)[event.key];
  const current = document.activeElement as HTMLElement | null;
  if (!step || current?.dataset.index === undefined) return;
  const index = Number(current.dataset.index);
  const row = Math.floor(index / size) + step[0], col = index % size + step[1];
  if (row < 0 || row >= size || col < 0 || col >= size) return;
  event.preventDefault();
  event.currentTarget.querySelector<HTMLElement>(`[data-index="${row * size + col}"]`)?.focus();
}

export function HexBoard({ size, turn, label, onKeyDown, children }: {
  size: number; turn?: string; label?: string; onKeyDown?: (event: ReactKeyboardEvent<HTMLDivElement>) => void; children: ReactNode;
}) {
  const width = 1.5 * size - 0.5;
  const height = (size - 1) * rowStep + cellHeight;
  const middle = (row: number) => row * rowStep + cellHeight / 2;
  const shift = (size - 1) / 2;
  return <div className="hx-board-area">
    <div className="hx-board" data-turn={turn} role={label ? 'group' : undefined} aria-label={label} onKeyDown={onKeyDown}
      style={{ '--span-x': width, '--span-y': height } as CSSProperties}>
      <svg className="hx-edges" viewBox={`0 0 ${width} ${height}`} aria-hidden="true">
        <line className="hx-edge-player" x1={0} y1={-edgeGap} x2={size} y2={-edgeGap} />
        <line className="hx-edge-player" x1={shift} y1={height + edgeGap} x2={shift + size} y2={height + edgeGap} />
        <line className="hx-edge-computer" x1={-edgeGap} y1={middle(0)} x2={shift - edgeGap} y2={middle(size - 1)} />
        <line className="hx-edge-computer" x1={size + edgeGap} y1={middle(0)} x2={shift + size + edgeGap} y2={middle(size - 1)} />
      </svg>
      {children}
    </div>
  </div>;
}

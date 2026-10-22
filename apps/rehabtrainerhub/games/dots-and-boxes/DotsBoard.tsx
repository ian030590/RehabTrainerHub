import type { CSSProperties, KeyboardEvent as ReactKeyboardEvent } from 'react';
import { LineIds, type Owner } from './logic/dotsAndBoxes';

// Positions are in box widths from the board corner; the outer dots sit half a box in from the edge.
const At = (x: number, y: number) => ({ '--x': x, '--y': y }) as CSSProperties;

export function LinePosition(size: number, line: string) {
  const index = Number(line.slice(1));
  if (line[0] === 'h') {
    const row = Math.floor(index / (size - 1)), col = index % (size - 1);
    return { row, col, style: At(0.5 + col, row) };
  }
  const row = Math.floor(index / size), col = index % size;
  return { row, col, style: At(col, 0.5 + row) };
}

// Left and right step through the lines in reading order; up and down keep the same kind of line in the same column.
export function MoveLineFocus(event: ReactKeyboardEvent<HTMLDivElement>, size: number) {
  const current = (document.activeElement as HTMLElement | null)?.dataset.line;
  if (!current || !['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) return;
  const order = ReadingOrder(size);
  let target: string | undefined;
  if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') target = order[order.indexOf(current) + (event.key === 'ArrowLeft' ? -1 : 1)];
  else {
    const { row, col } = LinePosition(size, current);
    const nextRow = row + (event.key === 'ArrowUp' ? -1 : 1);
    const perRow = current[0] === 'h' ? size - 1 : size;
    const rows = current[0] === 'h' ? size : size - 1;
    if (nextRow >= 0 && nextRow < rows) target = `${current[0]}${nextRow * perRow + col}`;
  }
  if (!target) return;
  event.preventDefault();
  event.currentTarget.querySelector<HTMLElement>(`[data-line="${target}"]`)?.focus();
}

export function ReadingOrder(size: number) {
  const order: string[] = [];
  for (let row = 0; row < size; row++) {
    for (let col = 0; col < size - 1; col++) order.push(`h${row * (size - 1) + col}`);
    if (row < size - 1) for (let col = 0; col < size; col++) order.push(`v${row * size + col}`);
  }
  return order;
}

export function DotsBoard({ size, hLines, vLines, boxes, turn, label, focusLine, tutorialLine, ownerLabel, onLine, onFocusLine, onKeyDown }: {
  size: number; hLines: (Owner | null)[]; vLines: (Owner | null)[]; boxes: (Owner | null)[]; turn?: string; label?: string;
  focusLine?: string; tutorialLine?: string; ownerLabel?: (line: string, owner: Owner | null) => string;
  onLine?: (line: string) => void; onFocusLine?: (line: string) => void; onKeyDown?: (event: ReactKeyboardEvent<HTMLDivElement>) => void;
}) {
  const interactive = Boolean(onLine);
  const owner = (line: string) => (line[0] === 'h' ? hLines : vLines)[Number(line.slice(1))];
  return <div className="db-board-area">
    <div className="db-board" data-turn={turn} role={interactive ? 'group' : undefined} aria-label={label} onKeyDown={onKeyDown}
      style={{ '--n': size } as CSSProperties}>
      {boxes.map((mark, box) => <span key={`b${box}`} className="db-box" data-owner={mark ?? undefined}
        style={At(0.5 + box % (size - 1), 0.5 + Math.floor(box / (size - 1)))}><span className="db-box-mark" /></span>)}
      {LineIds(size).map(line => {
        const shared = { className: 'db-line', 'data-line': line, 'data-orientation': line[0], 'data-owner': owner(line) ?? undefined,
          'data-tutorial': line === tutorialLine ? 'move' : undefined, style: LinePosition(size, line).style };
        return interactive
          ? <button key={line} type="button" {...shared} tabIndex={line === focusLine ? 0 : -1} aria-label={ownerLabel?.(line, owner(line))}
            onFocus={() => onFocusLine?.(line)} onClick={() => onLine?.(line)}><span className="db-stroke" /></button>
          : <span key={line} {...shared}><span className="db-stroke" /></span>;
      })}
      {Array.from({ length: size * size }, (_, dot) => <span key={`d${dot}`} className="db-dot" style={At(0.5 + dot % size, 0.5 + Math.floor(dot / size))} />)}
    </div>
  </div>;
}

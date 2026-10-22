import type { CSSProperties, KeyboardEvent as ReactKeyboardEvent } from 'react';
import type { HexCell } from './logic/hexBoard';

// Reading order (top row first) keeps Tab and the arrow keys in step with what the eye sees.
function SortCells(cells: HexCell[]) {
  return [...cells].sort((a, b) => a.r - b.r || a.q - b.q);
}

function MoveHexFocus(event: ReactKeyboardEvent<HTMLDivElement>) {
  const step = ({ ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] } as Record<string, number[]>)[event.key];
  const current = document.activeElement as HTMLElement | null;
  if (!step || !current?.dataset.q) return;
  const q = Number(current.dataset.q), r = Number(current.dataset.r);
  const buttons = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>('button[data-q]'));
  const x = q + r / 2;
  const target = step[1] === 0
    ? buttons.find(button => Number(button.dataset.r) === r && Number(button.dataset.q) === q + step[0])
    : buttons.filter(button => Number(button.dataset.r) === r + step[1])
      .sort((a, b) => Math.abs(Number(a.dataset.q) + (r + step[1]) / 2 - x) - Math.abs(Number(b.dataset.q) + (r + step[1]) / 2 - x))[0];
  if (!target) return;
  event.preventDefault();
  target.focus();
}

export function HexBoard({ rings, cells, found, wrong, centerShowing, label, centerLabel, foundLabel, onCell, onCenter, start }: {
  rings: number; cells: HexCell[]; found?: ReadonlySet<number>; wrong?: number | null; centerShowing?: boolean;
  label: string; centerLabel: string; foundLabel: string; onCell?: (value: number) => void; onCenter?: () => void; start?: number;
}) {
  const interactive = Boolean(onCell);
  return <div className="hex-board" aria-hidden={interactive ? undefined : true}>
    <div className="hex-field" style={{ '--rings': rings } as CSSProperties} role={interactive ? 'group' : undefined}
      aria-label={interactive ? label : undefined} onKeyDown={interactive ? MoveHexFocus : undefined}>
      {SortCells(cells).map(cell => {
        const isFound = Boolean(found?.has(cell.value));
        const shared = {
          className: 'hex-cell', style: { '--q': cell.q, '--r': cell.r } as CSSProperties, 'data-q': cell.q, 'data-r': cell.r,
          'data-found': isFound ? 'true' : undefined, 'data-wrong': wrong === cell.value ? 'true' : undefined,
          'data-start': cell.value === start ? 'true' : undefined,
        };
        const face = <span className="hex-face">{cell.value}</span>;
        const key = `${cell.q},${cell.r},${cell.value}`;
        return interactive
          ? <button key={key} type="button" {...shared} onClick={() => onCell?.(cell.value)}
            aria-label={isFound ? `${cell.value}, ${foundLabel}` : String(cell.value)}>{face}</button>
          : <span key={key} {...shared}>{face}</span>;
      })}
      {interactive
        ? <button type="button" className="hex-center" data-q={0} data-r={0} data-lit={centerShowing ? 'true' : undefined} aria-label={centerLabel} onClick={onCenter}>
          <span className="hex-face" aria-hidden="true" /></button>
        : <span className="hex-center"><span className="hex-face" /></span>}
    </div>
  </div>;
}

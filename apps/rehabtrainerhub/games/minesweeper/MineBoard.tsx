import type { CSSProperties, KeyboardEvent, ReactNode, Ref } from 'react';
import { zoomRange, type Cell } from './logic/minesweeper';

// There is no time limit, so the clock shows the time so far as m:ss.
export function FormatElapsed(ms: number, en: boolean) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const text = `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
  return en ? `Time ${text}` : `用時 ${text}`;
}

// Arrow keys move focus between cells, so a keyboard player can reach every cell.
export function MoveCellFocus(event: KeyboardEvent<HTMLElement>, size: number) {
  const step = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -size, ArrowDown: size }[event.key];
  const cell = (event.target as HTMLElement).closest<HTMLElement>('.ms-cell');
  if (!step || !cell) return false;
  event.preventDefault();
  const index = Number(cell.dataset.index), next = index + step;
  const sameRow = Math.abs(step) !== 1 || Math.floor(next / size) === Math.floor(index / size);
  if (next >= 0 && next < size * size && sameRow) {
    const target = event.currentTarget.querySelector<HTMLElement>(`.ms-cell[data-index="${next}"]`);
    target?.focus();
    target?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }
  return true;
}

export function CellState(cell: Cell) {
  return cell.open ? 'open' : cell.flagged ? 'flagged' : 'covered';
}

export function CellLabel(cell: Cell, index: number, size: number, en: boolean) {
  const position = en ? `Row ${Math.floor(index / size) + 1}, column ${index % size + 1}` : `第 ${Math.floor(index / size) + 1} 列第 ${index % size + 1} 欄`;
  const content = !cell.open ? (cell.flagged ? (en ? 'flagged' : '已插旗') : (en ? 'covered' : '未打開'))
    : cell.mine ? (en ? 'mine' : '地雷') : cell.adjacent ? (en ? `${cell.adjacent} mine${cell.adjacent === 1 ? '' : 's'} nearby` : `周圍 ${cell.adjacent} 顆地雷`)
      : (en ? 'empty' : '空白');
  return `${position}${en ? ', ' : '，'}${content}`;
}

// A flag on a covered cell, a mine once mines are shown, otherwise the clue number.
export function CellFace({ cell }: { cell: Cell }) {
  if (!cell.open && cell.flagged) return <svg className="ms-icon ms-flag" viewBox="0 0 100 100" aria-hidden="true">
    <path className="ms-flag-pole" d="M36 18v64" /><path className="ms-flag-cloth" d="M36 18 76 34 36 50Z" /></svg>;
  if (!cell.open) return null;
  if (cell.mine) return <svg className="ms-icon ms-mine" viewBox="0 0 100 100" aria-hidden="true">
    <path className="ms-mine-spikes" d="M50 18v64M18 50h64M27 27l46 46M73 27 27 73" /><circle cx="50" cy="50" r="22" /></svg>;
  return cell.adjacent ? <span aria-hidden="true">{cell.adjacent}</span> : null;
}

export function MineBoard({ size, zoom, state, label, areaRef, onKeyDown, children }: {
  size: number; zoom: number; state?: 'running' | 'over'; label?: string; areaRef?: Ref<HTMLDivElement>;
  onKeyDown?: (event: KeyboardEvent<HTMLDivElement>) => void; children: ReactNode;
}) {
  return <div ref={areaRef} className="ms-board-area">
    <div className="ms-board" role={label ? 'group' : undefined} aria-label={label} data-state={state}
      style={{ '--n': size, '--zoom': zoom } as CSSProperties} onKeyDown={onKeyDown} onContextMenu={event => event.preventDefault()}>{children}</div>
  </div>;
}

export function ZoomControls({ zoom, en, onStep, onReset, inert }: {
  zoom: number; en: boolean; onStep?: (direction: 1 | -1) => void; onReset?: () => void; inert?: boolean;
}) {
  const percent = `${Math.round(zoom * 100)}%`;
  if (inert) return <div className="ms-zoom"><span className="btn ms-zoom-step">−</span><span className="btn ms-zoom-reset">{percent}</span><span className="btn ms-zoom-step">+</span></div>;
  return <div className="ms-zoom" role="group" aria-label={en ? 'Board zoom' : '棋盤縮放'}>
    <button type="button" className="btn ms-zoom-step ms-zoom-out" disabled={zoom <= zoomRange.min} aria-label={en ? 'Zoom out' : '縮小棋盤'} onClick={() => onStep?.(-1)}>−</button>
    <button type="button" className="btn ms-zoom-reset" aria-label={en ? `Zoom ${percent}, reset to 100%` : `目前 ${percent}，回到 100%`} onClick={onReset}>{percent}</button>
    <button type="button" className="btn ms-zoom-step ms-zoom-in" disabled={zoom >= zoomRange.max} aria-label={en ? 'Zoom in' : '放大棋盤'} onClick={() => onStep?.(1)}>+</button>
  </div>;
}

export function MineCounter({ flags, mines, en }: { flags: number; mines: number; en: boolean }) {
  return <p className="ms-mines">{en ? 'Flags' : '旗'} <strong>{flags}</strong>{en ? ` / ${mines} mines` : `／地雷 ${mines}`}</p>;
}

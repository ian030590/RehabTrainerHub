import type { CSSProperties, KeyboardEvent, ReactNode } from 'react';

// Time limits run up to 5 minutes, so the countdown reads as m:ss.
export function FormatRemaining(ms: number, en: boolean) {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const text = `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
  return en ? `${text} left` : `剩 ${text}`;
}

// Each tile is keyed by its number, so it glides to its new cell instead of being redrawn.
export function TileStyle(index: number, size: number) {
  return { '--r': Math.floor(index / size), '--c': index % size } as CSSProperties;
}

// Arrow keys move focus to the next tile in that direction, stepping over the gap.
export function MoveSlidingFocus(event: KeyboardEvent<HTMLElement>, tiles: number[], size: number) {
  const step = { ArrowLeft: [0, -1], ArrowRight: [0, 1], ArrowUp: [-1, 0], ArrowDown: [1, 0] }[event.key];
  const tile = (event.target as HTMLElement).closest<HTMLElement>('.sp-tile');
  if (!step || !tile) return;
  event.preventDefault();
  const index = tiles.indexOf(Number(tile.dataset.tile));
  let [row, col] = [Math.floor(index / size) + step[0], index % size + step[1]];
  if (row >= 0 && row < size && col >= 0 && col < size && tiles[row * size + col] === 0) [row, col] = [row + step[0], col + step[1]];
  if (row < 0 || row >= size || col < 0 || col >= size) return;
  event.currentTarget.querySelector<HTMLElement>(`.sp-tile[data-tile="${tiles[row * size + col]}"]`)?.focus();
}

export function SlidingBoard({ size, state, label, onKeyDown, children }: {
  size: number; state?: 'running' | 'over'; label?: string;
  onKeyDown?: (event: KeyboardEvent<HTMLDivElement>) => void; children: ReactNode;
}) {
  return <div className="sp-board-area">
    <div className="sp-board" role={label ? 'group' : undefined} aria-label={label} data-state={state}
      style={{ '--n': size } as CSSProperties} onKeyDown={onKeyDown}>{children}</div>
  </div>;
}

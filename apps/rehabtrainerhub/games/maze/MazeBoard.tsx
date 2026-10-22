import type { CSSProperties } from 'react';
import type { Maze } from './logic/maze';

// Time limits run up to 5 minutes, so the countdown reads as m:ss.
export function FormatRemaining(ms: number, en: boolean) {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const text = `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
  return en ? `${text} left` : `剩 ${text}`;
}

const At = (index: number, size: number) => ({ '--r': Math.floor(index / size), '--c': index % size }) as CSSProperties;

// Each cell draws its top and left walls; the right and bottom edges close the board.
function WallPath({ size, cells }: Maze) {
  let path = '';
  cells.forEach((cell, index) => {
    const row = Math.floor(index / size), col = index % size;
    if (cell.top) path += `M${col} ${row}h1`;
    if (cell.left) path += `M${col} ${row}v1`;
    if (col === size - 1 && cell.right) path += `M${col + 1} ${row}v1`;
    if (row === size - 1 && cell.bottom) path += `M${col} ${row + 1}h1`;
  });
  return path;
}

export function MazeBoard({ maze, current, state, label, onTap }: {
  maze: Maze; current: number; state?: 'running' | 'over'; label?: string; onTap?: (index: number) => void;
}) {
  const { size } = maze;
  return <div className="mz-board-area">
    <div className="mz-board" role={label ? 'group' : undefined} aria-label={label} data-state={state} style={{ '--n': size } as CSSProperties}>
      {maze.cells.map((_, index) => <div key={index} className="mz-cell" style={At(index, size)} data-index={index}
        data-goal={index === maze.end ? 'true' : undefined} onClick={onTap && (() => onTap(index))} />)}
      <svg className="mz-walls" viewBox={`0 0 ${size} ${size}`} aria-hidden="true"><path d={WallPath(maze)} /></svg>
      <span className="mz-goal" style={At(maze.end, size)} />
      <span className="mz-player" style={At(current, size)} />
    </div>
  </div>;
}

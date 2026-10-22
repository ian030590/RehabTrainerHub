import type { Direction } from './logic/maze';

const arrows: Record<Direction, string> = {
  up: 'M6 15l6-6 6 6',
  down: 'M6 9l6 6 6-6',
  left: 'M15 6l-6 6 6 6',
  right: 'M9 6l6 6-6 6',
};

// One step per press. Touch and mouse move on press down, as the original pad did; a keyboard press moves on click.
export function DirectionPad({ en, onMove, inert }: { en: boolean; onMove?: (direction: Direction) => void; inert?: boolean }) {
  const labels: Record<Direction, string> = en ? { up: 'Up', down: 'Down', left: 'Left', right: 'Right' } : { up: '上', down: '下', left: '左', right: '右' };
  return <div className="mz-dpad" role={inert ? undefined : 'group'} aria-label={inert ? undefined : (en ? 'Direction buttons' : '方向按鈕')}>
    {(['up', 'left', 'right', 'down'] as Direction[]).map(direction => {
      const icon = <svg viewBox="0 0 24 24" aria-hidden="true"><path d={arrows[direction]} /></svg>;
      return inert ? <span key={direction} className={`btn mz-dpad-${direction}`}>{icon}</span>
        : <button key={direction} type="button" className={`btn mz-dpad-${direction}`} aria-label={labels[direction]}
          onPointerDown={event => { if (event.button === 0) onMove?.(direction); }}
          onClick={event => { if (event.detail === 0) onMove?.(direction); }}>{icon}</button>;
    })}
  </div>;
}

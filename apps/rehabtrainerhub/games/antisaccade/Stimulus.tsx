import type { Direction } from './logic/antisaccadeTrials';

// One side of the field. data-show picks what it holds: the square, the arrow or the mask.
export function Slot({ side, show, arrow, tutorial }: { side: 'left' | 'right'; show?: 'cue' | 'arrow' | 'mask'; arrow?: Direction; tutorial?: string }) {
  return <div className={`as-slot as-slot-${side}`} data-show={show} data-tutorial={tutorial}>
    <span className="as-cue" />
    <svg className="as-arrow" data-dir={arrow ?? 'right'} viewBox="0 0 48 48"><path d="M6 24h34M26 10l14 14-14 14" /></svg>
    <svg className="as-mask" viewBox="0 0 48 48"><path d="M0 6h48M0 18h48M0 30h48M0 42h48M6 0v48M18 0v48M30 0v48M42 0v48M0 0l48 48M48 0 0 48M0 24 24 0M24 48 48 24M0 24l24 24M24 0l24 24" /></svg>
  </div>;
}

export function DirectionName(direction: Direction, en: boolean) {
  return en ? { left: 'Left', up: 'Up', right: 'Right' }[direction] : { left: '左', up: '上', right: '右' }[direction];
}

export const directionKeys: Record<Direction, string> = { left: '←', up: '↑', right: '→' };

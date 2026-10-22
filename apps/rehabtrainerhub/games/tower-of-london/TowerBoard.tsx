import type { CSSProperties } from 'react';
import { capacities, type Board } from './logic/towerOfLondon';

export const countedTotal = 12;
const ballNames = { zh: ['', '綠', '紅', '藍'], en: ['', 'Green', 'Red', 'Blue'] };
export const BallLabel = (ball: number, en: boolean) => en ? ballNames.en[ball][0] : ballNames.zh[ball];
export const BallName = (ball: number, en: boolean) => en ? ballNames.en[ball] : ballNames.zh[ball];

// Draws one board; pegs are buttons only on the player's board.
export function TowerBoard({ board, en, label, onPeg, disabled }: {
  board: Board; en: boolean; label: string; onPeg?: (peg: number) => void; disabled?: boolean;
}) {
  return <div className="tower-board" role="group" aria-label={label}>
    {board.map((balls, peg) => {
      const content = <>
        <span className="tower-rod" aria-hidden="true" />
        <span className="tower-slots" aria-hidden="true">{balls.map((ball, slot) =>
          <span key={slot} className={`tower-ball tower-ball-${ball}`}>{BallLabel(ball, en)}</span>)}</span>
        <span className="tower-peg-number" aria-hidden="true">{peg + 1}</span>
      </>;
      const name = en ? `Peg ${peg + 1}, holds ${capacities[peg]}: ${balls.length ? balls.map(ball => BallName(ball, true)).join(', ') + ' from the bottom' : 'empty'}`
        : `第 ${peg + 1} 根柱子，可放 ${capacities[peg]} 顆：${balls.length ? '由下往上 ' + balls.map(ball => BallName(ball, false)).join('、') : '空的'}`;
      const style = { '--tower-capacity': capacities[peg] } as CSSProperties;
      return onPeg ? <button key={peg} type="button" className="tower-peg" data-peg={peg} style={style} disabled={disabled}
        aria-label={name} onClick={() => onPeg(peg)}>{content}</button>
        : <div key={peg} className="tower-peg" data-peg={peg} style={style} role="img" aria-label={name}>{content}</div>;
    })}
  </div>;
}

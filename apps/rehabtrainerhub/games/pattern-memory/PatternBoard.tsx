import type { PatternItem } from './logic/patterns';

export const colorKeys = ['red', 'green', 'yellow', 'blue'] as const;
export const shapeKeys = ['circle', 'square', 'triangle', 'cross'] as const;
const colorNames = { zh: ['紅色', '綠色', '黃色', '藍色'], en: ['red', 'green', 'yellow', 'blue'] };
const shapeNames = { zh: ['圓形', '方形', '三角形', '十字'], en: ['circle', 'square', 'triangle', 'cross'] };

function Shape({ shape }: { shape: number }) {
  if (shape === 0) return <circle className="pattern-shape" cx="0" cy="0" r="15" />;
  if (shape === 1) return <rect className="pattern-shape" x="-14" y="-14" width="28" height="28" rx="2" />;
  if (shape === 2) return <path className="pattern-shape" d="M0,-16 L16,13 L-16,13 Z" />;
  return <path className="pattern-shape" d="M-5.5,-16 H5.5 V-5.5 H16 V5.5 H5.5 V16 H-5.5 V5.5 H-16 V-5.5 H-5.5 Z" />;
}

export function DescribeItem(item: PatternItem, en: boolean) {
  return en ? `${colorNames.en[item.color]} ${shapeNames.en[item.shape]}` : `${colorNames.zh[item.color]}${shapeNames.zh[item.shape]}`;
}

// Nine fixed cells; only the shapes come and go, so the board never shifts between study and test.
export function PatternBoard({ items, step, changedCell = null, en }: { items: PatternItem[]; step: string; changedCell?: number | null; en: boolean }) {
  return <div className="pattern-board" data-step={step}>
    {Array.from({ length: 9 }, (_, cell) => {
      const item = items.find(entry => entry.cell === cell);
      return <div key={cell} className="pattern-cell" data-cell={cell} data-changed={changedCell === cell ? 'true' : undefined}
        data-color={item ? colorKeys[item.color] : undefined} data-shape={item ? shapeKeys[item.shape] : undefined}
        role="img" aria-label={item ? DescribeItem(item, en) : (en ? 'Empty' : '空格')}>
        {item && <svg viewBox="-20 -20 40 40" aria-hidden="true"><Shape shape={item.shape} /></svg>}
        {!item && cell === 4 && step === 'ready' && <span className="pattern-fixation" aria-hidden="true">+</span>}
      </div>;
    })}
  </div>;
}

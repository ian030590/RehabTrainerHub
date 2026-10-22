import type { Card, CardShape } from './logic/cardSorting';

const shapePaths: Record<Exclude<CardShape, 'circle'>, string> = {
  triangle: 'M0,-15 L15,12 L-15,12 Z',
  star: 'M0,-16 L4.7,-6.5 L15.2,-4.9 L7.6,2.5 L9.4,12.9 L0,8 L-9.4,12.9 L-7.6,2.5 L-15.2,-4.9 L-4.7,-6.5 Z',
  cross: 'M-5,-15 H5 V-5 H15 V5 H5 V15 H-5 V5 H-15 V-5 H-5 Z',
};

// Shape centres inside a 100 by 140 card for one to four shapes.
const layouts: [number, number][][] = [
  [[50, 70]],
  [[50, 42], [50, 98]],
  [[50, 34], [50, 70], [50, 106]],
  [[30, 46], [70, 46], [30, 94], [70, 94]],
];

const colorNames = { zh: { red: '紅色', green: '綠色', yellow: '黃色', blue: '藍色' }, en: { red: 'red', green: 'green', yellow: 'yellow', blue: 'blue' } };
const shapeNames = { zh: { triangle: '三角形', star: '星形', cross: '十字', circle: '圓形' },
  en: { triangle: ['triangle', 'triangles'], star: ['star', 'stars'], cross: ['cross', 'crosses'], circle: ['circle', 'circles'] } };

export function DescribeCard(card: Card, en: boolean) {
  if (!en) return `${card.count} 個${colorNames.zh[card.color]}${shapeNames.zh[card.shape]}`;
  return `${card.count} ${colorNames.en[card.color]} ${shapeNames.en[card.shape][card.count === 1 ? 0 : 1]}`;
}

export function CardFace({ card }: { card: Card }) {
  return <svg className="sort-card-face" viewBox="0 0 100 140" aria-hidden="true" data-color={card.color}>
    <rect className="sort-card-paper" x="2" y="2" width="96" height="136" rx="8" />
    {layouts[card.count - 1].map(([x, y], index) => card.shape === 'circle'
      ? <circle key={index} className="sort-card-shape" cx={x} cy={y} r="14" />
      : <path key={index} className="sort-card-shape" d={shapePaths[card.shape]} transform={`translate(${x} ${y})`} />)}
  </svg>;
}

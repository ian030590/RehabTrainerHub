const shapePaths = [
  <polygon key="pentagon" points="50,6 94,38 77,92 23,92 6,38" />,
  <polygon key="hourglass" points="14,8 86,8 58,50 86,92 14,92 42,50" />,
  <path key="tear" d="M50 4 C62 24 84 46 84 64 A34 34 0 0 1 16 64 C16 46 38 24 50 4 Z" />,
  <rect key="square" x="12" y="12" width="76" height="76" />,
];

export function ShapeIcon({ shape, className = 'stop-signal-shape' }: { shape: number; className?: string }) {
  return <svg className={className} data-shape={shape} viewBox="0 0 100 100" aria-hidden="true" focusable="false">{shapePaths[shape]}</svg>;
}

export function KeyGuide({ keyMap, side }: { keyMap: ('left' | 'right')[]; side: 'left' | 'right' }) {
  return <span className="stop-signal-guide">{keyMap.map((owner, shape) => owner === side ? <ShapeIcon key={shape} shape={shape} className="stop-signal-guide-shape" /> : null)}</span>;
}

// Outline star drawn around the shape as the stop signal.
export function StopStar() {
  const points = Array.from({ length: 10 }, (_, index) => {
    const radius = index % 2 ? 40 : 78, angle = -Math.PI / 2 + index * Math.PI / 5;
    return `${(80 + radius * Math.cos(angle)).toFixed(1)},${(80 + radius * Math.sin(angle)).toFixed(1)}`;
  }).join(' ');
  return <svg className="stop-signal-star" viewBox="0 0 160 160" aria-hidden="true" focusable="false"><polygon points={points} /></svg>;
}

// The tutorial's ball pictures, drawn like the stage balls; colors come from the game's CSS tokens.
export function BallIcon({ ball }: { ball: 'basketball' | 'soccer' | 'tennis' | 'beach' }) {
  const pentagon = (x: number, y: number, radius: number) => Array.from({ length: 5 }, (_, index) => {
    const angle = -Math.PI / 2 + index * Math.PI * 2 / 5;
    return `${x + Math.cos(angle) * radius},${y + Math.sin(angle) * radius}`;
  }).join(' ');
  return <svg className={`every-ball-icon every-ball-icon-${ball}`} viewBox="-110 -110 220 220" aria-hidden="true">
    {ball === 'basketball' && <>
      <circle className="every-ball-icon-fill" r="100" />
      <path className="every-ball-icon-seam" d="M-100 0Q0 -18 100 0M-100 0Q0 18 100 0M0 -100V100M-72 -72Q-25 0 -72 72M72 -72Q25 0 72 72" />
      <circle className="every-ball-icon-edge" r="100" />
    </>}
    {ball === 'soccer' && <>
      <circle className="every-ball-icon-fill" r="100" />
      <polygon className="every-ball-icon-patch" points={pentagon(0, 0, 32)} />
      {Array.from({ length: 5 }, (_, index) => {
        const angle = -Math.PI / 2 + index * Math.PI * 2 / 5;
        return <g key={index}>
          <polygon className="every-ball-icon-patch" points={pentagon(Math.cos(angle) * 62, Math.sin(angle) * 62, 16)} />
          <path className="every-ball-icon-seam" d={`M${Math.cos(angle) * 32} ${Math.sin(angle) * 32}L${Math.cos(angle) * 62} ${Math.sin(angle) * 62}`} />
        </g>;
      })}
      <circle className="every-ball-icon-edge" r="100" />
    </>}
    {ball === 'tennis' && <>
      <circle className="every-ball-icon-fill" r="100" />
      <path className="every-ball-icon-seam" d="M-68 -82C-10 -28 -10 28 -68 82M68 -82C10 -28 10 28 68 82" />
      <circle className="every-ball-icon-edge" r="100" />
    </>}
    {ball === 'beach' && <>
      {[0, 1, 2, 3].map(index => {
        const start = -Math.PI / 2 + index * Math.PI / 2;
        const end = start + Math.PI / 2;
        return <path key={index} className={`every-ball-icon-panel every-ball-icon-panel-${index}`}
          d={`M0 0L${Math.cos(start) * 100} ${Math.sin(start) * 100}A100 100 0 0 1 ${Math.cos(end) * 100} ${Math.sin(end) * 100}Z`} />;
      })}
      <circle className="every-ball-icon-edge" r="100" />
      <circle className="every-ball-icon-cap" r="18" />
    </>}
  </svg>;
}

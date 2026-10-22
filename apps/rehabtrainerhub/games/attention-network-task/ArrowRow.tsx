// Five items: arrows point by data-kind ("left" or "right"); "dash" draws a neutral bar.
export function ArrowRow({ slot, kinds = ['dash', 'dash', 'left', 'dash', 'dash'] }: { slot: 'up' | 'down'; kinds?: string[] }) {
  return <span className={`ant-row ant-row-${slot}`}>
    {kinds.map((kind, position) => <span key={position} className="ant-item" data-kind={kind}>
      <svg className="ant-arrow" viewBox="0 0 48 48" aria-hidden="true" focusable="false"><path d="M6 24h34M26 10l14 14-14 14" /></svg>
      <svg className="ant-dash" viewBox="0 0 48 48" aria-hidden="true" focusable="false"><path d="M8 24h32" /></svg>
    </span>)}
  </span>;
}

// Each pad has a color, a shape and a number, so pads read apart without relying on color.
const shapes = [
  <circle key="circle" cx="50" cy="50" r="30" />,
  <polygon key="triangle" points="50,18 84,80 16,80" />,
  <rect key="square" x="22" y="22" width="56" height="56" />,
  <polygon key="diamond" points="50,14 86,50 50,86 14,50" />,
];
const names = {
  en: ['Green circle', 'Red triangle', 'Yellow square', 'Blue diamond'],
  zh: ['綠色圓形', '紅色三角形', '黃色正方形', '藍色菱形'],
};

export function PadName(pad: number, en: boolean) {
  return `${names[en ? 'en' : 'zh'][pad]}${en ? ` (${pad + 1})` : `（${pad + 1}）`}`;
}

export function SimonPads({ lit, pressed, state, shake, en, label, tutorialPad, onPad }: {
  lit: number | null; pressed?: number | null; state: 'showing' | 'input' | 'over'; shake?: boolean; en: boolean;
  label?: string; tutorialPad?: number; onPad?: (pad: number) => void;
}) {
  return <div className="ss-board-area">
    <div className="ss-pads" role={label ? 'group' : undefined} aria-label={label} data-state={state} data-shake={shake ? 'true' : undefined}>
      {[0, 1, 2, 3].map(pad => {
        const props = { className: 'ss-pad', 'data-pad': pad, 'data-lit': lit === pad ? 'true' : undefined, 'data-pressed': pressed === pad ? 'true' : undefined,
          'data-tutorial': tutorialPad === pad ? 'move' : undefined };
        const face = <><svg className="ss-shape" viewBox="0 0 100 100" aria-hidden="true">{shapes[pad]}</svg><span className="ss-key" aria-hidden="true">{pad + 1}</span></>;
        return onPad
          ? <button key={pad} type="button" {...props} aria-label={PadName(pad, en)} aria-disabled={state !== 'input'} onClick={() => onPad(pad)}>{face}</button>
          : <span key={pad} {...props}>{face}</span>;
      })}
    </div>
  </div>;
}

export function Hearts({ count, total, en }: { count: number; total: number; en: boolean }) {
  return <p className="ss-lives" role="img" aria-label={en ? `Lives ${count} of ${total}` : `生命 ${count} / ${total}`}>
    {Array.from({ length: total }, (_, index) => <svg key={index} className="ss-heart" data-empty={index >= count ? 'true' : undefined} viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 21s-7.5-4.6-9.6-9.2C.9 8.4 3 4.5 6.7 4.5c2.1 0 3.6 1.1 4.3 2.4.7-1.3 2.2-2.4 4.3-2.4 3.7 0 5.8 3.9 4.3 7.3C19.5 16.4 12 21 12 21z" />
    </svg>)}
  </p>;
}

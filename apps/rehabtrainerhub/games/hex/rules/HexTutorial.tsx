import { useEffect, useRef, useState } from 'react';
import { useT } from '../i18n/useT';
import type { HexSettings } from '../settings';
import { StartTour } from '../runtime/tour';
import { GetHexTutorialSteps } from './tutorialSteps';
import { boardSizes } from '../logic/hex';
import { CellStyle, HexBoard } from '../HexBoard';

// The scene matches the training stage so each spotlight lands on the real control positions.
export function HexTutorial({ active, ready, title, settings, summaryItems, onStart, onBack }: {
  active: boolean; ready: boolean; title: string; settings: HexSettings;
  summaryItems: { label: string; value: string }[]; onStart: () => void; onBack: () => void;
}) {
  const { lang } = useT();
  const en = lang === 'en';
  const [finished, setFinished] = useState(false);
  const confirmationRef = useRef<HTMLDivElement>(null);
  const size = boardSizes[settings.difficulty] ?? boardSizes.medium;
  const middle = Math.floor(size * size / 2);
  const demo: Record<number, string> = { [middle]: 'P', [middle + 1]: 'A' };
  useEffect(() => {
    setFinished(false);
    if (!active) return;
    return StartTour(GetHexTutorialSteps(lang), { lang, onEvent: () => setFinished(true), onBack });
  }, [active, lang, onBack]);
  useEffect(() => { if (finished) confirmationRef.current?.querySelector<HTMLButtonElement>('button')?.focus(); }, [finished]);
  return <section className="hx-stage hex-tutorial" aria-label={en ? 'Game tutorial scene' : '遊戲說明場景'}>
    <header className="hx-hud" aria-hidden="true">
      <p className="hx-goal"><span className="hx-edge-icon" />{en ? 'Join your two blue edges' : '接通兩條藍色邊'}</p>
      <p className="hx-turn" data-turn="player"><span className="hx-stone-icon" data-mark="P" />{en ? 'Your turn' : '輪到你'}</p>
      <p className="hx-clock">0.0 {en ? 's' : '秒'}</p>
      <span className="btn btn-ghost hx-stop">{en ? 'Stop' : '停止'}</span>
    </header>
    <p className="hx-feedback" aria-hidden="true" />
    <div className="hx-board-slot" aria-hidden="true">
      <HexBoard size={size}>
        {Array.from({ length: size * size }, (_, index) => <span key={index} className="hx-cell" style={CellStyle(index, size)}
          data-mark={demo[index]} data-tutorial={index === middle - size ? 'move' : undefined}><span className="hx-face" /></span>)}
      </HexBoard>
    </div>
    {active && finished && <section className="training-panel hx-tutorial-ready" role="dialog" aria-modal="true" aria-label={title}
      onKeyDown={event => {
        if (event.key === 'Escape') { event.preventDefault(); onBack(); }
        if (event.key === 'Tab') {
          const buttons = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>('button'));
          event.preventDefault();
          const index = buttons.indexOf(document.activeElement as HTMLButtonElement);
          buttons[(index + (event.shiftKey ? buttons.length - 1 : 1)) % buttons.length]?.focus();
        }
      }}>
      <div ref={confirmationRef} className="training-config training-confirmation">
        <header className="training-config-header"><h2>{title}</h2></header>
        <div className="training-config-body"><section className="training-setting"><h3>{en ? 'Confirm settings' : '確認設定'}</h3>
          <div className="training-config-summary">{summaryItems.map(item => <p className="training-config-summary-item" key={item.label}><strong>{item.label}：</strong>{item.value}</p>)}</div>
        </section></div>
        <footer className="config-actions"><div className="training-config-navigation-buttons">
          <button type="button" className="btn btn-primary" disabled={!ready} onClick={onStart}>{en ? 'Start Training' : '開始訓練'}</button>
          <button type="button" className="btn btn-ghost" onClick={onBack}>{en ? 'Back to settings' : '返回設定'}</button>
        </div></footer>
      </div>
    </section>}
  </section>;
}

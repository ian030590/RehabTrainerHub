import { useEffect, useRef, useState } from 'react';
import { useT } from '../i18n/useT';
import { StartTour } from '../runtime/tour';
import { GetConnect4TutorialSteps } from './tutorialSteps';
import { boardCols, boardRows } from '../logic/connect4';

// The scene matches the training stage so each spotlight lands on the real control positions.
export function Connect4Tutorial({ active, ready, title, summaryItems, onStart, onBack }: {
  active: boolean; ready: boolean; title: string;
  summaryItems: { label: string; value: string }[]; onStart: () => void; onBack: () => void;
}) {
  const { lang } = useT();
  const en = lang === 'en';
  const [finished, setFinished] = useState(false);
  const confirmationRef = useRef<HTMLDivElement>(null);
  const demo: Record<number, string> = { [(boardRows - 1) * boardCols + 3]: 'P', [(boardRows - 1) * boardCols + 4]: 'A' };
  useEffect(() => {
    setFinished(false);
    if (!active) return;
    return StartTour(GetConnect4TutorialSteps(lang), { lang, onEvent: () => setFinished(true), onBack });
  }, [active, lang, onBack]);
  useEffect(() => { if (finished) confirmationRef.current?.querySelector<HTMLButtonElement>('button')?.focus(); }, [finished]);
  return <section className="c4-stage connect4-tutorial" aria-label={en ? 'Game tutorial scene' : '遊戲說明場景'}>
    <header className="c4-hud" aria-hidden="true">
      <p className="c4-goal">{en ? <><strong>4</strong> in a row wins</> : <>連成 <strong>4</strong> 個獲勝</>}</p>
      <p className="c4-turn" data-turn="player"><span className="c4-disc-icon" data-mark="P" />{en ? 'Your turn' : '輪到你'}</p>
      <p className="c4-clock">0.0 {en ? 's' : '秒'}</p>
      <span className="btn btn-ghost c4-stop">{en ? 'Stop' : '停止'}</span>
    </header>
    <p className="c4-feedback" aria-hidden="true" />
    <div className="c4-board-area" aria-hidden="true">
      <div className="c4-board">
        {Array.from({ length: boardCols }, (_, col) => <span key={col} className="c4-column" data-tutorial={col === 2 ? 'move' : undefined}>
          {Array.from({ length: boardRows }, (_, row) => <span key={row} className="c4-slot" data-mark={demo[row * boardCols + col]} />)}
        </span>)}
      </div>
    </div>
    {active && finished && <section className="training-panel c4-tutorial-ready" role="dialog" aria-modal="true" aria-label={title}
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

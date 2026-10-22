import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { useT } from '../i18n/useT';
import type { TicTacToeSettings } from '../settings';
import { StartTour } from '../runtime/tour';
import { GetTicTacToeTutorialSteps } from './tutorialSteps';
import { boardSpecs } from '../logic/ticTacToe';

// The scene matches the training stage so each spotlight lands on the real control positions.
export function TicTacToeTutorial({ active, ready, title, settings, summaryItems, onStart, onBack }: {
  active: boolean; ready: boolean; title: string; settings: TicTacToeSettings;
  summaryItems: { label: string; value: string }[]; onStart: () => void; onBack: () => void;
}) {
  const { lang } = useT();
  const en = lang === 'en';
  const [finished, setFinished] = useState(false);
  const confirmationRef = useRef<HTMLDivElement>(null);
  const { size, winLength } = boardSpecs[settings.difficulty] ?? boardSpecs.medium;
  const middle = Math.floor(size * size / 2);
  useEffect(() => {
    setFinished(false);
    if (!active) return;
    return StartTour(GetTicTacToeTutorialSteps(lang, settings), { lang, onEvent: () => setFinished(true), onBack });
  }, [active, lang, settings, onBack]);
  useEffect(() => { if (finished) confirmationRef.current?.querySelector<HTMLButtonElement>('button')?.focus(); }, [finished]);
  return <section className="ttt-stage tic-tac-toe-tutorial" aria-label={en ? 'Game tutorial scene' : '遊戲說明場景'}>
    <header className="ttt-hud" aria-hidden="true">
      <p className="ttt-goal">{en ? <><strong>{winLength}</strong> in a row wins</> : <>連成 <strong>{winLength}</strong> 個獲勝</>}</p>
      <p className="ttt-turn" data-turn="player">{en ? 'Your turn (X)' : '輪到你（X）'}</p>
      <p className="ttt-clock">0.0 {en ? 's' : '秒'}</p>
      <span className="btn btn-ghost ttt-stop">{en ? 'Stop' : '停止'}</span>
    </header>
    <p className="ttt-feedback" aria-hidden="true" />
    <div className="ttt-board-area" aria-hidden="true">
      <div className="ttt-board" style={{ '--board-size': size } as CSSProperties}>
        {Array.from({ length: size * size }, (_, index) => {
          const mark = index === 0 ? 'X' : index === middle ? 'O' : '';
          return <span key={index} className="ttt-cell" data-mark={mark || undefined} data-tutorial={index === 1 ? 'move' : undefined}>{mark}</span>;
        })}
      </div>
    </div>
    {active && finished && <section className="training-panel ttt-tutorial-ready" role="dialog" aria-modal="true" aria-label={title}
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

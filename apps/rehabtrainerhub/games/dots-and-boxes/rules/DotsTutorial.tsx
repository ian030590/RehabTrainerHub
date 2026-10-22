import { useEffect, useRef, useState } from 'react';
import { useT } from '../i18n/useT';
import type { DotsAndBoxesSettings } from '../settings';
import { StartTour } from '../runtime/tour';
import { GetDotsTutorialSteps } from './tutorialSteps';
import { boardDots, type Owner } from '../logic/dotsAndBoxes';
import { DotsBoard } from '../DotsBoard';

// The scene matches the training stage so each spotlight lands on the real control positions.
export function DotsTutorial({ active, ready, title, settings, summaryItems, onStart, onBack }: {
  active: boolean; ready: boolean; title: string; settings: DotsAndBoxesSettings;
  summaryItems: { label: string; value: string }[]; onStart: () => void; onBack: () => void;
}) {
  const { lang } = useT();
  const en = lang === 'en';
  const [finished, setFinished] = useState(false);
  const confirmationRef = useRef<HTMLDivElement>(null);
  const size = boardDots[settings.difficulty] ?? boardDots.medium;
  // The first box is already closed by the player and the computer has drawn one line beside it.
  const hLines: (Owner | null)[] = Array.from({ length: size * (size - 1) }, (_, index) => index === 0 || index === size - 1 ? 'P' : null);
  const vLines: (Owner | null)[] = Array.from({ length: (size - 1) * size }, (_, index) => index <= 1 ? 'P' : index === 2 ? 'A' : null);
  const boxes: (Owner | null)[] = Array.from({ length: (size - 1) ** 2 }, (_, index) => index === 0 ? 'P' : null);
  useEffect(() => {
    setFinished(false);
    if (!active) return;
    return StartTour(GetDotsTutorialSteps(lang), { lang, onEvent: () => setFinished(true), onBack });
  }, [active, lang, onBack]);
  useEffect(() => { if (finished) confirmationRef.current?.querySelector<HTMLButtonElement>('button')?.focus(); }, [finished]);
  return <section className="db-stage dots-and-boxes-tutorial" aria-label={en ? 'Game tutorial scene' : '遊戲說明場景'}>
    <header className="db-hud" aria-hidden="true">
      <p className="db-score"><span className="db-score-side"><span className="db-mark-icon" data-owner="P" />{en ? 'You' : '你'} <strong>1</strong></span>
        <span className="db-score-side"><span className="db-mark-icon" data-owner="A" />{en ? 'Computer' : '電腦'} <strong>0</strong></span></p>
      <p className="db-turn" data-turn="player">{en ? 'Your turn' : '輪到你'}</p>
      <p className="db-clock">0.0 {en ? 's' : '秒'}</p>
      <span className="btn btn-ghost db-stop">{en ? 'Stop' : '停止'}</span>
    </header>
    <p className="db-feedback" aria-hidden="true" />
    <div className="db-board-slot" aria-hidden="true">
      <DotsBoard size={size} hLines={hLines} vLines={vLines} boxes={boxes} tutorialLine="h1" />
    </div>
    {active && finished && <section className="training-panel db-tutorial-ready" role="dialog" aria-modal="true" aria-label={title}
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

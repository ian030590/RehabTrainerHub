import { useEffect, useRef, useState } from 'react';
import { useT } from '../i18n/useT';
import type { SortingSettings } from '../settings';
import { StartTour } from '../runtime/tour';
import { GetSortingTutorialSteps } from './tutorialSteps';
import { keyCards } from '../logic/cardSorting';
import { CardFace } from '../CardFace';

// The scene matches the training stage so each spotlight lands on the real control positions.
export function SortingTutorial({ active, ready, title, settings, summaryItems, onStart, onBack }: {
  active: boolean; ready: boolean; title: string; settings: SortingSettings;
  summaryItems: { label: string; value: string }[]; onStart: () => void; onBack: () => void;
}) {
  const { lang } = useT();
  const en = lang === 'en';
  const runLength = settings.runLength;
  const [finished, setFinished] = useState(false);
  const confirmationRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    setFinished(false);
    if (!active) return;
    return StartTour(GetSortingTutorialSteps(lang, runLength), { lang, onEvent: () => setFinished(true), onBack });
  }, [active, lang, runLength, onBack]);
  useEffect(() => { if (finished) confirmationRef.current?.querySelector<HTMLButtonElement>('button')?.focus(); }, [finished]);
  return <section className="sort-stage card-sorting-tutorial" aria-label={en ? 'Game tutorial scene' : '遊戲說明場景'}>
    <header className="sort-hud" aria-hidden="true">
      <p className="sort-progress-label">{en ? `Card 1 of up to ${settings.maxCards}` : `第 1 張，最多 ${settings.maxCards} 張`}</p>
      <div className="sort-progress-track"><div className="sort-progress-fill" /></div>
      <span className="btn btn-ghost sort-stop">{en ? 'Stop' : '停止'}</span>
    </header>
    <div className="sort-keys" aria-hidden="true">
      {keyCards.map((card, index) => <div key={index} className="sort-key"><CardFace card={card} /><span className="sort-key-number">{index + 1}</span></div>)}
    </div>
    <p className="sort-feedback" aria-hidden="true" />
    <div className="sort-current" aria-hidden="true"><div className="sort-current-card"><CardFace card={{ color: 'green', shape: 'circle', count: 3 }} /></div></div>
    {active && finished && <section className="training-panel sort-tutorial-ready" role="dialog" aria-modal="true" aria-label={title}
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

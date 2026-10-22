import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { useT } from '../i18n/useT';
import type { SpatialSpanSettings } from '../settings';
import { StartTour } from '../runtime/tour';
import { GetSpatialSpanTutorialSteps } from './tutorialSteps';

// The scene matches the training stage so each spotlight lands on the real control positions.
export function SpatialSpanTutorial({ active, ready, title, settings, summaryItems, onStart, onBack }: {
  active: boolean; ready: boolean; title: string; settings: SpatialSpanSettings;
  summaryItems: { label: string; value: string }[]; onStart: () => void; onBack: () => void;
}) {
  const { lang } = useT();
  const en = lang === 'en';
  const [finished, setFinished] = useState(false);
  const confirmationRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    setFinished(false);
    if (!active) return;
    return StartTour(GetSpatialSpanTutorialSteps(lang), { lang, onEvent: () => setFinished(true), onBack });
  }, [active, lang, onBack]);
  useEffect(() => { if (finished) confirmationRef.current?.querySelector<HTMLButtonElement>('button')?.focus(); }, [finished]);
  const size = settings.boardSize;
  const lit = size + 2;
  return <section className="spatial-span-stage spatial-span-tutorial" data-state="square" aria-label={en ? 'Game tutorial scene' : '遊戲說明場景'}>
    <header className="spatial-span-hud" aria-hidden="true">
      <p className="spatial-span-progress-label">{settings.practice ? (en ? 'Practice 1 of 2' : '練習 1／2') : (en ? `Forward 1 of ${settings.rounds / 2}` : `順向 1／${settings.rounds / 2}`)}</p>
      <p className="spatial-span-direction">{en ? 'Forward' : '順向：照順序'}</p>
      <div className="spatial-span-progress-track"><div className="spatial-span-progress-fill" /></div>
      <span className="btn btn-ghost spatial-span-stop">{en ? 'Stop' : '停止'}</span>
    </header>
    <p className="spatial-span-message" aria-hidden="true">{en ? 'Watch the order' : '記住亮起的順序'}</p>
    <div className="spatial-span-board-wrap" aria-hidden="true">
      <div className="spatial-span-board" style={{ '--spatial-span-size': size } as CSSProperties}>
        {Array.from({ length: size ** 2 }, (_, index) => <span key={index} className={`spatial-span-cell${index + 1 === lit ? ' spatial-span-lit' : ''}`} />)}
      </div>
    </div>
    <div className="spatial-span-answer" aria-hidden="true">
      <p className="spatial-span-entry">{en ? 'Tapped: 0' : '已點：0 個'}</p>
      <div className="spatial-span-actions">
        <span className="spatial-span-action spatial-span-back">{en ? 'Undo' : '刪除'}</span>
        <span className="spatial-span-action spatial-span-clear">{en ? 'Clear' : '清除'}</span>
        <span className="spatial-span-action spatial-span-submit">{en ? 'Submit' : '送出'}</span>
      </div>
    </div>
    {active && finished && <section className="training-panel spatial-span-tutorial-ready" role="dialog" aria-modal="true" aria-label={title}
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

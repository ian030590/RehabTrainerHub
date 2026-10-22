import { useEffect, useRef, useState } from 'react';
import { useT } from '../i18n/useT';
import type { SimonSaysSettings } from '../settings';
import { StartTour } from '../runtime/tour';
import { GetSimonTutorialSteps } from './tutorialSteps';
import { targetLengths } from '../logic/simonSays';
import { Hearts, SimonPads } from '../SimonPads';

// The demo shows the red triangle lit, as it would be during playback.
const demoPad = 1;

// The scene matches the training stage so each spotlight lands on the real control positions.
export function SimonTutorial({ active, ready, title, settings, summaryItems, onStart, onBack }: {
  active: boolean; ready: boolean; title: string; settings: SimonSaysSettings;
  summaryItems: { label: string; value: string }[]; onStart: () => void; onBack: () => void;
}) {
  const { lang } = useT();
  const en = lang === 'en';
  const [finished, setFinished] = useState(false);
  const confirmationRef = useRef<HTMLDivElement>(null);
  const targetLength = targetLengths[settings.difficulty] ?? targetLengths.medium;
  useEffect(() => {
    setFinished(false);
    if (!active) return;
    return StartTour(GetSimonTutorialSteps(lang, targetLength, settings.lives), { lang, onEvent: () => setFinished(true), onBack });
  }, [active, lang, onBack, targetLength, settings.lives]);
  useEffect(() => { if (finished) confirmationRef.current?.querySelector<HTMLButtonElement>('button')?.focus(); }, [finished]);
  return <section className="ss-stage simon-says-tutorial" aria-label={en ? 'Game tutorial scene' : '遊戲說明場景'}>
    <header className="ss-hud" aria-hidden="true">
      <p className="ss-status">{en ? 'Watch' : '看順序'}</p>
      <p className="ss-length">{en ? 'Length' : '長度'} 1 / {targetLength}</p>
      <Hearts count={settings.lives} total={settings.lives} en={en} />
      <span className="btn btn-ghost ss-stop">{en ? 'Stop' : '停止'}</span>
    </header>
    <p className="ss-feedback" aria-hidden="true" />
    <div className="ss-board-slot" aria-hidden="true">
      <SimonPads lit={demoPad} state="showing" en={en} tutorialPad={demoPad} />
    </div>
    {active && finished && <section className="training-panel ss-tutorial-ready" role="dialog" aria-modal="true" aria-label={title}
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

import { useEffect, useRef, useState } from 'react';
import { useT } from '../i18n/useT';
import type { KeepTrackSettings } from '../settings';
import { StartTour } from '../runtime/tour';
import { GetKeepTrackTutorialSteps } from './tutorialSteps';
import { wordLabels } from '../logic/keepTrack';
import { AnswerRows } from '../AnswerRows';

// The scene matches the training stage so each spotlight lands on the real control positions.
// It shows a practice block with three targets in the middle of the words, Bird on screen and already picked under Animals.
export function KeepTrackTutorial({ active, ready, title, settings, summaryItems, onStart, onBack }: {
  active: boolean; ready: boolean; title: string; settings: KeepTrackSettings;
  summaryItems: { label: string; value: string }[]; onStart: () => void; onBack: () => void;
}) {
  const { lang } = useT();
  const en = lang === 'en';
  const [finished, setFinished] = useState(false);
  const confirmationRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    setFinished(false);
    if (!active) return;
    return StartTour(GetKeepTrackTutorialSteps(lang, settings.itemExposureMs), { lang, onEvent: () => setFinished(true), onBack });
  }, [active, lang, onBack, settings.itemExposureMs]);
  useEffect(() => { if (finished) confirmationRef.current?.querySelector<HTMLButtonElement>('button')?.focus(); }, [finished]);
  return <section className="kt-stage keep-track-tutorial" data-state="tutorial" aria-label={en ? 'Game tutorial scene' : '遊戲說明場景'}>
    <header className="kt-hud" aria-hidden="true">
      <p className="kt-progress-label">{settings.practice ? (en ? 'Practice block' : '練習組') : (en ? `Block 1 of ${settings.rounds}` : `第 1 組，共 ${settings.rounds} 組`)}</p>
      <div className="kt-progress-track"><div className="kt-progress-fill" /></div>
      <span className="btn btn-ghost kt-stop">{en ? 'Stop' : '停止'}</span>
    </header>
    <div className="kt-display" aria-hidden="true"><p className="kt-word">{wordLabels.bird[en ? 'en' : 'zh']}</p></div>
    <div className="kt-answer-area" aria-hidden="true">
      <AnswerRows targets={['animals', 'colors', 'relatives']} en={en} choices={{ animals: 'bird' }} active={false} example="animals" inert />
      <footer className="kt-actions"><span className="btn btn-primary kt-submit">{en ? 'Submit' : '送出答案'}</span></footer>
    </div>
    {active && finished && <section className="training-panel kt-tutorial-ready" role="dialog" aria-modal="true" aria-label={title}
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

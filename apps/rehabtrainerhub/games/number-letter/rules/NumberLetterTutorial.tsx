import { useEffect, useRef, useState } from 'react';
import { useT } from '../i18n/useT';
import type { NumberLetterSettings } from '../settings';
import { StartTour } from '../runtime/tour';
import { GetNumberLetterTutorialSteps } from './tutorialSteps';

// The scene matches the training stage so each spotlight lands on the real control positions.
export function NumberLetterTutorial({ active, ready, title, settings, summaryItems, onStart, onBack }: {
  active: boolean; ready: boolean; title: string; settings: NumberLetterSettings;
  summaryItems: { label: string; value: string }[]; onStart: () => void; onBack: () => void;
}) {
  const { lang } = useT();
  const en = lang === 'en';
  const [finished, setFinished] = useState(false);
  const confirmationRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    setFinished(false);
    if (!active) return;
    return StartTour(GetNumberLetterTutorialSteps(lang), { lang, onEvent: () => setFinished(true), onBack });
  }, [active, lang, onBack]);
  useEffect(() => { if (finished) confirmationRef.current?.querySelector<HTMLButtonElement>('button')?.focus(); }, [finished]);
  return <section className="number-letter-stage number-letter-tutorial" aria-label={en ? 'Game tutorial scene' : '遊戲說明場景'}>
    <header className="number-letter-hud" aria-hidden="true">
      <p className="number-letter-progress-label">{settings.practice ? (en ? 'Practice 1 of 12' : '練習 1／12') : (en ? 'Part 1 of 3 · 1/32' : '第 1 段（共 3 段）· 1／32')}</p>
      <p className="number-letter-rule">{settings.practice ? (en ? 'Switching' : '上下切換') : (en ? 'Numbers' : '數字題')}</p>
      <div className="number-letter-progress-track"><div className="number-letter-progress-fill" /></div>
      <span className="btn btn-ghost number-letter-stop">{en ? 'Stop' : '停止'}</span>
    </header>
    <div className="number-letter-field" aria-hidden="true">
      <p className="number-letter-half number-letter-half-top">{en ? 'Top half: number' : '上半部：看數字'}</p>
      <div className="number-letter-board" data-state="target" data-position="topright"><p className="number-letter-pair">G9</p></div>
      <p className="number-letter-half number-letter-half-bottom">{en ? 'Bottom half: letter' : '下半部：看字母'}</p>
    </div>
    <div className="number-letter-pads" aria-hidden="true">
      <div className="number-letter-pad number-letter-pad-z"><span className="number-letter-pad-rule">{en ? 'Odd' : '奇數'}</span>
        <span className="number-letter-pad-rule">{en ? 'Consonant' : '子音'}</span><small>Z / ←</small></div>
      <div className="number-letter-pad number-letter-pad-m"><span className="number-letter-pad-rule">{en ? 'Even' : '偶數'}</span>
        <span className="number-letter-pad-rule">{en ? 'Vowel' : '母音'}</span><small>M / →</small></div>
    </div>
    {active && finished && <section className="training-panel number-letter-tutorial-ready" role="dialog" aria-modal="true" aria-label={title}
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

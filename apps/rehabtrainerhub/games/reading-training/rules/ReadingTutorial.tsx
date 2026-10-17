import { useEffect, useRef, useState } from 'react';
import { useT } from '../i18n/useT';
import type { ReadingSettings } from '../settings';
import { StartTour } from '../runtime/tour';
import { GetReadingTutorialSteps } from './tutorialSteps';

// Sample tokens and question come from the first passage in each language.
const samples = {
  zh: { tokens: ['小', '貓', '白', '白', '在'], question: '主角是什麼動物？', options: ['小狗', '小貓', '小兔', '小鳥'] },
  en: { tokens: ['Elara', 'was', 'a', 'nineteen-year-old', 'mechanic'], question: "What is the main character's name?", options: ['Silas', 'Kael', 'Elara', 'Pip'] },
};

export function ReadingTutorial({ active, ready, title, settings, summaryItems, onStart, onBack }: {
  active: boolean; ready: boolean; title: string; settings: ReadingSettings;
  summaryItems: { label: string; value: string }[]; onStart: () => void; onBack: () => void;
}) {
  const { lang } = useT();
  const en = lang === 'en';
  const sample = samples[en ? 'en' : 'zh'];
  const [finished, setFinished] = useState(false);
  const confirmationRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    setFinished(false);
    if (!active) return;
    return StartTour(GetReadingTutorialSteps(lang), { lang, onEvent: () => setFinished(true), onBack });
  }, [active, lang, onBack]);
  useEffect(() => { if (finished) confirmationRef.current?.querySelector<HTMLButtonElement>('button')?.focus(); }, [finished]);
  // Same gray conversion as the RSVP renderer.
  const gray = Math.round((1 - settings.contrast / 100) * 200).toString(16).padStart(2, '0');
  const perDisplay = settings.crowding / 100;
  return <section className="reading-tutorial" aria-label={en ? 'Game tutorial scene' : '遊戲說明場景'}>
    <header className="reading-preview-pace">
      <p>{en ? 'Speed' : '呈現速度'}: {settings.wordsPerMinute} {en ? 'segments/min' : '片段／分'}</p>
      <p>{en ? 'Per display' : '每批'}: {perDisplay}</p>
      <p>{en ? 'Contrast' : '文字對比'}: {settings.contrast}%</p>
    </header>
    <p className="reading-preview-word" style={{ color: `#${gray}${gray}${gray}` }}>{sample.tokens.slice(0, perDisplay).join(' ')}</p>
    <section className="reading-preview-question" aria-hidden="true">
      <p className="reading-qa-question">{sample.question}</p>
      <ul className="reading-preview-options">{sample.options.map(option => <li key={option}>{option}</li>)}</ul>
    </section>
    {active && finished && <section className="training-panel reading-tutorial-ready" role="dialog" aria-modal="true" aria-label={title}
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

import { useEffect, useRef, useState } from 'react';
import { useT } from '../i18n/useT';
import { StartTour } from '../runtime/tour';
import { GetSeagullTutorialSteps } from './tutorialSteps';
import { copy } from '../labels';
import { SeagullIcon } from '../SeagullIcon';

export function SeagullTutorial({ active, ready, title, summaryItems, onStart, onBack, inputReady = false, keyboard = false, status = '' }: {
  active: boolean; ready: boolean; title: string; summaryItems: { label: string; value: string }[];
  onStart: () => void; onBack: () => void; inputReady?: boolean; keyboard?: boolean; status?: string;
}) {
  const { lang } = useT();
  const labels = copy[lang];
  const [finished, setFinished] = useState(false);
  const confirmationRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    setFinished(false);
    if (!active) return;
    return StartTour(GetSeagullTutorialSteps(lang), { lang, onEvent: () => setFinished(true), onBack });
  }, [active, lang, onBack]);
  useEffect(() => { if (finished) confirmationRef.current?.querySelector<HTMLButtonElement>('button:not(:disabled)')?.focus(); }, [finished, ready]);
  return <section className="seagull-tutorial" aria-label={lang === 'en' ? 'Flight tutorial' : '飛行說明'}>
    <div className="seagull-preview-scene" aria-hidden="true">
      <div className="seagull-preview-flap"><SeagullIcon /><strong>{labels.flap}</strong></div>
      <div className="seagull-preview-glide"><span className="seagull-preview-ring" /><strong>{labels.left} / {labels.right}</strong><span className="seagull-preview-ring" /></div>
      <div className="seagull-preview-sea"><strong>{lang === 'en' ? 'The sea ends the flight' : '落海即結束'}</strong></div>
    </div>
    {active && finished && <section className="training-panel seagull-tutorial-ready" role="dialog" aria-modal="true" aria-label={title}
      onKeyDown={event => {
        if (event.key === 'Escape') { event.preventDefault(); onBack(); }
        if (event.key === 'Tab') {
          const buttons = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>('button:not(:disabled)'));
          event.preventDefault();
          const index = buttons.indexOf(document.activeElement as HTMLButtonElement);
          buttons[(index + (event.shiftKey ? buttons.length - 1 : 1)) % buttons.length]?.focus();
        }
      }}>
      <div ref={confirmationRef} className="training-confirmation training-config">
        <header className="training-config-header"><h2>{title}</h2></header>
        <div className="training-config-body"><section className="training-setting"><h3>{labels.confirm}</h3>
          <div className="training-config-summary">{summaryItems.map(item => <p className="training-config-summary-item" key={item.label}><strong>{item.label}：</strong>{item.value}</p>)}</div>
          <p className="seagull-input-status" role="status">{status || (keyboard ? labels.inputHint : labels.privacy)}</p>
        </section></div>
        <footer className="config-actions"><div className="training-config-navigation-buttons">
          <button type="button" className="btn btn-primary" disabled={!ready} onClick={onStart}>{inputReady || keyboard ? labels.start : labels.enable}</button>
          <button type="button" className="btn btn-ghost" onClick={onBack}>{labels.backSettings}</button>
        </div></footer>
      </div>
    </section>}
  </section>;
}

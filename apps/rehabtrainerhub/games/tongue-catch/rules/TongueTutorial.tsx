import { useEffect, useRef, useState } from 'react';
import { useT } from '../i18n/useT';
import { StartTour } from '../runtime/tour';
import { GetTongueTutorialSteps } from './tutorialSteps';
import { copy } from '../labels';
import { TongueCue } from '../TongueCue';

const appleUrl = new URL('../textures/apple.svg', import.meta.url).href;
const calibrationLabels = ['Rest', 'Tongue_Left', 'Tongue_Right'] as const;

// The calibration cards and the play preview sit on the real stage, so the HUD the last spotlight points at is the one used in play.
export function TongueTutorial({ active, ready, title, summaryItems, onStart, onBack, inputReady = false, status = '' }: {
  active: boolean; ready: boolean; title: string; summaryItems: { label: string; value: string }[];
  onStart: () => void; onBack: () => void; inputReady?: boolean; status?: string;
}) {
  const { lang } = useT();
  const labels = copy[lang];
  const [finished, setFinished] = useState(false);
  const confirmationRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    setFinished(false);
    if (!active) return;
    return StartTour(GetTongueTutorialSteps(lang), { lang, onEvent: () => setFinished(true), onBack });
  }, [active, lang, onBack]);
  useEffect(() => { if (finished) confirmationRef.current?.querySelector<HTMLButtonElement>('button:not(:disabled)')?.focus(); }, [finished, ready]);
  return <section className="tongue-tutorial" aria-label={lang === 'en' ? 'Game tutorial scene' : '遊戲說明場景'}>
    <div className={`tongue-preview-scene${inputReady ? ' is-camera' : ''}`} aria-hidden="true">
      <ol className="tongue-preview-calibration">
        {calibrationLabels.map(label => <li key={label} className="tongue-preview-step">
          <span className="tongue-direction-cue"><TongueCue label={label} /></span>
          <strong>{labels.calibration[label].short}</strong><span>{labels.seconds(1.9)}</span>
        </li>)}
      </ol>
      <div className="tongue-preview-play">
        <div className="tongue-preview-apples">
          <img className="tongue-preview-apple tongue-preview-apple-edge" src={appleUrl} alt="" />
          <img className="tongue-preview-apple tongue-preview-apple-center" src={appleUrl} alt="" />
        </div>
        <div className="tongue-preview-mouth">
          <span className="tongue-direction-cue"><TongueCue label="Tongue_Right" /></span>
          <span className="tongue-preview-rope" />
        </div>
      </div>
    </div>
    {active && finished && <section className="training-panel tongue-tutorial-ready" role="dialog" aria-modal="true" aria-label={title}
      onKeyDown={event => {
        if (event.key === 'Escape') { event.preventDefault(); onBack(); }
        if (event.key === 'Tab') {
          const buttons = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>('button:not(:disabled)'));
          event.preventDefault();
          const index = buttons.indexOf(document.activeElement as HTMLButtonElement);
          buttons[(index + (event.shiftKey ? buttons.length - 1 : 1)) % buttons.length]?.focus();
        }
      }}>
      <div ref={confirmationRef} className="training-config training-confirmation">
        <header className="training-config-header"><h2>{title}</h2></header>
        <div className="training-config-body"><section className="training-setting"><h3>{labels.confirm}</h3>
          <div className="training-config-summary">{summaryItems.map(item => <p className="training-config-summary-item" key={item.label}><strong>{item.label}：</strong>{item.value}</p>)}</div>
          <p className="tongue-input-status" role="status">{status || labels.privacy}</p>
        </section></div>
        <footer className="config-actions"><div className="training-config-navigation-buttons">
          <button type="button" className="btn btn-primary" disabled={!ready} onClick={onStart}>{inputReady ? labels.start : labels.enable}</button>
          <button type="button" className="btn btn-ghost" onClick={onBack}>{labels.backSettings}</button>
        </div></footer>
      </div>
    </section>}
  </section>;
}

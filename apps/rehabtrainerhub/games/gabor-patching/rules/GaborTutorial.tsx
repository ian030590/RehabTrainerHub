import { useEffect, useRef, useState } from 'react';
import { useT } from '../i18n/useT';
import { CreateGaborCanvas, gaborTextureSpecs } from '../gaborTexture';
import type { GaborSettings } from '../settings';
import { StartTour } from '../runtime/tour';
import { GetGaborTutorialSteps } from './tutorialSteps';

export function GaborTutorial({ active, ready, title, settings, summaryItems, onStart, onBack }: {
  active: boolean; ready: boolean; title: string; settings: GaborSettings;
  summaryItems: { label: string; value: string }[]; onStart: () => void; onBack: () => void;
}) {
  const { lang } = useT();
  const en = lang === 'en';
  const [finished, setFinished] = useState(false);
  const sceneRef = useRef<HTMLElement>(null);
  const confirmationRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    sceneRef.current?.querySelectorAll('canvas').forEach((canvas, index) => {
      const spec = gaborTextureSpecs[index];
      canvas.getContext('2d')?.drawImage(CreateGaborCanvas(spec.size, spec.freq, spec.angle), 0, 0);
    });
  }, []);
  useEffect(() => {
    setFinished(false);
    if (!active) return;
    return StartTour(GetGaborTutorialSteps(lang), { lang, onEvent: () => setFinished(true), onBack });
  }, [active, lang, onBack]);
  useEffect(() => { if (finished) confirmationRef.current?.querySelector<HTMLButtonElement>('button')?.focus(); }, [finished]);
  return <section ref={sceneRef} className="gabor-tutorial" aria-label={en ? 'Game tutorial scene' : '遊戲說明場景'}>
    <header className="gabor-preview-hud">
      <p className="gabor-preview-timer">{en ? 'Time' : '時間'}: {settings.durationSec}s</p>
      <p className="gabor-preview-score">{en ? 'Score' : '分數'}: 0</p>
    </header>
    {gaborTextureSpecs.map((spec, index) => <div key={spec.freq} className={index === 0 ? 'gabor-preview-patch' : 'gabor-preview-secondary'} aria-hidden="true">
      <canvas width="256" height="256" />
    </div>)}
    {active && finished && <section className="training-panel gabor-tutorial-ready" role="dialog" aria-modal="true" aria-label={title}
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

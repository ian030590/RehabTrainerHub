import { useEffect, useRef, useState } from 'react';
import { useT } from '../i18n/useT';
import type { DrivingSettings } from '../settings';
import { StartTour } from '../runtime/tour';
import { GetDrivingTutorialSteps } from './tutorialSteps';

export function DrivingTutorial({ active, ready, title, settings, summaryItems, onStart, onBack }: {
  active: boolean; ready: boolean; title: string; settings: DrivingSettings;
  summaryItems: { label: string; value: string }[]; onStart: () => void; onBack: () => void;
}) {
  const { lang } = useT();
  const en = lang === 'en';
  const [finished, setFinished] = useState(false);
  const confirmationRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    setFinished(false);
    if (!active) return;
    return StartTour(GetDrivingTutorialSteps(lang, settings.controlMode), { lang, onEvent: () => setFinished(true), onBack });
  }, [active, lang, settings.controlMode, onBack]);
  useEffect(() => { if (finished) confirmationRef.current?.querySelector<HTMLButtonElement>('button')?.focus(); }, [finished]);
  return <section className="driving-tutorial" aria-label={en ? 'Game tutorial scene' : '遊戲說明場景'}>
    <div className="driving-preview-sky" aria-hidden="true" />
    <div className="driving-preview-road" aria-hidden="true"><span className="driving-preview-divider" /></div>
    <div className="driving-preview-hazard" role="img" aria-label={en ? 'Oncoming vehicle crossing lanes' : '逆行車跨越車道'}>
      <span className="driving-preview-car-window" /><span className="driving-preview-crossing">↘</span>
    </div>
    <div className="driving-preview-player" role="img" aria-label={en ? 'Your vehicle' : '你的車輛'}><span className="driving-preview-car-window" /></div>
    <div className="driving-preview-status"><p>{en ? 'Delivery route · Stay in your lane' : '送貨路線 · 維持車道'}</p><p>{en ? 'Collisions 0 · Lane departures 0' : '碰撞 0 · 偏離車道 0'}</p></div>
    <div className="driving-preview-controls" aria-label={en ? 'Configured controls' : '本次操作方式'}>
      <p>{settings.controlMode === 'wheel' ? (en ? 'Wheel + pedals' : '方向盤＋踏板') : settings.controlMode === 'touch' ? (en ? 'Drag wheel · Accelerator · Brake' : '拖曳方向盤 · 油門 · 煞車') : settings.controlMode === 'wasd' ? 'W / A / S / D · Space' : '↑ / ← / ↓ / → · Space'}</p>
      <span className="driving-preview-wheel" aria-hidden="true">◉</span>
    </div>
    {active && finished && <section className="training-panel driving-tutorial-ready" role="dialog" aria-modal="true" aria-label={title}
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

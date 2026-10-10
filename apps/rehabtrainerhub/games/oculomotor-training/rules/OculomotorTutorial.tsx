import { useEffect, useRef, useState } from 'react';
import { StartTour } from '../runtime/tour';
import { GetOculomotorTutorialSteps } from './tutorialSteps';
import type { OculomotorSettings } from '../settings';

export function OculomotorTutorial({ active, language, settings, summaryItems, ready, cameraState, error, onCamera, onStart, onBack }: {
  active: boolean; language: 'zh' | 'en'; settings: OculomotorSettings; summaryItems: { label: string; value: string }[];
  ready: boolean; cameraState: string; error: string; onCamera: () => void; onStart: () => void; onBack: () => void;
}) {
  const en = language === 'en';
  const [finished, setFinished] = useState(false);
  const confirmationRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    setFinished(false);
    if (!active) return;
    return StartTour(GetOculomotorTutorialSteps(language, String(settings.module)), { lang: language, onEvent: () => setFinished(true), onBack });
  }, [active, language, settings.module, onBack]);
  useEffect(() => { if (finished) confirmationRef.current?.querySelector<HTMLButtonElement>('button:not(:disabled)')?.focus(); }, [finished]);
  return <section className="oculomotor-tutorial" aria-label={en ? 'Game tutorial scene' : '遊戲說明場景'}>
    <header className="oculomotor-preview-hud"><p>{en ? 'Oculomotor practice' : '眼動練習'}</p><p className="oculomotor-preview-calibration">{settings.eyeTrackingSource === 'webgazer' ? (en ? 'Nine calibration points · Five validation points' : '九點校正 · 五點驗證') : (en ? 'No gaze tracking' : '不記錄眼動')}</p></header>
    <p className={`oculomotor-preview-target oculomotor-preview-${settings.stimulusType}`} aria-label={en ? 'Stimulus preview' : '目標預覽'}>{settings.module === 'vor' || settings.stimulusType === 'numbers_dot' ? '5' : ''}</p>
    <div className="oculomotor-preview-directions" aria-label={en ? 'Selected directions' : '選定方位'}>
      {['↑', '↗', '→', '↘', '↓', '↙', '←', '↖'].map((arrow, index) => <p key={arrow} className={settings[`axis${index}Enabled`] ? 'is-selected' : ''}>{arrow}</p>)}
    </div>
    <p className="oculomotor-preview-stop">{en ? 'Escape: end current activity' : 'Esc：結束當次活動'}</p>
    {active && finished && <section className="training-panel oculomotor-tutorial-ready" role="dialog" aria-modal="true" aria-label={en ? 'Confirm settings' : '確認設定'}
      onKeyDown={event => {
        if (event.key === 'Escape') { event.preventDefault(); onBack(); }
        if (event.key === 'Tab') {
          event.preventDefault(); const buttons = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>('button:not(:disabled)'));
          const index = buttons.indexOf(document.activeElement as HTMLButtonElement);
          buttons[(index + (event.shiftKey ? buttons.length - 1 : 1)) % buttons.length]?.focus();
        }
      }}>
      <div ref={confirmationRef} className="training-config training-confirmation">
        <header className="training-config-header"><h2>{en ? 'Oculomotor practice' : '眼動練習'}</h2></header>
        <div className="training-config-body"><section className="training-setting"><h3>{en ? 'Session settings' : '本次設定'}</h3>
          <div className="training-config-summary">{summaryItems.map(item => <p className="training-config-summary-item" key={item.label}><strong>{item.label}：</strong>{item.value}</p>)}</div>
          {settings.eyeTrackingSource === 'webgazer' && <p role="status">{cameraState === 'ready' ? (en ? 'Camera ready. Start to calibrate.' : '相機已就緒，開始後進行校正。') : (en ? 'Enable the camera before starting.' : '開始前請先啟用相機。')}</p>}
          {error && <p role="alert">{error}</p>}
        </section></div>
        <footer className="config-actions"><div className="training-config-navigation-buttons">
          {settings.eyeTrackingSource === 'webgazer' && cameraState !== 'ready' && <button type="button" className="btn btn-primary" onClick={onCamera} disabled={cameraState === 'starting'}>{en ? 'Enable camera' : '啟用相機'}</button>}
          <button type="button" className="btn btn-primary" disabled={!ready || (settings.eyeTrackingSource === 'webgazer' && cameraState !== 'ready')} onClick={onStart}>{en ? 'Start practice' : '開始練習'}</button>
          <button type="button" className="btn btn-ghost" onClick={onBack}>{en ? 'Back to settings' : '返回設定'}</button>
        </div></footer>
      </div>
    </section>}
  </section>;
}

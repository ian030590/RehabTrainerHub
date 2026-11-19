import { useEffect, useRef } from 'react';
import { useT } from '../i18n/useT';
import { StartTour } from '../runtime/tour';
import type { Settings } from '../settings';
import { GetBrakeTutorialSteps } from './tutorialSteps';

type SummaryItem = { label: string; value: string };

export function BrakeReactionTutorial({ title, ready, settings, sound, showDistraction, roundCount, summaryItems,
  onStart, onBack, drawPreview, onContinue, onDemo }: {
  title: string;
  ready: boolean;
  settings: Settings;
  sound: boolean;
  showDistraction: boolean;
  roundCount: number;
  summaryItems: SummaryItem[];
  onStart: () => void;
  onBack: () => void;
  drawPreview: (canvas: HTMLCanvasElement, controls: HTMLElement) => () => void;
  onContinue: () => void;
  onDemo: () => void;
}) {
  const { copy, lang } = useT();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const controlsRef = useRef<HTMLDivElement>(null);
  const carRef = useRef<HTMLDivElement>(null);
  const startRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const controls = controlsRef.current;
    const car = carRef.current;
    if (!canvas || !controls || !car) return;
    const draw = drawPreview(canvas, controls);

    const updatePreview = () => {
      draw();
      const bounds = canvas.dataset.targetRect;
      if (bounds) {
        const [left, top, width, height] = bounds.split(',').map(Number);
        const rect = canvas.getBoundingClientRect();
        Object.assign(car.style, {
          left: `${left - rect.left}px`, top: `${top - rect.top}px`, width: `${width}px`, height: `${height}px`,
        });
      }
      car.hidden = !bounds;
      window.dispatchEvent(new Event('game:tutorial-layout'));
    };

    updatePreview();
    const observer = new ResizeObserver(updatePreview);
    observer.observe(canvas);
    observer.observe(controls);
    return () => observer.disconnect();
  }, [ready, drawPreview]);

  useEffect(() => {
    if (ready) {
      startRef.current?.focus();
      return;
    }
    return StartTour(GetBrakeTutorialSteps(lang, showDistraction), {
      lang,
      onEvent: event => { if (event === 'tour_done' || event === 'tour_skip') onContinue(); },
      onBack,
    });
  }, [ready, lang, showDistraction, onContinue, onBack]);

  return <>
    <section className="driving brake-tutorial-scene" inert aria-hidden="true">
      <div className="road-frame">
        <canvas ref={canvasRef} aria-hidden="true" />
        <div className="tutorial-lead-car" ref={carRef} />
      </div>
      <div className="drive-top">
        <header className="drive-toolbar">
          <h2 className="tutorial-round">{lang === 'en' ? copy.round : '第'} 1 / {roundCount}</h2>
          <span className="drive-speed">{settings.speedKmh} km/h</span>
          <div className="drive-actions">
            <button type="button" className="btn btn-ghost" aria-pressed={sound}>{copy.sound}</button>
            <button type="button" className="btn btn-ghost" id="stop">{copy.stop}</button>
          </div>
        </header>
        {showDistraction && <section className="drive-notification messages" aria-label={copy.messages}>
          <div className="notification-copy">
            <p className="notification-sender">{copy.messageSender}</p>
            <p className="notification-question"><strong>3</strong> + <strong>4</strong> = ?</p>
          </div>
          <div className="answers">{[5, 7, 9].map(answer =>
            <button type="button" key={answer} className="btn btn-ghost">{answer}</button>,
          )}</div>
        </section>}
        <p className="road-caption">{copy.ready}</p>
      </div>
      <div className="drive-stimulus" />
      <div className="drive-bottom" ref={controlsRef}>
        <div className="brake-controls">
          <button type="button" className="btn btn-primary" id="brake">{copy.brake}</button>
          <p id="brake-help">{copy.pressHelp}</p>
        </div>
      </div>
    </section>
    {ready && <section className="training-panel brake-tutorial-ready" role="dialog" aria-modal="true" aria-label={title}
      onKeyDown={event => {
        if (event.key === 'Escape') {
          event.preventDefault();
          onBack();
        }
        if (event.key === 'Tab') {
          const buttons = [...event.currentTarget.querySelectorAll('button')];
          const index = buttons.indexOf(document.activeElement as HTMLButtonElement);
          const next = event.shiftKey ? (index < 1 ? buttons.length - 1 : index - 1) : (index + 1) % buttons.length;
          event.preventDefault();
          buttons[next]?.focus();
        }
      }}>
      <div className="training-config training-confirmation">
        <header className="training-config-header"><h2>{title}</h2></header>
        <div className="training-config-body">
          <section className="training-setting">
            <h3>{lang === 'en' ? 'Confirm settings' : '確認設定'}</h3>
            <div className="training-config-summary">
              {summaryItems.map(item => <p className="training-config-summary-item" key={item.label}><strong>{item.label}：</strong>{item.value}</p>)}
            </div>
          </section>
        </div>
        <footer className="config-actions"><div className="training-config-navigation-buttons">
          <button type="button" className="btn btn-primary" id="start" ref={startRef} onClick={onStart}>{copy.start}</button>
          <button type="button" className="btn btn-ghost" id="demo" onClick={onDemo}>{copy.demo}</button>
          <button type="button" className="btn btn-ghost" onClick={onBack}>{copy.backSettings}</button>
        </div></footer>
      </div>
    </section>}
  </>;
}

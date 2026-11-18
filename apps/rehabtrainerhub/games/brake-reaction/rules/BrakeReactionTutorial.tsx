import { useEffect, useRef } from 'react';
import { useT } from '../i18n/useT';
import { MakeRoad } from '../src/road';

type SummaryItem = { label: string; value: string };

export function BrakeReactionTutorial({ title, ready, summaryItems, onStart, onBack, drawPreview, onContinue, onDemo }: {
  title: string;
  ready: boolean;
  summaryItems: SummaryItem[];
  onStart: () => void;
  onBack: () => void;
  drawPreview?: (draw: ReturnType<typeof MakeRoad>) => void;
  onContinue?: () => void;
  onDemo?: () => void;
}) {
  const { copy, lang } = useT();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !drawPreview) return;
    const draw = MakeRoad(canvas);
    const update = () => drawPreview(draw);
    update();
    const observer = new ResizeObserver(update);
    observer.observe(canvas);
    return () => observer.disconnect();
  }, [drawPreview]);

  if (ready) return <section className="training-panel training-config training-confirmation" aria-labelledby="title">
    <header className="training-config-header"><h2 id="title" tabIndex={-1}>{title}</h2></header>
    <div className="training-config-body">
      <section className="training-setting">
        <h3>{lang === 'en' ? 'Confirm settings' : '確認設定'}</h3>
        <div className="training-config-summary">
          {summaryItems.map(item => <p className="training-config-summary-item" key={item.label}><strong>{item.label}</strong> {item.value}</p>)}
        </div>
      </section>
    </div>
    <footer className="config-actions">
      <button className="btn btn-ghost" onClick={onBack}>{copy.backSettings}</button>
      <button className="btn btn-primary" id="start" onClick={onStart}>{copy.start}</button>
    </footer>
  </section>;

  const preview = <div className="tutorial-road">
    <div className="tutorial-scene">
      <canvas ref={canvasRef} aria-hidden="true" />
      {onContinue && <span className="tutorial-lamp-focus" aria-hidden="true" />}
    </div>
    {onContinue && <p className="spotlight">{copy.instruction}</p>}
  </div>;
  if (!onContinue) return preview;
  return <section className="training-panel" aria-labelledby="title">
    <header className="training-config-header"><h2 id="title" tabIndex={-1}>{title}</h2></header>
    <div className="training-config-body">{preview}<p>{copy.ignore}</p></div>
    <footer className="config-actions training-config-navigation-buttons">
      <button className="btn btn-ghost" onClick={onBack}>{copy.backSettings}</button>
      <button className="btn btn-ghost" id="continue" onClick={onContinue}>{copy.skipDemo}</button>
      <button className="btn btn-primary" id="demo" onClick={onDemo}>{copy.demo}</button>
    </footer>
  </section>;
}

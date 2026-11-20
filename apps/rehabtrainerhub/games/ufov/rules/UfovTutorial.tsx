import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useT } from '../i18n/useT';
import { EnabledAxes, type UfovSettings } from '../settings';
import { StartTour } from '../runtime/tour';
import { CalculatePeripheralAttentionScreenGeometry, CreatePeripheralAttentionCanvasSlots, DrawPeripheralAttentionCanvasStage,
  GetPeripheralAttentionTargetRects } from '../runtime/peripheralAttentionCanvas';
import { GetUfovTutorialSteps, type UfovTutorialScene } from './tutorialSteps';
import { DirectionQuestion, VehicleQuestion } from '../AnswerPad';

const slots = CreatePeripheralAttentionCanvasSlots();

function PositionMarker(marker: HTMLSpanElement | null, rect: { left: number; top: number; width: number; height: number }) {
  if (!marker) return;
  const { left, top, width, height } = rect;
  Object.assign(marker.style, { left: `${left}px`, top: `${top}px`, width: `${width}px`, height: `${height}px` });
}

export function UfovTutorial({ active, ready, title, settings, summaryItems, onStart, onBack }: {
  active: boolean; ready: boolean; title: string; settings: UfovSettings;
  summaryItems: { label: string; value: string }[]; onStart: () => void; onBack: () => void;
}) {
  const { lang } = useT();
  const en = lang === 'en';
  const activity = settings.subtestId === 2 || settings.subtestId === 3 ? settings.subtestId : 1;
  const [finished, setFinished] = useState(false);
  const [currentScene, setScene] = useState<UfovTutorialScene>('fixation');
  const scene = active ? currentScene : 'fixation';
  const confirmationRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const centerRef = useRef<HTMLSpanElement>(null);
  const outerRef = useRef<HTMLSpanElement>(null);
  const enabledAxes = EnabledAxes(settings);
  const exampleAxis = enabledAxes.includes(2) ? 2 : enabledAxes[0];
  const outerSlot = activity === 1 ? undefined : slots.find(slot => slot.isTargetCandidate && slot.axis === exampleAxis);
  const { screenWidthCm, screenHeightCm, viewingDistanceCm, targetVisualAngleDeg, vehicleVisualAngleDeg, contrastPercent } = settings;
  useEffect(() => {
    setFinished(false);
    if (!active) { setScene('fixation'); return; }
    return StartTour(GetUfovTutorialSteps(lang, activity), { lang, onEvent: () => setFinished(true), onBack, onStep: step => setScene(step.scene) });
  }, [active, activity, lang, onBack]);
  useLayoutEffect(() => {
    const refreshScene = () => {
      const stage = stageRef.current;
      if (stage && scene !== 'vehicle' && scene !== 'direction') {
        const geometry = CalculatePeripheralAttentionScreenGeometry(screenWidthCm, screenHeightCm, viewingDistanceCm, targetVisualAngleDeg, vehicleVisualAngleDeg);
        DrawPeripheralAttentionCanvasStage(stage, { ariaLabel: title, phase: scene, centralTarget: 'truck',
          hasPeripheral: activity !== 1, hasDistractors: activity === 3, peripheralSlot: outerSlot, slots, geometry, contrastPercent });
        const { center, outer } = GetPeripheralAttentionTargetRects(stage.getBoundingClientRect(), geometry, outerSlot);
        PositionMarker(centerRef.current, center);
        if (outer) PositionMarker(outerRef.current, outer);
      }
      window.dispatchEvent(new Event('game:tutorial-layout'));
    };
    refreshScene();
    window.addEventListener('resize', refreshScene);
    return () => window.removeEventListener('resize', refreshScene);
  }, [activity, scene, title, outerSlot, screenWidthCm, screenHeightCm, viewingDistanceCm, targetVisualAngleDeg, vehicleVisualAngleDeg, contrastPercent]);
  useEffect(() => { if (finished) confirmationRef.current?.querySelector<HTMLButtonElement>('button')?.focus(); }, [finished]);
  return <section className="ufov-stage ufov-tutorial" aria-label={en ? 'Game tutorial' : '遊戲教學'} data-scene={scene}>
    <header className="ufov-hud" aria-hidden="true">
      <span className="btn btn-ghost ufov-stop">{en ? 'Stop' : '停止'}</span>
    </header>
    {scene === 'vehicle' || scene === 'direction' ? <div className="ufov-answer" aria-hidden="true">
      {scene === 'vehicle' ? <VehicleQuestion lang={lang} /> : <DirectionQuestion lang={lang} tutorialAxis={outerSlot?.axis ?? undefined} />}
    </div> : <div ref={stageRef} className="ufov-canvas-stage" aria-hidden="true">
      <canvas className="ufov-stage-canvas" />
      {scene === 'mask' ? <span className="ufov-tutorial-mask" /> : <span ref={centerRef} className="ufov-tutorial-center" />}
      {scene === 'stimulus' && outerSlot && <span ref={outerRef} className="ufov-tutorial-outer" />}
    </div>}
    {active && finished && <section className="training-panel ufov-tutorial-ready" role="dialog" aria-modal="true" aria-label={title}
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

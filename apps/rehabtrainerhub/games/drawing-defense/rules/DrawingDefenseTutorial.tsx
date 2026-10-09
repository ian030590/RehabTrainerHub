import { useEffect, useState } from 'react';
import { useT } from '../i18n/useT';
import { StartTour, type TourStep } from '../runtime/tour';
import '../runtime/tour.css';
import type { ReactNode } from 'react';
type TrainingConfigSummaryItem = { label: ReactNode; value: ReactNode };

interface DrawingDefenseTutorialProps {
  onStart: () => void;
  onBack: () => void;
  summaryItems?: readonly TrainingConfigSummaryItem[];
}

export function DrawingDefenseTutorial({ onStart, onBack, summaryItems }: DrawingDefenseTutorialProps) {
  const { t, lang } = useT();
  const [tourFinished, setTourFinished] = useState(false);

  useEffect(() => {
    let disposeTour: (() => void) | undefined;
    const timer = window.setTimeout(() => {
      const isZh = lang !== 'en';
      const steps: TourStep[] = isZh
        ? [
            {
              target: '.mock-enemy',
              title: '目標敵人',
              text: '每個敵人會顯示需要描繪的形狀。',
              place: 'bottom',
            },
            {
              target: '.mock-canvas-area',
              title: '描繪形狀',
              text: '請用滑鼠、觸控或手寫板，在畫面上依提示完成筆畫。系統會依形狀相似度進行攻擊。',
              place: 'top',
            },
            {
              target: '.mock-defense-line',
              title: '防線',
              text: '若敵人抵達防線會扣除 HP。HP 歸零或時間結束後進入結算。',
              place: 'top',
            },
          ]
        : [
            {
              target: '.mock-enemy',
              title: 'Target Enemy',
              text: 'Each enemy shows a target shape to draw.',
              place: 'bottom',
            },
            {
              target: '.mock-canvas-area',
              title: 'Draw the Shape',
              text: 'Draw the shape with your mouse, touch, or pen tablet. Recognition uses shape similarity to attack.',
              place: 'top',
            },
            {
              target: '.mock-defense-line',
              title: 'Defense Line',
              text: 'Enemies that reach the defense line cost HP. Results appear when HP reaches zero or time ends.',
              place: 'top',
            },
          ];

      disposeTour = StartTour(steps, {
        lang: lang === 'en' ? 'en' : 'zh-TW',
        zIndex: 9999,
        mask: true,
        ring: true,
        block: true,
        onEvent: (name) => {
          if (name === 'tour_done' || name === 'tour_skip') {
            setTourFinished(true);
          }
        },
      });
    }, 300);

    return () => {
      window.clearTimeout(timer);
      disposeTour?.();
    };
  }, [lang]);

  return (
    <div
      className="drawing-defense-tutorial mock-canvas-area"
      style={{
        width: '100%',
        height: '100%',
        position: 'absolute',
        top: 0,
        left: 0,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        alignItems: 'center',
        overflow: 'hidden',
        zIndex: 10,
        pointerEvents: tourFinished ? 'auto' : 'none', // Prevent interacting with UI beneath during tour
      }}
    >
      {/* Top Bar with Back Button */}
      <div className="drawing-tutorial-navigation" style={{ width: '100%', padding: '16px 24px', display: 'flex', justifyContent: 'flex-start', pointerEvents: 'auto' }}>
        <button
          className="ui-button"
          onClick={onBack}
          style={{ 
            backgroundColor: 'rgba(255,255,255,0.9)', 
            border: 'none', 
            padding: '8px 16px', 
            borderRadius: '4px',
            cursor: 'pointer' 
          }}
        >
          {t('training.back')}
        </button>
      </div>

      {/* Mock Enemy */}
      <div
        className="mock-enemy"
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          marginTop: '5%',
        }}
      >
        <div className="drawing-tutorial-enemy-icon" style={{ fontSize: 42 }}>👾</div>
        <div
          className="drawing-tutorial-target-shape"
          style={{
            width: 68,
            height: 50,
            backgroundColor: '#ffffff',
            border: '2px solid #c2c6d4',
            borderRadius: 6,
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            marginTop: 6,
          }}
        >
          <svg width="40" height="40" viewBox="0 0 100 100">
            <polygon points="50,15 85,85 15,85" fill="none" stroke="#1a1c1e" strokeWidth="6" strokeLinejoin="round" />
          </svg>
        </div>
      </div>

      {tourFinished && <section className="training-panel drawing-tutorial-ready">
        <div className="training-config training-confirmation">
          <header className="training-config-header"><h2>{t('training.drawing.title')}</h2></header>
          <div className="training-config-body">
            <section className="training-setting"><h3>{lang === 'en' ? 'Confirm settings' : '確認設定'}</h3>
              <div className="training-config-summary">
                {summaryItems?.map((item, index) => <p className="training-config-summary-item" key={index}><strong>{item.label}：</strong>{item.value}</p>)}
              </div>
            </section>
          </div>
          <footer className="config-actions"><div className="training-config-navigation-buttons">
            <button type="button" className="btn btn-primary ui-button-primary" onClick={onStart}>{t('training.start')}</button>
            <button type="button" className="btn btn-ghost ui-button" onClick={onBack}>{lang === 'en' ? 'Back to settings' : '返回設定'}</button>
          </div></footer>
        </div>
      </section>}

      {/* Mock Defense Line */}
      <div
        className="mock-defense-line"
        style={{
          width: '100%',
          height: 98,
          backgroundColor: 'rgba(5, 8, 22, 0.5)',
          borderTop: '2px dashed rgba(255, 255, 255, 0.4)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          color: 'rgba(255, 255, 255, 0.8)',
          fontSize: '1.2rem',
        }}
      >
        {lang === 'en' ? 'Defense Line' : '防線'}
      </div>
    </div>
  );
}

import { useEffect, useState } from 'react';
import { useT } from '../i18n/useT';
import { StartTour, type TourStep } from '../runtime/tour';
import '../runtime/tour.css';
type TrainingConfigSummaryItem = { label: ReactNode; value: ReactNode };
import type { ReactNode } from 'react';

const assetUrls = {
    background: new URL('../textures/background.png', import.meta.url).href,
    ship: new URL('../textures/ship.png', import.meta.url).href,
    shield: new URL('../textures/shield.png', import.meta.url).href,
    normal: new URL('../textures/asteroid-blue.png', import.meta.url).href,
    heavy: new URL('../textures/asteroid-green.png', import.meta.url).href,
    lethal: new URL('../textures/asteroid-dark.png', import.meta.url).href,
    energy: new URL('../textures/energy-rock.png', import.meta.url).href,
} as const;

interface AsteroidShieldTutorialProps {
  title?: ReactNode;
  summaryItems?: readonly TrainingConfigSummaryItem[];
  shieldSizePercent: number;
  ready: boolean;
  active: boolean;
  onStart: () => void;
  onBack: () => void;
}

export function AsteroidShieldTutorial({ title, summaryItems, shieldSizePercent, onStart, onBack, ready, active }: AsteroidShieldTutorialProps) {
  const { t, lang } = useT();
  const [tourFinished, setTourFinished] = useState(false);

  useEffect(() => {
    if (!active) { setTourFinished(false); return; }
    let disposeTour: (() => void) | undefined;
    const timer = window.setTimeout(() => {
      const isZh = lang !== 'en';
      const steps: TourStep[] = isZh
        ? [
            {
              target: '.mock-asteroid-group',
              title: '威脅與能量石',
              text: '藍色小行星造成少量傷害，綠色傷害較高，暗色命中會直接結束；發光的能量石可恢復耐久。',
              place: 'bottom',
            },
            {
              target: '.mock-spaceship',
              title: '飛船',
              text: '保護飛船免受小行星撞擊。若耐久歸零則會提早結束。',
              place: 'top',
            },
            {
              target: '.mock-shield',
              title: '護盾防禦',
              text: '使用滑鼠或觸控左右移動護盾，攔截從上方以不同速度落下的小行星。護盾維持固定高度。',
              place: 'top',
            },
          ]
        : [
            {
              target: '.mock-asteroid-group',
              title: 'Threats & Energy Rocks',
              text: 'Blue asteroids deal light damage, green deal heavy damage, and dark ends the session. Energy rocks restore durability.',
              place: 'bottom',
            },
            {
              target: '.mock-spaceship',
              title: 'Spaceship',
              text: 'Protect your ship from asteroids. The session ends if durability reaches zero.',
              place: 'top',
            },
            {
              target: '.mock-shield',
              title: 'Shield Defense',
              text: 'Move the shield left and right using your mouse or touch. Intercept asteroids falling at different speeds; the shield stays at a fixed height.',
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
  }, [lang, active]);

  return (
    <div
      className="asteroid-shield-tutorial"
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
        pointerEvents: active && tourFinished ? 'auto' : 'none',
        backgroundImage: `url(${assetUrls.background})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }}
    >
      {/* Top Bar with Back Button */}
      <div className="asteroid-tutorial-navigation" style={{ width: '100%', padding: '16px 24px', display: 'flex', justifyContent: 'flex-start', pointerEvents: 'auto' }}>
        {active && <button
          className="ui-button"
          onClick={onBack}
          style={{ 
            backgroundColor: 'var(--surface)',
            border: 'none', 
            padding: '8px 16px', 
            borderRadius: '4px',
            cursor: 'pointer',
            fontWeight: 'bold',
            color: 'var(--text)'
          }}
        >
          {lang === 'en' ? 'Back to Settings' : '回設定'}
        </button>}
      </div>

      {/* Mock Asteroids */}
      <div
        className="mock-asteroid-group"
        style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          gap: 'clamp(4px, 3vw, 24px)',
          marginTop: '5%',
          padding: '16px',
          backgroundColor: 'var(--bg-overlay)',
          borderRadius: '12px',
        }}
      >
        <img src={assetUrls.normal} alt="Normal Asteroid" style={{ width: 60, height: 60, filter: 'drop-shadow(0 0 8px #76b7ff)' }} />
        <img src={assetUrls.heavy} alt="Heavy Asteroid" style={{ width: 70, height: 70, filter: 'drop-shadow(0 0 8px #63e27a)' }} />
        <img src={assetUrls.lethal} alt="Lethal Asteroid" style={{ width: 80, height: 80, filter: 'drop-shadow(0 0 8px #2f3446)', opacity: 0.9 }} />
        <img src={assetUrls.energy} alt="Energy Rock" style={{ width: 50, height: 50, filter: 'drop-shadow(0 0 12px #ffffff)' }} />
      </div>

      {active && tourFinished && <section className="training-panel asteroid-tutorial-ready">
        <div className="training-config training-confirmation">
          <header className="training-config-header"><h2>{title}</h2></header>
          <div className="training-config-body">
            <section className="training-setting"><h3>{lang === 'en' ? 'Confirm settings' : '確認設定'}</h3>
              <div className="training-config-summary">
                {summaryItems?.map((item, index) => <p className="training-config-summary-item" key={index}><strong>{item.label}：</strong>{item.value}</p>)}
              </div>
            </section>
          </div>
          <footer className="config-actions"><div className="training-config-navigation-buttons">
            <button type="button" className="btn btn-primary ui-button-primary" disabled={!ready} onClick={onStart}>{lang === 'en' ? 'Start Training' : '開始訓練'}</button>
            <button type="button" className="btn btn-ghost ui-button" onClick={onBack}>{lang === 'en' ? 'Back to settings' : '返回設定'}</button>
          </div></footer>
        </div>
      </section>}

      {/* Mock Shield and Ship */}
      <div className="asteroid-tutorial-defense" style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
        <div className="mock-shield" style={{
            position: 'absolute',
            left: '50%',
            transform: 'translateX(-50%)',
            bottom: 'calc(min(20px, 3dvh) + min(26.265625vw, 22dvh) + max(12px, 2.5vmin))',
            width: `min(60vw, max(100px, ${shieldSizePercent * 0.4}vmin))`,
            aspectRatio: '1 / 0.28',
            backgroundImage: `url(${assetUrls.shield})`,
            backgroundSize: '100% 100%',
            opacity: 0.6,
            mixBlendMode: 'screen'
        }} />
        <div className="mock-spaceship" style={{
            position: 'absolute',
            left: '9%',
            bottom: 'min(20px, 3dvh)',
            width: '82%',
            height: 'min(26.265625vw, 22dvh)',
            backgroundImage: `url(${assetUrls.ship})`,
            backgroundSize: '100% 100%',
            backgroundRepeat: 'no-repeat',
            backgroundPosition: 'center',
        }} />
      </div>
    </div>
  );
}

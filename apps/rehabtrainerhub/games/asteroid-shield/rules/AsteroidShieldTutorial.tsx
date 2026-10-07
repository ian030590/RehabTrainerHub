import { useEffect, useState } from 'react';
import { useT } from '@rehab-trainer/ui/i18n/games';
import { StartTour, type TourStep } from '@rehab-trainer/ui/tour';
import '@rehab-trainer/ui/tour/toutour.css';
import type { TrainingConfigSummaryItem } from '@rehab-trainer/ui';
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
  onStart: () => void;
  onBack: () => void;
}

export function AsteroidShieldTutorial({ title, summaryItems, onStart, onBack }: AsteroidShieldTutorialProps) {
  const { t, lang } = useT();
  const [tourFinished, setTourFinished] = useState(false);

  useEffect(() => {
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
              text: '使用滑鼠或體感操作移動護盾，攔截飛向飛船的小行星。',
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
              text: 'Move the shield using your mouse or motion control to intercept incoming asteroids.',
              place: 'top',
            },
          ];

      StartTour(steps, {
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
    };
  }, [lang]);

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
        pointerEvents: tourFinished ? 'auto' : 'none',
        backgroundImage: `url(${assetUrls.background})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }}
    >
      {/* Top Bar with Back Button */}
      <div style={{ width: '100%', padding: '16px 24px', display: 'flex', justifyContent: 'flex-start', pointerEvents: 'auto' }}>
        <button
          className="ui-button"
          onClick={onBack}
          style={{ 
            backgroundColor: 'rgba(255,255,255,0.9)', 
            border: 'none', 
            padding: '8px 16px', 
            borderRadius: '4px',
            cursor: 'pointer',
            fontWeight: 'bold',
            color: '#333'
          }}
        >
          {lang === 'en' ? 'Back to Settings' : '回設定'}
        </button>
      </div>

      {/* Mock Asteroids */}
      <div
        className="mock-asteroid-group"
        style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          gap: '24px',
          marginTop: '5%',
          padding: '16px',
          backgroundColor: 'rgba(0,0,0,0.3)',
          borderRadius: '12px',
        }}
      >
        <img src={assetUrls.normal} alt="Normal Asteroid" style={{ width: 60, height: 60, filter: 'drop-shadow(0 0 8px #76b7ff)' }} />
        <img src={assetUrls.heavy} alt="Heavy Asteroid" style={{ width: 70, height: 70, filter: 'drop-shadow(0 0 8px #63e27a)' }} />
        <img src={assetUrls.lethal} alt="Lethal Asteroid" style={{ width: 80, height: 80, filter: 'drop-shadow(0 0 8px #2f3446)', opacity: 0.9 }} />
        <img src={assetUrls.energy} alt="Energy Rock" style={{ width: 50, height: 50, filter: 'drop-shadow(0 0 12px #ffffff)' }} />
      </div>

      {/* Center content / Start Button */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', pointerEvents: 'auto', zIndex: 20 }}>
        {tourFinished && (
          <div style={{ 
            backgroundColor: 'rgba(255, 255, 255, 0.95)', 
            padding: '24px', 
            borderRadius: '12px', 
            display: 'flex', 
            flexDirection: 'column', 
            alignItems: 'center',
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
            maxWidth: '90%',
          }}>
            <h2 style={{ margin: '0 0 16px 0', fontSize: '1.5rem', color: '#333', textAlign: 'center' }}>
              {title}
            </h2>
            {summaryItems && summaryItems.length > 0 && (
              <div style={{ marginBottom: '24px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '0.9rem', color: '#555' }}>
                {summaryItems.map((item, idx) => (
                  <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', gap: '12px' }}>
                    <span style={{ fontWeight: 'bold' }}>{item.label}:</span>
                    <span>{item.value}</span>
                  </div>
                ))}
              </div>
            )}
            <button
              className="ui-button ui-button-primary"
              style={{ fontSize: '1.2rem', padding: '12px 32px', backgroundColor: '#005EB8', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}
              onClick={onStart}
            >
              {lang === 'en' ? 'Start Training' : '開始訓練'}
            </button>
          </div>
        )}
      </div>

      {/* Mock Shield and Ship */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '10%' }}>
        <div className="mock-shield" style={{
            width: 200,
            height: 50,
            backgroundImage: `url(${assetUrls.shield})`,
            backgroundSize: '100% 100%',
            marginBottom: '20px',
            opacity: 0.6,
            mixBlendMode: 'screen'
        }} />
        <div className="mock-spaceship" style={{
            width: 100,
            height: 100,
            backgroundImage: `url(${assetUrls.ship})`,
            backgroundSize: 'contain',
            backgroundRepeat: 'no-repeat',
            backgroundPosition: 'center',
        }} />
      </div>
    </div>
  );
}

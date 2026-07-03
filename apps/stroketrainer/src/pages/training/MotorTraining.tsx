import { useSearchParams } from 'react-router-dom';
import { useT } from '../../i18n';
import { DrawingTowerDefenseGame } from './DrawingTowerDefenseGame';
import { GestureBattlerGame } from './GestureBattlerGame';
import { useGameModuleGuard } from './useGameModuleGuard';

type MotorModuleId = 'drawing-defense' | 'gesture-battler';

export function MotorTraining() {
  const { t } = useT();
  const [searchParams] = useSearchParams();
  const requestedGameId = searchParams.get('game');
  const requestedModule: MotorModuleId | null =
    requestedGameId === 'drawing-defense' || requestedGameId === 'gesture-battler'
      ? requestedGameId
      : null;
  const { activeModule, openModule, closeModule } = useGameModuleGuard<MotorModuleId>({
    requestedModule,
    basePath: '/motor-training',
  });

  if (activeModule === 'drawing-defense') {
    return <DrawingTowerDefenseGame onExit={closeModule} />;
  }

  if (activeModule === 'gesture-battler') {
    return <GestureBattlerGame onExit={closeModule} />;
  }

  return (
    <div className="page-content">
      <h1 className="section-title fade-in-up">{t('home.module.motor.title')}</h1>
      <p className="section-subtitle fade-in-up">{t('training.motor.subtitle')}</p>

      <div className="training-grid">
        <button className="card fade-in-up training-module-button" onClick={() => openModule('drawing-defense')}>
          <div className="card-icon">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 19l7-7 3 3-7 7-3-3z" />
              <path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18" />
              <path d="M2 2l7.586 7.586" />
              <circle cx="11" cy="11" r="2" />
            </svg>
          </div>
          <h2 className="card-title">{t('training.drawing.title')}</h2>
          <p className="card-desc">{t('training.drawing.desc')}</p>
          <div className="card-expand-hint">{t('training.startGame')}</div>
        </button>

        <button className="card fade-in-up training-module-button" onClick={() => openModule('gesture-battler')}>
          <div className="card-icon">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M7 11V5.5a1.5 1.5 0 0 1 3 0V10" />
              <path d="M10 9V3.5a1.5 1.5 0 0 1 3 0V9" />
              <path d="M13 9V4.5a1.5 1.5 0 0 1 3 0V10" />
              <path d="M16 10V7.5a1.5 1.5 0 0 1 3 0V14c0 4.4-2.8 7-7 7h-1c-2.2 0-3.7-.8-5-2.5L3.4 15a1.7 1.7 0 0 1 2.5-2.2L8 15" />
              <path d="M18.5 2.5l.6 1.2 1.3.2-.9.9.2 1.3-1.2-.6-1.2.6.2-1.3-.9-.9 1.3-.2.6-1.2z" />
            </svg>
          </div>
          <h2 className="card-title">{t('training.gesture.title')}</h2>
          <p className="card-desc">{t('training.gesture.desc')}</p>
          <div className="card-expand-hint">{t('training.startGame')}</div>
        </button>
      </div>
    </div>
  );
}

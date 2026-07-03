import { useT } from '../i18n';
import { useNavigate } from 'react-router-dom';
import { TrainingModuleCard } from './home/TrainingModuleCard';
import { TRAINING_MODULES } from './home/trainingModules';
import type { TrainingModuleId } from './home/trainingModules';

export function HomePage() {
  const { t } = useT();
  const navigate = useNavigate();

  const handleCardClick = (moduleId: TrainingModuleId) => {
    navigate(`/training?module=${moduleId}`);
  };

  return (
    <div className="page-content">
      <h1 className="section-title fade-in-up">{t('home.listTitle')}</h1>
      <p className="section-subtitle fade-in-up">{t('home.listSubtitle')}</p>

      <div className="training-grid">
        {TRAINING_MODULES.map((module) => (
          <TrainingModuleCard
            key={module.id}
            module={module}
            onSelect={handleCardClick}
            t={t}
          />
        ))}
      </div>
    </div>
  );
}

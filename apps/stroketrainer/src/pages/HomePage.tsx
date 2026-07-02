import { useState } from 'react';
import { useT } from '../i18n';
import { useNavigate } from 'react-router-dom';
import { UserSelector } from '../components/UserSelector';
import { getActiveUser } from '../utils/settings';
import { TrainingModuleCard } from './home/TrainingModuleCard';
import { TRAINING_MODULES } from './home/trainingModules';
import type { TrainingModuleId } from './home/trainingModules';

export function HomePage() {
  const { t } = useT();
  const navigate = useNavigate();
  const [activeUser, setActiveUserState] = useState(getActiveUser);

  const handleCardClick = (moduleId: TrainingModuleId) => {
    if (!activeUser) {
      alert(t('home.pleaseSelectUser'));
      return;
    }
    navigate(`/training?module=${moduleId}`);
  };

  return (
    <div className="page-content">
      <UserSelector onActiveUserChange={setActiveUserState} />

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

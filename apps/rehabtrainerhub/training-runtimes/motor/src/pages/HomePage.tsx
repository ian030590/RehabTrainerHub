import { useT } from '../i18n';
import { useNavigate } from 'react-router-dom';
import {
  TrainingModuleSelectionPage,
  type TrainingModuleSelectionItem,
} from '@rehab-trainer/ui/components/TrainingModuleSelectionPage';
import { trainingModules } from './home/trainingModules';
import type { TrainingModuleId } from './home/trainingModules';

export function HomePage() {
  const { t } = useT();
  const navigate = useNavigate();

  const handleCardClick = (moduleId: TrainingModuleId) => {
    navigate(`/training?module=${moduleId}`);
  };
  const modules: readonly TrainingModuleSelectionItem<TrainingModuleId>[] = trainingModules.map((module) => ({
    id: module.id,
    title: t(module.titleKey),
    description: t(module.descKey),
  }));

  return (
    <TrainingModuleSelectionPage
      title={t('home.listTitle')}
      subtitle={t('home.listSubtitle')}
      modules={modules}
      actionLabel={t('btn.selectModule')}
      onSelect={handleCardClick}
    />
  );
}

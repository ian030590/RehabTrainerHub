import type { TranslationKey } from '../../i18n';
import type { TrainingModuleCardData, TrainingModuleId } from './trainingModules';

type TFunction = (key: TranslationKey, params?: Record<string, string | number>) => string;

interface TrainingModuleCardProps {
  module: TrainingModuleCardData;
  onSelect: (moduleId: TrainingModuleId) => void;
  t: TFunction;
}

export function TrainingModuleCard({ module, onSelect, t }: TrainingModuleCardProps) {
  return (
    <div
      className="card fade-in-up"
      role="button"
      tabIndex={0}
      onClick={() => onSelect(module.id)}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onSelect(module.id);
        }
      }}
    >
      <div className="card-icon">{module.icon}</div>
      <div className="card-title">{t(module.titleKey)}</div>
      <div className="card-desc">{t(module.descKey)}</div>
      <div className="card-action">
        {t('btn.selectModule')}
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
        >
          <path d="M5 12h14M12 5l7 7-7 7" />
        </svg>
      </div>
    </div>
  );
}

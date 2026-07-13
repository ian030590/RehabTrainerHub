import type { ReactNode } from 'react';
import { SelectionCard } from './SelectionCard';

export interface TrainingModuleSelectionItem<TModuleId extends string> {
  id: TModuleId;
  title: ReactNode;
  description: ReactNode;
  icon: ReactNode;
  meta?: ReactNode;
  actionLabel?: ReactNode;
}

export interface TrainingModuleSelectionPageProps<TModuleId extends string> {
  title: ReactNode;
  subtitle?: ReactNode;
  modules: readonly TrainingModuleSelectionItem<TModuleId>[];
  selectedModuleId?: TModuleId | null;
  actionLabel?: ReactNode | ((module: TrainingModuleSelectionItem<TModuleId>) => ReactNode);
  className?: string;
  gridClassName?: string;
  cardClassName?: string;
  children?: ReactNode;
  onSelect: (moduleId: TModuleId) => void;
}

export function TrainingModuleSelectionPage<TModuleId extends string>({
  title,
  subtitle,
  modules,
  selectedModuleId = null,
  actionLabel,
  className = 'page-content',
  gridClassName = 'training-grid',
  cardClassName,
  children,
  onSelect,
}: TrainingModuleSelectionPageProps<TModuleId>) {
  return (
    <div className={className}>
      <h1 className="section-title fade-in-up">{title}</h1>
      {subtitle && <p className="section-subtitle fade-in-up">{subtitle}</p>}

      <div className={gridClassName}>
        {modules.map((module) => (
          <SelectionCard
            key={module.id}
            title={module.title}
            description={module.description}
            icon={module.icon}
            meta={module.meta}
            isSelected={selectedModuleId === module.id}
            actionLabel={typeof actionLabel === 'function' ? actionLabel(module) : actionLabel ?? module.actionLabel}
            className={cardClassName}
            onSelect={() => onSelect(module.id)}
          />
        ))}
      </div>
      {children}
    </div>
  );
}

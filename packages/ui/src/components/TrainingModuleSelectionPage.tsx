import type { ReactNode } from 'react';
import { SelectionCard } from './SelectionCard';

export interface TrainingModuleSelectionItem<TModuleId extends string> {
  id: TModuleId;
  title: ReactNode;
  description: ReactNode;
  meta?: ReactNode;
  actionLabel?: ReactNode;
  imageSrc?: string;
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
  onPreload?: (moduleId: TModuleId) => void;
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
  onPreload,
}: TrainingModuleSelectionPageProps<TModuleId>) {
  const pageClassName = [className, 'training-module-selection-page']
    .filter((value, index, values) => values.indexOf(value) === index)
    .join(' ');

  return (
    <main className={pageClassName} id="main-content">
      <h1 className="section-title fade-in-up">{title}</h1>
      {subtitle && <p className="section-subtitle fade-in-up">{subtitle}</p>}

      <div className={gridClassName}>
        {modules.map((module, index) => (
          <SelectionCard
            key={module.id}
            title={module.title}
            description={module.description}
            index={index + 1}
            meta={module.meta}
            imageSrc={module.imageSrc}
            isSelected={selectedModuleId === module.id}
            actionLabel={typeof actionLabel === 'function' ? actionLabel(module) : actionLabel ?? module.actionLabel}
            className={cardClassName}
            onSelect={() => onSelect(module.id)}
            onPreload={onPreload ? () => onPreload(module.id) : undefined}
          />
        ))}
      </div>
      {children && <div className="training-module-overlay-content">{children}</div>}
    </main>
  );
}

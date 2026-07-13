import type { ReactNode } from 'react';

export interface TrainingConfigSummaryItem {
  label?: ReactNode;
  value: ReactNode;
}

export interface TrainingConfigSummaryProps {
  title?: ReactNode;
  items: readonly TrainingConfigSummaryItem[];
}

export function TrainingConfigSummary({ items }: TrainingConfigSummaryProps) {
  return (
    <div className="config-summary">
      {items.map((item, index) => (
        <span key={index}>{item.value}</span>
      ))}
    </div>
  );
}

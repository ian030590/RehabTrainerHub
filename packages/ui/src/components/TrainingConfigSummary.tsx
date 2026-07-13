import type { ReactNode } from 'react';

export interface TrainingConfigSummaryItem {
  label: ReactNode;
  value: ReactNode;
}

export interface TrainingConfigSummaryProps {
  title: ReactNode;
  items: readonly TrainingConfigSummaryItem[];
}

export function TrainingConfigSummary({ title, items }: TrainingConfigSummaryProps) {
  return (
    <div className="config-summary">
      <strong>{title}</strong>
      {items.map((item, index) => (
        <span key={index}>
          {item.label}: {item.value}
        </span>
      ))}
    </div>
  );
}

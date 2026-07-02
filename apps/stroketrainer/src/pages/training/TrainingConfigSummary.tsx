import type { ReactNode } from 'react';

export interface TrainingConfigSummaryItem {
  label: string;
  value: ReactNode;
}

interface TrainingConfigSummaryProps {
  title: string;
  items: TrainingConfigSummaryItem[];
}

export function TrainingConfigSummary({ title, items }: TrainingConfigSummaryProps) {
  return (
    <div className="training-config-summary">
      <strong>{title}</strong>
      {items.map((item) => (
        <span key={item.label}>
          {item.label}: {item.value}
        </span>
      ))}
    </div>
  );
}

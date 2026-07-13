import type { ReactNode } from 'react';

export interface ResultSummaryItem {
  label: ReactNode;
  value: ReactNode;
  emphasize?: boolean;
  meta?: ReactNode;
}

export interface ResultSummaryProps {
  items: readonly ResultSummaryItem[];
  className?: string;
}

export function ResultSummary({ items, className = '' }: ResultSummaryProps) {
  return (
    <div className={`results-summary ${className}`.trim()}>
      {items.map((item, index) => (
        <span key={index}>
          {item.label}{' '}
          <b className={item.emphasize === false ? undefined : 'results-summary-value'}>
            {item.value}
          </b>
          {item.meta}
        </span>
      ))}
    </div>
  );
}

import type { ReactNode } from 'react';

export interface ResultSummaryItem {
  label: ReactNode;
  value: ReactNode;
  emphasize?: boolean;
}

interface ResultSummaryProps {
  items: readonly ResultSummaryItem[];
}

export function ResultSummary({ items }: ResultSummaryProps) {
  return (
    <div className="results-summary">
      {items.map((item, index) => (
        <span key={index}>
          {item.label}{' '}
          <b className={item.emphasize === false ? undefined : 'results-summary-value'}>
            {item.value}
          </b>
        </span>
      ))}
    </div>
  );
}

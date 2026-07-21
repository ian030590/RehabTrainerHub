import type { ReactNode } from 'react';

export interface SelectionCardProps {
  title: ReactNode;
  description: ReactNode;
  index: number;
  isSelected?: boolean;
  disabled?: boolean;
  actionLabel?: ReactNode;
  meta?: ReactNode;
  className?: string;
  onSelect: () => void;
}

export function SelectionCard({
  title,
  description,
  index,
  isSelected = false,
  disabled = false,
  actionLabel,
  meta,
  className = '',
  onSelect,
}: SelectionCardProps) {
  return (
    <button
      type="button"
      className={`card selection-card fade-in-up ${isSelected ? 'card-active' : ''} ${className}`.trim()}
      aria-expanded={isSelected}
      disabled={disabled}
      onClick={onSelect}
    >
      <span className="card-icon" aria-hidden="true">{index}</span>
      <span className="card-title">{title}</span>
      <span className="card-desc">{description}</span>
      {meta && <span className="card-meta">{meta}</span>}
      {actionLabel && (
        <span className="card-action">
          {actionLabel}
          {!disabled && (
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              className={isSelected ? 'card-action-icon is-expanded' : 'card-action-icon'}
              aria-hidden="true"
            >
              <path d="M6 9l6 6 6-6" />
            </svg>
          )}
        </span>
      )}
    </button>
  );
}

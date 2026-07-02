import type { ButtonHTMLAttributes, ReactNode } from 'react';

interface StartTrainingButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
}

export function StartTrainingButton({
  children,
  className = '',
  type = 'button',
  ...props
}: StartTrainingButtonProps) {
  return (
    <button
      {...props}
      type={type}
      className={`btn btn-primary btn-lg config-start-btn ${className}`.trim()}
    >
      <svg
        className="config-start-icon"
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="currentColor"
        aria-hidden="true"
      >
        <path d="M7 4.8v14.4L18.5 12 7 4.8Z" />
      </svg>
      <span>{children}</span>
    </button>
  );
}

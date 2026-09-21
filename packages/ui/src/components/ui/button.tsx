import * as React from 'react';
import { cn } from '../../lib/cn';

const baseClassName = 'inline-flex min-h-11 items-center justify-center gap-2 rounded-[var(--radius)] px-4 py-2 text-sm font-extrabold outline-none transition-[background-color,border-color,box-shadow,color,transform] duration-200 focus-visible:ring-2 focus-visible:ring-[var(--focus)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--surface)] active:translate-y-px disabled:pointer-events-none disabled:opacity-50';
const variantClassNames = {
  default: 'border border-[var(--primary)] bg-[var(--primary)] text-[var(--text-on-accent)] hover:bg-[var(--primary-hover)]',
  outline: 'border border-[var(--border-strong)] bg-[var(--surface)] text-[var(--heading)] hover:border-[var(--primary)] hover:text-[var(--primary)]',
  ghost: 'border border-transparent bg-transparent text-[var(--text-muted)] hover:bg-[var(--surface-muted)] hover:text-[var(--heading)]',
} as const;
const sizeClassNames = {
  default: 'min-h-11 px-4',
  sm: 'min-h-9 px-3 text-xs',
  lg: 'min-h-12 px-6 text-base',
} as const;

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  size?: keyof typeof sizeClassNames;
  variant?: keyof typeof variantClassNames;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, size = 'default', variant = 'default', ...props }, ref) => (
    <button
      className={cn(baseClassName, variantClassNames[variant], sizeClassNames[size], className)}
      ref={ref}
      {...props}
    />
  ),
);
Button.displayName = 'Button';

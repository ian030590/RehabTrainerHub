import type { AriaRole, ReactNode } from 'react';

interface InlineAlertProps { children: ReactNode; tone?: 'error' | 'warning' | 'info'; className?: string; onClick?: () => void; role?: AriaRole; 'aria-label'?: string; }

export function InlineAlert({ children, tone = 'info', className = '', onClick, ...props }: InlineAlertProps) {
  const classes = `inline-alert inline-alert-${tone} ${onClick ? 'inline-alert-action' : ''} ${className}`.trim();
  return onClick ? <button {...props} type="button" className={classes} onClick={onClick}>{children}</button> : <div {...props} className={classes}>{children}</div>;
}

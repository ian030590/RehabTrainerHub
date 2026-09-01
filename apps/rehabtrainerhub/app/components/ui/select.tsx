'use client';

import * as React from 'react';
import * as SelectPrimitive from '@radix-ui/react-select';
import { cn } from '../../lib/cn';

export const Select = SelectPrimitive.Root;
export const SelectValue = SelectPrimitive.Value;

export const SelectTrigger = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Trigger>
>(({ children, className, ...props }, ref) => (
  <SelectPrimitive.Trigger
    className={cn(
      'flex min-h-11 w-full items-center justify-between gap-3 rounded-[var(--radius)] border border-[var(--border-strong)] bg-[var(--surface)] px-3 py-2 text-left text-sm font-bold text-[var(--heading)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus)] disabled:cursor-not-allowed disabled:opacity-50',
      className,
    )}
    ref={ref}
    {...props}
  >
    {children}
    <SelectPrimitive.Icon aria-hidden="true" className="text-[var(--text-muted)]">⌄</SelectPrimitive.Icon>
  </SelectPrimitive.Trigger>
));
SelectTrigger.displayName = SelectPrimitive.Trigger.displayName;

export const SelectContent = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Content> & {
    portalContainer?: HTMLElement | null;
  }
>(({ children, className, portalContainer, position = 'popper', ...props }, ref) => (
  <SelectPrimitive.Portal container={portalContainer ?? undefined}>
    <SelectPrimitive.Content
      className={cn(
        'z-[230] max-h-72 min-w-[var(--radix-select-trigger-width)] overflow-hidden rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)] p-1 text-[var(--text)] shadow-[var(--shadow-md)]',
        position === 'popper' && 'translate-y-1',
        className,
      )}
      position={position}
      ref={ref}
      {...props}
    >
      <SelectPrimitive.Viewport>{children}</SelectPrimitive.Viewport>
    </SelectPrimitive.Content>
  </SelectPrimitive.Portal>
));
SelectContent.displayName = SelectPrimitive.Content.displayName;

export const SelectItem = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Item>
>(({ children, className, ...props }, ref) => (
  <SelectPrimitive.Item
    className={cn(
      'relative flex min-h-10 cursor-default select-none items-center rounded-[6px] py-2 pr-8 pl-3 text-sm font-semibold outline-none data-[disabled]:pointer-events-none data-[disabled]:opacity-50 data-[highlighted]:bg-[var(--primary-soft)] data-[highlighted]:text-[var(--heading)]',
      className,
    )}
    ref={ref}
    {...props}
  >
    <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
    <SelectPrimitive.ItemIndicator className="absolute right-3 text-[var(--primary)]">✓</SelectPrimitive.ItemIndicator>
  </SelectPrimitive.Item>
));
SelectItem.displayName = SelectPrimitive.Item.displayName;

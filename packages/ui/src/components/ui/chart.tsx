'use client';

import type { ComponentProps, CSSProperties } from 'react';
import { ResponsiveContainer } from 'recharts';
import { cn } from '../../lib/cn';

export type ChartConfig = Record<string, { label: string; color: string }>;

// shadcn/ui composition: Recharts stays directly accessible to consumers.
export function ChartContainer({ config, children, className, ...props }: ComponentProps<'div'> & {
  config: ChartConfig;
  children: ComponentProps<typeof ResponsiveContainer>['children'];
}) {
  const style = Object.fromEntries(Object.entries(config).map(([key, value]) => [`--color-${key}`, value.color])) as CSSProperties;
  return <div data-slot="chart" className={cn('h-64 w-full text-xs [&_.recharts-cartesian-axis-tick_text]:fill-[var(--text-muted)] [&_.recharts-cartesian-grid_line]:stroke-[var(--border)]', className)} style={style} {...props}>
    <ResponsiveContainer width="100%" height="100%">{children}</ResponsiveContainer>
  </div>;
}

export { Tooltip as ChartTooltip } from 'recharts';

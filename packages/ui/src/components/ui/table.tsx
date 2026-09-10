import type { ComponentProps } from 'react';
import { cn } from '../../lib/cn';

// shadcn/ui table primitives, using the shared platform theme.
export function Table({ className, ...props }: ComponentProps<'table'>) {
  return <div className="relative w-full overflow-x-auto"><table data-slot="table" className={cn('w-full caption-bottom text-sm', className)} {...props} /></div>;
}
export function TableHeader(props: ComponentProps<'thead'>) {
  return <thead data-slot="table-header" className="[&_tr]:border-b" {...props} />;
}
export function TableBody(props: ComponentProps<'tbody'>) {
  return <tbody data-slot="table-body" className="[&_tr:last-child]:border-0" {...props} />;
}
export function TableRow(props: ComponentProps<'tr'>) {
  return <tr data-slot="table-row" className="border-b border-[var(--border)] hover:bg-[var(--surface-muted)]" {...props} />;
}
export function TableHead(props: ComponentProps<'th'>) {
  return <th data-slot="table-head" scope="col" className="h-11 px-3 text-start font-semibold whitespace-nowrap text-[var(--text-muted)]" {...props} />;
}
export function TableCell(props: ComponentProps<'td'>) {
  return <td data-slot="table-cell" className="p-3 align-middle tabular-nums" {...props} />;
}

'use client';

import { motion } from 'motion/react';
import type { ReactNode } from 'react';

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Duration, EASE_OUT, MAX_STAGGERED_ITEMS } from '@/lib/constants/motion.constants';
import { cn } from '@/lib/utils';

export type Column<T> = { key: string; header: string; cell: (row: T) => ReactNode; className?: string; hideOnCard?: boolean };

const ROW_STEP = 0.03;

const CARD_CLASS = 'flex flex-col gap-3 rounded-xl border border-[#eef2f6] bg-card p-4 shadow-card';

function CardBody<T>({ row, columns, title }: { row: T; columns: Column<T>[]; title: (row: T) => ReactNode }) {
  return (
    <>
      <span className="block font-semibold text-foreground">{title(row)}</span>
      <dl className="grid grid-cols-2 gap-x-3 gap-y-2 text-[13px]">
        {columns
          .filter((column) => !column.hideOnCard)
          .map((column) => (
            <div key={column.key} className="contents">
              <dt className="text-muted-foreground">{column.header}</dt>
              <dd className="text-right font-medium">{column.cell(row)}</dd>
            </div>
          ))}
      </dl>
    </>
  );
}

const rowMotion = (index: number) => ({ initial: { opacity: 0, y: 6 }, animate: { opacity: 1, y: 0 }, transition: { delay: Math.min(index, MAX_STAGGERED_ITEMS) * ROW_STEP, duration: Duration.Base, ease: EASE_OUT } }) as const;

export function ResponsiveList<T>({ rows, columns, rowKey, title, onRowClick, empty, footer }: { rows: T[]; columns: Column<T>[]; rowKey: (row: T) => string; title: (row: T) => ReactNode; onRowClick?: (row: T) => void; empty?: ReactNode; footer?: ReactNode }) {
  if (rows.length === 0) return <>{empty}</>;
  return (
    <>
      <div className="hidden overflow-hidden rounded-2xl border border-[#eef2f6] bg-card shadow-card md:block">
        <Table>
          <TableHeader>
            <TableRow>
              {columns.map((column) => (
                <TableHead key={column.key} className={column.className}>
                  {column.header}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row, index) => (
              <motion.tr key={rowKey(row)} {...rowMotion(index)} data-slot="table-row" className={cn('border-b border-border/60 transition-colors hover:bg-background', onRowClick && 'cursor-pointer')} onClick={onRowClick ? () => onRowClick(row) : undefined}>
                {columns.map((column) => (
                  <TableCell key={column.key} className={column.className}>
                    {column.cell(row)}
                  </TableCell>
                ))}
              </motion.tr>
            ))}
          </TableBody>
        </Table>
        {footer ? <div className="flex items-center justify-between gap-2 border-t border-border/60 px-4 py-3 text-[13px] text-muted-foreground">{footer}</div> : null}
      </div>
      <ul className="flex flex-col gap-2 md:hidden">
        {rows.map((row, index) => (
          <motion.li key={rowKey(row)} {...rowMotion(index)}>
            {onRowClick ? (
              <button type="button" className={cn(CARD_CLASS, 'w-full cursor-pointer text-left active:scale-[0.99]')} onClick={() => onRowClick(row)}>
                <CardBody row={row} columns={columns} title={title} />
              </button>
            ) : (
              <div className={CARD_CLASS}>
                <CardBody row={row} columns={columns} title={title} />
              </div>
            )}
          </motion.li>
        ))}
        {footer ? <li className="px-1 text-center text-xs text-muted-foreground">{footer}</li> : null}
      </ul>
    </>
  );
}

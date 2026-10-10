import type { ReactNode } from 'react';

import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

export type Column<T> = { key: string; header: string; cell: (row: T) => ReactNode; className?: string; hideOnCard?: boolean };

export function ResponsiveList<T>({ rows, columns, rowKey, title, onRowClick, empty }: { rows: T[]; columns: Column<T>[]; rowKey: (row: T) => string; title: (row: T) => ReactNode; onRowClick?: (row: T) => void; empty?: ReactNode }) {
  if (rows.length === 0) return <>{empty}</>;
  return (
    <>
      <div className="hidden overflow-hidden rounded-xl border bg-card md:block">
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
            {rows.map((row) => (
              <TableRow key={rowKey(row)} className={onRowClick ? 'cursor-pointer' : undefined} onClick={onRowClick ? () => onRowClick(row) : undefined}>
                {columns.map((column) => (
                  <TableCell key={column.key} className={column.className}>
                    {column.cell(row)}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <ul className="flex flex-col gap-2 md:hidden">
        {rows.map((row) => (
          <li key={rowKey(row)}>
            <Card className={onRowClick ? 'cursor-pointer active:bg-muted/50' : undefined} onClick={onRowClick ? () => onRowClick(row) : undefined}>
              <CardContent className="flex flex-col gap-2">
                <div className="font-medium">{title(row)}</div>
                <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-sm">
                  {columns
                    .filter((column) => !column.hideOnCard)
                    .map((column) => (
                      <div key={column.key} className="contents">
                        <dt className="text-muted-foreground">{column.header}</dt>
                        <dd className="text-right">{column.cell(row)}</dd>
                      </div>
                    ))}
                </dl>
              </CardContent>
            </Card>
          </li>
        ))}
      </ul>
    </>
  );
}

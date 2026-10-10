'use client';

import type { ReactNode } from 'react';

import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';

type Props = { open: boolean; onOpenChange: (open: boolean) => void; title: string; description?: string; children: ReactNode; footer?: ReactNode };

export function DetailSheet({ open, onOpenChange, title, description, children, footer }: Props) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full gap-0 p-0 sm:max-w-md">
        <SheetHeader className="border-b border-subtle p-4">
          <SheetTitle className="font-heading text-lg font-semibold text-navy">{title}</SheetTitle>
          {description ? <SheetDescription>{description}</SheetDescription> : null}
        </SheetHeader>
        <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-4">{children}</div>
        {footer ? <div className="flex flex-wrap gap-2 border-t border-subtle p-4 safe-bottom">{footer}</div> : null}
      </SheetContent>
    </Sheet>
  );
}

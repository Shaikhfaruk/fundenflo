'use client';

import { AnimatePresence, motion } from 'motion/react';
import type { ReactNode } from 'react';

import { SPRING } from '@/lib/constants/motion.constants';

export function ZoomIn({ show, children, className }: { show: boolean; children: ReactNode; className?: string }) {
  return (
    <AnimatePresence initial={false}>
      {show ? (
        <motion.span key="zoom" className={className} initial={{ scale: 0.4, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.4, opacity: 0 }} transition={SPRING}>
          {children}
        </motion.span>
      ) : null}
    </AnimatePresence>
  );
}

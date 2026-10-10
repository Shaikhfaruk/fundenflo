'use client';

import { MotionConfig } from 'motion/react';
import type { ReactNode } from 'react';

import { Duration, EASE_OUT } from '@/lib/constants/motion.constants';

export function MotionProvider({ children }: { children: ReactNode }) {
  return (
    <MotionConfig reducedMotion="user" transition={{ duration: Duration.Base, ease: EASE_OUT }}>
      {children}
    </MotionConfig>
  );
}

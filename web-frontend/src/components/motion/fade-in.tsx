'use client';

import { motion, type HTMLMotionProps } from 'motion/react';

import { Duration, ENTRY_OFFSET, EASE_OUT } from '@/lib/constants/motion.constants';

type Props = HTMLMotionProps<'div'> & { delay?: number; offset?: number; duration?: number };

export function FadeIn({ delay = 0, offset = -ENTRY_OFFSET, duration = Duration.Base, children, ...props }: Props) {
  return (
    <motion.div initial={{ opacity: 0, y: offset }} animate={{ opacity: 1, y: 0 }} transition={{ delay, duration, ease: EASE_OUT }} {...props}>
      {children}
    </motion.div>
  );
}

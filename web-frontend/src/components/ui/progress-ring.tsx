'use client';

import { motion } from 'motion/react';
import type { ReactNode } from 'react';

import { Duration, EASE_OUT } from '@/lib/constants/motion.constants';
import { cn } from '@/lib/utils';

type Props = { progress: number; size: number; stroke: number; className?: string; trackClassName?: string; barClassName?: string; children?: ReactNode; label?: string };

export function ProgressRing({ progress, size, stroke, className, trackClassName = 'stroke-subtle', barClassName = 'stroke-gold', children, label }: Props) {
  const radius = (size - stroke) / 2;
  const value = Math.max(0, Math.min(1, progress));
  return (
    <div className={cn('relative inline-flex shrink-0 items-center justify-center', className)} style={{ width: size, height: size }} role={label ? 'img' : undefined} aria-label={label}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90" aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" strokeWidth={stroke} className={trackClassName} />
        {value > 0 ? (
          <motion.circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            strokeWidth={stroke}
            strokeLinecap="round"
            className={barClassName}
            initial={{ pathLength: 0 }}
            animate={{ pathLength: value }}
            transition={{ duration: Duration.Count, ease: EASE_OUT }}
          />
        ) : null}
      </svg>
      {children ? <div className="absolute inset-0 flex flex-col items-center justify-center">{children}</div> : null}
    </div>
  );
}

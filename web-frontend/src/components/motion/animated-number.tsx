'use client';

import { animate, useInView, useMotionValue, useMotionValueEvent, useReducedMotion } from 'motion/react';
import { useEffect, useRef, useState } from 'react';

import { Duration, EASE_OUT } from '@/lib/constants/motion.constants';

export function AnimatedNumber({ value, format, className }: { value: number; format: (value: number) => string; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true });
  const reduced = useReducedMotion();
  const current = useMotionValue(0);
  const [shown, setShown] = useState(() => format(0));
  useMotionValueEvent(current, 'change', (latest) => setShown(format(Math.round(latest))));
  useEffect(() => {
    if (!inView) return undefined;
    if (reduced) {
      current.set(value);
      return undefined;
    }
    const controls = animate(current, value, { duration: Duration.Count, ease: EASE_OUT });
    return () => controls.stop();
  }, [inView, reduced, value, current]);
  return (
    <span ref={ref} className={className} aria-label={format(value)}>
      {shown}
    </span>
  );
}

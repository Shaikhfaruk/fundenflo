'use client';

import { motion, type HTMLMotionProps, type Variants } from 'motion/react';

import { Duration, ENTRY_OFFSET, EASE_OUT, STAGGER_STEP } from '@/lib/constants/motion.constants';

const container = (delay: number, step: number): Variants => ({ hidden: {}, shown: { transition: { delayChildren: delay, staggerChildren: step } } });

const item: Variants = {
  hidden: { opacity: 0, y: -ENTRY_OFFSET },
  shown: { opacity: 1, y: 0, transition: { duration: Duration.Base, ease: EASE_OUT } },
};

type Timing = { delay?: number; step?: number };

export function Stagger({ delay = 0, step = STAGGER_STEP, ...props }: HTMLMotionProps<'div'> & Timing) {
  return <motion.div initial="hidden" animate="shown" variants={container(delay, step)} {...props} />;
}

export function StaggerList({ delay = 0, step = STAGGER_STEP, ...props }: HTMLMotionProps<'ul'> & Timing) {
  return <motion.ul initial="hidden" animate="shown" variants={container(delay, step)} {...props} />;
}

export function StaggerItem(props: HTMLMotionProps<'div'>) {
  return <motion.div variants={item} {...props} />;
}

export function StaggerListItem(props: HTMLMotionProps<'li'>) {
  return <motion.li variants={item} {...props} />;
}

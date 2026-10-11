export const Duration = {
  Fast: 0.18,
  Base: 0.36,
  Slow: 0.5,
  Count: 0.9,
  Ring: 0.6,
} as const;

export const EASE_OUT = [0.22, 1, 0.36, 1] as const;

export const STAGGER_STEP = 0.06;

export const ENTRY_OFFSET = 16;

export const SPRING = { type: 'spring', stiffness: 420, damping: 32, mass: 0.8 } as const;

export const SOFT_SPRING = { type: 'spring', stiffness: 260, damping: 28 } as const;

export const MAX_STAGGERED_ITEMS = 12;

export const ERROR_TOAST_DURATION_MS = 8_000;

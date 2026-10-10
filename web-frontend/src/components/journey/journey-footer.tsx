'use client';

import { AnimatePresence, motion } from 'motion/react';
import type { ReactNode } from 'react';

import { Button } from '@/components/ui/button';
import { Icon, type IconName } from '@/components/ui/icon';
import { SecureNote } from '@/components/ui/secure-note';
import { Spinner } from '@/components/ui/spinner';

type Props = { label: string; onContinue: () => void; disabled?: boolean; pending?: boolean; hint?: string | null; error?: string | null; note: string; icon?: IconName; secondary?: ReactNode };

export function JourneyFooter({ label, onContinue, disabled, pending, hint, error, note, icon = 'arrow-forward', secondary }: Props) {
  return (
    <div className="flex flex-col gap-3 pt-4">
      <AnimatePresence initial={false} mode="wait">
        {error ? (
          <motion.p key="error" initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="flex items-center gap-1.5 rounded-sm bg-[#fff1ef] px-3 py-2 text-xs text-destructive" role="alert">
            <Icon name="error" size={15} />
            {error}
          </motion.p>
        ) : hint && disabled ? (
          <motion.p key="hint" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="text-center text-xs text-muted-foreground" aria-live="polite">
            {hint}
          </motion.p>
        ) : null}
      </AnimatePresence>
      <Button className="w-full" disabled={disabled || pending} onClick={onContinue}>
        {pending ? <Spinner /> : null}
        {label}
        {pending ? null : <Icon name={icon} size={18} />}
      </Button>
      {secondary}
      <SecureNote>{note}</SecureNote>
    </div>
  );
}

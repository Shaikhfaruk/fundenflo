'use client';

import { AnimatePresence, motion } from 'motion/react';
import { useTranslations } from 'next-intl';
import { useId, useState } from 'react';

import { ZoomIn } from '@/components/motion/zoom-in';
import { Icon, type IconName } from '@/components/ui/icon';
import { IconTile } from '@/components/ui/icon-tile';
import { LoginAs } from '@/lib/constants/auth.constants';
import { Duration, EASE_OUT } from '@/lib/constants/motion.constants';
import { cn } from '@/lib/utils';

import { FIELD_SURFACE } from '../ui/field-surface';

const SIGN_IN_ROLES: readonly { id: LoginAs; icon: IconName }[] = [
  { id: LoginAs.Borrower, icon: 'person' },
  { id: LoginAs.Dsa, icon: 'store' },
  { id: LoginAs.Ca, icon: 'receipt' },
  { id: LoginAs.Lender, icon: 'bank' },
];

export function RolePicker({ value, onChange }: { value: LoginAs; onChange: (role: LoginAs) => void }) {
  const t = useTranslations('auth.login.roles');
  const tLogin = useTranslations('auth.login');
  const [open, setOpen] = useState(false);
  const menuId = useId();
  const selected = SIGN_IN_ROLES.find((role) => role.id === value) ?? SIGN_IN_ROLES[0];
  return (
    <div className="flex flex-col">
      <button type="button" aria-expanded={open} aria-controls={menuId} aria-label={tLogin('as')} onClick={() => setOpen((current) => !current)} className={cn('flex h-[54px] w-full items-center gap-2.5 px-3 text-left', FIELD_SURFACE, open && 'border-navy bg-card')}>
        <IconTile icon={selected.icon} size="sm" tone="subtle" />
        <span className="flex-1 truncate text-base font-semibold text-foreground">{t(`${selected.id}.label`)}</span>
        <motion.span animate={{ rotate: open ? 180 : 0 }} transition={{ duration: Duration.Fast }} className="flex text-muted-foreground">
          <Icon name="expand-more" size={20} />
        </motion.span>
      </button>
      <AnimatePresence initial={false}>
        {open ? (
          <motion.div key="menu" initial={{ opacity: 0, height: 0, y: -6 }} animate={{ opacity: 1, height: 'auto', y: 0 }} exit={{ opacity: 0, height: 0, transition: { duration: 0.12 } }} transition={{ duration: 0.22, ease: EASE_OUT }} className="overflow-hidden">
            <div id={menuId} className="mt-2 overflow-hidden rounded-xl border border-border bg-card shadow-card">
              {SIGN_IN_ROLES.map((role) => {
                const on = role.id === value;
                return (
                  <button
                    key={role.id}
                    type="button"
                    aria-pressed={on}
                    onClick={() => {
                      onChange(role.id);
                      setOpen(false);
                    }}
                    className={cn('flex w-full items-center gap-2.5 px-3 py-3 text-left transition-colors hover:bg-background focus-visible:bg-background focus-visible:outline-none', on && 'bg-background')}
                  >
                    <IconTile icon={role.icon} size="sm" tone={on ? 'goldSoft' : 'subtle'} className={on ? 'text-navy' : undefined} />
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className={cn('text-[15px] font-semibold text-foreground', on && 'text-navy')}>{t(`${role.id}.label`)}</span>
                      <span className="text-xs text-muted-foreground">{t(`${role.id}.hint`)}</span>
                    </span>
                    <ZoomIn show={on} className="flex text-gold-deep">
                      <Icon name="check" size={18} />
                    </ZoomIn>
                  </button>
                );
              })}
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

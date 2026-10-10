'use client';

import { type ComponentProps, useState } from 'react';

import { Icon, type IconName } from '@/components/ui/icon';
import { cn } from '@/lib/utils';

import { FIELD_SURFACE } from './field-surface';

type Props = ComponentProps<'input'> & { icon: IconName; revealLabel?: { show: string; hide: string } };

export function IconInput({ icon, revealLabel, type, className, ...props }: Props) {
  const [revealed, setRevealed] = useState(false);
  const secret = type === 'password';
  return (
    <div aria-invalid={props['aria-invalid']} className={cn('flex h-[54px] w-full items-center gap-2.5 px-3.5 text-muted-foreground focus-within:text-navy', FIELD_SURFACE, className)}>
      <Icon name={icon} size={20} />
      <input type={secret && revealed ? 'text' : type} className="h-full min-w-0 flex-1 bg-transparent text-base font-medium text-foreground outline-none placeholder:text-muted-foreground/60" {...props} />
      {secret && revealLabel ? (
        <button type="button" onClick={() => setRevealed((value) => !value)} aria-label={revealed ? revealLabel.hide : revealLabel.show} aria-pressed={revealed} className="-mr-1.5 flex size-9 items-center justify-center rounded-md text-muted-foreground hover:bg-subtle hover:text-navy">
          <Icon name={revealed ? 'visibility-off' : 'visibility'} size={20} />
        </button>
      ) : null}
    </div>
  );
}

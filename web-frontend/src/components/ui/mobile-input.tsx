'use client';

import type { ComponentProps } from 'react';

import { ZoomIn } from '@/components/motion/zoom-in';
import { Icon } from '@/components/ui/icon';
import { DEFAULT_COUNTRY_CODE, MOBILE_DIGITS, MOBILE_GROUP_SPLIT } from '@/lib/constants/auth.constants';
import { cn } from '@/lib/utils';

import { FIELD_SURFACE } from './field-surface';

type Props = Omit<ComponentProps<'input'>, 'value' | 'onChange' | 'type'> & { value: string; onValueChange: (digits: string) => void; valid?: boolean; invalid?: boolean };

const grouped = (digits: string) => (digits.length > MOBILE_GROUP_SPLIT ? `${digits.slice(0, MOBILE_GROUP_SPLIT)} ${digits.slice(MOBILE_GROUP_SPLIT)}` : digits);

export function MobileInput({ value, onValueChange, valid, invalid, className, ...props }: Props) {
  return (
    <div aria-invalid={invalid || undefined} className={cn('flex h-[54px] w-full items-center px-3.5', FIELD_SURFACE, className)}>
      <span className="flex h-3.5 w-5 shrink-0 flex-col overflow-hidden rounded-[2px] shadow-[0_0_0_0.5px_rgba(10,25,47,0.15)]" aria-hidden="true">
        <span className="flex-1 bg-[#ff9933]" />
        <span className="flex flex-1 items-center justify-center bg-white">
          <span className="size-1 rounded-full bg-[#000080]" />
        </span>
        <span className="flex-1 bg-[#128807]" />
      </span>
      <span className="ml-2 text-[15px] font-semibold text-foreground tabular">{DEFAULT_COUNTRY_CODE}</span>
      <span className="mx-3 h-5 w-px shrink-0 bg-border" aria-hidden="true" />
      <input
        type="tel"
        inputMode="numeric"
        autoComplete="tel-national"
        maxLength={MOBILE_DIGITS + 1}
        value={grouped(value)}
        onChange={(event) => onValueChange(event.target.value.replaceAll(/\D/g, '').slice(0, MOBILE_DIGITS))}
        aria-invalid={invalid || undefined}
        className="h-full min-w-0 flex-1 bg-transparent text-[17px] font-medium tracking-[0.06em] text-foreground tabular outline-none placeholder:text-muted-foreground/50"
        {...props}
      />
      <ZoomIn show={Boolean(valid)} className="flex text-success">
        <Icon name="check-circle" size={20} />
      </ZoomIn>
    </div>
  );
}

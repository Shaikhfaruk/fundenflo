'use client';

import { Slider as SliderPrimitive } from '@base-ui/react/slider';

import { cn } from '@/lib/utils';

type Props = { value: number; min: number; max: number; step: number; onValueChange: (value: number) => void; onValueCommitted?: (value: number) => void; label: string; valueText?: (value: number) => string; className?: string };

export function Slider({ value, min, max, step, onValueChange, onValueCommitted, label, valueText, className }: Props) {
  return (
    <SliderPrimitive.Root value={value} min={min} max={max} step={step} onValueChange={(next) => onValueChange(next)} onValueCommitted={(next) => onValueCommitted?.(next)} className={cn('w-full', className)}>
      <SliderPrimitive.Control className="flex h-11 w-full touch-none items-center select-none">
        <SliderPrimitive.Track className="relative h-2 w-full rounded-full bg-[#e5e9ef]">
          <SliderPrimitive.Indicator className="rounded-full bg-gold/40" />
          <SliderPrimitive.Thumb
            getAriaLabel={() => label}
            getAriaValueText={valueText ? (_, current) => valueText(current) : undefined}
            className="size-6 rounded-full border-[3px] border-white bg-gold shadow-[0_2px_6px_rgba(10,25,47,0.25)] transition-transform outline-none focus-visible:ring-4 focus-visible:ring-gold/40 active:scale-110 data-dragging:scale-110"
          />
        </SliderPrimitive.Track>
      </SliderPrimitive.Control>
    </SliderPrimitive.Root>
  );
}

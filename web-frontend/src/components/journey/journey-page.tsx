'use client';

import type { ReactNode } from 'react';

import { FadeIn } from '@/components/motion/fade-in';
import { Eyebrow } from '@/components/ui/eyebrow';
import { StepHeader } from '@/components/ui/step-header';
import { JOURNEY_TOTAL_STEPS } from '@/lib/constants/journey.constants';
import { RoutePath } from '@/lib/constants/routes.constants';

type Props = { applicationId: string; step: number; eyebrow?: string; icon?: ReactNode; title: string; description?: string; onBack?: () => void; children: ReactNode };

export function JourneyPage({ applicationId, step, eyebrow, icon, title, description, onBack, children }: Props) {
  return (
    <div className="mx-auto flex w-full max-w-[560px] flex-1 flex-col">
      <StepHeader step={step} total={JOURNEY_TOTAL_STEPS} onBack={onBack} backHref={onBack ? undefined : RoutePath.application(applicationId)} />
      <FadeIn className="mt-4">
        {icon ? <div className="mb-3">{icon}</div> : null}
        {eyebrow ? <Eyebrow className="mb-2">{eyebrow}</Eyebrow> : null}
        <h1 className="font-heading text-2xl leading-8 font-semibold tracking-[-0.01em] text-foreground">{title}</h1>
        {description ? <p className="mt-2 text-sm leading-[22px] text-muted-foreground">{description}</p> : null}
      </FadeIn>
      <div className="mt-4 flex flex-1 flex-col">{children}</div>
    </div>
  );
}

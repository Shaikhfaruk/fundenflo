'use client';

import { createContext, type ReactNode, use } from 'react';

import { JourneyMode } from '@/lib/constants/journey.constants';
import { JOURNEY_PATHS } from '@/lib/constants/routes.constants';

const JourneyModeContext = createContext<JourneyMode>(JourneyMode.Borrower);

export function JourneyModeProvider({ mode, children }: { mode: JourneyMode; children: ReactNode }) {
  return <JourneyModeContext value={mode}>{children}</JourneyModeContext>;
}

export const usePartnerMode = () => use(JourneyModeContext) === JourneyMode.Partner;

export const useJourneyPaths = () => JOURNEY_PATHS[use(JourneyModeContext)];

import { JOURNEY_ORDER } from '@/lib/constants/status.constants';

export const journeyStep = (stage: string | null | undefined) => {
  const index = stage ? JOURNEY_ORDER.indexOf(stage) : -1;
  return index === -1 ? 1 : index + 1;
};

export const JOURNEY_TOTAL = JOURNEY_ORDER.length;

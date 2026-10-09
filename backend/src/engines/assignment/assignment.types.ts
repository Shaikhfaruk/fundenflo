export const AssignmentStrategy = {
  Manual: 'manual',
  RoundRobin: 'round_robin',
  Weighted: 'weighted',
  LeastLoaded: 'least_loaded',
  Pool: 'pool',
  Broadcast: 'broadcast',
  Sticky: 'sticky',
} as const;

export type AssignmentStrategy = (typeof AssignmentStrategy)[keyof typeof AssignmentStrategy];

export type AssignmentCandidate = {
  id: string;
  weight: number;
  openCount: number;
  capacity: number | null;
  lastAssignedAt: Date | null;
  previouslyWorked: boolean;
};

export type PickRequest = {
  strategy: AssignmentStrategy;
  candidates: readonly AssignmentCandidate[];
  excluded?: ReadonlySet<string>;
  offers?: number;
  random?: () => number;
};

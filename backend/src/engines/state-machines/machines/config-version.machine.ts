import { defineMachine } from '../define-machine.js';

export const ConfigVersionState = {
  Draft: 'draft',
  InReview: 'in_review',
  Approved: 'approved',
  Published: 'published',
  Retired: 'retired',
} as const;

export type ConfigVersionState = (typeof ConfigVersionState)[keyof typeof ConfigVersionState];

export const ConfigVersionEvent = {
  Edit: 'edit',
  Submit: 'submit',
  Approve: 'approve',
  Reject: 'reject',
  Publish: 'publish',
  Retire: 'retire',
} as const;

export type ConfigVersionEvent = (typeof ConfigVersionEvent)[keyof typeof ConfigVersionEvent];

const { Draft, InReview, Approved, Published, Retired } = ConfigVersionState;

export const configVersionMachine = defineMachine<ConfigVersionState, ConfigVersionEvent>({
  name: 'config_version',
  states: Object.values(ConfigVersionState),
  transitions: {
    edit: { from: [Draft], to: Draft },
    submit: { from: [Draft], to: InReview },
    approve: { from: [InReview], to: Approved },
    reject: { from: [InReview], to: Draft },
    publish: { from: [Approved], to: Published },
    retire: { from: [Draft, InReview, Approved, Published], to: Retired },
  },
});

export const OPEN_CONFIG_VERSION_STATES: readonly ConfigVersionState[] = [Draft, InReview, Approved];

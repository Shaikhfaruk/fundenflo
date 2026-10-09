export type TransitionMap<S extends string, E extends string> = Record<E, { from: readonly S[]; to: S }>;

export type MachineDefinition<S extends string, E extends string> = {
  name: string;
  states: readonly S[];
  transitions: TransitionMap<S, E>;
};

export class TransitionError extends Error {
  constructor(
    readonly machine: string,
    readonly from: string,
    readonly event: string,
  ) {
    super(`${machine}: cannot ${event} from ${from}`);
    this.name = 'TransitionError';
  }
}

export type Machine<S extends string, E extends string> = {
  name: string;
  states: readonly S[];
  can: (state: S, event: E) => boolean;
  next: (state: S, event: E) => S;
  events: (state: S) => E[];
};

export function defineMachine<S extends string, E extends string>(definition: MachineDefinition<S, E>): Machine<S, E> {
  const entries = Object.entries(definition.transitions) as Array<[E, { from: readonly S[]; to: S }]>;
  const can = (state: S, event: E) => definition.transitions[event].from.includes(state);
  return {
    name: definition.name,
    states: definition.states,
    can,
    next: (state, event) => {
      if (!can(state, event)) throw new TransitionError(definition.name, state, event);
      return definition.transitions[event].to;
    },
    events: (state) => entries.filter(([, transition]) => transition.from.includes(state)).map(([event]) => event),
  };
}

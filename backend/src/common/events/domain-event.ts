import type { ActorSnapshot } from '../context/actor.js';
import type { EventName } from './event-names.js';

export type DomainEventInput<P extends Record<string, unknown> = Record<string, unknown>> = {
  name: EventName;
  aggregateType: string;
  aggregateId: string | null;
  payload: P;
};

export type DomainEventEnvelope<P extends Record<string, unknown> = Record<string, unknown>> = DomainEventInput<P> & {
  id: string;
  actor: ActorSnapshot | null;
  requestId: string | null;
  occurredAt: string;
};

import { ActorType, type Role, type SessionContext } from '../enums/db.enums.js';

export type UserActor = {
  type: 'user';
  userId: string;
  sessionId: string;
  membershipId: string | null;
  context: SessionContext;
  role: Role | null;
  organizationId: string | null;
};

export type SystemActor = {
  type: 'system';
  name: string;
};

export type ApiClientActor = {
  type: 'api_client';
  apiClientId: string;
  name: string;
};

export type Actor = UserActor | SystemActor | ApiClientActor;

export type ActorSnapshot = {
  type: Actor['type'];
  userId?: string;
  sessionId?: string;
  membershipId?: string | null;
  context?: SessionContext;
  role?: Role | null;
  name?: string;
  apiClientId?: string;
};

const ACTOR_TYPES: Record<Actor['type'], ActorType> = {
  user: ActorType.user,
  system: ActorType.system,
  api_client: ActorType.api_client,
};

export const actorTypeOf = (actor: Actor | undefined): ActorType => (actor ? ACTOR_TYPES[actor.type] : ActorType.system);

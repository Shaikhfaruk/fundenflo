import type { Role, SessionContext } from '../enums/db.enums.js';

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

export type Actor = UserActor | SystemActor;

export type ActorSnapshot = {
  type: Actor['type'];
  userId?: string;
  sessionId?: string;
  membershipId?: string | null;
  context?: SessionContext;
  role?: Role | null;
  name?: string;
};

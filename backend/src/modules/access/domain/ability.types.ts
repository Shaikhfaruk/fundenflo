import type { Ability } from '@casl/ability';
import type { PrismaQueryOf, Subjects } from '@casl/prisma/runtime';

import type {
  AuditEvent,
  Invitation,
  Membership,
  Organization,
  Prisma,
  Session,
  User,
} from '../../../generated/prisma/client.js';

export const AppAction = {
  Manage: 'manage',
  Create: 'create',
  Read: 'read',
  Update: 'update',
  Delete: 'delete',
} as const;

export type AppAction = (typeof AppAction)[keyof typeof AppAction];

export const NonModelSubject = {
  Catalog: 'Catalog',
} as const;

export type AppSubjects =
  | 'all'
  | (typeof NonModelSubject)[keyof typeof NonModelSubject]
  | Subjects<{
      User: User;
      Session: Session;
      Membership: Membership;
      Invitation: Invitation;
      Organization: Organization;
      AuditEvent: AuditEvent;
    }>;

export type AppAbility = Ability<[AppAction, AppSubjects], PrismaQueryOf<Prisma.TypeMap>>;

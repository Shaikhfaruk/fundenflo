import type { Ability } from '@casl/ability';
import type { PrismaQueryOf, Subjects } from '@casl/prisma/runtime';

import type {
  AttributeDefinition,
  AuditEvent,
  ConfigDocument,
  Invitation,
  Membership,
  Organization,
  Party,
  Prisma,
  Question,
  Session,
  User,
} from '../../../generated/prisma/client.js';

export const AppAction = {
  Manage: 'manage',
  Create: 'create',
  Read: 'read',
  Update: 'update',
  Delete: 'delete',
  Approve: 'approve',
  Publish: 'publish',
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
      AttributeDefinition: AttributeDefinition;
      Party: Party;
      ConfigDocument: ConfigDocument;
      Question: Question;
    }>;

export type AppAbility = Ability<[AppAction, AppSubjects], PrismaQueryOf<Prisma.TypeMap>>;

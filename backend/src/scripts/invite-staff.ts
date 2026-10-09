import '../bootstrap/load-env.js';
import 'reflect-metadata';

import { parseArgs } from 'node:util';
import { createPrismaAbility } from '@casl/prisma/runtime';
import { NestFactory } from '@nestjs/core';
import { ClsService } from 'nestjs-cls';

import { ContactType, Role } from '../common/enums/db.enums.js';
import { normaliseEmail } from '../engines/party-matching/normalise.js';
import { InvitationService } from '../modules/access/application/invitation.service.js';
import { AppAction, type AppAbility } from '../modules/access/domain/ability.types.js';
import { AccessRepository } from '../modules/access/infrastructure/access.repository.js';
import { ScriptModule } from './script.module.js';

const { values } = parseArgs({ options: { email: { type: 'string' }, role: { type: 'string', default: Role.super_admin } } });
const email = normaliseEmail(values.email ?? '');
const role = values.role as Role;
if (!email || !Object.values(Role).includes(role)) {
  process.stderr.write('Usage: pnpm staff:invite --email <address> [--role super_admin]\n');
  process.exit(1);
}

const app = await NestFactory.createApplicationContext(ScriptModule, { logger: ['error', 'warn'] });
try {
  const cls = app.get(ClsService);
  await cls.run(async () => {
    cls.set('actor', { type: 'system', name: 'staff-invite-script' });
    const organization = await app.get(AccessRepository).findFundenfloOrganization();
    if (!organization) throw new Error('FundenFlo organization is missing. Run pnpm db:seed first.');
    const ability = createPrismaAbility([{ action: AppAction.Manage, subject: 'all' }]) as AppAbility;
    const invitations = app.get(InvitationService);
    const created = await invitations.create({ organizationId: organization.id, role, recipient: { channel: ContactType.email, value: email } }, null, ability);
    await invitations.deliver(created);
    process.stdout.write(`Invitation ${created.invitation.id} sent to ${created.invitation.identifierMasked} as ${role}.\nInvitation code: ${created.token}\n`);
  });
} finally {
  await app.close();
}

import { randomBytes } from 'node:crypto';

import { createPrismaAbility } from '@casl/prisma/runtime';
import type { INestApplicationContext } from '@nestjs/common';
import { ClsService } from 'nestjs-cls';

import type { UserActor } from '../../common/context/actor.js';
import { ChangeRequestStatus, ConfigResource, ConfigVersionStatus, ContactType, LenderAgreementStatus, LenderStatus, LoginMethod, Role, SessionContext } from '../../common/enums/db.enums.js';
import { PrismaService } from '../../infrastructure/database/prisma.service.js';
import { InvitationService } from '../../modules/access/application/invitation.service.js';
import { AppAction, type AppAbility } from '../../modules/access/domain/ability.types.js';
import { AccessRepository } from '../../modules/access/infrastructure/access.repository.js';
import { LoginIdentifierService } from '../../modules/auth/application/login-identifier.service.js';
import { actorForSession, SessionService } from '../../modules/auth/application/session.service.js';
import { StaffAuthService } from '../../modules/auth/application/staff-auth.service.js';
import { RevokeReason } from '../../modules/auth/domain/auth.enums.js';
import { IdentityRepository } from '../../modules/auth/infrastructure/identity.repository.js';
import { ConfigPublishingService } from '../../modules/config-publishing/application/config-publishing.service.js';
import { LenderService } from '../../modules/lenders/application/lender.service.js';
import { DEMO_AGREEMENT_REFERENCE_SUFFIX, DEMO_LENDERS, DEMO_PASSWORD_BYTES, DEMO_STAFF } from './demo.js';

export type DemoSeedOptions = { adminEmail: string; lenderEmail: string | null; staffDomain: string };

export async function runDemoSeed(app: INestApplicationContext, { adminEmail, lenderEmail, staffDomain }: DemoSeedOptions): Promise<string[]> {
  const report: string[] = [];
  const say = (line: string) => report.push(line);

  const cls = app.get(ClsService);
  const prisma = app.get(PrismaService);
  const identifiers = app.get(LoginIdentifierService);
  const identity = app.get(IdentityRepository);
  const access = app.get(AccessRepository);
  const sessions = app.get(SessionService);
  const staffAuth = app.get(StaffAuthService);
  const invitations = app.get(InvitationService);
  const lenders = app.get(LenderService);
  const config = app.get(ConfigPublishingService);
  const ability = createPrismaAbility([{ action: AppAction.Manage, subject: 'all' }]) as AppAbility;
  const openedSessions: string[] = [];

  const staffActor = async (email: string): Promise<UserActor | null> => {
    const login = await identity.findLogin(LoginMethod.password, identifiers.resolve({ email }).hash);
    if (!login) return null;
    const membership = await access.findFirstActiveMembership(login.userId, SessionContext.staff);
    if (!membership) throw new Error(`${email} has no active staff membership`);
    const issued = await sessions.start({ userId: login.userId, membership, loginMethod: LoginMethod.password });
    openedSessions.push(issued.session.id);
    return actorForSession(issued.session, membership);
  };

  const acting = async <T>(actor: UserActor, work: () => Promise<T>) => {
    cls.set('actor', actor);
    return work();
  };

  await cls.run(async () => {
    cls.set('actor', { type: 'system', name: 'demo-seed-script' });
    try {
      const fundenflo = await access.findFundenfloOrganization();
      if (!fundenflo) throw new Error('FundenFlo organization is missing. Run pnpm db:seed first.');
      const admin = await staffActor(adminEmail);
      if (!admin || admin.role !== Role.super_admin) throw new Error(`${adminEmail} must be an existing super admin who has accepted the staff invitation`);

      for (const staff of DEMO_STAFF) {
        const email = `${staff.localPart}@${staffDomain}`;
        if (await identity.findLogin(LoginMethod.password, identifiers.resolve({ email }).hash)) {
          say(`Staff   ${staff.fullName.padEnd(28)} ${email}  (already exists, keep the password you have)`);
          continue;
        }
        const created = await acting(admin, () => invitations.create({ organizationId: fundenflo.id, role: staff.role, recipient: { channel: ContactType.email, value: email } }, admin.userId, ability));
        const password = randomBytes(DEMO_PASSWORD_BYTES).toString('base64url');
        if (!created.token) throw new Error(`No invitation code was issued for ${email}`);
        const token = created.token;
        await staffAuth.acceptInvitation(token, password, staff.fullName);
        say(`Staff   ${staff.fullName.padEnd(28)} ${email}  password ${password}  (${staff.role}; set up the authenticator at first sign-in)`);
      }
      const approverEmail = `${DEMO_STAFF[0].localPart}@${staffDomain}`;
      const approver = await staffActor(approverEmail);
      if (!approver) throw new Error(`${approverEmail} could not be found`);

      const today = new Date().toISOString().slice(0, 10);
      for (const lender of DEMO_LENDERS) {
        await acting(admin, async () => {
          if (!(await prisma.lender.findUnique({ where: { key: lender.key } }))) await lenders.create({ key: lender.key, name: lender.name, kind: lender.kind, responseSlaHours: lender.responseSlaHours }, admin);
          let row = await prisma.lender.findUniqueOrThrow({ where: { key: lender.key } });
          if (row.status !== LenderStatus.active) {
            await lenders.update(row.id, { status: LenderStatus.active }, row.version, ability);
            row = await prisma.lender.findUniqueOrThrow({ where: { key: lender.key } });
          }
          const agreements = await prisma.lenderAgreement.findMany({ where: { lenderId: row.id } });
          if (!agreements.some((agreement) => agreement.status === LenderAgreementStatus.active)) {
            const reference = `${lender.key}-${DEMO_AGREEMENT_REFERENCE_SUFFIX}`;
            if (!agreements.some((agreement) => agreement.reference === reference)) await lenders.createAgreement(row.id, { reference, validFrom: today }, admin, ability);
            const draft = await prisma.lenderAgreement.findFirstOrThrow({ where: { lenderId: row.id, reference } });
            await lenders.updateAgreement(row.id, draft.id, { status: LenderAgreementStatus.active }, draft.version, ability);
          }
          say(`Lender  ${lender.name.padEnd(28)} key ${lender.key}, active with an active agreement`);
        });

        for (const product of lender.products) {
          const find = () => prisma.configDocument.findFirst({ where: { resource: ConfigResource.lender_product, key: product.key }, include: { versions: { orderBy: { number: 'desc' }, take: 1 } } });
          if (!(await find())) await acting(admin, () => config.createDocument(ConfigResource.lender_product, { key: product.key, name: { en: product.name }, content: product.content }, admin));
          const created = await find();
          const first = created?.versions[0];
          if (!created || !first) throw new Error(`${product.key} was not created`);
          if (first.status === ConfigVersionStatus.draft) {
            await acting(admin, () => config.submit(ConfigResource.lender_product, created.id, first.number, 'Demo product for the FundenFlo walkthrough', undefined, admin));
          }
          const request = await prisma.configChangeRequest.findFirst({ where: { versionId: first.id, status: ChangeRequestStatus.pending } });
          if (request) await acting(approver, () => config.approve(request.id, 'Checked for the demo', approver, ability));
          const reviewed = (await find())?.versions[0];
          if (reviewed?.status === ConfigVersionStatus.approved) await acting(admin, () => config.publish(ConfigResource.lender_product, created.id, reviewed.number, undefined, admin));
          const live = (await find())?.versions[0];
          say(`Product ${product.name.padEnd(28)} ${product.key} version ${live?.number}, ${live?.status}`);
        }
      }

      if (lenderEmail) {
        const organizationId = (await prisma.lender.findUniqueOrThrow({ where: { key: DEMO_LENDERS[0].key } })).organizationId;
        try {
          const created = await acting(admin, () => invitations.create({ organizationId, role: Role.lender_admin, recipient: { channel: ContactType.email, value: lenderEmail } }, admin.userId, ability));
          await invitations.deliver(created);
          say(`Lender user ${lenderEmail} invited to ${DEMO_LENDERS[0].name}: sign in at /login?as=lender with this email; the code arrives by email`);
        } catch (error) {
          say(`Lender user ${lenderEmail}: ${error instanceof Error ? error.message : String(error)} (an invitation or account may already exist)`);
        }
      }
    } finally {
      if (openedSessions.length > 0) await sessions.revoke(openedSessions, RevokeReason.Logout);
    }
  });
  return report;
}

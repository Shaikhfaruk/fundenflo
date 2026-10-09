import { randomInt } from 'node:crypto';
import { createPrismaAbility } from '@casl/prisma/runtime';
import { ClsService } from 'nestjs-cls';
import { Secret, TOTP } from 'otpauth';

import { ContactType, LoginAs, OrganizationStatus, OrganizationType, PartyKind, Role } from '../../../src/common/enums/db.enums.js';
import { InvitationService } from '../../../src/modules/access/application/invitation.service.js';
import { AppAction, type AppAbility } from '../../../src/modules/access/domain/ability.types.js';
import { AccessRepository } from '../../../src/modules/access/infrastructure/access.repository.js';
import type { AuthResult } from '../../../src/modules/auth/domain/auth.types.js';
import type { TestApp } from './test-app.js';
import { TEST_OTP_CODE, TEST_STAFF_PASSWORD } from './test.constants.js';

export const randomMobile = () => `98${String(randomInt(0, 100_000_000)).padStart(8, '0')}`;

export const randomEmail = (prefix: string) => `${prefix}.${randomInt(0, 1_000_000_000)}@sustaininsight.com`;

export const bearer = (token: string) => ({ Authorization: `Bearer ${token}` });

export const systemAbility = () => createPrismaAbility([{ action: AppAction.Manage, subject: 'all' }]) as AppAbility;

export async function otpLogin(t: TestApp, mobile: string, loginAs: LoginAs = LoginAs.borrower): Promise<AuthResult> {
  await t.api().post('/v1/auth/otp/request').send({ mobile, countryCode: '+91', loginAs }).expect(200);
  const response = await t.api().post('/v1/auth/otp/verify').send({ mobile, countryCode: '+91', otp: TEST_OTP_CODE }).expect(200);
  return response.body as AuthResult;
}

export async function createOrganization(t: TestApp, type: OrganizationType, name: string) {
  const party = await t.prisma.party.create({ data: { kind: PartyKind.business, displayName: name } });
  return t.prisma.organization.create({ data: { partyId: party.id, type, name, status: OrganizationStatus.active } });
}

export async function inviteBySystem(t: TestApp, input: { organizationId: string; role: Role; channel: typeof ContactType.mobile | typeof ContactType.email; value: string }) {
  const cls = t.app.get(ClsService);
  const invitations = t.app.get(InvitationService);
  return cls.run(async () => {
    cls.set('actor', { type: 'system', name: 'integration-test' });
    return invitations.create(
      { organizationId: input.organizationId, role: input.role, recipient: { channel: input.channel, value: input.value } },
      null,
      systemAbility(),
    );
  });
}

export type StaffSession = AuthResult & { email: string; totpSecret: string };

export async function createStaffSession(t: TestApp, role: Role = Role.super_admin, fullName = 'Ananya Iyer'): Promise<StaffSession> {
  const organization = await t.app.get(AccessRepository).findFundenfloOrganization();
  if (!organization) throw new Error('FundenFlo organization was not seeded');
  const email = randomEmail('staff');
  const created = await inviteBySystem(t, { organizationId: organization.id, role, channel: ContactType.email, value: email });
  await t.api().post('/v1/auth/staff/invitations/accept').send({ token: created.token, fullName, password: TEST_STAFF_PASSWORD }).expect(200);
  const login = await t.api().post('/v1/auth/staff/login').send({ email, password: TEST_STAFF_PASSWORD }).expect(200);
  const totpSecret = login.body.mfaSetup.secret as string;
  const code = new TOTP({ secret: Secret.fromBase32(totpSecret) }).generate();
  const verified = await t.api().post('/v1/auth/staff/mfa/verify').send({ mfaToken: login.body.mfaToken, code }).expect(200);
  return { ...(verified.body as AuthResult), email, totpSecret };
}

import { Secret, TOTP } from 'otpauth';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { ContactType, LoginAs, OrganizationType, Role } from '../../src/common/enums/db.enums.js';
import { bearer, createOrganization, createStaffSession, inviteBySystem, otpLogin, randomEmail, randomMobile, type StaffSession } from './support/fixtures.js';
import { startTestApp, type TestApp } from './support/test-app.js';
import { TEST_OTP_CODE, TEST_STAFF_PASSWORD } from './support/test.constants.js';

describe('staff authentication and administration', () => {
  let t: TestApp;
  let admin: StaffSession;

  beforeAll(async () => {
    t = await startTestApp();
    admin = await createStaffSession(t, Role.super_admin, 'Vikas Ahuja');
  });

  afterAll(async () => {
    await t.close();
  });

  it('signs staff in with password and TOTP and blocks code replay', async () => {
    expect(admin.user.activeContext).toMatchObject({ context: 'staff', role: 'super_admin' });

    const login = await t.api().post('/v1/auth/staff/login').send({ email: admin.email, password: TEST_STAFF_PASSWORD }).expect(200);
    expect(login.body.mfaSetup).toBeNull();
    const code = new TOTP({ secret: Secret.fromBase32(admin.totpSecret) }).generate();
    const wrong = await t.api().post('/v1/auth/staff/mfa/verify').send({ mfaToken: login.body.mfaToken, code: code === '000000' ? '111111' : '000000' }).expect(401);
    expect(wrong.body.code).toBe('MFA_CODE_INVALID');
    const replay = await t.api().post('/v1/auth/staff/mfa/verify').send({ mfaToken: login.body.mfaToken, code }).expect(401);
    expect(replay.body.code).toBe('MFA_CODE_INVALID');
  });

  it('locks a staff account after repeated wrong passwords', async () => {
    const staff = await createStaffSession(t, Role.support, 'Neha Singh');
    for (let attempt = 0; attempt < 5; attempt += 1) {
      await t.api().post('/v1/auth/staff/login').send({ email: staff.email, password: 'definitely-the-wrong-one' }).expect(401);
    }
    const locked = await t.api().post('/v1/auth/staff/login').send({ email: staff.email, password: TEST_STAFF_PASSWORD }).expect(423);
    expect(locked.body.code).toBe('ACCOUNT_LOCKED');
  });

  it('lists and searches users by blind-indexed mobile, and suspends them', async () => {
    const mobile = randomMobile();
    const borrower = await otpLogin(t, mobile);

    const found = await t.api().get('/v1/admin/users').query({ q: mobile }).set(bearer(admin.accessToken)).expect(200);
    expect(found.body.items.map((user: { id: string }) => user.id)).toEqual([borrower.user.id]);

    const detail = await t.api().get(`/v1/admin/users/${borrower.user.id}`).set(bearer(admin.accessToken)).expect(200);
    expect(detail.body.logins[0].identifier).toContain('•');

    await t.api().patch(`/v1/admin/users/${borrower.user.id}`).set(bearer(admin.accessToken)).set('If-Match', `"${detail.body.version}"`).send({ status: 'suspended' }).expect(200);
    const blocked = await t.api().get('/v1/me').set(bearer(borrower.accessToken)).expect(401);
    expect(blocked.body.code).toBe('SESSION_REVOKED');
    const refresh = await t.api().post('/v1/auth/token/refresh').send({ refreshToken: borrower.refreshToken }).expect(403);
    expect(refresh.body.code).toBe('USER_SUSPENDED');
  });

  it('denies admin routes to staff roles without the permission', async () => {
    const support = await createStaffSession(t, Role.support, 'Karan Verma');
    await t.api().get('/v1/admin/users').set(bearer(support.accessToken)).expect(200);
    const forbidden = await t.api().get('/v1/admin/audit-events').set(bearer(support.accessToken)).expect(403);
    expect(forbidden.body.code).toBe('FORBIDDEN');
  });

  it('invites a lender officer by mobile with idempotency and admits them on OTP sign-in', async () => {
    const lender = await createOrganization(t, OrganizationType.lender, 'Lender X Finance Ltd');
    const mobile = randomMobile();
    const body = { organizationId: lender.id, role: Role.lender_credit_officer, mobile, countryCode: '+91' };

    const first = await t.api().post('/v1/admin/invitations').set(bearer(admin.accessToken)).set('Idempotency-Key', 'invite-lender-officer-0001').send(body).expect(201);
    const replay = await t.api().post('/v1/admin/invitations').set(bearer(admin.accessToken)).set('Idempotency-Key', 'invite-lender-officer-0001').send(body).expect(201);
    expect(replay.headers['idempotent-replayed']).toBe('true');
    expect(replay.body.id).toBe(first.body.id);
    const reused = await t.api().post('/v1/admin/invitations').set(bearer(admin.accessToken)).set('Idempotency-Key', 'invite-lender-officer-0001').send({ ...body, role: Role.lender_admin }).expect(422);
    expect(reused.body.code).toBe('IDEMPOTENCY_KEY_REUSED');

    const officer = await otpLogin(t, mobile, LoginAs.lender);
    expect(officer.nextAction).toBeNull();
    expect(officer.user.activeContext).toMatchObject({ context: 'lender', role: 'lender_credit_officer', organization: { id: lender.id } });

    const listed = await t.api().get('/v1/admin/invitations').query({ organizationId: lender.id }).set(bearer(admin.accessToken)).expect(200);
    expect(listed.body.items[0]).toMatchObject({ status: 'accepted', recipient: expect.stringContaining('•') });
  });

  it('admits an email-invited lender user without a mobile account', async () => {
    const lender = await createOrganization(t, OrganizationType.lender, 'Lender Y Bank');
    const email = randomEmail('lender');
    await inviteBySystem(t, { organizationId: lender.id, role: Role.lender_admin, channel: ContactType.email, value: email });

    await t.api().post('/v1/auth/otp/request').send({ email, loginAs: LoginAs.lender }).expect(200);
    const login = await t.api().post('/v1/auth/otp/verify').send({ email, otp: TEST_OTP_CODE }).expect(200);
    expect(login.body.user.activeContext).toMatchObject({ context: 'lender', role: 'lender_admin' });
    expect(login.body.user.mobile).toBeNull();
  });

  it('manages memberships and revokes access when a membership is suspended', async () => {
    const partner = await createOrganization(t, OrganizationType.partner, 'Apex Advisory Partners');
    const mobile = randomMobile();
    const person = await otpLogin(t, mobile);

    const wrongRole = await t.api().post('/v1/admin/memberships').set(bearer(admin.accessToken)).send({ userId: person.user.id, organizationId: partner.id, role: Role.lender_admin }).expect(400);
    expect(wrongRole.body.code).toBe('ROLE_NOT_ALLOWED');

    const created = await t.api().post('/v1/admin/memberships').set(bearer(admin.accessToken)).send({ userId: person.user.id, organizationId: partner.id, role: Role.partner_owner }).expect(201);
    expect(created.body).toMatchObject({ context: 'partner', role: 'partner_owner', status: 'active' });

    const asPartner = await otpLogin(t, mobile, LoginAs.dsa);
    expect(asPartner.user.activeContext).toMatchObject({ context: 'partner', membershipId: created.body.id });

    await t.api().patch(`/v1/admin/memberships/${created.body.id}`).set(bearer(admin.accessToken)).set('If-Match', `"${created.body.version}"`).send({ status: 'suspended' }).expect(200);
    const blocked = await t.api().get('/v1/me').set(bearer(asPartner.accessToken)).expect(401);
    expect(blocked.body.code).toBe('SESSION_REVOKED');
    const refresh = await t.api().post('/v1/auth/token/refresh').send({ refreshToken: asPartner.refreshToken }).expect(403);
    expect(refresh.body.code).toBe('MEMBERSHIP_INACTIVE');
  });

  it('keeps a verifiable audit hash chain', async () => {
    const events = await t.api().get('/v1/admin/audit-events').query({ limit: 100 }).set(bearer(admin.accessToken)).expect(200);
    expect(events.body.items.length).toBeGreaterThan(5);
    const verification = await t.api().get('/v1/admin/audit-events/verify').set(bearer(admin.accessToken)).expect(200);
    expect(verification.body).toMatchObject({ valid: true, brokenAt: null });
    expect(verification.body.checked).toBeGreaterThan(5);
  });

  it('rejects reuse of a staff invitation', async () => {
    const organization = await t.prisma.organization.findFirstOrThrow({ where: { type: OrganizationType.fundenflo } });
    const email = randomEmail('ops');
    const created = await inviteBySystem(t, { organizationId: organization.id, role: Role.ops_lead, channel: ContactType.email, value: email });
    await t.api().post('/v1/auth/staff/invitations/accept').send({ token: created.token, fullName: 'Pooja Mehta', password: TEST_STAFF_PASSWORD }).expect(200);
    const again = await t.api().post('/v1/auth/staff/invitations/accept').send({ token: created.token, fullName: 'Pooja Mehta', password: TEST_STAFF_PASSWORD }).expect(400);
    expect(again.body.code).toBe('INVITATION_INVALID');
  });
});

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { LoginAs, Role } from '../../src/common/enums/db.enums.js';
import { bearer, createStaffSession, otpLogin, randomMobile, type StaffSession } from './support/fixtures.js';
import { startTestApp, type TestApp } from './support/test-app.js';

describe('partner onboarding', () => {
  let t: TestApp;
  let partnerManager: StaffSession;
  let opsLead: StaffSession;
  let gurugramId: string;
  const ownerMobile = randomMobile();
  const agentMobile = randomMobile();
  let partnerId: string;
  let pendingToken: string;
  let ownerToken: string;

  const signup = (token: string, body: Record<string, unknown>) => t.api().post('/v1/partner/signup').set(bearer(token)).send(body);
  const verify = (staff: StaffSession, id: string, decision: string, note: string) => t.api().post(`/v1/admin/partners/${id}/verify`).set(bearer(staff.accessToken)).send({ decision, note });

  beforeAll(async () => {
    t = await startTestApp();
    partnerManager = await createStaffSession(t, Role.partner_manager, 'Deepak Chawla');
    opsLead = await createStaffSession(t, Role.ops_lead, 'Lakshmi Menon');
    gurugramId = (await t.api().get('/v1/catalog/geo/cities').query({ q: 'Gurugram' }).expect(200)).body.items[0].id;
  });

  afterAll(async () => {
    await t.close();
  });

  it('lets a CA sign up from a partner login without a membership, pending verification', async () => {
    const first = await otpLogin(t, ownerMobile, LoginAs.ca);
    expect(first.nextAction?.code).toBe('PARTNER_NOT_ONBOARDED');

    const badKey = await signup(first.accessToken, { kind: 'ca', firmName: 'Agarwal & Co', categories: ['spaceships'] }).expect(400);
    expect(badKey.body.details[0]).toMatchObject({ path: 'categories.0', code: 'unknown_key' });

    const created = await signup(first.accessToken, {
      kind: 'ca',
      firmName: 'Agarwal & Co Chartered Accountants',
      membershipNumber: '512345',
      segments: ['msme'],
      categories: ['business'],
      languages: ['hi', 'en'],
      serviceAreas: [{ stateGstCode: '07' }, { cityId: gurugramId }, { pincode: '110001' }, { pincode: '110001' }],
    }).expect(201);
    partnerId = created.body.id;
    expect(created.body).toMatchObject({ kind: 'ca', level: 'new', organizationStatus: 'pending', verification: { status: 'pending' }, capacity: { segments: ['msme'], languages: ['hi', 'en'] } });
    expect(created.body.serviceAreas.map((area: { type: string }) => area.type)).toEqual(['state', 'city', 'pincode']);

    await signup(first.accessToken, { kind: 'ca', firmName: 'Second Firm' }).expect(409).expect((response) => expect(response.body.code).toBe('PARTNER_ALREADY_REGISTERED'));
    const again = await otpLogin(t, ownerMobile, LoginAs.ca);
    expect(again.nextAction?.code).toBe('PARTNER_PENDING_VERIFICATION');
    expect(again.user.activeContext).toBeNull();
    pendingToken = again.accessToken;
  });

  it('needs two different staff members to verify, then the CA works in partner context', async () => {
    const recommended = await verify(partnerManager, partnerId, 'approve', 'ICAI membership checked on the public register').expect(200);
    expect(recommended.body.verification).toMatchObject({ status: 'in_review', recommendedDecision: 'approve', recommendedByUserId: partnerManager.user.id });
    await verify(partnerManager, partnerId, 'approve', 'Approving my own recommendation').expect(403).expect((response) => expect(response.body.code).toBe('SELF_APPROVAL_NOT_ALLOWED'));
    const verified = await verify(opsLead, partnerId, 'approve', 'Second check done').expect(200);
    expect(verified.body).toMatchObject({ organizationStatus: 'active', verification: { status: 'verified', decidedByUserId: opsLead.user.id } });
    await verify(opsLead, partnerId, 'reject', 'Too late').expect(409);

    const me = await t.api().get('/v1/me').set(bearer(pendingToken)).expect(200);
    const membership = me.body.memberships.find((item: { context: string }) => item.context === 'partner');
    expect(membership).toMatchObject({ role: 'partner_owner', status: 'active' });
    const switched = await t.api().post('/v1/auth/switch-context').set(bearer(pendingToken)).send({ membershipId: membership.id }).expect(200);
    expect(switched.body.user.activeContext).toMatchObject({ context: 'partner', role: 'partner_owner' });
    ownerToken = switched.body.accessToken;
    const owner = { accessToken: ownerToken };
    const profile = await t.api().get('/v1/partner/profile').set(bearer(owner.accessToken)).expect(200);
    expect(profile.body).toMatchObject({ id: partnerId, name: 'Agarwal & Co Chartered Accountants' });

    const capacity = await t.api().get('/v1/partner/capacity').set(bearer(owner.accessToken)).expect(200);
    await t.api().put('/v1/partner/capacity').set(bearer(owner.accessToken)).send({ workingHours: { start: '18:00', end: '09:00' } }).expect(400);
    const updated = await t.api().put('/v1/partner/capacity').set(bearer(owner.accessToken)).set('If-Match', `"${capacity.body.version}"`)
      .send({ maxOpenLeads: 25, workingDays: [6, 1, 2, 3, 4, 5], workingHours: { start: '09:30', end: '18:30' }, categories: ['business', 'working-capital'] }).expect(200);
    expect(updated.body).toMatchObject({ maxOpenLeads: 25, workingDays: [1, 2, 3, 4, 5, 6], workingHours: { start: '09:30', end: '18:30' }, segments: ['msme'] });

    const areas = await t.api().put('/v1/partner/service-areas').set(bearer(owner.accessToken)).send({ areas: [{ pincode: '122002' }, { cityId: gurugramId }] }).expect(200);
    expect(areas.body.items).toHaveLength(2);
    await t.api().put('/v1/partner/service-areas').set(bearer(owner.accessToken)).send({ areas: [{ stateGstCode: '99' }] }).expect(400);
  });

  it('lets the owner add and suspend staff, while staff cannot manage the firm', async () => {
    const owner = { accessToken: ownerToken };
    const invitation = await t.api().post('/v1/partner/members').set(bearer(owner.accessToken)).send({ mobile: agentMobile }).expect(201);
    expect(invitation.body).toMatchObject({ role: 'partner_agent', status: 'pending', recipient: expect.stringContaining('•') });

    const agent = await otpLogin(t, agentMobile, LoginAs.ca);
    expect(agent.user.activeContext).toMatchObject({ context: 'partner', role: 'partner_agent' });
    await t.api().get('/v1/partner/profile').set(bearer(agent.accessToken)).expect(200);
    await t.api().put('/v1/partner/capacity').set(bearer(agent.accessToken)).send({ paused: true }).expect(403);
    await t.api().get('/v1/partner/members').set(bearer(agent.accessToken)).expect(403);

    const members = await t.api().get('/v1/partner/members').set(bearer(owner.accessToken)).expect(200);
    expect(members.body.members.map((member: { role: string }) => member.role).toSorted()).toEqual(['partner_agent', 'partner_owner']);
    const agentMembership = members.body.members.find((member: { role: string }) => member.role === 'partner_agent');
    const ownerMembership = members.body.members.find((member: { role: string }) => member.role === 'partner_owner');
    await t.api().patch(`/v1/partner/members/${ownerMembership.id}`).set(bearer(owner.accessToken)).send({ status: 'suspended' }).expect(403);
    await t.api().patch(`/v1/partner/members/${agentMembership.id}`).set(bearer(owner.accessToken)).send({ status: 'suspended' }).expect(200);
    await t.api().get('/v1/partner/profile').set(bearer(agent.accessToken)).expect(401);
  });

  it('suspends a partner firm at once and reinstates it, with levels managed by staff', async () => {
    const owner = { accessToken: ownerToken };
    await t.api().post(`/v1/admin/partners/${partnerId}/level`).set(bearer(partnerManager.accessToken)).send({ level: 'strategic', note: 'Top converter in Q3' }).expect(200);

    await t.api().post(`/v1/admin/partners/${partnerId}/suspend`).set(bearer(partnerManager.accessToken)).send({ note: 'Complaint under review' }).expect(200);
    const blocked = await t.api().get('/v1/partner/profile').set(bearer(owner.accessToken)).expect(401);
    expect(blocked.body.code).toBe('SESSION_REVOKED');
    const suspendedLogin = await otpLogin(t, ownerMobile, LoginAs.ca);
    expect(suspendedLogin.nextAction?.code).toBe('MEMBERSHIP_SUSPENDED');
    await t.api().post(`/v1/admin/partners/${partnerId}/suspend`).set(bearer(partnerManager.accessToken)).send({ note: 'Twice' }).expect(409);

    await t.api().post(`/v1/admin/partners/${partnerId}/reinstate`).set(bearer(partnerManager.accessToken)).send({ note: 'Complaint resolved' }).expect(200);
    const back = await otpLogin(t, ownerMobile, LoginAs.ca);
    expect(back.user.activeContext).toMatchObject({ context: 'partner' });
    const detail = await t.api().get(`/v1/admin/partners/${partnerId}`).set(bearer(opsLead.accessToken)).expect(200);
    expect(detail.body).toMatchObject({ level: 'strategic', organizationStatus: 'active' });
    expect(detail.body.members).toHaveLength(2);
  });

  it('closes rejected registrations so the person can sign up again, and filters the admin list', async () => {
    const mobile = randomMobile();
    const login = await otpLogin(t, mobile, LoginAs.dsa);
    const created = await signup(login.accessToken, { kind: 'dsa', firmName: 'Quick Loans Connect' }).expect(201);
    await verify(opsLead, created.body.id, 'reject', 'Could not confirm the DSA agreement').expect(200);
    const rejected = await verify(partnerManager, created.body.id, 'reject', 'Agreed, rejecting').expect(200);
    expect(rejected.body).toMatchObject({ organizationStatus: 'closed', verification: { status: 'rejected' } });

    const relogin = await otpLogin(t, mobile, LoginAs.dsa);
    expect(relogin.nextAction?.code).toBe('PARTNER_NOT_ONBOARDED');
    await signup(relogin.accessToken, { kind: 'dsa', firmName: 'Quick Loans Connect LLP' }).expect(201);

    const verified = await t.api().get('/v1/admin/partners').query({ verificationStatus: 'verified', q: 'agarwal' }).set(bearer(opsLead.accessToken)).expect(200);
    expect(verified.body.items.map((item: { id: string }) => item.id)).toEqual([partnerId]);
    const borrower = await otpLogin(t, randomMobile());
    await t.api().get('/v1/admin/partners').set(bearer(borrower.accessToken)).expect(403);
  });
});

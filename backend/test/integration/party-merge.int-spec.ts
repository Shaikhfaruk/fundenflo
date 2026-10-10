import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { LoginAs, Role } from '../../src/common/enums/db.enums.js';
import { bearer, createStaffSession, otpLogin, randomEmail, randomMobile, type StaffSession } from './support/fixtures.js';
import { startTestApp, type TestApp } from './support/test-app.js';

const consent = { basis: 'consent', evidence: 'Agreed on a call, 10 Oct', items: [{ purpose: 'contact', granted: true }, { purpose: 'partner_sharing', granted: true }] };

describe('party match reviews and merges', () => {
  let t: TestApp;
  let ops: StaffSession;

  const lead = async (body: Record<string, unknown>) => (await t.api().post('/v1/ops/leads').set(bearer(ops.accessToken)).send({ category: 'business', ...body }).expect(201)).body;

  const reviewFor = async (partyId: string) => {
    const list = await t.api().get('/v1/ops/party-match-reviews').set(bearer(ops.accessToken)).expect(200);
    return list.body.items.find((item: { partyId: string }) => item.partyId === partyId);
  };

  beforeAll(async () => {
    t = await startTestApp();
    ops = await createStaffSession(t, Role.ops_lead, 'Yusuf Merchant');
  });

  afterAll(async () => {
    await t.close();
  });

  it('opens a review for an uncertain match, merges the duplicate with everything attached and can undo it', async () => {
    const mobile = randomMobile();
    const first = await lead({ name: 'Ramesh Kumar', mobile, consent });
    const second = await lead({ name: 'Suresh Patel', mobile, email: randomEmail('suresh'), consent });
    const survivor = first.party.id;
    const duplicate = second.party.id;
    expect(duplicate).not.toBe(survivor);

    const review = await reviewFor(duplicate);
    expect(review).toMatchObject({ status: 'open', candidatePartyIds: [survivor] });
    const detail = await t.api().get(`/v1/ops/party-match-reviews/${review.id}`).set(bearer(ops.accessToken)).expect(200);
    expect(detail.body.parties.map((party: { id: string }) => party.id).toSorted((left: string, right: string) => left.localeCompare(right))).toEqual([survivor, duplicate].toSorted((left: string, right: string) => left.localeCompare(right)));
    expect(detail.body.parties[0].contacts[0].masked).toMatch(/•/);

    await t.api().post(`/v1/ops/parties/${duplicate}/facts`).set(bearer(ops.accessToken)).send({ note: 'Told us on the call', facts: [{ attributeKey: 'business.gst_registered', value: true }] }).expect(201);
    await t.api().post(`/v1/ops/party-match-reviews/${review.id}/resolve`).set(bearer(ops.accessToken)).send({ decision: 'merge', survivorPartyId: survivor, note: 'Same person' }).expect(400);
    const resolved = await t.api().post(`/v1/ops/party-match-reviews/${review.id}/resolve`).set(bearer(ops.accessToken)).send({ decision: 'merge', survivorPartyId: survivor, mergedPartyId: duplicate, note: 'Same person; the second caller gave a wrong name' }).expect(200);
    expect(resolved.body.status).toBe('linked');

    expect((await t.api().get(`/v1/ops/leads/${second.id}`).set(bearer(ops.accessToken)).expect(200)).body.party.id).toBe(survivor);
    const facts = await t.api().get(`/v1/ops/parties/${survivor}/facts`).set(bearer(ops.accessToken)).expect(200);
    expect(JSON.stringify(facts.body)).toContain('business.gst_registered');
    const history = await t.api().get(`/v1/ops/parties/${survivor}/consents/history`).set(bearer(ops.accessToken)).expect(200);
    expect(history.body.items.length).toBeGreaterThanOrEqual(4);
    const merged = await t.prisma.party.findUniqueOrThrow({ where: { id: duplicate } });
    expect(merged).toMatchObject({ status: 'merged', mergedIntoId: survivor });
    expect((await t.prisma.partyContact.findMany({ where: { partyId: survivor } })).map((contact) => contact.type).toSorted((left: string, right: string) => left.localeCompare(right))).toEqual(['email', 'mobile']);
    await t.api().post(`/v1/ops/party-match-reviews/${review.id}/resolve`).set(bearer(ops.accessToken)).send({ decision: 'dismiss', note: 'Changed my mind' }).expect(409);

    const merges = await t.api().get('/v1/ops/party-merges').query({ partyId: survivor }).set(bearer(ops.accessToken)).expect(200);
    expect(merges.body.items[0]).toMatchObject({ sourcePartyId: duplicate, targetPartyId: survivor, revertedAt: null });
    const reverted = await t.api().post(`/v1/ops/party-merges/${merges.body.items[0].id}/revert`).set(bearer(ops.accessToken)).send({ reason: 'Turned out to be the brother' }).expect(200);
    expect(reverted.body.revertedAt).not.toBeNull();
    await t.api().post(`/v1/ops/party-merges/${merges.body.items[0].id}/revert`).set(bearer(ops.accessToken)).send({ reason: 'Again' }).expect(409);

    expect((await t.api().get(`/v1/ops/leads/${second.id}`).set(bearer(ops.accessToken)).expect(200)).body.party.id).toBe(duplicate);
    expect((await t.prisma.party.findUniqueOrThrow({ where: { id: duplicate } })).status).toBe('active');
    expect((await t.prisma.partyContact.findMany({ where: { partyId: duplicate } })).map((contact) => contact.type).toSorted((left: string, right: string) => left.localeCompare(right))).toEqual(['email', 'mobile']);
    expect(JSON.stringify((await t.api().get(`/v1/ops/parties/${duplicate}/facts`).set(bearer(ops.accessToken)).expect(200)).body)).toContain('business.gst_registered');
  });

  it('moves a login to the survivor but refuses to merge two logins or a person with a business', async () => {
    const appUser = await otpLogin(t, randomMobile(), LoginAs.borrower);
    const appParty = (await t.prisma.user.findUniqueOrThrow({ where: { id: appUser.user.id } })).partyId;
    const enquiry = await lead({ name: 'Zoya Ansari', mobile: randomMobile(), businessName: 'Ansari Embroidery', consent });

    const merged = await t.api().post('/v1/ops/parties/merge').set(bearer(ops.accessToken)).send({ survivorPartyId: enquiry.party.id, mergedPartyId: appParty, reason: 'App sign-up with a second number' }).expect(201);
    expect((await t.prisma.user.findUniqueOrThrow({ where: { id: appUser.user.id } })).partyId).toBe(enquiry.party.id);
    await t.api().post(`/v1/ops/party-merges/${merged.body.id}/revert`).set(bearer(ops.accessToken)).send({ reason: 'Different people after all' }).expect(200);
    expect((await t.prisma.user.findUniqueOrThrow({ where: { id: appUser.user.id } })).partyId).toBe(appParty);

    const otherUser = await otpLogin(t, randomMobile(), LoginAs.borrower);
    const otherParty = (await t.prisma.user.findUniqueOrThrow({ where: { id: otherUser.user.id } })).partyId;
    const twoLogins = await t.api().post('/v1/ops/parties/merge').set(bearer(ops.accessToken)).send({ survivorPartyId: appParty, mergedPartyId: otherParty, reason: 'Same person, two phones' }).expect(400);
    expect(twoLogins.body.details.map((issue: { code: string }) => issue.code)).toEqual(['two_logins']);
    const business = await t.prisma.lead.findUniqueOrThrow({ where: { id: enquiry.id } });
    const kinds = await t.api().post('/v1/ops/parties/merge').set(bearer(ops.accessToken)).send({ survivorPartyId: enquiry.party.id, mergedPartyId: business.businessPartyId, reason: 'Owner and firm are the same' }).expect(400);
    expect(kinds.body.details.map((issue: { code: string }) => issue.code)).toContain('kind_mismatch');
  });

  it('carries borrower profiles, applications and documents to the survivor and back on revert', async () => {
    const appUser = await otpLogin(t, randomMobile(), LoginAs.borrower);
    const appParty = (await t.prisma.user.findUniqueOrThrow({ where: { id: appUser.user.id } })).partyId;
    const application = await t.api().post('/v1/applications').set(bearer(appUser.accessToken)).send({ segment: 'individual', subSegment: 'salaried', category: 'personal' }).expect(201);
    const document = await t.api().post('/v1/documents').set(bearer(appUser.accessToken)).field('documentType', 'pan').field('borrowerProfileId', application.body.borrowerProfileId).attach('file', Buffer.from('%PDF-1.7\nPAN card\n%%EOF\n'), { filename: 'pan.pdf', contentType: 'application/pdf' }).expect(201);
    const enquiry = await lead({ name: 'Imran Qureshi', mobile: randomMobile(), consent });

    const merged = await t.api().post('/v1/ops/parties/merge').set(bearer(ops.accessToken)).send({ survivorPartyId: enquiry.party.id, mergedPartyId: appParty, reason: 'Enquiry before the app sign-up' }).expect(201);
    const moved = { application: await t.prisma.loanApplication.findUniqueOrThrow({ where: { id: application.body.id } }), profile: await t.prisma.borrowerProfile.findUniqueOrThrow({ where: { id: application.body.borrowerProfileId } }), document: await t.prisma.document.findUniqueOrThrow({ where: { id: document.body.id } }) };
    expect(moved.application).toMatchObject({ partyId: enquiry.party.id, actingPartyId: enquiry.party.id });
    expect(moved.profile).toMatchObject({ partyId: enquiry.party.id, actingPartyId: enquiry.party.id });
    expect(moved.document.partyId).toBe(enquiry.party.id);
    await t.api().get(`/v1/applications/${application.body.id}`).set(bearer(appUser.accessToken)).expect(200);
    await t.api().get(`/v1/documents/${document.body.id}`).set(bearer(appUser.accessToken)).expect(200);

    await t.api().post(`/v1/ops/party-merges/${merged.body.id}/revert`).set(bearer(ops.accessToken)).send({ reason: 'Different people after all' }).expect(200);
    expect(await t.prisma.loanApplication.findUniqueOrThrow({ where: { id: application.body.id } })).toMatchObject({ partyId: appParty, actingPartyId: appParty });
    expect((await t.prisma.document.findUniqueOrThrow({ where: { id: document.body.id } })).partyId).toBe(appParty);

    const second = await otpLogin(t, randomMobile(), LoginAs.borrower);
    await t.api().post('/v1/borrower-profiles').set(bearer(second.accessToken)).send({ segment: 'individual' }).expect(201);
    const secondParty = (await t.prisma.user.findUniqueOrThrow({ where: { id: second.user.id } })).partyId;
    const refused = await t.api().post('/v1/ops/parties/merge').set(bearer(ops.accessToken)).send({ survivorPartyId: appParty, mergedPartyId: secondParty, reason: 'Two profiles' }).expect(400);
    expect(refused.body.details.map((issue: { code: string }) => issue.code)).toEqual(expect.arrayContaining(['two_logins', 'two_borrower_profiles']));
  });

  it('dismisses a review when the people are different', async () => {
    const mobile = randomMobile();
    await lead({ name: 'Aarav Mehta', mobile });
    const second = await lead({ name: 'Bhavna Rawat', mobile });
    const review = await reviewFor(second.party.id);
    const dismissed = await t.api().post(`/v1/ops/party-match-reviews/${review.id}/resolve`).set(bearer(ops.accessToken)).send({ decision: 'dismiss', note: 'Shared family phone' }).expect(200);
    expect(dismissed.body).toMatchObject({ status: 'dismissed', resolution: 'Shared family phone' });
  });
});

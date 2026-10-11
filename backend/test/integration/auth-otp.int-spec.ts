import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { EventName } from '../../src/common/events/event-names.js';
import { LoginAs } from '../../src/common/enums/db.enums.js';
import { RATE_LIMIT_KEY_PREFIX } from '../../src/infrastructure/rate-limit/rate-limit.constants.js';
import { OtpLimit, RateLimitRules } from '../../src/modules/auth/domain/auth.constants.js';
import { bearer, otpLogin, randomMobile } from './support/fixtures.js';
import { startTestApp, type TestApp } from './support/test-app.js';
import { TEST_OTP_CODE } from './support/test.constants.js';

describe('OTP sign-in and multiple logins', () => {
  let t: TestApp;

  beforeAll(async () => {
    t = await startTestApp();
  });

  afterAll(async () => {
    await t.close();
  });

  it('signs up a borrower with a personal borrower membership and records signup events', async () => {
    const mobile = randomMobile();
    const issued = await t.api().post('/v1/auth/otp/request').send({ mobile, countryCode: '+91', loginAs: LoginAs.borrower, referralCode: 'ff-dsa-20418' }).expect(200);
    expect(issued.body).toEqual({ challengeId: expect.any(String), resendIn: 30, expiresIn: 300 });

    const verified = await t.api().post('/v1/auth/otp/verify').send({ mobile, countryCode: '+91', otp: TEST_OTP_CODE, device: { name: 'Pixel 9', platform: 'android' } }).expect(200);
    expect(verified.body).toMatchObject({ tokenType: 'Bearer', expiresIn: 900, nextAction: null });
    expect(verified.body.user.activeContext).toMatchObject({ context: 'borrower', role: 'borrower', organization: null });
    expect(verified.body.user.mobile).toBe(`+91${mobile}`);
    expect(verified.body.user.logins).toEqual([expect.objectContaining({ method: 'mobile_otp', identifier: expect.stringContaining('•') })]);

    const user = await t.prisma.user.findUniqueOrThrow({ where: { id: verified.body.user.id } });
    expect(user.signupReferralCode).toBe('FF-DSA-20418');
    const events = await t.prisma.outboxEvent.findMany({ where: { aggregateId: user.id } });
    expect(events.map((event) => event.eventName)).toContain(EventName.UserSignedUp);
  });

  it('enforces the resend cooldown and locks after repeated wrong codes', async () => {
    const mobile = randomMobile();
    await t.api().post('/v1/auth/otp/request').send({ mobile, countryCode: '+91' }).expect(200);
    const cooldown = await t.api().post('/v1/auth/otp/request').send({ mobile, countryCode: '+91' }).expect(429);
    expect(cooldown.body.code).toBe('OTP_COOLDOWN');
    expect(cooldown.headers['retry-after']).toBeDefined();

    for (let attempt = 4; attempt >= 1; attempt -= 1) {
      const wrong = await t.api().post('/v1/auth/otp/verify').send({ mobile, countryCode: '+91', otp: '000000' }).expect(401);
      expect(wrong.body).toMatchObject({ code: 'OTP_INVALID', details: { attemptsLeft: attempt } });
    }
    const locked = await t.api().post('/v1/auth/otp/verify').send({ mobile, countryCode: '+91', otp: '000000' }).expect(429);
    expect(locked.body.code).toBe('OTP_LOCKED');
    const afterLock = await t.api().post('/v1/auth/otp/verify').send({ mobile, countryCode: '+91', otp: TEST_OTP_CODE }).expect(429);
    expect(afterLock.body.code).toBe('OTP_LOCKED');
  });

  it('does not count requests refused by the cooldown against the hourly allowance', async () => {
    const mobile = randomMobile();
    const request = () => t.api().post('/v1/auth/otp/request').send({ mobile, countryCode: '+91', loginAs: LoginAs.borrower });
    const openResend = (challengeId: string) => t.prisma.otpChallenge.update({ where: { id: challengeId }, data: { resendAvailableAt: new Date(Date.now() - 1_000) } });
    for (let sent = 1; sent <= OtpLimit.requestsPerIdentifier.limit; sent += 1) {
      const issued = await request().expect(200);
      for (let refused = 0; refused < 3; refused += 1) expect((await request().expect(429)).body.code).toBe('OTP_COOLDOWN');
      await openResend(issued.body.challengeId);
    }
    expect((await request().expect(429)).body.code).toBe('OTP_RATE_LIMITED');
    const ipKeys = await t.redis.keys(`${RATE_LIMIT_KEY_PREFIX}${RateLimitRules.otpRequest.name}:ip:*`);
    if (ipKeys.length > 0) await t.redis.del(...ipKeys);
  });

  it('sends a fresh code when the person changes the role or referral code inside the cooldown', async () => {
    const mobile = randomMobile();
    const borrower = await t.api().post('/v1/auth/otp/request').send({ mobile, countryCode: '+91', loginAs: LoginAs.borrower }).expect(200);
    const dsa = await t.api().post('/v1/auth/otp/request').send({ mobile, countryCode: '+91', loginAs: LoginAs.dsa }).expect(200);
    expect(dsa.body.challengeId).not.toBe(borrower.body.challengeId);
    expect((await t.api().post('/v1/auth/otp/request').send({ mobile, countryCode: '+91', loginAs: LoginAs.dsa }).expect(429)).body.code).toBe('OTP_COOLDOWN');
    const referred = await t.api().post('/v1/auth/otp/request').send({ mobile, countryCode: '+91', loginAs: LoginAs.dsa, referralCode: 'ff-ca-77120' }).expect(200);

    expect((await t.api().post('/v1/auth/otp/verify').send({ mobile, countryCode: '+91', otp: TEST_OTP_CODE, challengeId: borrower.body.challengeId }).expect(410)).body.code).toBe('OTP_EXPIRED');
    const verified = await t.api().post('/v1/auth/otp/verify').send({ mobile, countryCode: '+91', otp: TEST_OTP_CODE, challengeId: referred.body.challengeId }).expect(200);
    expect(verified.body.nextAction?.code).toBe('PARTNER_NOT_ONBOARDED');
    const user = await t.prisma.user.findUniqueOrThrow({ where: { id: verified.body.user.id } });
    expect(user.signupReferralCode).toBe('FF-CA-77120');
  });

  it('lets one person sign in as a partner, get a next action, and switch to borrower in the same session', async () => {
    const mobile = randomMobile();
    const borrower = await otpLogin(t, mobile, LoginAs.borrower);
    const borrowerMembershipId = borrower.user.activeContext?.membershipId as string;

    const partner = await otpLogin(t, mobile, LoginAs.ca);
    expect(partner.user.id).toBe(borrower.user.id);
    expect(partner.user.activeContext).toBeNull();
    expect(partner.nextAction).toMatchObject({ code: 'PARTNER_NOT_ONBOARDED' });

    const denied = await t.api().get('/v1/admin/users').set(bearer(partner.accessToken)).expect(403);
    expect(denied.body.code).toBe('CONTEXT_NOT_ALLOWED');
    await t.api().get('/v1/me').set(bearer(partner.accessToken)).expect(200);

    const switched = await t.api().post('/v1/auth/switch-context').set(bearer(partner.accessToken)).send({ membershipId: borrowerMembershipId }).expect(200);
    expect(switched.body.user.activeContext).toMatchObject({ context: 'borrower', membershipId: borrowerMembershipId });

    const sessions = await t.api().get('/v1/me/sessions').set(bearer(switched.body.accessToken)).expect(200);
    expect(sessions.body.items).toHaveLength(2);
    expect(sessions.body.items.filter((session: { current: boolean }) => session.current)).toHaveLength(1);
  });

  it('rotates refresh tokens and revokes the whole session when an old one is reused', async () => {
    const login = await otpLogin(t, randomMobile());
    const rotated = await t.api().post('/v1/auth/token/refresh').send({ refreshToken: login.refreshToken }).expect(200);
    expect(rotated.body.refreshToken).not.toBe(login.refreshToken);

    const reused = await t.api().post('/v1/auth/token/refresh').send({ refreshToken: login.refreshToken }).expect(401);
    expect(reused.body.code).toBe('REFRESH_TOKEN_REUSED');
    const familyRevoked = await t.api().post('/v1/auth/token/refresh').send({ refreshToken: rotated.body.refreshToken }).expect(401);
    expect(familyRevoked.body.code).toBe('REFRESH_TOKEN_INVALID');
    const revokedAccess = await t.api().get('/v1/me').set(bearer(rotated.body.accessToken)).expect(401);
    expect(revokedAccess.body.code).toBe('SESSION_REVOKED');
  });

  it('logs out one session and can sign out every other device', async () => {
    const mobile = randomMobile();
    const phone = await otpLogin(t, mobile);
    const laptop = await otpLogin(t, mobile);

    const others = await t.api().delete('/v1/me/sessions').set(bearer(laptop.accessToken)).expect(200);
    expect(others.body).toEqual({ revoked: 1 });
    await t.api().get('/v1/me').set(bearer(phone.accessToken)).expect(401);
    await t.api().get('/v1/me').set(bearer(laptop.accessToken)).expect(200);

    await t.api().post('/v1/auth/logout').set(bearer(laptop.accessToken)).expect(204);
    await t.api().get('/v1/me').set(bearer(laptop.accessToken)).expect(401);
  });

  it('updates the profile with optimistic concurrency and ETags', async () => {
    const login = await otpLogin(t, randomMobile());
    const me = await t.api().get('/v1/me').set(bearer(login.accessToken)).expect(200);
    expect(me.headers.etag).toBe(`"${me.body.version}"`);

    const stale = await t.api().patch('/v1/me/profile').set(bearer(login.accessToken)).set('If-Match', `"${me.body.version + 5}"`).send({ fullName: 'Rohit Sharma' }).expect(409);
    expect(stale.body).toMatchObject({ code: 'VERSION_CONFLICT', details: { currentVersion: me.body.version } });

    const updated = await t.api().patch('/v1/me/profile').set(bearer(login.accessToken)).set('If-Match', `"${me.body.version}"`).send({ fullName: '  Rohit   Sharma ', preferredLanguage: 'hi' }).expect(200);
    expect(updated.body).toMatchObject({ fullName: 'Rohit Sharma', preferredLanguage: 'hi', profileComplete: true, version: me.body.version + 1 });
  });

  it('does not reveal whether an unlinked email exists', async () => {
    const response = await t.api().post('/v1/auth/otp/request').send({ email: 'unknown.person@sustaininsight.com', loginAs: LoginAs.lender }).expect(200);
    expect(response.body.challengeId).toBeDefined();
    const deliveries = await t.prisma.notificationDelivery.count({ where: { recipientMasked: { startsWith: 'un' } } });
    expect(deliveries).toBe(0);
    const verify = await t.api().post('/v1/auth/otp/verify').send({ email: 'unknown.person@sustaininsight.com', otp: TEST_OTP_CODE }).expect(401);
    expect(verify.body.code).toBe('OTP_INVALID');
  });
});

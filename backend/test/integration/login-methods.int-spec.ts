import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { LoginAs } from '../../src/common/enums/db.enums.js';
import { bearer, otpLogin, randomEmail, randomMobile } from './support/fixtures.js';
import { startTestApp, type TestApp } from './support/test-app.js';
import { TEST_OTP_CODE } from './support/test.constants.js';

describe('linked sign-in methods and mobile change', () => {
  let t: TestApp;

  beforeAll(async () => {
    t = await startTestApp();
  });

  afterAll(async () => {
    await t.close();
  });

  it('links an email by OTP and then signs in with it to the same user', async () => {
    const login = await otpLogin(t, randomMobile());
    const email = randomEmail('borrower');

    const started = await t.api().post('/v1/me/logins').set(bearer(login.accessToken)).send({ email }).expect(202);
    const linked = await t.api().post('/v1/me/logins/verify').set(bearer(login.accessToken)).send({ challengeId: started.body.challengeId, otp: TEST_OTP_CODE }).expect(201);
    expect(linked.body).toMatchObject({ method: 'email_otp', identifier: expect.stringContaining('•') });

    await t.api().post('/v1/auth/otp/request').send({ email, loginAs: LoginAs.borrower }).expect(200);
    const byEmail = await t.api().post('/v1/auth/otp/verify').send({ email, otp: TEST_OTP_CODE }).expect(200);
    expect(byEmail.body.user.id).toBe(login.user.id);
    expect(byEmail.body.user.email).toBe(email);

    const duplicate = await t.api().post('/v1/me/logins').set(bearer(login.accessToken)).send({ email }).expect(409);
    expect(duplicate.body.code).toBe('LOGIN_IN_USE');
  });

  it('protects the mobile login and the last remaining method', async () => {
    const login = await otpLogin(t, randomMobile());
    const logins = await t.api().get('/v1/me/logins').set(bearer(login.accessToken)).expect(200);
    const mobileLogin = logins.body.items.find((item: { method: string }) => item.method === 'mobile_otp');

    const removeMobile = await t.api().delete(`/v1/me/logins/${mobileLogin.id}`).set(bearer(login.accessToken)).expect(409);
    expect(removeMobile.body.code).toBe('PRIMARY_LOGIN_REQUIRED');

    const email = randomEmail('remove');
    const started = await t.api().post('/v1/me/logins').set(bearer(login.accessToken)).send({ email }).expect(202);
    const linked = await t.api().post('/v1/me/logins/verify').set(bearer(login.accessToken)).send({ challengeId: started.body.challengeId, otp: TEST_OTP_CODE }).expect(201);
    await t.api().delete(`/v1/me/logins/${linked.body.id}`).set(bearer(login.accessToken)).expect(204);
    const after = await t.api().get('/v1/me/logins').set(bearer(login.accessToken)).expect(200);
    expect(after.body.items).toHaveLength(1);
  });

  it('changes the mobile number, signs out other sessions and keeps the same account', async () => {
    const oldMobile = randomMobile();
    const phone = await otpLogin(t, oldMobile);
    const laptop = await otpLogin(t, oldMobile);
    const newMobile = randomMobile();

    const started = await t.api().post('/v1/me/mobile-change').set(bearer(laptop.accessToken)).send({ mobile: newMobile, countryCode: '+91' }).expect(202);
    const changed = await t.api().post('/v1/me/mobile-change/verify').set(bearer(laptop.accessToken)).send({ challengeId: started.body.challengeId, otp: TEST_OTP_CODE }).expect(200);
    expect(changed.body.mobile).toBe(`+91${newMobile}`);

    await t.api().get('/v1/me').set(bearer(phone.accessToken)).expect(401);
    const viaNew = await otpLogin(t, newMobile);
    expect(viaNew.user.id).toBe(laptop.user.id);

    const viaOld = await otpLogin(t, oldMobile);
    expect(viaOld.user.id).not.toBe(laptop.user.id);
  });

  it('refuses to move a mobile number that another account already uses', async () => {
    const taken = randomMobile();
    await otpLogin(t, taken);
    const other = await otpLogin(t, randomMobile());
    const response = await t.api().post('/v1/me/mobile-change').set(bearer(other.accessToken)).send({ mobile: taken, countryCode: '+91' }).expect(409);
    expect(response.body.code).toBe('MOBILE_IN_USE');
  });
});

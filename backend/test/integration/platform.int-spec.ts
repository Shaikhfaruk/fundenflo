import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { otpLogin, randomMobile } from './support/fixtures.js';
import { startTestApp, type TestApp } from './support/test-app.js';

describe('platform behaviour', () => {
  let t: TestApp;

  beforeAll(async () => {
    t = await startTestApp();
  });

  afterAll(async () => {
    await t.close();
  });

  it('serves unprefixed health probes', async () => {
    await t.api().get('/health/live').expect(200, { status: 'ok' });
    const ready = await t.api().get('/health/ready').expect(200);
    expect(ready.body.details).toMatchObject({ database: { status: 'up' }, redis: { status: 'up' } });
  });

  it('echoes a valid X-Request-Id and generates one otherwise', async () => {
    const echoed = await t.api().get('/health/live').set('X-Request-Id', 'client-request-0001').expect(200);
    expect(echoed.headers['x-request-id']).toBe('client-request-0001');
    const generated = await t.api().get('/health/live').set('X-Request-Id', 'bad id').expect(200);
    expect(generated.headers['x-request-id']).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('returns the flat error contract for unknown routes, bad JSON and validation errors', async () => {
    const missing = await t.api().get('/v1/does-not-exist').expect(404);
    expect(missing.body).toMatchObject({ code: 'ROUTE_NOT_FOUND', requestId: expect.any(String) });

    const badJson = await t.api().post('/v1/auth/otp/request').set('Content-Type', 'application/json').send('{bad').expect(400);
    expect(badJson.body.code).toBe('INVALID_JSON');

    const invalid = await t.api().post('/v1/auth/otp/request').send({ mobile: '12' }).expect(400);
    expect(invalid.body).toMatchObject({ code: 'VALIDATION_FAILED', details: expect.arrayContaining([expect.objectContaining({ path: 'mobile' })]) });
  });

  it('rejects oversized JSON bodies', async () => {
    const response = await t.api().post('/v1/auth/otp/request').send({ mobile: '9'.repeat(1_100_000) }).expect(413);
    expect(response.body.code).toBe('PAYLOAD_TOO_LARGE');
  });

  it('requires authentication on protected routes', async () => {
    const response = await t.api().get('/v1/me').expect(401);
    expect(response.body.code).toBe('UNAUTHENTICATED');
    const forged = await t.api().get('/v1/me').set('Authorization', 'Bearer not-a-token').expect(401);
    expect(forged.body.code).toBe('TOKEN_INVALID');
  });

  it('keeps audit events append-only', async () => {
    await otpLogin(t, randomMobile());
    expect(await t.prisma.auditEvent.count()).toBeGreaterThan(0);
    await expect(t.prisma.$executeRawUnsafe(`UPDATE audit_events SET action = 'tampered'`)).rejects.toThrow(/append-only/);
    await expect(t.prisma.$executeRawUnsafe('DELETE FROM audit_events')).rejects.toThrow(/append-only/);
  });
});

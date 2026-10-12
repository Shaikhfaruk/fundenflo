import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { ChangeRequestStatus, ConfigResource, ConfigVersionStatus, LenderAgreementStatus, LenderStatus, Role } from '../../src/common/enums/db.enums.js';
import { DEMO_LENDERS, DEMO_STAFF } from '../../src/scripts/seed-data/demo.js';
import { runDemoSeed } from '../../src/scripts/seed-data/run-demo-seed.js';
import { createStaffSession, randomEmail } from './support/fixtures.js';
import { startTestApp, type TestApp } from './support/test-app.js';

const STAFF_DOMAIN = 'demo-seed.sustaininsight.com';

describe('demo seed', () => {
  let t: TestApp;

  beforeAll(async () => {
    t = await startTestApp();
  });

  afterAll(async () => {
    await t.close();
  });

  it('sets up demo staff, live lenders and products as the super admin, and can run again', async () => {
    const admin = await createStaffSession(t, Role.super_admin, 'Faruk Shaikh');
    const lenderEmail = randomEmail('demo.lender');
    const report = await runDemoSeed(t.app, { adminEmail: admin.email, lenderEmail, staffDomain: STAFF_DOMAIN });

    const approverEmail = `${DEMO_STAFF[0].localPart}@${STAFF_DOMAIN}`;
    const password = new RegExp(`${approverEmail.replaceAll('.', '\\.')}  password (\\S+)`).exec(report.join('\n'))?.[1];
    expect(password).toBeDefined();
    const login = await t.api().post('/v1/auth/staff/login').send({ email: approverEmail, password }).expect(200);
    expect(login.body.mfaSetup).toMatchObject({ secret: expect.any(String) });

    for (const lender of DEMO_LENDERS) {
      const row = await t.prisma.lender.findUniqueOrThrow({ where: { key: lender.key }, include: { agreements: true } });
      expect(row.status).toBe(LenderStatus.active);
      expect(row.agreements.some((agreement) => agreement.status === LenderAgreementStatus.active)).toBe(true);
      for (const product of lender.products) {
        const document = await t.prisma.configDocument.findFirstOrThrow({ where: { resource: ConfigResource.lender_product, key: product.key }, include: { versions: true } });
        expect(document.versions.map((version) => version.status)).toEqual([ConfigVersionStatus.published]);
        const request = await t.prisma.configChangeRequest.findFirstOrThrow({ where: { versionId: document.versions[0]?.id } });
        expect(request).toMatchObject({ status: ChangeRequestStatus.approved, makerUserId: admin.user.id });
        expect(request.checkerUserId).not.toBe(admin.user.id);
      }
    }
    expect(await t.prisma.invitation.count({ where: { role: Role.lender_admin, acceptedAt: null } })).toBeGreaterThan(0);
    expect(await t.prisma.session.count({ where: { userId: admin.user.id, revokedAt: null } })).toBe(1);

    const again = await runDemoSeed(t.app, { adminEmail: admin.email, lenderEmail: null, staffDomain: STAFF_DOMAIN });
    expect(again.join('\n')).toContain('already exists');
    const products = await t.prisma.configVersion.count({ where: { document: { resource: ConfigResource.lender_product, key: { in: DEMO_LENDERS.flatMap((lender) => lender.products.map((product) => product.key)) } } } });
    expect(products).toBe(3);
  });

  it('refuses an admin email that is not a super admin', async () => {
    await expect(runDemoSeed(t.app, { adminEmail: 'nobody@sustaininsight.com', lenderEmail: null, staffDomain: STAFF_DOMAIN })).rejects.toThrow(/must be an existing super admin/);
  });
});

import { randomInt } from 'node:crypto';

import { ClsService } from 'nestjs-cls';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { LoginAs } from '../../src/common/enums/db.enums.js';
import { OBJECT_STORAGE, type ObjectStorage } from '../../src/infrastructure/storage/storage.port.js';
import type { AuthResult } from '../../src/modules/auth/domain/auth.types.js';
import { DocumentScanService } from '../../src/modules/documents/application/document-scan.service.js';
import { DocumentMaintenance } from '../../src/modules/documents/infrastructure/document.maintenance.js';
import { bearer, otpLogin, randomMobile } from './support/fixtures.js';
import { startTestApp, type TestApp } from './support/test-app.js';

const PAST = new Date(Date.now() - 86_400_000);

describe('document freshness, retention purge and orphan file clean-up', () => {
  let t: TestApp;
  let borrower: AuthResult;
  let applicationId: string;

  const inCls = <T>(work: () => Promise<T>) => t.app.get(ClsService).run(work);
  const maintenance = () => t.app.get(DocumentMaintenance);
  const storage = () => t.app.get<ObjectStorage>(OBJECT_STORAGE);

  const upload = async (documentType: string) => {
    const created = await t.api().post('/v1/documents').set(bearer(borrower.accessToken)).field('documentType', documentType).field('applicationId', applicationId).attach('file', Buffer.from(`%PDF-1.7\n${documentType} ${randomInt(0, 1_000_000_000)}\n%%EOF\n`), { filename: `${documentType}.pdf`, contentType: 'application/pdf' }).expect(201);
    expect(await inCls(() => t.app.get(DocumentScanService).scan(created.body.id))).toBe('clean');
    return t.prisma.document.findUniqueOrThrow({ where: { id: created.body.id } });
  };

  beforeAll(async () => {
    t = await startTestApp();
    borrower = await otpLogin(t, randomMobile(), LoginAs.borrower);
    applicationId = (await t.api().post('/v1/applications').set(bearer(borrower.accessToken)).send({ segment: 'msme', subSegment: 'proprietorship', businessName: 'Retention Traders', category: 'business' }).expect(201)).body.id;
  });

  afterAll(async () => {
    await t.close();
  });

  it('expires stale documents and tells the journey', async () => {
    const statement = await upload('bank_statement');
    await t.prisma.document.update({ where: { id: statement.id }, data: { freshUntil: PAST } });
    expect(await inCls(() => maintenance().expireStale())).toBeGreaterThanOrEqual(1);
    expect((await t.prisma.document.findUniqueOrThrow({ where: { id: statement.id } })).status).toBe('expired');
    expect(await t.prisma.outboxEvent.count({ where: { eventName: 'document.expired', aggregateId: statement.id } })).toBe(1);
    expect((await t.api().get(`/v1/documents/${statement.id}`).set(bearer(borrower.accessToken)).expect(200)).body.status).toBe('expired');
  });

  it('purges documents past retention, keeps ones shared with lenders and retries orphan files', async () => {
    const old = await upload('itr');
    const shared = await upload('udyam_certificate');
    await t.prisma.document.update({ where: { id: old.id }, data: { retentionUntil: PAST } });
    await t.prisma.document.update({ where: { id: shared.id }, data: { retentionUntil: PAST, lockedAt: new Date() } });
    expect(await storage().exists(old.storageKey)).toBe(true);
    expect(await inCls(() => maintenance().purgeExpired())).toBeGreaterThanOrEqual(1);
    const purged = await t.prisma.document.findUniqueOrThrow({ where: { id: old.id } });
    expect(purged).toMatchObject({ status: 'purged' });
    expect(purged.storageDeletedAt).not.toBeNull();
    expect(await storage().exists(old.storageKey)).toBe(false);
    expect((await t.prisma.document.findUniqueOrThrow({ where: { id: shared.id } })).status).toBe('scanned');

    const orphan = await upload('pan');
    await t.prisma.document.update({ where: { id: orphan.id }, data: { status: 'deleted', deletedAt: new Date() } });
    expect(await inCls(() => maintenance().removeOrphanFiles())).toBeGreaterThanOrEqual(1);
    expect((await t.prisma.document.findUniqueOrThrow({ where: { id: orphan.id } })).storageDeletedAt).not.toBeNull();
    expect(await storage().exists(orphan.storageKey)).toBe(false);
  });
});

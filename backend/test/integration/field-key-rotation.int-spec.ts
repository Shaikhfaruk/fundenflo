import { randomUUID } from 'node:crypto';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { FactProvenance, LoginAs } from '../../src/common/enums/db.enums.js';
import { CipherPurpose, KEY_ROTATION_SETTING } from '../../src/infrastructure/crypto/crypto.constants.js';
import { FieldCipher } from '../../src/infrastructure/crypto/field-cipher.service.js';
import { FieldKeyRotation } from '../../src/infrastructure/crypto/field-key-rotation.service.js';
import { otpLogin, randomMobile } from './support/fixtures.js';
import { startTestApp, type TestApp } from './support/test-app.js';

describe('field key rotation', () => {
  let t: TestApp;
  let retired: FieldCipher;
  let activeKeyId: string;

  beforeAll(async () => {
    t = await startTestApp();
    activeKeyId = process.env.CRYPTO_ACTIVE_KEY_ID ?? '';
    const ring = new Map(Object.entries(JSON.parse(process.env.CRYPTO_LOCAL_KEYS ?? '{}') as Record<string, string>).map(([id, key]) => [id, Buffer.from(key, 'base64')]));
    const retiredKeyId = [...ring.keys()].find((id) => id !== activeKeyId) ?? '';
    retired = new FieldCipher({ loadDataKeys: async () => ({ activeKeyId: retiredKeyId, keys: ring }) });
    await retired.onModuleInit();
  });

  afterAll(async () => {
    await t.close();
  });

  it('moves values written with a retired key to the active key and keeps facts append-only', async () => {
    const cipher = t.app.get(FieldCipher);
    const rotation = t.app.get(FieldKeyRotation);
    await otpLogin(t, randomMobile(), LoginAs.borrower);
    const contact = await t.prisma.partyContact.findFirstOrThrow({ orderBy: { createdAt: 'desc' } });
    const mobile = cipher.decrypt(contact.valueEnc, CipherPurpose.PartyContact);
    await t.prisma.partyContact.update({ where: { id: contact.id }, data: { valueEnc: retired.encrypt(mobile, CipherPurpose.PartyContact) } });

    const attribute = await t.prisma.attributeDefinition.findFirstOrThrow();
    const fact = await t.prisma.borrowerFact.create({ data: { partyId: contact.partyId, attributeKey: attribute.key, valueEnc: retired.encryptJson({ amount: 42 }, CipherPurpose.BorrowerFact), provenance: FactProvenance.declared, sourceType: 'key_rotation_test', observedAt: new Date() } });
    const unreadable = await t.prisma.borrowerFact.create({ data: { partyId: contact.partyId, attributeKey: attribute.key, valueEnc: `v1:dk-${randomUUID()}:aaaa:bbbb:cccc`, provenance: FactProvenance.declared, sourceType: 'key_rotation_test', observedAt: new Date() } });

    await expect(t.prisma.$executeRaw`UPDATE borrower_facts SET value_enc = ${cipher.encryptJson({ amount: 7 }, CipherPurpose.BorrowerFact)} WHERE id = ${fact.id}::uuid`).rejects.toThrow(/append-only/);
    await expect(
      t.prisma.$transaction(async (tx) => {
        await tx.$executeRaw`SELECT set_config(${KEY_ROTATION_SETTING}, 'on', true)`;
        await tx.$executeRaw`UPDATE borrower_facts SET source_type = 'tampered' WHERE id = ${fact.id}::uuid`;
      }),
    ).rejects.toThrow(/append-only/);

    const before = new Map((await rotation.backlog()).map((row) => [`${row.table}.${row.column}`, row.rows]));
    expect(before.get('party_contacts.value_enc')).toBeGreaterThanOrEqual(1);
    expect(before.get('borrower_facts.value_enc')).toBeGreaterThanOrEqual(2);

    const run = await rotation.rotate(Number.POSITIVE_INFINITY);
    expect(run).toMatchObject({ complete: true });
    expect(run.rotated).toBeGreaterThanOrEqual(2);
    expect(run.failed).toBeGreaterThanOrEqual(1);

    const rotatedContact = await t.prisma.partyContact.findUniqueOrThrow({ where: { id: contact.id } });
    expect(rotatedContact.valueEnc.startsWith(`v1:${activeKeyId}:`)).toBe(true);
    expect(cipher.decrypt(rotatedContact.valueEnc, CipherPurpose.PartyContact)).toBe(mobile);
    const rotatedFact = await t.prisma.borrowerFact.findUniqueOrThrow({ where: { id: fact.id } });
    expect(cipher.decryptJson(rotatedFact.valueEnc ?? '', CipherPurpose.BorrowerFact)).toEqual({ amount: 42 });
    expect(rotatedFact.sourceType).toBe('key_rotation_test');

    const after = new Map((await rotation.backlog()).map((row) => [`${row.table}.${row.column}`, row.rows]));
    expect(after.get('party_contacts.value_enc')).toBe(0);
    expect(after.get('borrower_facts.value_enc')).toBe(1);
    expect((await rotation.rotate(Number.POSITIVE_INFINITY)).rotated).toBe(0);
    await t.prisma.borrowerFact.delete({ where: { id: unreadable.id } });
  });
});

import { randomInt } from 'node:crypto';

import { ClsService } from 'nestjs-cls';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { LoginAs, NotificationChannel, Role } from '../../src/common/enums/db.enums.js';
import { BlindIndex } from '../../src/infrastructure/crypto/blind-index.service.js';
import { BlindIndexDomain } from '../../src/infrastructure/crypto/crypto.constants.js';
import { UserNotifier } from '../../src/modules/auth/application/user-notifier.service.js';
import type { AuthResult } from '../../src/modules/auth/domain/auth.types.js';
import { NotificationPreferencePrivacyParticipant } from '../../src/modules/notifications/application/notification-preference-privacy.participant.js';
import { NotificationTemplateKey } from '../../src/modules/notifications/domain/notification.constants.js';
import { bearer, createStaffSession, otpLogin, randomMobile, type StaffSession } from './support/fixtures.js';
import { startTestApp, type TestApp } from './support/test-app.js';

const PUSH_TOKEN = `ExponentPushToken[prefs${randomInt(100_000, 999_999)}AbCdEf]`;

describe('notification preferences and template admin', () => {
  let t: TestApp;
  let compliance: StaffSession;
  let support: StaffSession;
  let opsLead: StaffSession;

  const as = (session: AuthResult | StaffSession) => ({
    get: (path: string) => t.api().get(`/v1${path}`).set(bearer(session.accessToken)),
    post: (path: string, body: Record<string, unknown>) => t.api().post(`/v1${path}`).set(bearer(session.accessToken)).send(body),
    put: (path: string, body: Record<string, unknown>, version?: number) => {
      const request = t.api().put(`/v1${path}`).set(bearer(session.accessToken));
      return (version === undefined ? request : request.set('If-Match', `"${version}"`)).send(body);
    },
    patch: (path: string, body: Record<string, unknown>, version?: number) => {
      const request = t.api().patch(`/v1${path}`).set(bearer(session.accessToken));
      return (version === undefined ? request : request.set('If-Match', `"${version}"`)).send(body);
    },
  });

  const notify = (userId: string) => t.app.get(ClsService).run(() => t.app.get(UserNotifier).notify([userId], NotificationTemplateKey.AnalysisCompleted, () => ({ ref: 'AN-26-000001' }), [NotificationChannel.push, NotificationChannel.sms]));

  const deliveries = (recipient: string, domain: (typeof BlindIndexDomain)[keyof typeof BlindIndexDomain], templateKey: string) =>
    t.prisma.notificationDelivery.count({ where: { recipientHash: t.app.get(BlindIndex).hash(domain, recipient), templateKey } });

  beforeAll(async () => {
    t = await startTestApp();
    compliance = await createStaffSession(t, Role.compliance_officer, 'Farah Qureshi');
    support = await createStaffSession(t, Role.support, 'Ravi Menon');
    opsLead = await createStaffSession(t, Role.ops_lead, 'Sunita Rao');
  });

  afterAll(async () => {
    await t.close();
  });

  it('lets a user choose update channels while security codes always go out', async () => {
    const mobile = randomMobile();
    const e164 = `+91${mobile}`;
    const borrower = await otpLogin(t, mobile, LoginAs.borrower);
    const path = '/me/notification-preferences';
    expect((await as(borrower).get(path).expect(200)).body).toEqual({ sms: true, email: true, push: true, version: 0, updatedAt: null });
    expect((await as(borrower).put(path, { sms: false, email: false, push: false }).expect(400)).body.details[0].code).toBe('one_channel_required');
    await as(borrower).put(path, { sms: false, email: true }).expect(400);

    const quiet = await as(borrower).put(path, { sms: false, email: true, push: true }, 0).expect(200);
    expect(quiet.body).toMatchObject({ sms: false, email: true, push: true, version: 1 });
    expect((await as(borrower).put(path, { sms: true, email: true, push: true }, 0).expect(409)).body.code).toBe('VERSION_CONFLICT');

    expect(await notify(borrower.user.id)).toBe(0);
    expect(await deliveries(e164, BlindIndexDomain.Mobile, NotificationTemplateKey.AnalysisCompleted)).toBe(0);

    await t.api().post('/v1/auth/otp/request').send({ mobile, countryCode: '+91' }).expect(200);
    expect(await deliveries(e164, BlindIndexDomain.Mobile, NotificationTemplateKey.AuthOtp)).toBe(2);

    await as(borrower).put('/me/sessions/current/push-token', { token: PUSH_TOKEN }).expect(200);
    expect(await notify(borrower.user.id)).toBe(1);
    expect(await deliveries(PUSH_TOKEN, BlindIndexDomain.PushToken, NotificationTemplateKey.AnalysisCompleted)).toBe(1);

    await as(borrower).put(path, { sms: true, email: true, push: false }, 1).expect(200);
    expect(await notify(borrower.user.id)).toBe(1);
    expect(await deliveries(e164, BlindIndexDomain.Mobile, NotificationTemplateKey.AnalysisCompleted)).toBe(1);
    expect(await deliveries(PUSH_TOKEN, BlindIndexDomain.PushToken, NotificationTemplateKey.AnalysisCompleted)).toBe(1);

    const participant = t.app.get(NotificationPreferencePrivacyParticipant);
    const { partyId } = await t.prisma.user.findUniqueOrThrow({ where: { id: borrower.user.id } });
    const subject = { userId: borrower.user.id, personPartyId: partyId, partyIds: [partyId], requestRef: 'DR-TEST' };
    expect(await t.app.get(ClsService).run(() => participant.export(subject))).toMatchObject({ sms: true, email: true, push: false, version: 2 });
    expect(await t.app.get(ClsService).run(() => participant.erase(subject))).toEqual({ preferences: 1 });
    expect((await as(borrower).get(path).expect(200)).body.version).toBe(0);
  });

  it('lets compliance edit templates within the placeholders the sender provides', async () => {
    const path = '/admin/notification-templates';
    const listed = await as(support).get(path).query({ key: NotificationTemplateKey.AnalysisCompleted, active: 'true' }).expect(200);
    expect(listed.body.items.map((item: { channel: string; locale: string }) => `${item.channel}/${item.locale}`)).toEqual(['sms/en', 'push/en']);
    expect(listed.body.items[0]).toMatchObject({ availableParams: ['ref'], placeholders: ['ref'] });
    await as(support).patch(`${path}/${listed.body.items[0].id}`, { active: true }).expect(403);
    await as(opsLead).post(path, { key: NotificationTemplateKey.AnalysisCompleted, channel: 'sms', locale: 'hi', body: 'केस {{ref}} का विश्लेषण तैयार है' }).expect(403);

    const unknown = await as(compliance).post(path, { key: NotificationTemplateKey.AnalysisCompleted, channel: 'sms', locale: 'hi', body: 'नमस्ते {{name}}, केस {{ref}} तैयार है' }).expect(400);
    expect(unknown.body.details.map((issue: { code: string }) => issue.code)).toEqual(['unknown_placeholder']);
    expect((await as(compliance).post(path, { key: NotificationTemplateKey.AnalysisCompleted, channel: 'push', locale: 'hi', body: 'केस {{ref}} तैयार है' }).expect(400)).body.details[0].path).toBe('subject');
    await as(compliance).post(path, { key: NotificationTemplateKey.AnalysisCompleted, channel: 'whatsapp', locale: 'hi', body: 'केस {{ref}} तैयार है' }).expect(400);
    expect((await as(compliance).post(path, { key: NotificationTemplateKey.AuthOtp, channel: 'sms', locale: 'hi', body: 'आपका कोड {{minutes}} मिनट में समाप्त होगा' }).expect(400)).body.details[0].code).toBe('placeholder_required');

    const created = await as(compliance).post(path, { key: NotificationTemplateKey.AnalysisCompleted, channel: 'sms', locale: 'hi', body: 'केस {{ref}} का विश्लेषण तैयार है', providerTemplateId: '1107160000000000001' }).expect(201);
    expect(created.body).toMatchObject({ locale: 'hi', subject: null, providerTemplateId: '1107160000000000001', active: true, version: 1 });
    expect((await as(compliance).post(path, { key: NotificationTemplateKey.AnalysisCompleted, channel: 'sms', locale: 'hi', body: 'केस {{ref}} तैयार है' }).expect(409)).body.details[0].code).toBe('duplicate');

    const id = created.body.id as string;
    expect((await as(compliance).patch(`${path}/${id}`, { body: 'आपके केस {{ref}} का विश्लेषण तैयार है' }, 1).expect(400)).body.details[0].code).toBe('dlt_template_required');
    const edited = await as(compliance).patch(`${path}/${id}`, { body: 'आपके केस {{ref}} का विश्लेषण तैयार है', providerTemplateId: '1107160000000000002' }, 1).expect(200);
    expect(edited.body).toMatchObject({ body: 'आपके केस {{ref}} का विश्लेषण तैयार है', providerTemplateId: '1107160000000000002', version: 2 });
    expect((await as(compliance).patch(`${path}/${id}`, { active: false }, 1).expect(409)).body.code).toBe('VERSION_CONFLICT');
    expect((await as(compliance).patch(`${path}/${id}`, { active: false }, 2).expect(200)).body.active).toBe(false);

    const english = listed.body.items[0];
    expect((await as(compliance).patch(`${path}/${english.id}`, { active: false }).expect(400)).body.details[0].code).toBe('default_locale_required');
    await as(compliance).patch(`${path}/${english.id}`, {}).expect(400);

    const audit = await t.prisma.auditEvent.findMany({ where: { entityId: id }, orderBy: { occurredAt: 'asc' } });
    expect(audit.map((event) => event.action)).toEqual(['notification_template.created', 'notification_template.changed', 'notification_template.changed']);
  });
});

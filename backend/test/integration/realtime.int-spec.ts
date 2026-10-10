import type { AddressInfo } from 'node:net';
import type { Job } from 'bullmq';
import { ClsService } from 'nestjs-cls';
import { io, type Socket } from 'socket.io-client';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { NotificationChannel, Role } from '../../src/common/enums/db.enums.js';
import type { DomainEventEnvelope } from '../../src/common/events/domain-event.js';
import { EventName } from '../../src/common/events/event-names.js';
import { REALTIME_NAMESPACE } from '../../src/infrastructure/realtime/realtime.constants.js';
import { RealtimePublishProcessor } from '../../src/infrastructure/realtime/realtime-publish.processor.js';
import type { AuthResult } from '../../src/modules/auth/domain/auth.types.js';
import { UserNotifier } from '../../src/modules/auth/application/user-notifier.service.js';
import { NotificationTemplateKey } from '../../src/modules/notifications/domain/notification.constants.js';
import { bearer, createPartnerFirm, createPartnerSession, createStaffSession, type StaffSession } from './support/fixtures.js';
import { startTestApp, type TestApp } from './support/test-app.js';

const PUSH_TOKEN = 'ExponentPushToken[xYz123AbC456dEf789]';

const next = (socket: Socket, event: string) => new Promise<Record<string, unknown>>((resolve) => socket.once(event, resolve));

describe('realtime gateway and push notifications', () => {
  let t: TestApp;
  let url: string;
  let ops: StaffSession;
  let firm: string;
  let owner: AuthResult;
  let publisher: RealtimePublishProcessor;
  const sockets: Socket[] = [];

  const connect = (token: string) =>
    new Promise<{ socket: Socket; first: { event: string; data: unknown } }>((resolve) => {
      const socket = io(url, { auth: { token }, transports: ['websocket'], reconnection: false });
      sockets.push(socket);
      socket.on('ready', (data: unknown) => resolve({ socket, first: { event: 'ready', data } }));
      socket.on('error', (data: unknown) => resolve({ socket, first: { event: 'error', data } }));
    });

  const publish = (name: EventName, payload: Record<string, unknown>) =>
    t.app.get(ClsService).run(() => publisher.process({ name, data: { id: `evt-${Date.now()}`, name, aggregateType: 'test', aggregateId: null, payload, actor: null, requestId: null, occurredAt: new Date().toISOString() } } as Job<DomainEventEnvelope>));

  beforeAll(async () => {
    t = await startTestApp();
    await t.app.listen(0, '127.0.0.1');
    url = `http://127.0.0.1:${(t.app.getHttpServer().address() as AddressInfo).port}${REALTIME_NAMESPACE}`;
    ops = await createStaffSession(t, Role.ops_lead, 'Zainab Qureshi');
    const gurugramId = (await t.api().get('/v1/catalog/geo/cities').query({ q: 'Gurugram' }).expect(200)).body.items[0].id;
    firm = await createPartnerFirm(t, { name: 'Zaveri Associates', cityId: gurugramId, signedUpByUserId: ops.user.id });
    owner = await createPartnerSession(t, firm);
    publisher = new RealtimePublishProcessor(t.app.get(ClsService), t.redis);
  });

  afterAll(async () => {
    for (const socket of sockets) socket.disconnect();
    await t.close();
  });

  it('refuses sockets without a valid access token', async () => {
    const { first, socket } = await connect('not-a-token');
    expect(first).toMatchObject({ event: 'error', data: { code: 'TOKEN_INVALID' } });
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(socket.connected).toBe(false);
  });

  it('delivers id-only events to the firm and staff rooms and drops a suspended membership', async () => {
    const partner = await connect(owner.accessToken);
    const staff = await connect(ops.accessToken);
    expect(partner.first).toMatchObject({ event: 'ready', data: { context: 'partner' } });
    expect(staff.first).toMatchObject({ event: 'ready', data: { context: 'staff' } });

    const partnerEvent = next(partner.socket, 'lead.assignment.changed');
    const staffEvent = next(staff.socket, 'lead.assignment.changed');
    await publish(EventName.AssignmentOffered, { assignmentId: 'a-1', leadId: 'l-1', organizationId: firm, respondBy: new Date().toISOString() });
    expect(await partnerEvent).toMatchObject({ assignmentId: 'a-1', leadId: 'l-1' });
    expect(Object.keys(await staffEvent).toSorted((left, right) => left.localeCompare(right))).toEqual(['assignmentId', 'eventId', 'leadId', 'occurredAt', 'status']);

    const leadEvent = next(staff.socket, 'lead.changed');
    await publish(EventName.LeadCaptured, { leadId: 'l-2', ref: 'LD-26-000999' });
    expect(await leadEvent).toMatchObject({ leadId: 'l-2' });

    const dropped = new Promise((resolve) => partner.socket.once('disconnect', resolve));
    await publish(EventName.MembershipChanged, { membershipId: owner.user.activeContext?.membershipId, status: 'suspended' });
    expect(await dropped).toBe('io server disconnect');
    expect(staff.socket.connected).toBe(true);
  });

  it('registers an Expo push token on the session and prefers push over SMS', async () => {
    await t.api().put('/v1/me/sessions/current/push-token').set(bearer(owner.accessToken)).send({ token: 'abc' }).expect(400);
    const registered = await t.api().put('/v1/me/sessions/current/push-token').set(bearer(owner.accessToken)).send({ token: PUSH_TOKEN }).expect(200);
    expect(registered.body).toEqual({ registered: true });

    const before = await t.prisma.notificationDelivery.count({ where: { templateKey: NotificationTemplateKey.FollowUpDue } });
    const sent = await t.app.get(ClsService).run(() => t.app.get(UserNotifier).notify([owner.user.id], NotificationTemplateKey.FollowUpDue, () => ({ ref: 'LD-26-000001', dueAt: '10 Oct, 5:00 pm' }), [NotificationChannel.push, NotificationChannel.sms]));
    expect(sent).toBe(1);
    const deliveries = await t.prisma.notificationDelivery.findMany({ where: { templateKey: NotificationTemplateKey.FollowUpDue }, orderBy: { id: 'desc' }, take: (await t.prisma.notificationDelivery.count({ where: { templateKey: NotificationTemplateKey.FollowUpDue } })) - before });
    expect(deliveries.map((delivery) => delivery.channel)).toEqual(['push']);
    expect(deliveries[0]?.recipientMasked).toBe('ExponentPushToken[…');

    await t.api().put('/v1/me/sessions/current/push-token').set(bearer(owner.accessToken)).send({ token: null }).expect(200);
    const fallback = await t.app.get(ClsService).run(() => t.app.get(UserNotifier).notify([owner.user.id], NotificationTemplateKey.FollowUpDue, () => ({ ref: 'LD-26-000001', dueAt: '10 Oct, 5:00 pm' }), [NotificationChannel.push, NotificationChannel.sms]));
    expect(fallback).toBe(1);
    const latest = await t.prisma.notificationDelivery.findFirstOrThrow({ where: { templateKey: NotificationTemplateKey.FollowUpDue }, orderBy: { id: 'desc' } });
    expect(latest.channel).toBe('sms');
  });
});

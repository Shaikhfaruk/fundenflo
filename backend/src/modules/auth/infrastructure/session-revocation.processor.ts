import { Processor } from '@nestjs/bullmq';
import type { Job } from 'bullmq';
import { ClsService } from 'nestjs-cls';

import type { RequestContextStore } from '../../../common/context/request-context.service.js';
import type { DomainEventEnvelope } from '../../../common/events/domain-event.js';
import { EventName } from '../../../common/events/event-names.js';
import { MembershipStatus, OrganizationStatus, UserStatus } from '../../../common/enums/db.enums.js';
import { ContextualProcessor } from '../../../infrastructure/queue/contextual.processor.js';
import { QueueName } from '../../../infrastructure/queue/queue-names.js';
import { SessionService } from '../application/session.service.js';
import { RevokeReason } from '../domain/auth.enums.js';

type MembershipChangedPayload = { membershipId: string; status: MembershipStatus };

type UserStatusChangedPayload = { userId: string; status: UserStatus };

type OrganizationStatusChangedPayload = { organizationId: string; status: OrganizationStatus; membershipIds: string[] };

@Processor(QueueName.AuthSessionRevocations)
export class SessionRevocationProcessor extends ContextualProcessor<DomainEventEnvelope, { revoked: number }> {
  constructor(
    cls: ClsService<RequestContextStore>,
    private readonly sessions: SessionService,
  ) {
    super(cls);
  }

  protected async handle(job: Job<DomainEventEnvelope>): Promise<{ revoked: number }> {
    const event = job.data;
    if (event.name === EventName.MembershipChanged) {
      const payload = event.payload as MembershipChangedPayload;
      if (payload.status === MembershipStatus.active) return { revoked: 0 };
      return { revoked: await this.sessions.revokeForMembership(payload.membershipId, RevokeReason.MembershipChanged) };
    }
    if (event.name === EventName.UserStatusChanged) {
      const payload = event.payload as UserStatusChangedPayload;
      if (payload.status === UserStatus.active) return { revoked: 0 };
      return { revoked: await this.sessions.revokeForUser(payload.userId, RevokeReason.UserSuspended) };
    }
    if (event.name === EventName.OrganizationStatusChanged) {
      const payload = event.payload as OrganizationStatusChangedPayload;
      if (payload.status === OrganizationStatus.active) return { revoked: 0 };
      let revoked = 0;
      for (const membershipId of payload.membershipIds) revoked += await this.sessions.revokeForMembership(membershipId, RevokeReason.OrganizationInactive);
      return { revoked };
    }
    return { revoked: 0 };
  }
}

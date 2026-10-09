import { Module } from '@nestjs/common';

import { PartiesModule } from '../parties/parties.module.js';
import { InvitationService } from './application/invitation.service.js';
import { MembershipService } from './application/membership.service.js';
import { AdminInvitationsController } from './http/admin-invitations.controller.js';
import { AdminMembershipsController } from './http/admin-memberships.controller.js';
import { AccessRepository } from './infrastructure/access.repository.js';

@Module({
  imports: [PartiesModule],
  controllers: [AdminMembershipsController, AdminInvitationsController],
  providers: [AccessRepository, MembershipService, InvitationService],
  exports: [AccessRepository, MembershipService, InvitationService],
})
export class AccessModule {}

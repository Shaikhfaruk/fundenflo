import { Module } from '@nestjs/common';

import { PartiesModule } from '../parties/parties.module.js';
import { ApiClientService } from './application/api-client.service.js';
import { InvitationService } from './application/invitation.service.js';
import { MembershipService } from './application/membership.service.js';
import { OrganizationService } from './application/organization.service.js';
import { AdminApiClientsController } from './http/admin-api-clients.controller.js';
import { AdminInvitationsController } from './http/admin-invitations.controller.js';
import { ApiKeyGuard } from './http/api-key.guard.js';
import { AdminMembershipsController } from './http/admin-memberships.controller.js';
import { AccessRepository } from './infrastructure/access.repository.js';
import { ApiClientRepository } from './infrastructure/api-client.repository.js';

@Module({
  imports: [PartiesModule],
  controllers: [AdminMembershipsController, AdminInvitationsController, AdminApiClientsController],
  providers: [AccessRepository, ApiClientRepository, MembershipService, InvitationService, OrganizationService, ApiClientService, ApiKeyGuard],
  exports: [AccessRepository, MembershipService, InvitationService, OrganizationService, ApiClientService, ApiKeyGuard],
})
export class AccessModule {}

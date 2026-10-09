import { Injectable } from '@nestjs/common';

import { ContactType } from '../../../common/enums/db.enums.js';
import { AppError } from '../../../common/errors/app-error.js';
import { ErrorCode } from '../../../common/errors/error-codes.js';
import type { UserLogin } from '../../../generated/prisma/client.js';
import { toMembershipView } from '../../access/application/access.views.js';
import { AccessRepository } from '../../access/infrastructure/access.repository.js';
import { PartyService } from '../../parties/application/party.service.js';
import type { LoginView, MeView } from '../domain/auth.types.js';
import { IdentityRepository } from '../infrastructure/identity.repository.js';

export const toLoginView = (login: UserLogin): LoginView => ({
  id: login.id,
  method: login.method,
  identifier: login.identifierMasked,
  verifiedAt: login.verifiedAt.toISOString(),
  lastUsedAt: login.lastUsedAt?.toISOString() ?? null,
});

@Injectable()
export class MeViewBuilder {
  constructor(
    private readonly identity: IdentityRepository,
    private readonly access: AccessRepository,
    private readonly parties: PartyService,
  ) {}

  async build(userId: string, activeMembershipId: string | null): Promise<MeView> {
    const user = await this.identity.findUser(userId);
    if (!user) throw new AppError(ErrorCode.NOT_FOUND);
    const memberships = await this.access.listMemberships(userId);
    const logins = await this.identity.listLogins(userId);
    const mobile = await this.parties.getPrimaryContactValue(user.partyId, ContactType.mobile);
    const email = await this.parties.getPrimaryContactValue(user.partyId, ContactType.email);
    const active = memberships.find((membership) => membership.id === activeMembershipId);
    return {
      id: user.id,
      status: user.status,
      fullName: user.party.displayName,
      preferredLanguage: user.party.preferredLanguage,
      mobile,
      email,
      profileComplete: Boolean(user.party.displayName),
      version: user.party.version,
      activeContext: active
        ? { membershipId: active.id, context: active.context, role: active.role, organization: active.organization }
        : null,
      memberships: memberships.map(toMembershipView),
      logins: logins.map(toLoginView),
    };
  }
}

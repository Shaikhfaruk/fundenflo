import { Transactional } from '@nestjs-cls/transactional';
import { Injectable } from '@nestjs/common';

import { ContactType, LoginAs, LoginMethod, MembershipStatus, OrganizationStatus, OtpPurpose, UserStatus } from '../../../common/enums/db.enums.js';
import { EventName } from '../../../common/events/event-names.js';
import { AppError } from '../../../common/errors/app-error.js';
import { ErrorCode } from '../../../common/errors/error-codes.js';
import type { DeviceInput } from '../../../common/validation/common.schemas.js';
import { OutboxService } from '../../../infrastructure/outbox/outbox.service.js';
import { InvitationService } from '../../access/application/invitation.service.js';
import { MembershipService } from '../../access/application/membership.service.js';
import { LOGIN_AS_CONTEXT } from '../../access/domain/access.constants.js';
import { AuditService } from '../../audit/application/audit.service.js';
import { AuditAction, AuditEntity } from '../../audit/domain/audit.constants.js';
import { PartyResolver } from '../../parties/application/party-resolver.service.js';
import { PartyService } from '../../parties/application/party.service.js';
import { ContactSource } from '../../parties/domain/party.constants.js';
import { SignupChannel } from '../domain/auth.constants.js';
import { NextActionCode } from '../domain/auth.enums.js';
import type { AuthResult, NextAction, OtpIssued } from '../domain/auth.types.js';
import { IdentityRepository } from '../infrastructure/identity.repository.js';
import { type IdentifierInput, LoginIdentifierService, type ResolvedIdentifier } from './login-identifier.service.js';
import { MeViewBuilder } from './me-view.builder.js';
import { OtpService } from './otp.service.js';
import { actorForSession, SessionService } from './session.service.js';

export type OtpRequestInput = IdentifierInput & { loginAs: LoginAs; referralCode?: string };

export type OtpVerifyInput = IdentifierInput & { otp: string; challengeId?: string; device?: DeviceInput };

type LoginPayload = { referralCode?: string };

const NEXT_ACTION_MESSAGES: Record<NextActionCode, string> = {
  [NextActionCode.PartnerNotOnboarded]: 'This account is not registered as a CA or DSA partner yet. Complete partner signup to continue.',
  [NextActionCode.MembershipRequired]: 'This account has not been given access to a lender organization yet. Ask your organization admin for an invitation.',
  [NextActionCode.PartnerPendingVerification]: 'Your partner registration is being verified. You can sign in as a partner once it is approved.',
  [NextActionCode.MembershipSuspended]: 'Access to this organization is suspended. Contact FundenFlo support.',
};

@Injectable()
export class OtpLoginService {
  constructor(
    private readonly identifiers: LoginIdentifierService,
    private readonly otp: OtpService,
    private readonly identity: IdentityRepository,
    private readonly resolver: PartyResolver,
    private readonly parties: PartyService,
    private readonly memberships: MembershipService,
    private readonly invitations: InvitationService,
    private readonly sessions: SessionService,
    private readonly me: MeViewBuilder,
    private readonly outbox: OutboxService,
    private readonly audit: AuditService,
  ) {}

  async request(input: OtpRequestInput): Promise<OtpIssued> {
    const identifier = this.identifiers.resolve(input);
    const deliver = await this.canSignIn(identifier, input.loginAs);
    return this.otp.issue({
      purpose: OtpPurpose.login,
      channel: identifier.channel,
      identifier: identifier.value,
      identifierHash: identifier.hash,
      loginAs: input.loginAs,
      payload: input.referralCode ? { referralCode: input.referralCode } : undefined,
      deliver,
    });
  }

  async verify(input: OtpVerifyInput): Promise<AuthResult> {
    const identifier = this.identifiers.resolve(input);
    const verified = await this.otp.verify<LoginPayload>({
      purpose: OtpPurpose.login,
      code: input.otp,
      identifierHash: identifier.hash,
      challengeId: input.challengeId,
    });
    return this.completeLogin({
      identifier,
      loginAs: verified.challenge.loginAs ?? LoginAs.borrower,
      referralCode: verified.payload?.referralCode ?? null,
      device: input.device,
    });
  }

  @Transactional()
  private async completeLogin(input: { identifier: ResolvedIdentifier; loginAs: LoginAs; referralCode: string | null; device?: DeviceInput }): Promise<AuthResult> {
    const { identifier } = input;
    const existing = await this.identity.findLogin(identifier.method, identifier.hash);
    if (!existing && !(await this.canSignIn(identifier, input.loginAs))) throw new AppError(ErrorCode.OTP_INVALID);

    let userId: string;
    let partyId: string;
    let isNewUser = false;
    if (existing) {
      userId = existing.userId;
      partyId = existing.user.partyId;
      if (existing.user.status !== UserStatus.active) throw new AppError(ErrorCode.USER_SUSPENDED);
      await this.identity.updateLogin(existing.id, { lastUsedAt: new Date() });
      await this.parties.addContact(partyId, { type: identifier.channel, value: identifier.value, verified: true, primary: false, source: ContactSource.OtpLogin });
    } else {
      const resolved = await this.resolver.resolvePersonByVerifiedContact(identifier.channel, identifier.value, ContactSource.OtpLogin);
      const user = await this.identity.createUser({ partyId: resolved.partyId, signupChannel: identifier.method === LoginMethod.email_otp ? SignupChannel.EmailOtp : SignupChannel.MobileOtp, signupReferralCode: input.referralCode });
      const encoded = this.identifiers.encodeForLogin(identifier);
      await this.identity.createLogin({
        userId: user.id,
        method: identifier.method,
        identifierHash: encoded.hash,
        identifierEnc: encoded.encrypted,
        identifierMasked: encoded.masked,
        verifiedAt: new Date(),
        lastUsedAt: new Date(),
      });
      userId = user.id;
      partyId = resolved.partyId;
      isNewUser = true;
    }

    const membership = await this.memberships.resolveForLogin(userId, input.loginAs, { channel: identifier.channel, hash: identifier.hash });
    const issued = await this.sessions.start({ userId, membership, loginMethod: identifier.method, device: input.device });
    await this.identity.touchLastLogin(userId);

    if (isNewUser) {
      await this.outbox.publish({
        name: EventName.UserSignedUp,
        aggregateType: 'user',
        aggregateId: userId,
        payload: { userId, partyId, loginAs: input.loginAs, channel: identifier.channel, referralCode: input.referralCode },
      });
    }
    await this.audit.record({
      action: AuditAction.OtpLogin,
      entityType: AuditEntity.User,
      entityId: userId,
      actor: actorForSession(issued.session, membership),
      metadata: { loginAs: input.loginAs, channel: identifier.channel, newUser: isNewUser, context: issued.session.context },
    });

    return {
      ...issued.tokens,
      user: await this.me.build(userId, membership?.id ?? null),
      nextAction: membership ? null : await this.nextAction(userId, input.loginAs),
    };
  }

  private async canSignIn(identifier: ResolvedIdentifier, loginAs: LoginAs): Promise<boolean> {
    if (identifier.channel === ContactType.mobile) return true;
    if (await this.identity.findLogin(identifier.method, identifier.hash)) return true;
    return this.invitations.hasAcceptable(identifier.channel, identifier.hash, LOGIN_AS_CONTEXT[loginAs]);
  }

  private async nextAction(userId: string, loginAs: LoginAs): Promise<NextAction> {
    const code = await this.nextActionCode(userId, loginAs);
    return { code, message: NEXT_ACTION_MESSAGES[code] };
  }

  private async nextActionCode(userId: string, loginAs: LoginAs): Promise<NextActionCode> {
    const latest = await this.memberships.latestForContext(userId, LOGIN_AS_CONTEXT[loginAs]);
    if (latest?.status === MembershipStatus.suspended || latest?.organization?.status === OrganizationStatus.suspended) return NextActionCode.MembershipSuspended;
    if (loginAs === LoginAs.lender) return NextActionCode.MembershipRequired;
    if (latest?.status === MembershipStatus.pending && latest.organization?.status === OrganizationStatus.pending) return NextActionCode.PartnerPendingVerification;
    return NextActionCode.PartnerNotOnboarded;
  }
}

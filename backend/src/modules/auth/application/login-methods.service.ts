import { Transactional } from '@nestjs-cls/transactional';
import { Injectable } from '@nestjs/common';

import type { UserActor } from '../../../common/context/actor.js';
import { ContactType, LoginMethod, OtpPurpose } from '../../../common/enums/db.enums.js';
import { EventName } from '../../../common/events/event-names.js';
import { AppError } from '../../../common/errors/app-error.js';
import { ErrorCode } from '../../../common/errors/error-codes.js';
import { OutboxService } from '../../../infrastructure/outbox/outbox.service.js';
import { AuditService } from '../../audit/application/audit.service.js';
import { AuditAction, AuditEntity } from '../../audit/domain/audit.constants.js';
import { PartyService } from '../../parties/application/party.service.js';
import { ContactSource } from '../../parties/domain/party.constants.js';
import { RevokeReason } from '../domain/auth.enums.js';
import type { LoginView, MeView, OtpIssued } from '../domain/auth.types.js';
import { IdentityRepository } from '../infrastructure/identity.repository.js';
import { LoginIdentifierService, type ResolvedIdentifier } from './login-identifier.service.js';
import { MeViewBuilder, toLoginView } from './me-view.builder.js';
import { OtpService } from './otp.service.js';
import { SessionService } from './session.service.js';

type IdentifierPayload = { channel: ResolvedIdentifier['channel']; value: string };

@Injectable()
export class LoginMethodsService {
  constructor(
    private readonly identifiers: LoginIdentifierService,
    private readonly identity: IdentityRepository,
    private readonly otp: OtpService,
    private readonly parties: PartyService,
    private readonly sessions: SessionService,
    private readonly me: MeViewBuilder,
    private readonly outbox: OutboxService,
    private readonly audit: AuditService,
  ) {}

  async list(actor: UserActor): Promise<LoginView[]> {
    return (await this.identity.listLogins(actor.userId)).map(toLoginView);
  }

  async startEmailLink(actor: UserActor, email: string): Promise<OtpIssued> {
    const identifier = this.identifiers.resolve({ email });
    if (await this.identity.findLogin(identifier.method, identifier.hash)) throw new AppError(ErrorCode.LOGIN_IN_USE);
    return this.otp.issue({
      purpose: OtpPurpose.link_login,
      channel: identifier.channel,
      identifier: identifier.value,
      identifierHash: identifier.hash,
      userId: actor.userId,
      payload: { channel: identifier.channel, value: identifier.value } satisfies IdentifierPayload,
      deliver: true,
    });
  }

  async completeEmailLink(actor: UserActor, challengeId: string, code: string): Promise<LoginView> {
    const verified = await this.otp.verify<IdentifierPayload>({ purpose: OtpPurpose.link_login, code, challengeId, userId: actor.userId });
    if (!verified.payload) throw new AppError(ErrorCode.OTP_EXPIRED);
    return this.linkLogin(actor, this.identifiers.resolve({ email: verified.payload.value }));
  }

  @Transactional()
  async remove(actor: UserActor, loginId: string): Promise<void> {
    const login = await this.identity.findLoginForUser(actor.userId, loginId);
    if (!login) throw new AppError(ErrorCode.NOT_FOUND);
    if (login.method === LoginMethod.mobile_otp) throw new AppError(ErrorCode.PRIMARY_LOGIN_REQUIRED);
    if ((await this.identity.countLogins(actor.userId)) <= 1) throw new AppError(ErrorCode.LAST_LOGIN_METHOD);
    await this.identity.deleteLogin(login.id);
    await this.outbox.publish({ name: EventName.LoginRemoved, aggregateType: 'user', aggregateId: actor.userId, payload: { userId: actor.userId, method: login.method } });
    await this.audit.record({
      action: AuditAction.LoginRemoved,
      entityType: AuditEntity.UserLogin,
      entityId: login.id,
      metadata: { method: login.method, identifier: login.identifierMasked },
    });
  }

  async startMobileChange(actor: UserActor, mobile: string, countryCode: string | undefined): Promise<OtpIssued> {
    const identifier = this.identifiers.resolve({ mobile, countryCode });
    if (await this.identity.findLogin(identifier.method, identifier.hash)) throw new AppError(ErrorCode.MOBILE_IN_USE);
    return this.otp.issue({
      purpose: OtpPurpose.mobile_change,
      channel: identifier.channel,
      identifier: identifier.value,
      identifierHash: identifier.hash,
      userId: actor.userId,
      payload: { channel: identifier.channel, value: identifier.value } satisfies IdentifierPayload,
      deliver: true,
    });
  }

  async completeMobileChange(actor: UserActor, challengeId: string, code: string): Promise<MeView> {
    const verified = await this.otp.verify<IdentifierPayload>({ purpose: OtpPurpose.mobile_change, code, challengeId, userId: actor.userId });
    if (!verified.payload) throw new AppError(ErrorCode.OTP_EXPIRED);
    await this.changeMobile(actor, this.identifiers.resolve({ mobile: verified.payload.value }));
    return this.me.build(actor.userId, actor.membershipId);
  }

  @Transactional()
  private async linkLogin(actor: UserActor, identifier: ResolvedIdentifier): Promise<LoginView> {
    if (await this.identity.findLogin(identifier.method, identifier.hash)) throw new AppError(ErrorCode.LOGIN_IN_USE);
    const user = await this.identity.findUser(actor.userId);
    if (!user) throw new AppError(ErrorCode.NOT_FOUND);
    const encoded = this.identifiers.encodeForLogin(identifier);
    const login = await this.identity.createLogin({
      userId: actor.userId,
      method: identifier.method,
      identifierHash: encoded.hash,
      identifierEnc: encoded.encrypted,
      identifierMasked: encoded.masked,
      verifiedAt: new Date(),
    });
    await this.parties.addContact(user.partyId, { type: identifier.channel, value: identifier.value, verified: true, primary: true, source: ContactSource.LoginLink });
    await this.outbox.publish({ name: EventName.LoginLinked, aggregateType: 'user', aggregateId: actor.userId, payload: { userId: actor.userId, method: login.method } });
    await this.audit.record({ action: AuditAction.LoginLinked, entityType: AuditEntity.UserLogin, entityId: login.id, metadata: { method: login.method, identifier: login.identifierMasked } });
    return toLoginView(login);
  }

  @Transactional()
  private async changeMobile(actor: UserActor, identifier: ResolvedIdentifier): Promise<void> {
    if (identifier.channel !== ContactType.mobile) throw new AppError(ErrorCode.MOBILE_INVALID);
    if (await this.identity.findLogin(identifier.method, identifier.hash)) throw new AppError(ErrorCode.MOBILE_IN_USE);
    const user = await this.identity.findUser(actor.userId);
    const current = await this.identity.findUserLogin(actor.userId, LoginMethod.mobile_otp);
    if (!user || !current) throw new AppError(ErrorCode.NOT_FOUND);
    const encoded = this.identifiers.encodeForLogin(identifier);
    await this.identity.updateLogin(current.id, {
      identifierHash: encoded.hash,
      identifierEnc: encoded.encrypted,
      identifierMasked: encoded.masked,
      verifiedAt: new Date(),
    });
    await this.parties.addContact(user.partyId, { type: ContactType.mobile, value: identifier.value, verified: true, primary: true, source: ContactSource.MobileChange });
    await this.sessions.revokeForUser(actor.userId, RevokeReason.MobileChanged, actor.sessionId);
    await this.outbox.publish({ name: EventName.UserMobileChanged, aggregateType: 'user', aggregateId: actor.userId, payload: { userId: actor.userId } });
    await this.audit.record({
      action: AuditAction.MobileChanged,
      entityType: AuditEntity.UserLogin,
      entityId: current.id,
      metadata: { from: current.identifierMasked, to: encoded.masked },
    });
  }
}

import { Transactional } from '@nestjs-cls/transactional';
import { Injectable, type OnModuleInit } from '@nestjs/common';
import { argon2id, hash as argonHash, verify as argonVerify } from 'argon2';
import type { Redis } from 'ioredis';
import { Secret, TOTP } from 'otpauth';

import { ContactType, LoginMethod, SessionContext, UserStatus } from '../../../common/enums/db.enums.js';
import { AppError } from '../../../common/errors/app-error.js';
import { ErrorCode } from '../../../common/errors/error-codes.js';
import type { DeviceInput } from '../../../common/validation/common.schemas.js';
import { maskEmail } from '../../../engines/party-matching/mask.js';
import { CipherPurpose } from '../../../infrastructure/crypto/crypto.constants.js';
import { FieldCipher } from '../../../infrastructure/crypto/field-cipher.service.js';
import { randomToken, sha256 } from '../../../infrastructure/crypto/secure-random.js';
import { InjectRedis } from '../../../infrastructure/redis/redis.module.js';
import { InvitationService } from '../../access/application/invitation.service.js';
import { MembershipService } from '../../access/application/membership.service.js';
import { AccessRepository } from '../../access/infrastructure/access.repository.js';
import { AuditService } from '../../audit/application/audit.service.js';
import { AuditAction, AuditEntity } from '../../audit/domain/audit.constants.js';
import { PartyResolver } from '../../parties/application/party-resolver.service.js';
import { ContactSource } from '../../parties/domain/party.constants.js';
import {
  ARGON2_OPTIONS,
  MFA_MAX_ATTEMPTS,
  MFA_TOKEN_TTL_SECONDS,
  MfaKey,
  SignupChannel,
  STAFF_LOCK_MINUTES,
  STAFF_LOGIN_MAX_FAILURES,
  TOTP_SETTINGS,
} from '../domain/auth.constants.js';
import type { AuthResult } from '../domain/auth.types.js';
import { IdentityRepository } from '../infrastructure/identity.repository.js';
import { LoginIdentifierService } from './login-identifier.service.js';
import { MeViewBuilder } from './me-view.builder.js';
import { actorForSession, SessionService } from './session.service.js';

type MfaState = {
  userId: string;
  loginId: string;
  membershipId: string;
  label: string;
  pendingSecret: string | null;
  attempts: number;
};

export type StaffLoginChallenge = {
  mfaToken: string;
  mfaRequired: true;
  expiresIn: number;
  mfaSetup: { secret: string; otpauthUrl: string } | null;
};

@Injectable()
export class StaffAuthService implements OnModuleInit {
  private dummyHash = '';

  constructor(
    private readonly identifiers: LoginIdentifierService,
    private readonly identity: IdentityRepository,
    private readonly access: AccessRepository,
    private readonly memberships: MembershipService,
    private readonly invitations: InvitationService,
    private readonly resolver: PartyResolver,
    private readonly sessions: SessionService,
    private readonly me: MeViewBuilder,
    private readonly cipher: FieldCipher,
    private readonly audit: AuditService,
    @InjectRedis() private readonly redis: Redis,
  ) {}

  async onModuleInit() {
    this.dummyHash = await this.hashPassword(randomToken(16));
  }

  async login(email: string, password: string): Promise<StaffLoginChallenge> {
    const identifier = this.identifiers.resolve({ email });
    const login = await this.identity.findLogin(LoginMethod.password, identifier.hash);
    const credential = login?.user.staffCredential;
    if (!login || !credential) {
      await argonVerify(this.dummyHash, password).catch(() => false);
      throw new AppError(ErrorCode.CREDENTIALS_INVALID);
    }
    if (credential.lockedUntil && credential.lockedUntil.getTime() > Date.now()) {
      throw new AppError(ErrorCode.ACCOUNT_LOCKED, { retryAfterSeconds: Math.ceil((credential.lockedUntil.getTime() - Date.now()) / 1000) });
    }
    if (!(await argonVerify(credential.passwordHash, password))) {
      await this.recordFailure(login.userId, credential.failedAttempts + 1);
      throw new AppError(ErrorCode.CREDENTIALS_INVALID);
    }
    if (credential.failedAttempts > 0 || credential.lockedUntil) {
      await this.identity.updateStaffCredential(login.userId, { failedAttempts: 0, lockedUntil: null });
    }
    if (login.user.status !== UserStatus.active) throw new AppError(ErrorCode.USER_SUSPENDED);
    const membership = await this.access.findFirstActiveMembership(login.userId, SessionContext.staff);
    if (!membership) throw new AppError(ErrorCode.MEMBERSHIP_INACTIVE);

    const pendingSecret = credential.totpEnabledAt ? null : new Secret({ size: TOTP_SETTINGS.secretBytes }).base32;
    const state: MfaState = { userId: login.userId, loginId: login.id, membershipId: membership.id, label: identifier.value, pendingSecret, attempts: 0 };
    const mfaToken = randomToken(32);
    await this.redis.set(MfaKey.challenge(sha256(mfaToken)), this.cipher.encryptJson(state, CipherPurpose.MfaChallenge), 'EX', MFA_TOKEN_TTL_SECONDS);
    return {
      mfaToken,
      mfaRequired: true,
      expiresIn: MFA_TOKEN_TTL_SECONDS,
      mfaSetup: pendingSecret ? { secret: pendingSecret, otpauthUrl: this.totp(identifier.value, pendingSecret).toString() } : null,
    };
  }

  async verifyMfa(mfaToken: string, code: string, device: DeviceInput | undefined): Promise<AuthResult> {
    const key = MfaKey.challenge(sha256(mfaToken));
    const raw = await this.redis.get(key);
    if (!raw) throw new AppError(ErrorCode.MFA_TOKEN_INVALID);
    const state = this.cipher.decryptJson<MfaState>(raw, CipherPurpose.MfaChallenge);
    if (state.attempts >= MFA_MAX_ATTEMPTS) {
      await this.redis.del(key);
      throw new AppError(ErrorCode.MFA_TOKEN_INVALID);
    }

    const credential = await this.identity.findStaffCredential(state.userId);
    const secret = state.pendingSecret ?? (credential?.totpSecretEnc ? this.cipher.decrypt(credential.totpSecretEnc, CipherPurpose.TotpSecret) : null);
    if (!secret) throw new AppError(ErrorCode.MFA_TOKEN_INVALID);

    const totp = this.totp(state.label, secret);
    const delta = totp.validate({ token: code, window: TOTP_SETTINGS.window });
    if (delta === null) {
      await this.redis.set(key, this.cipher.encryptJson({ ...state, attempts: state.attempts + 1 }, CipherPurpose.MfaChallenge), 'KEEPTTL');
      throw new AppError(ErrorCode.MFA_CODE_INVALID);
    }
    const replayTtl = TOTP_SETTINGS.period * (TOTP_SETTINGS.window * 2 + 1);
    const fresh = await this.redis.set(MfaKey.usedCounter(state.userId, totp.counter() + delta), '1', 'EX', replayTtl, 'NX');
    if (!fresh) throw new AppError(ErrorCode.MFA_CODE_INVALID);
    await this.redis.del(key);
    return this.completeLogin(state, device);
  }

  @Transactional()
  async acceptInvitation(token: string, password: string, fullName: string): Promise<{ userId: string; email: string }> {
    const invitation = await this.invitations.findAcceptableByToken(token);
    if (invitation.context !== SessionContext.staff || invitation.channel !== ContactType.email) throw new AppError(ErrorCode.INVITATION_INVALID);
    const email = this.invitations.decryptRecipient(invitation);
    const identifier = this.identifiers.resolve({ email });
    const existing = await this.identity.findLogin(LoginMethod.password, identifier.hash);

    let userId = existing?.userId;
    if (!userId) {
      const resolved = await this.resolver.resolvePersonByVerifiedContact(ContactType.email, identifier.value, ContactSource.StaffInvitation, fullName);
      const user = await this.identity.createUser({ partyId: resolved.partyId, signupChannel: SignupChannel.StaffInvitation });
      const encoded = this.identifiers.encodeForLogin(identifier);
      await this.identity.createLogin({
        userId: user.id,
        method: LoginMethod.password,
        identifierHash: encoded.hash,
        identifierEnc: encoded.encrypted,
        identifierMasked: encoded.masked,
        verifiedAt: new Date(),
      });
      await this.identity.createStaffCredential({ userId: user.id, passwordHash: await this.hashPassword(password), passwordChangedAt: new Date() });
      userId = user.id;
    }
    await this.invitations.accept(invitation, userId);
    return { userId, email: maskEmail(identifier.value) };
  }

  @Transactional()
  private async completeLogin(state: MfaState, device: DeviceInput | undefined): Promise<AuthResult> {
    const membership = await this.access.findMembership(state.membershipId);
    if (!membership) throw new AppError(ErrorCode.MEMBERSHIP_INACTIVE);
    this.memberships.assertUsable(membership);
    if (state.pendingSecret) {
      await this.identity.updateStaffCredential(state.userId, {
        totpSecretEnc: this.cipher.encrypt(state.pendingSecret, CipherPurpose.TotpSecret),
        totpEnabledAt: new Date(),
      });
    }
    const issued = await this.sessions.start({ userId: state.userId, membership, loginMethod: LoginMethod.password, device });
    await this.identity.updateLogin(state.loginId, { lastUsedAt: new Date() });
    await this.identity.touchLastLogin(state.userId);
    const actor = actorForSession(issued.session, membership);
    if (state.pendingSecret) {
      await this.audit.record({ action: AuditAction.MfaEnabled, entityType: AuditEntity.StaffCredential, entityId: state.userId, actor });
    }
    await this.audit.record({ action: AuditAction.StaffLogin, entityType: AuditEntity.User, entityId: state.userId, actor, metadata: { role: membership.role } });
    return { ...issued.tokens, user: await this.me.build(state.userId, membership.id), nextAction: null };
  }

  private async recordFailure(userId: string, failedAttempts: number) {
    const locked = failedAttempts >= STAFF_LOGIN_MAX_FAILURES;
    await this.identity.updateStaffCredential(userId, {
      failedAttempts: locked ? 0 : failedAttempts,
      lockedUntil: locked ? new Date(Date.now() + STAFF_LOCK_MINUTES * 60_000) : null,
    });
    await this.audit.record({
      action: AuditAction.StaffLoginFailed,
      entityType: AuditEntity.User,
      entityId: userId,
      actor: { type: 'system', name: 'staff-login' },
      metadata: { failedAttempts, locked },
    });
  }

  private hashPassword(password: string): Promise<string> {
    return argonHash(password, { ...ARGON2_OPTIONS, type: argon2id });
  }

  private totp(label: string, secret: string): TOTP {
    return new TOTP({
      issuer: TOTP_SETTINGS.issuer,
      label,
      algorithm: TOTP_SETTINGS.algorithm,
      digits: TOTP_SETTINGS.digits,
      period: TOTP_SETTINGS.period,
      secret: Secret.fromBase32(secret),
    });
  }
}

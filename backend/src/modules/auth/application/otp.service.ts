import { isDeepStrictEqual } from 'node:util';

import { Injectable } from '@nestjs/common';

import { RequestContext } from '../../../common/context/request-context.service.js';
import { ContactType, type LoginAs, NotificationChannel, type OtpPurpose } from '../../../common/enums/db.enums.js';
import { AppError } from '../../../common/errors/app-error.js';
import { ErrorCode } from '../../../common/errors/error-codes.js';
import { uuidv7 } from '../../../common/ids/uuid-v7.js';
import { InjectConfig } from '../../../config/config.constants.js';
import type { AppConfig } from '../../../config/env.schema.js';
import type { OtpChallenge } from '../../../generated/prisma/client.js';
import { CipherPurpose } from '../../../infrastructure/crypto/crypto.constants.js';
import { FieldCipher } from '../../../infrastructure/crypto/field-cipher.service.js';
import { hmacSha256, randomDigits, safeEqual } from '../../../infrastructure/crypto/secure-random.js';
import { JobPriority } from '../../../infrastructure/queue/queue.constants.js';
import { RateLimiter } from '../../../infrastructure/rate-limit/rate-limiter.service.js';
import { NotificationService } from '../../notifications/application/notification.service.js';
import { NotificationTemplateKey } from '../../notifications/domain/notification.constants.js';
import { OTP_LENGTH, OTP_MAX_ATTEMPTS, OTP_RESEND_SECONDS, OTP_TTL_SECONDS, OtpLimit, RateLimitKey } from '../domain/auth.constants.js';
import type { OtpIssued } from '../domain/auth.types.js';
import { OtpChallengeRepository } from '../infrastructure/otp-challenge.repository.js';

export type OtpIssueInput = {
  purpose: OtpPurpose;
  channel: typeof ContactType.mobile | typeof ContactType.email;
  identifier: string;
  identifierHash: string;
  loginAs?: LoginAs;
  userId?: string;
  payload?: Record<string, unknown>;
  deliver: boolean;
  message?: { templateKey: NotificationTemplateKey; params: Record<string, string> };
};

export type OtpVerifyInput = {
  purpose: OtpPurpose;
  code: string;
  identifierHash?: string;
  challengeId?: string;
  userId?: string;
};

export type VerifiedChallenge<P = Record<string, unknown>> = {
  challenge: OtpChallenge;
  payload: P | null;
};

@Injectable()
export class OtpService {
  private readonly hashKey: Buffer;

  constructor(
    private readonly challenges: OtpChallengeRepository,
    private readonly limiter: RateLimiter,
    private readonly notifications: NotificationService,
    private readonly cipher: FieldCipher,
    private readonly context: RequestContext,
    @InjectConfig() private readonly config: AppConfig,
  ) {
    this.hashKey = Buffer.from(config.OTP_HASH_KEY, 'base64');
  }

  async issue(input: OtpIssueInput): Promise<OtpIssued> {
    const latest = await this.challenges.findLatestOpen(input.purpose, input.identifierHash);
    const now = Date.now();
    if (latest && latest.resendAvailableAt.getTime() > now && latest.expiresAt.getTime() > now && this.sameIntent(latest, input)) {
      const retryAfterSeconds = Math.ceil((latest.resendAvailableAt.getTime() - now) / 1000);
      throw new AppError(ErrorCode.OTP_COOLDOWN, { retryAfterSeconds, details: { retryAfterSeconds } });
    }

    const quota = await this.limiter.consume(
      RateLimitKey.otpRequests(input.purpose, input.identifierHash),
      OtpLimit.requestsPerIdentifier.limit,
      OtpLimit.requestsPerIdentifier.windowSeconds,
    );
    if (!quota.allowed) throw new AppError(ErrorCode.OTP_RATE_LIMITED, { retryAfterSeconds: quota.retryAfterSeconds });

    await this.challenges.supersedeOpen(input.purpose, input.identifierHash);
    const id = uuidv7();
    const code = this.config.AUTH_OTP_STATIC_CODE ?? randomDigits(OTP_LENGTH);
    await this.challenges.create({
      id,
      purpose: input.purpose,
      channel: input.channel,
      identifierHash: input.identifierHash,
      codeHash: this.hashCode(id, code),
      userId: input.userId ?? null,
      loginAs: input.loginAs ?? null,
      payload: input.payload ? { enc: this.cipher.encryptJson(input.payload, CipherPurpose.OtpChallengePayload) } : undefined,
      maxAttempts: OTP_MAX_ATTEMPTS,
      expiresAt: new Date(now + OTP_TTL_SECONDS * 1000),
      resendAvailableAt: new Date(now + OTP_RESEND_SECONDS * 1000),
      ip: this.context.ip ?? null,
      userAgent: this.context.userAgent ?? null,
    });

    if (input.deliver) {
      await this.notifications.send({
        templateKey: input.message?.templateKey ?? NotificationTemplateKey.AuthOtp,
        channel: input.channel === ContactType.mobile ? NotificationChannel.sms : NotificationChannel.email,
        recipient: input.identifier,
        params: { ...input.message?.params, code, minutes: Math.round(OTP_TTL_SECONDS / 60) },
        priority: JobPriority.Critical,
      });
    }
    return { challengeId: id, resendIn: OTP_RESEND_SECONDS, expiresIn: OTP_TTL_SECONDS };
  }

  async verify<P = Record<string, unknown>>(input: OtpVerifyInput): Promise<VerifiedChallenge<P>> {
    const challenge = input.challengeId
      ? await this.challenges.findById(input.challengeId)
      : input.identifierHash
        ? await this.challenges.findLatestOpen(input.purpose, input.identifierHash)
        : null;
    const belongs =
      challenge &&
      challenge.purpose === input.purpose &&
      (!input.identifierHash || challenge.identifierHash === input.identifierHash) &&
      (!input.userId || challenge.userId === input.userId);
    if (!challenge || !belongs || challenge.consumedAt) throw new AppError(ErrorCode.OTP_EXPIRED);

    const failures = await this.limiter.count(RateLimitKey.otpFailures(challenge.identifierHash));
    if (failures >= OtpLimit.failuresPerIdentifier.limit) throw new AppError(ErrorCode.OTP_LOCKED);
    if (challenge.expiresAt.getTime() <= Date.now()) throw new AppError(ErrorCode.OTP_EXPIRED);
    if (challenge.attempts >= challenge.maxAttempts) throw new AppError(ErrorCode.OTP_LOCKED);

    if (!safeEqual(challenge.codeHash, this.hashCode(challenge.id, input.code))) {
      const updated = await this.challenges.incrementAttempts(challenge.id);
      await this.limiter.consume(
        RateLimitKey.otpFailures(challenge.identifierHash),
        OtpLimit.failuresPerIdentifier.limit,
        OtpLimit.failuresPerIdentifier.windowSeconds,
      );
      const attemptsLeft = Math.max(0, updated.maxAttempts - updated.attempts);
      if (attemptsLeft === 0) throw new AppError(ErrorCode.OTP_LOCKED);
      throw new AppError(ErrorCode.OTP_INVALID, { details: { attemptsLeft } });
    }

    const consumed = await this.challenges.consume(challenge.id);
    if (consumed.count === 0) throw new AppError(ErrorCode.OTP_EXPIRED);
    await this.limiter.reset(RateLimitKey.otpFailures(challenge.identifierHash));

    return { challenge, payload: this.payloadOf<P>(challenge) };
  }

  private sameIntent(challenge: OtpChallenge, input: OtpIssueInput): boolean {
    return (challenge.loginAs ?? null) === (input.loginAs ?? null) && isDeepStrictEqual(this.payloadOf(challenge), input.payload ?? null);
  }

  private payloadOf<P = Record<string, unknown>>(challenge: OtpChallenge): P | null {
    const stored = challenge.payload as { enc?: string } | null;
    return stored?.enc ? this.cipher.decryptJson<P>(stored.enc, CipherPurpose.OtpChallengePayload) : null;
  }

  private hashCode(challengeId: string, code: string): string {
    return hmacSha256(this.hashKey, `${challengeId}:${code}`);
  }
}

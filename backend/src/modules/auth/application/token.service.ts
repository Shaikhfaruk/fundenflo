import { randomUUID } from 'node:crypto';
import { Injectable, type OnModuleInit } from '@nestjs/common';
import { type CryptoKey, errors, importJWK, type JWTPayload, jwtVerify, SignJWT } from 'jose';
import { z } from 'zod';

import { Role, SessionContext } from '../../../common/enums/db.enums.js';
import { AppError } from '../../../common/errors/app-error.js';
import { ErrorCode } from '../../../common/errors/error-codes.js';
import { InjectConfig } from '../../../config/config.constants.js';
import type { AppConfig } from '../../../config/env.schema.js';
import { ACCESS_TOKEN_ALGORITHM, ACCESS_TOKEN_TYPE } from '../domain/auth.constants.js';
import type { AccessClaims } from '../domain/auth.types.js';

const claimsSchema = z.object({
  sub: z.uuid(),
  sid: z.uuid(),
  mid: z.uuid().nullable(),
  ctx: z.enum(Object.values(SessionContext)),
  rol: z.enum(Object.values(Role)).nullable(),
  org: z.uuid().nullable(),
});

@Injectable()
export class TokenService implements OnModuleInit {
  private signer: { kid: string; key: CryptoKey } | undefined;
  private readonly verifiers = new Map<string, CryptoKey>();

  constructor(@InjectConfig() private readonly config: AppConfig) {}

  async onModuleInit() {
    for (const [index, jwk] of this.config.JWT_SIGNING_KEYS.entries()) {
      const { d: _private, ...publicJwk } = jwk;
      const verifier = await importJWK({ ...publicJwk, alg: ACCESS_TOKEN_ALGORITHM }, ACCESS_TOKEN_ALGORITHM);
      this.verifiers.set(jwk.kid, verifier);
      if (index === 0) {
        const key = await importJWK({ ...jwk, alg: ACCESS_TOKEN_ALGORITHM }, ACCESS_TOKEN_ALGORITHM);
        this.signer = { kid: jwk.kid, key };
      }
    }
  }

  get accessTtlSeconds(): number {
    return this.config.JWT_ACCESS_TTL_SECONDS;
  }

  async issueAccessToken(claims: AccessClaims): Promise<string> {
    if (!this.signer) throw new Error('TokenService used before keys were loaded');
    const payload: JWTPayload = {
      sid: claims.sessionId,
      mid: claims.membershipId,
      ctx: claims.context,
      rol: claims.role,
      org: claims.organizationId,
    };
    return new SignJWT(payload)
      .setProtectedHeader({ alg: ACCESS_TOKEN_ALGORITHM, kid: this.signer.kid, typ: ACCESS_TOKEN_TYPE })
      .setSubject(claims.userId)
      .setIssuer(this.config.JWT_ISSUER)
      .setAudience(this.config.JWT_AUDIENCE)
      .setIssuedAt()
      .setJti(randomUUID())
      .setExpirationTime(`${this.config.JWT_ACCESS_TTL_SECONDS}s`)
      .sign(this.signer.key);
  }

  async verifyAccessToken(token: string): Promise<AccessClaims> {
    let payload: JWTPayload;
    try {
      const result = await jwtVerify(
        token,
        (header) => {
          const key = header.kid ? this.verifiers.get(header.kid) : undefined;
          if (!key) throw new errors.JWKSNoMatchingKey();
          return key;
        },
        { issuer: this.config.JWT_ISSUER, audience: this.config.JWT_AUDIENCE, algorithms: [ACCESS_TOKEN_ALGORITHM], typ: ACCESS_TOKEN_TYPE },
      );
      payload = result.payload;
    } catch (error) {
      if (error instanceof errors.JWTExpired) throw new AppError(ErrorCode.TOKEN_EXPIRED);
      throw new AppError(ErrorCode.TOKEN_INVALID);
    }
    const parsed = claimsSchema.safeParse(payload);
    if (!parsed.success) throw new AppError(ErrorCode.TOKEN_INVALID);
    return {
      userId: parsed.data.sub,
      sessionId: parsed.data.sid,
      membershipId: parsed.data.mid,
      context: parsed.data.ctx,
      role: parsed.data.rol,
      organizationId: parsed.data.org,
    };
  }
}

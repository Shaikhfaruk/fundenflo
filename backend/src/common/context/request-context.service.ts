import { Injectable } from '@nestjs/common';
import { ClsService, type ClsStore } from 'nestjs-cls';

import { AppError } from '../errors/app-error.js';
import { ErrorCode } from '../errors/error-codes.js';
import type { Actor, ActorSnapshot, UserActor } from './actor.js';

export interface RequestContextStore extends ClsStore {
  actor?: Actor;
  ip?: string;
  userAgent?: string;
}

@Injectable()
export class RequestContext {
  constructor(private readonly cls: ClsService<RequestContextStore>) {}

  get requestId(): string | undefined {
    return this.cls.isActive() ? this.cls.getId() : undefined;
  }

  get ip(): string | undefined {
    return this.cls.isActive() ? this.cls.get('ip') : undefined;
  }

  get userAgent(): string | undefined {
    return this.cls.isActive() ? this.cls.get('userAgent') : undefined;
  }

  get actor(): Actor | undefined {
    return this.cls.isActive() ? this.cls.get('actor') : undefined;
  }

  setActor(actor: Actor) {
    this.cls.set('actor', actor);
  }

  requireUser(): UserActor {
    const actor = this.actor;
    if (actor?.type !== 'user') throw new AppError(ErrorCode.UNAUTHENTICATED);
    return actor;
  }

  snapshot(): ActorSnapshot | undefined {
    const actor = this.actor;
    if (!actor) return undefined;
    if (actor.type === 'system') return { type: 'system', name: actor.name };
    if (actor.type === 'api_client') return { type: 'api_client', apiClientId: actor.apiClientId, name: actor.name };
    return {
      type: 'user',
      userId: actor.userId,
      sessionId: actor.sessionId,
      membershipId: actor.membershipId,
      context: actor.context,
      role: actor.role,
    };
  }
}

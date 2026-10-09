import {
  applyDecorators,
  type CanActivate,
  createParamDecorator,
  type ExecutionContext,
  Injectable,
  SetMetadata,
  UseGuards,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';

import { AppError } from '../../../common/errors/app-error.js';
import { ErrorCode } from '../../../common/errors/error-codes.js';
import '../../../common/http/request.types.js';
import { AbilityFactory } from '../application/ability.factory.js';
import type { AppAbility } from '../domain/ability.types.js';

export type PolicyHandler = (ability: AppAbility) => boolean;

const CHECK_POLICIES_KEY = 'access:policies';

const ABILITY_REQUEST_KEY = Symbol('access:ability');

type RequestWithAbility = Request & { [ABILITY_REQUEST_KEY]?: AppAbility };

@Injectable()
export class PoliciesGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly abilities: AbilityFactory,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const handlers = this.reflector.get<PolicyHandler[] | undefined>(CHECK_POLICIES_KEY, context.getHandler()) ?? [];
    const request = context.switchToHttp().getRequest<RequestWithAbility>();
    if (!request.actor) throw new AppError(ErrorCode.UNAUTHENTICATED);
    const ability = this.abilities.forActor(request.actor);
    request[ABILITY_REQUEST_KEY] = ability;
    if (!handlers.every((handler) => handler(ability))) throw new AppError(ErrorCode.FORBIDDEN);
    return true;
  }
}

export const CheckPolicies = (...handlers: PolicyHandler[]) =>
  applyDecorators(SetMetadata(CHECK_POLICIES_KEY, handlers), UseGuards(PoliciesGuard));

export const CurrentAbility = createParamDecorator((_: unknown, context: ExecutionContext): AppAbility => {
  const ability = context.switchToHttp().getRequest<RequestWithAbility>()[ABILITY_REQUEST_KEY];
  if (!ability) throw new AppError(ErrorCode.FORBIDDEN);
  return ability;
});

import { AbilityBuilder } from '@casl/ability';
import { createPrismaAbility } from '@casl/prisma/runtime';
import { Injectable } from '@nestjs/common';

import type { UserActor } from '../../../common/context/actor.js';
import type { AppAbility } from '../domain/ability.types.js';
import { ROLE_GRANTS, SELF_GRANT } from '../domain/permissions.js';
import { isRoleAllowed } from '../domain/role-rules.js';

@Injectable()
export class AbilityFactory {
  forActor(actor: UserActor): AppAbility {
    const builder = new AbilityBuilder<AppAbility>(createPrismaAbility);
    SELF_GRANT(builder, actor);
    if (actor.role && isRoleAllowed(actor.context, actor.role)) ROLE_GRANTS[actor.role]?.(builder, actor);
    return builder.build();
  }
}

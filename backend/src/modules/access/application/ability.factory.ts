import { AbilityBuilder } from '@casl/ability';
import { createPrismaAbility } from '@casl/prisma/runtime';
import { Injectable } from '@nestjs/common';

import type { UserActor } from '../../../common/context/actor.js';
import { SessionContext } from '../../../common/enums/db.enums.js';
import type { AppAbility } from '../domain/ability.types.js';
import { ROLE_GRANTS, SELF_GRANT } from '../domain/permissions.js';

@Injectable()
export class AbilityFactory {
  forActor(actor: UserActor): AppAbility {
    const builder = new AbilityBuilder<AppAbility>(createPrismaAbility);
    SELF_GRANT(builder, actor);
    if (actor.context === SessionContext.staff && actor.role) ROLE_GRANTS[actor.role]?.(builder, actor);
    return builder.build();
  }
}

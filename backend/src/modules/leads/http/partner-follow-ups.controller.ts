import { accessibleBy } from "@casl/prisma/runtime";
import { Controller, Get, Patch } from "@nestjs/common";

import {
  AllowContexts,
  CurrentActor,
} from "../../../common/auth/auth.decorators.js";
import type { UserActor } from "../../../common/context/actor.js";
import { SessionContext } from "../../../common/enums/db.enums.js";
import { IfMatchVersion } from "../../../common/http/versioning.js";
import { uuidSchema } from "../../../common/validation/common.schemas.js";
import {
  ValidBody,
  ValidParam,
  ValidQuery,
} from "../../../common/validation/zod-validation.pipe.js";
import {
  AppAction,
  type AppAbility,
} from "../../access/domain/ability.types.js";
import { CurrentAbility } from "../../access/http/policies.guard.js";
import { ActivityService } from "../../activities/application/activity.service.js";
import { LeadActivityService } from "../application/lead-activity.service.js";
import {
  assigneeScope,
  canReadFollowUps,
  canUpdateFollowUps,
} from "./follow-up.policies.js";
import {
  type FollowUpListDto,
  followUpListSchema,
  type UpdateFollowUpDto,
  updateFollowUpSchema,
} from "./leads.dto.js";

@Controller("partner/follow-ups")
@AllowContexts(SessionContext.partner)
export class PartnerFollowUpsController {
  constructor(
    private readonly leadActivities: LeadActivityService,
    private readonly activities: ActivityService,
  ) {}

  @Get()
  @canReadFollowUps
  list(
    @ValidQuery(followUpListSchema) query: FollowUpListDto,
    @CurrentActor() actor: UserActor,
    @CurrentAbility() ability: AppAbility,
  ) {
    return this.leadActivities.listFollowUps(
      {
        AND: [
          accessibleBy(ability, AppAction.Read).ofType("FollowUp"),
          assigneeScope(query, actor),
        ],
      },
      query,
      query.limit,
      actor.organizationId,
    );
  }

  @Patch(":id")
  @canUpdateFollowUps
  update(
    @ValidParam("id", uuidSchema) id: string,
    @ValidBody(updateFollowUpSchema) body: UpdateFollowUpDto,
    @IfMatchVersion() version: number | undefined,
    @CurrentActor() actor: UserActor,
    @CurrentAbility() ability: AppAbility,
  ) {
    return this.activities.updateFollowUp(
      id,
      accessibleBy(ability, AppAction.Update).ofType("FollowUp"),
      body,
      version,
      actor.userId,
    );
  }
}

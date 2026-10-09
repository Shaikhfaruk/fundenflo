import type { Prisma } from "../../../generated/prisma/client.js";
import type { UserActor } from "../../../common/context/actor.js";
import { AppAction } from "../../access/domain/ability.types.js";
import { CheckPolicies } from "../../access/http/policies.guard.js";
import { FollowUpAssignee, type FollowUpListDto } from "./leads.dto.js";

export const canReadFollowUps = CheckPolicies((ability) =>
  ability.can(AppAction.Read, "FollowUp"),
);

export const canUpdateFollowUps = CheckPolicies((ability) =>
  ability.can(AppAction.Update, "FollowUp"),
);

export const assigneeScope = (
  query: FollowUpListDto,
  actor: UserActor,
): Prisma.FollowUpWhereInput =>
  query.assignee === FollowUpAssignee.Me
    ? { assigneeUserId: actor.userId }
    : {};

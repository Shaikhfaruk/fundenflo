import { Controller, Get, Patch } from '@nestjs/common';

import { StaffOnly } from '../../../common/auth/auth.decorators.js';
import { IfMatchVersion } from '../../../common/http/versioning.js';
import { uuidSchema } from '../../../common/validation/common.schemas.js';
import { ValidBody, ValidParam, ValidQuery } from '../../../common/validation/zod-validation.pipe.js';
import { AppAction, type AppAbility } from '../../access/domain/ability.types.js';
import { CheckPolicies, CurrentAbility } from '../../access/http/policies.guard.js';
import { AdminUsersService } from '../application/admin-users.service.js';
import { type AdminUpdateUserDto, adminUpdateUserSchema, type AdminUsersQuery, adminUsersQuerySchema } from './auth.dto.js';

@Controller('admin/users')
@StaffOnly()
export class AdminUsersController {
  constructor(private readonly users: AdminUsersService) {}

  @Get()
  @CheckPolicies((ability) => ability.can(AppAction.Read, 'User'))
  list(@ValidQuery(adminUsersQuerySchema) query: AdminUsersQuery, @CurrentAbility() ability: AppAbility) {
    return this.users.list(query, ability);
  }

  @Get(':id')
  @CheckPolicies((ability) => ability.can(AppAction.Read, 'User'))
  get(@ValidParam('id', uuidSchema) id: string, @CurrentAbility() ability: AppAbility) {
    return this.users.get(id, ability);
  }

  @Patch(':id')
  @CheckPolicies((ability) => ability.can(AppAction.Update, 'User'))
  update(
    @ValidParam('id', uuidSchema) id: string,
    @ValidBody(adminUpdateUserSchema) body: AdminUpdateUserDto,
    @IfMatchVersion() version: number | undefined,
    @CurrentAbility() ability: AppAbility,
  ) {
    return this.users.updateStatus(id, body.status, version, ability);
  }
}

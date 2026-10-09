import { z } from 'zod';

import { InvitationStatus, MembershipStatus, Role } from '../../../common/enums/db.enums.js';
import { pageQuerySchema } from '../../../common/listing/cursor-page.js';
import { ApiScope } from '../domain/access.constants.js';

const roleSchema = z.enum(Object.values(Role));

export const createMembershipSchema = z
  .object({
    userId: z.uuid(),
    organizationId: z.uuid(),
    role: roleSchema,
  })
  .strict();

export type CreateMembershipDto = z.output<typeof createMembershipSchema>;

export const updateMembershipSchema = z
  .object({
    status: z.enum([MembershipStatus.active, MembershipStatus.suspended, MembershipStatus.revoked]).optional(),
    role: roleSchema.optional(),
  })
  .strict()
  .refine((value) => value.status !== undefined || value.role !== undefined, 'provide status or role');

export type UpdateMembershipDto = z.output<typeof updateMembershipSchema>;

export const createInvitationSchema = z
  .object({
    organizationId: z.uuid(),
    role: roleSchema,
    mobile: z.string().trim().min(6).max(20).optional(),
    countryCode: z.string().trim().regex(/^\+?\d{1,4}$/).optional(),
    email: z.email().max(254).optional(),
  })
  .strict()
  .refine((value) => (value.mobile ? 1 : 0) + (value.email ? 1 : 0) === 1, 'provide exactly one of mobile or email');

export type CreateInvitationDto = z.output<typeof createInvitationSchema>;

export const listInvitationsSchema = pageQuerySchema.extend({
  organizationId: z.uuid().optional(),
  status: z.enum(Object.values(InvitationStatus)).optional(),
});

export type ListInvitationsDto = z.output<typeof listInvitationsSchema>;

export const createApiClientSchema = z
  .object({
    name: z.string().trim().min(3).max(100),
    scopes: z.array(z.enum(Object.values(ApiScope))).min(1),
    leadSourceId: z.uuid().optional(),
    expiresAt: z.coerce.date().refine((date) => date > new Date(), 'must be in the future').optional(),
  })
  .strict();

export type CreateApiClientDto = z.output<typeof createApiClientSchema>;

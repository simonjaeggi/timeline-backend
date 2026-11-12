import { z } from '@hono/zod-openapi';
import { APP_ROLES } from '../../../data/models.ts';
import { DateTimeSchema, IdParamSchema } from '../../../shared/openapi.ts';
import { BodyIdSchema } from '../../../shared/zod/common.schema.ts';
import { GroupRoleSchema } from '../../groups/zod/group.schema.ts';
import { AccessCodeInputSchema } from '../access-code.util.ts';

export const AppRoleSchema = z.enum(APP_ROLES).openapi('AppRole');

export const AccessCodeBodySchema = z
  .strictObject({
    code: AccessCodeInputSchema.openapi({
      type: 'string',
      example: 'K7QM-2XTA-9PLR',
    }),
  })
  .openapi('AccessCodeInput');

export const MAX_ACCESS_CODE_DAYS = 14;

export const CreateAccessCodeSchema = z
  .strictObject({
    /** Group the redeemer joins. */
    groupId: BodyIdSchema.optional(),
    /** Role in that group, defaults to viewer. */
    groupRole: GroupRoleSchema.optional(),
    /** Makes the redeemer an app admin. */
    grantsAdmin: z.boolean().default(false),
    /** Only this email can redeem the code. */
    email: z
      .email('Email must be a valid email address.')
      .transform((value) => value.toLowerCase())
      .optional(),
    daysValid: z
      .number()
      .int()
      .positive()
      .max(
        MAX_ACCESS_CODE_DAYS,
        `An access code cannot be valid for longer than ${MAX_ACCESS_CODE_DAYS} days.`,
      )
      .default(7),
  })
  .refine((value) => value.groupId !== undefined || value.grantsAdmin, {
    message: 'A code must grant a group membership or the admin role.',
    path: ['groupId'],
  })
  .refine(
    (value) => value.groupRole === undefined || value.groupId !== undefined,
    {
      message: 'groupRole requires groupId.',
      path: ['groupRole'],
    },
  )
  .openapi('CreateAccessCode');

export type CreateAccessCodeDto = z.infer<typeof CreateAccessCodeSchema>;

export const AccessCodeParamsSchema = z.object({ accessCodeId: IdParamSchema });

/* Responses */

export const AccessCodeSchema = z
  .object({
    id: z.number().int(),
    codeHint: z.string().openapi({ description: 'Last 4 characters.' }),
    groupId: z.number().int().nullable(),
    groupRole: GroupRoleSchema.nullable(),
    grantsAppRole: AppRoleSchema,
    email: z.string().nullable(),
    isInitial: z.boolean(),
    createdBy: z.string().nullable(),
    createdAt: DateTimeSchema,
    expiresAt: DateTimeSchema.nullable(),
    redeemedAt: DateTimeSchema.nullable(),
    redeemedByUserId: z.string().nullable(),
    redeemedByEmail: z.string().nullable(),
    revokedAt: DateTimeSchema.nullable(),
    status: z.enum(['active', 'redeemed', 'revoked', 'expired']),
  })
  .openapi('AccessCode');

export const CreatedAccessCodeSchema = z
  .object({
    code: z.string().openapi({
      description: 'The code itself. Shown only once, only its hash is stored.',
      example: 'K7QM-2XTA-9PLR',
    }),
    accessCode: AccessCodeSchema,
  })
  .openapi('CreatedAccessCode');

export const AccessCodeCheckSchema = z
  .object({
    valid: z.literal(true),
    group: z.object({ id: z.number().int(), name: z.string() }).nullable(),
    groupRole: GroupRoleSchema.nullable(),
    grantsAdmin: z.boolean(),
    expiresAt: DateTimeSchema.nullable(),
  })
  .openapi('AccessCodeCheck');

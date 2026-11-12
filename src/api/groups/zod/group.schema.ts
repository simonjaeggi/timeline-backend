import { z } from '@hono/zod-openapi';
import { GROUP_ROLES } from '../../../data/models.ts';
import { DateTimeSchema, GroupParamsSchema } from '../../../shared/openapi.ts';
import { nullableText } from '../../../shared/zod/common.schema.ts';

export const GroupRoleSchema = z.enum(GROUP_ROLES).openapi('GroupRole', {
  description:
    'owner > editor > viewer. Viewers read, editors write, owners manage the group.',
});

const GroupFields = z.strictObject({
  name: z
    .string()
    .trim()
    .min(1, 'Name is required.')
    .max(255, 'Name cannot be longer than 255 characters.')
    .openapi({ example: 'Jäggi family' }),
  description: nullableText(2000, 'Description'),
});

export const CreateGroupSchema = GroupFields.openapi('CreateGroup');

export type CreateGroupDto = z.infer<typeof CreateGroupSchema>;

export const UpdateGroupSchema = GroupFields.partial()
  .refine(
    (value) => Object.keys(value).length > 0,
    'At least one field must be provided.',
  )
  .openapi('UpdateGroup');

export type UpdateGroupDto = z.infer<typeof UpdateGroupSchema>;

export const GroupSchema = z
  .object({
    id: z.number().int(),
    name: z.string(),
    description: z.string().nullable(),
    createdBy: z.string().nullable(),
    createdAt: DateTimeSchema,
    updatedAt: DateTimeSchema,
  })
  .openapi('Group');

export const GroupWithRoleSchema = GroupSchema.extend({
  myRole: GroupRoleSchema,
}).openapi('GroupWithRole');

export const GroupMemberSchema = z
  .object({
    groupId: z.number().int(),
    userId: z.string(),
    role: GroupRoleSchema,
    createdAt: DateTimeSchema,
    user: z.object({
      id: z.string(),
      name: z.string(),
      email: z.string(),
      image: z.string().nullable(),
    }),
  })
  .openapi('GroupMember');

export const MemberParamsSchema = GroupParamsSchema.extend({
  userId: z
    .string()
    .min(1)
    .openapi({ param: { required: true } }),
});

export const UpdateMemberSchema = z
  .strictObject({ role: GroupRoleSchema })
  .openapi('UpdateMember');

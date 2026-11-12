import { z } from '@hono/zod-openapi';
import { DateTimeSchema } from '../../../shared/openapi.ts';
import { AppRoleSchema } from '../../access-codes/zod/access-code.schema.ts';
import { GroupRoleSchema } from '../../groups/zod/group.schema.ts';

export const UserSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    email: z.string(),
    image: z.string().nullable(),
    role: AppRoleSchema,
    createdAt: DateTimeSchema,
  })
  .openapi('User');

export const UserGroupSchema = z
  .object({
    id: z.number().int(),
    name: z.string(),
    role: GroupRoleSchema,
  })
  .openapi('UserGroup');

export const MeSchema = z
  .object({
    user: z.object({
      id: z.string(),
      name: z.string(),
      email: z.string().nullable(),
      role: AppRoleSchema,
    }),
    groups: z.array(UserGroupSchema),
  })
  .openapi('Me');

export const UserParamsSchema = z.object({
  userId: z
    .string()
    .min(1)
    .openapi({ param: { required: true } }),
});

export const UpdateUserSchema = z
  .strictObject({ role: AppRoleSchema })
  .openapi('UpdateUser');

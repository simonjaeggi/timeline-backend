import { createRoute, z } from '@hono/zod-openapi';
import { requireAdmin } from '../../middleware/auth.middleware.ts';
import { errorResponses, json, jsonBody } from '../../shared/openapi.ts';
import {
  MeSchema,
  UpdateUserSchema,
  UserParamsSchema,
  UserSchema,
} from './zod/user.schema.ts';

export const meRoute = createRoute({
  method: 'get',
  path: '/me',
  tags: ['Users'],
  summary: 'The signed-in user and their groups',
  responses: {
    200: json(MeSchema, 'Current user'),
    ...errorResponses(401),
  },
});

const tags = ['Admin'];

export const listUsersRoute = createRoute({
  method: 'get',
  path: '/admin/users',
  tags,
  summary: 'List user accounts (admin)',
  middleware: [requireAdmin()] as const,
  responses: {
    200: json(z.object({ users: z.array(UserSchema) }), 'Users'),
    ...errorResponses(401, 403),
  },
});

export const updateUserRoute = createRoute({
  method: 'patch',
  path: '/admin/users/{userId}',
  tags,
  summary: 'Change a user’s app role (admin)',
  middleware: [requireAdmin()] as const,
  request: { params: UserParamsSchema, body: jsonBody(UpdateUserSchema) },
  responses: {
    200: json(z.object({ user: UserSchema }), 'Updated user'),
    ...errorResponses(400, 401, 403, 404, 409),
  },
});

export const deleteUserRoute = createRoute({
  method: 'delete',
  path: '/admin/users/{userId}',
  tags,
  summary: 'Delete a user account (admin)',
  middleware: [requireAdmin()] as const,
  request: { params: UserParamsSchema },
  responses: {
    200: json(z.object({ user: UserSchema }), 'Deleted user'),
    ...errorResponses(401, 403, 404, 409),
  },
});

import type { RouteHandler } from '@hono/zod-openapi';
import { getAuthUser } from '../../middleware/auth.middleware.ts';
import { NotFoundError } from '../../shared/errors.ts';
import type {
  deleteUserRoute,
  listUsersRoute,
  meRoute,
  updateUserRoute,
} from './user.openapi.ts';
import * as userService from './user.service.ts';

export const me: RouteHandler<typeof meRoute> = async (c) => {
  return c.json(await userService.getMe(getAuthUser(c)), 200);
};

export const listUsers: RouteHandler<typeof listUsersRoute> = async (c) => {
  return c.json({ users: await userService.listUsers() }, 200);
};

export const updateUser: RouteHandler<typeof updateUserRoute> = async (c) => {
  const { userId } = c.req.valid('param');
  const user = await userService.setUserRole(userId, c.req.valid('json').role);
  if (!user) throw new NotFoundError('User');
  return c.json({ user }, 200);
};

export const deleteUser: RouteHandler<typeof deleteUserRoute> = async (c) => {
  const { userId } = c.req.valid('param');
  const user = await userService.deleteUser(userId);
  if (!user) throw new NotFoundError('User');
  return c.json({ user }, 200);
};

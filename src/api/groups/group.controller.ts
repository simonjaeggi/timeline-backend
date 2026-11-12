import type { RouteHandler } from '@hono/zod-openapi';
import { getAuthUser } from '../../middleware/auth.middleware.ts';
import {
  getCurrentGroupRole,
  getGroupId,
} from '../../middleware/group-access.middleware.ts';
import { NotFoundError } from '../../shared/errors.ts';
import type {
  createGroupRoute,
  deleteGroupRoute,
  getGroupRoute,
  listGroupsRoute,
  listMembersRoute,
  removeMemberRoute,
  updateGroupRoute,
  updateMemberRoute,
} from './group.openapi.ts';
import * as groupService from './group.service.ts';

export const listGroups: RouteHandler<typeof listGroupsRoute> = async (c) => {
  const groups = await groupService.listGroups(getAuthUser(c));
  return c.json({ groups }, 200);
};

export const createGroup: RouteHandler<typeof createGroupRoute> = async (c) => {
  const group = await groupService.createGroup(
    getAuthUser(c),
    c.req.valid('json'),
  );
  return c.json({ group }, 201);
};

export const getGroup: RouteHandler<typeof getGroupRoute> = async (c) => {
  const group = await groupService.getGroup(getGroupId(c));
  if (!group) throw new NotFoundError('Group');
  return c.json({ group: { ...group, myRole: getCurrentGroupRole(c) } }, 200);
};

export const updateGroup: RouteHandler<typeof updateGroupRoute> = async (c) => {
  const group = await groupService.updateGroup(
    getGroupId(c),
    c.req.valid('json'),
  );
  if (!group) throw new NotFoundError('Group');
  return c.json({ group }, 200);
};

export const deleteGroup: RouteHandler<typeof deleteGroupRoute> = async (c) => {
  const group = await groupService.deleteGroup(getGroupId(c));
  if (!group) throw new NotFoundError('Group');
  return c.json({ group }, 200);
};

export const listMembers: RouteHandler<typeof listMembersRoute> = async (c) => {
  const members = await groupService.listMembers(getGroupId(c));
  return c.json({ members }, 200);
};

export const updateMember: RouteHandler<typeof updateMemberRoute> = async (
  c,
) => {
  const { userId } = c.req.valid('param');
  const { role } = c.req.valid('json');
  const membership = await groupService.updateMemberRole(
    getGroupId(c),
    userId,
    role,
  );
  if (!membership) throw new NotFoundError('Member');
  return c.body(null, 204);
};

export const removeMember: RouteHandler<typeof removeMemberRoute> = async (
  c,
) => {
  const { userId } = c.req.valid('param');
  const membership = await groupService.removeMember(getGroupId(c), userId);
  if (!membership) throw new NotFoundError('Member');
  return c.body(null, 204);
};

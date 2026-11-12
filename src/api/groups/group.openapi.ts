import { createRoute, z } from '@hono/zod-openapi';
import { requireAdmin } from '../../middleware/auth.middleware.ts';
import { requireGroupRole } from '../../middleware/group-access.middleware.ts';
import {
  errorResponses,
  GROUP_ERRORS,
  GroupParamsSchema,
  json,
  jsonBody,
} from '../../shared/openapi.ts';
import {
  CreateGroupSchema,
  GroupMemberSchema,
  GroupSchema,
  GroupWithRoleSchema,
  MemberParamsSchema,
  UpdateGroupSchema,
  UpdateMemberSchema,
} from './zod/group.schema.ts';

const tags = ['Groups'];

export const listGroupsRoute = createRoute({
  method: 'get',
  path: '/groups',
  tags,
  summary: 'List the groups the caller can see',
  description: 'Admins see every group. Each group includes the caller’s role.',
  responses: {
    200: json(z.object({ groups: z.array(GroupWithRoleSchema) }), 'Groups'),
    ...errorResponses(401),
  },
});

export const createGroupRoute = createRoute({
  method: 'post',
  path: '/groups',
  tags,
  summary: 'Create a group (admin)',
  middleware: [requireAdmin()] as const,
  request: { body: jsonBody(CreateGroupSchema) },
  responses: {
    201: json(z.object({ group: GroupSchema }), 'Created group'),
    ...errorResponses(400, 401, 403),
  },
});

export const getGroupRoute = createRoute({
  method: 'get',
  path: '/groups/{groupId}',
  tags,
  summary: 'Get a group',
  request: { params: GroupParamsSchema },
  responses: {
    200: json(z.object({ group: GroupWithRoleSchema }), 'Group'),
    ...errorResponses(...GROUP_ERRORS),
  },
});

export const updateGroupRoute = createRoute({
  method: 'patch',
  path: '/groups/{groupId}',
  tags,
  summary: 'Update a group (owner)',
  middleware: [requireGroupRole('owner')] as const,
  request: { params: GroupParamsSchema, body: jsonBody(UpdateGroupSchema) },
  responses: {
    200: json(z.object({ group: GroupSchema }), 'Updated group'),
    ...errorResponses(...GROUP_ERRORS),
  },
});

export const deleteGroupRoute = createRoute({
  method: 'delete',
  path: '/groups/{groupId}',
  tags,
  summary: 'Delete a group and everything in it (owner)',
  middleware: [requireGroupRole('owner')] as const,
  request: { params: GroupParamsSchema },
  responses: {
    200: json(z.object({ group: GroupSchema }), 'Deleted group'),
    ...errorResponses(...GROUP_ERRORS),
  },
});

export const listMembersRoute = createRoute({
  method: 'get',
  path: '/groups/{groupId}/members',
  tags,
  summary: 'List the users with access to a group',
  request: { params: GroupParamsSchema },
  responses: {
    200: json(z.object({ members: z.array(GroupMemberSchema) }), 'Members'),
    ...errorResponses(...GROUP_ERRORS),
  },
});

export const updateMemberRoute = createRoute({
  method: 'patch',
  path: '/groups/{groupId}/members/{userId}',
  tags,
  summary: 'Change a member’s role (owner)',
  middleware: [requireGroupRole('owner')] as const,
  request: { params: MemberParamsSchema, body: jsonBody(UpdateMemberSchema) },
  responses: {
    204: { description: 'Role changed' },
    ...errorResponses(...GROUP_ERRORS),
  },
});

export const removeMemberRoute = createRoute({
  method: 'delete',
  path: '/groups/{groupId}/members/{userId}',
  tags,
  summary: 'Remove a member’s access (owner)',
  middleware: [requireGroupRole('owner')] as const,
  request: { params: MemberParamsSchema },
  responses: {
    204: { description: 'Access removed' },
    ...errorResponses(...GROUP_ERRORS),
  },
});

import type { Context, MiddlewareHandler } from 'hono';
import { z } from '@hono/zod-openapi';
import { getGroupRole } from '../api/groups/group.service.ts';
import { GROUP_ROLES, type GroupRole } from '../data/models.ts';
import { ForbiddenError, NotFoundError } from '../shared/errors.ts';
import { parseParams } from '../shared/validation.ts';
import { IdSchema } from '../shared/zod/common.schema.ts';
import { getAuthUser } from './auth.middleware.ts';

declare module 'hono' {
  interface ContextVariableMap {
    groupId: number;
    groupRole: GroupRole;
  }
}

const GroupIdParamSchema = z.object({ groupId: IdSchema });

/** True if `role` is at least as privileged as `required`. */
export function hasGroupRole(role: GroupRole, required: GroupRole): boolean {
  return GROUP_ROLES.indexOf(role) <= GROUP_ROLES.indexOf(required);
}

/**
 * Resolves `:groupId` and the caller's role in it. Non-members get a 404, so
 * the existence of other groups is not revealed. App admins act as owners.
 * Must run after requireAuth.
 * @throws {ValidationError} 400 invalid group id
 * @throws {NotFoundError} 404 group not found or caller not a member
 */
export function requireGroupAccess(): MiddlewareHandler {
  return async (c, next) => {
    const { groupId } = parseParams(c, GroupIdParamSchema);
    const role = await getGroupRole(getAuthUser(c), groupId);

    if (!role) {
      throw new NotFoundError('Group');
    }

    c.set('groupId', groupId);
    c.set('groupRole', role);
    await next();
  };
}

/**
 * Requires at least the given role in the current group.
 * @throws {ForbiddenError} 403 role too low
 */
export function requireGroupRole(required: GroupRole): MiddlewareHandler {
  return async (c, next) => {
    if (!hasGroupRole(getGroupRole_(c), required)) {
      throw new ForbiddenError(
        `This requires the ${required} role in this group.`,
      );
    }
    await next();
  };
}

/**
 * Viewers may read, writing (POST, PATCH, DELETE, ...) requires editor.
 */
export function requireWriteAccessForMutations(): MiddlewareHandler {
  return async (c, next) => {
    const method = c.req.method;
    if (
      method !== 'GET' &&
      method !== 'HEAD' &&
      !hasGroupRole(getGroupRole_(c), 'editor')
    ) {
      throw new ForbiddenError('Viewers cannot change this group.');
    }
    await next();
  };
}

function getGroupRole_(c: Context): GroupRole {
  const role = c.get('groupRole') as GroupRole | undefined;
  if (!role) {
    throw new Error('Group role checked outside of requireGroupAccess.');
  }
  return role;
}

/** Returns the group id resolved by requireGroupAccess. */
export function getGroupId(c: Context): number {
  const groupId = c.get('groupId') as number | undefined;
  if (groupId === undefined) {
    throw new Error('getGroupId called outside of requireGroupAccess.');
  }
  return groupId;
}

/** Returns the caller's role resolved by requireGroupAccess. */
export function getCurrentGroupRole(c: Context): GroupRole {
  return getGroupRole_(c);
}

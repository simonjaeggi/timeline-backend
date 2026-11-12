import { getRepositories } from '../../data/index.ts';
import type { AppRole, User, UserGroup } from '../../data/models.ts';
import type { AuthUser } from '../../middleware/auth.middleware.ts';
import { ConflictError } from '../../shared/errors.ts';

/**
 * Returns the caller with the groups they can access. Admins get every group
 * with the owner role.
 */
export async function getMe(
  user: AuthUser,
): Promise<{ user: AuthUser; groups: UserGroup[] }> {
  const repositories = getRepositories();

  if (user.role === 'admin') {
    const groups = await repositories.groups.list();
    return {
      user,
      groups: groups.map((group) => ({
        id: group.id,
        name: group.name,
        role: 'owner' as const,
      })),
    };
  }

  return {
    user,
    groups: await repositories.memberships.listGroupsForUser(user.id),
  };
}

export async function listUsers(): Promise<User[]> {
  return getRepositories().users.list();
}

async function assertNotLastAdmin(userId: string): Promise<void> {
  const repositories = getRepositories();
  const user = await repositories.users.findById(userId);
  if (user?.role === 'admin' && (await repositories.users.countAdmins()) <= 1) {
    throw new ConflictError('At least one admin must remain.');
  }
}

/**
 * Changes a user's app role.
 * @throws {ConflictError} would remove the last admin
 */
export async function setUserRole(
  userId: string,
  role: AppRole,
): Promise<User | null> {
  if (role !== 'admin') await assertNotLastAdmin(userId);
  return getRepositories().users.setRole(userId, role);
}

/**
 * Deletes an account with its sessions and memberships.
 * @throws {ConflictError} would remove the last admin
 */
export async function deleteUser(userId: string): Promise<User | null> {
  await assertNotLastAdmin(userId);
  return getRepositories().users.delete(userId);
}

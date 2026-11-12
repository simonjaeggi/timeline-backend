import { getRepositories } from '../../data/index.ts';
import type {
  Group,
  GroupMember,
  GroupMembership,
  GroupRole,
} from '../../data/models.ts';
import type { AuthUser } from '../../middleware/auth.middleware.ts';
import type { CreateGroupDto, UpdateGroupDto } from './zod/group.schema.ts';

export type GroupWithRole = Group & { myRole: GroupRole };

/**
 * Returns the user's role in a group. App admins act as owners of every group.
 * @returns Role, or null if the group does not exist or the user is no member.
 */
export async function getGroupRole(
  user: AuthUser,
  groupId: number,
): Promise<GroupRole | null> {
  const repositories = getRepositories();
  const group = await repositories.groups.findById(groupId);
  if (!group) return null;

  if (user.role === 'admin') return 'owner';

  const membership = await repositories.memberships.find(groupId, user.id);
  return membership?.role ?? null;
}

/**
 * Returns the groups the user can see, with their role in each.
 * Admins see every group.
 */
export async function listGroups(user: AuthUser): Promise<GroupWithRole[]> {
  const repositories = getRepositories();

  if (user.role === 'admin') {
    const groups = await repositories.groups.list();
    return groups.map((group) => ({ ...group, myRole: 'owner' }));
  }

  const memberships = await repositories.memberships.listGroupsForUser(user.id);
  const groups = await repositories.groups.list();
  const roles = new Map(memberships.map((m) => [m.id, m.role]));

  return groups.flatMap((group) => {
    const role = roles.get(group.id);
    return role ? [{ ...group, myRole: role }] : [];
  });
}

export async function getGroup(groupId: number): Promise<Group | null> {
  return getRepositories().groups.findById(groupId);
}

export async function createGroup(
  user: AuthUser,
  input: CreateGroupDto,
): Promise<Group> {
  return getRepositories().groups.create({ ...input, createdBy: user.id });
}

export async function updateGroup(
  groupId: number,
  input: UpdateGroupDto,
): Promise<Group | null> {
  return getRepositories().groups.update(groupId, input);
}

/** Deletes a group including its people, entries and memberships. */
export async function deleteGroup(groupId: number): Promise<Group | null> {
  return getRepositories().groups.delete(groupId);
}

export async function listMembers(groupId: number): Promise<GroupMember[]> {
  return getRepositories().memberships.listForGroup(groupId);
}

/**
 * Changes a member's role.
 * @returns Updated membership, null if the user is not a member.
 */
export async function updateMemberRole(
  groupId: number,
  userId: string,
  role: GroupRole,
): Promise<GroupMembership | null> {
  const repositories = getRepositories();
  const existing = await repositories.memberships.find(groupId, userId);
  if (!existing) return null;
  return repositories.memberships.upsert(groupId, userId, role);
}

export async function removeMember(
  groupId: number,
  userId: string,
): Promise<GroupMembership | null> {
  return getRepositories().memberships.delete(groupId, userId);
}

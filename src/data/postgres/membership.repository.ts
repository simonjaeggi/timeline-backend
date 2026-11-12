import { and, asc, eq } from 'drizzle-orm';
import type {
  GroupMember,
  GroupMembership,
  GroupRole,
  UserGroup,
} from '../models.ts';
import type { MembershipRepository } from '../repositories.ts';
import type { PostgresDb } from './db.ts';
import { withTranslatedErrors } from './error-translation.ts';
import { groupMembers, groups, users } from './schema.ts';

export function createMembershipRepository(
  db: PostgresDb,
): MembershipRepository {
  return {
    async listGroupsForUser(userId: string): Promise<UserGroup[]> {
      return db
        .select({ id: groups.id, name: groups.name, role: groupMembers.role })
        .from(groupMembers)
        .innerJoin(groups, eq(groups.id, groupMembers.groupId))
        .where(eq(groupMembers.userId, userId))
        .orderBy(asc(groups.name), asc(groups.id));
    },

    async listForGroup(groupId: number): Promise<GroupMember[]> {
      const rows = await db
        .select({
          groupId: groupMembers.groupId,
          userId: groupMembers.userId,
          role: groupMembers.role,
          createdAt: groupMembers.createdAt,
          user: {
            id: users.id,
            name: users.name,
            email: users.email,
            image: users.image,
          },
        })
        .from(groupMembers)
        .innerJoin(users, eq(users.id, groupMembers.userId))
        .where(eq(groupMembers.groupId, groupId))
        .orderBy(asc(users.name), asc(users.email));

      return rows;
    },

    async find(
      groupId: number,
      userId: string,
    ): Promise<GroupMembership | null> {
      const [membership] = await db
        .select()
        .from(groupMembers)
        .where(
          and(
            eq(groupMembers.groupId, groupId),
            eq(groupMembers.userId, userId),
          ),
        );
      return membership ?? null;
    },

    async upsert(
      groupId: number,
      userId: string,
      role: GroupRole,
    ): Promise<GroupMembership> {
      return withTranslatedErrors(async () => {
        const [membership] = await db
          .insert(groupMembers)
          .values({ groupId, userId, role })
          .onConflictDoUpdate({
            target: [groupMembers.groupId, groupMembers.userId],
            set: { role },
          })
          .returning();
        if (!membership) throw new Error('Upsert into group_members failed.');
        return membership;
      });
    },

    async delete(
      groupId: number,
      userId: string,
    ): Promise<GroupMembership | null> {
      const [membership] = await db
        .delete(groupMembers)
        .where(
          and(
            eq(groupMembers.groupId, groupId),
            eq(groupMembers.userId, userId),
          ),
        )
        .returning();
      return membership ?? null;
    },
  };
}

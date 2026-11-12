import { asc, eq } from 'drizzle-orm';
import type { Group, GroupUpdate, NewGroup } from '../models.ts';
import type { GroupRepository } from '../repositories.ts';
import type { PostgresDb } from './db.ts';
import { withTranslatedErrors } from './error-translation.ts';
import { groups } from './schema.ts';

export function createGroupRepository(db: PostgresDb): GroupRepository {
  return {
    async list(): Promise<Group[]> {
      return db.select().from(groups).orderBy(asc(groups.name), asc(groups.id));
    },

    async findById(id: number): Promise<Group | null> {
      const [group] = await db.select().from(groups).where(eq(groups.id, id));
      return group ?? null;
    },

    async create(input: NewGroup): Promise<Group> {
      return withTranslatedErrors(async () => {
        const [group] = await db.insert(groups).values(input).returning();
        if (!group) throw new Error('Insert into groups returned no row.');
        return group;
      });
    },

    async update(id: number, input: GroupUpdate): Promise<Group | null> {
      return withTranslatedErrors(async () => {
        const [group] = await db
          .update(groups)
          .set(input)
          .where(eq(groups.id, id))
          .returning();
        return group ?? null;
      });
    },

    async delete(id: number): Promise<Group | null> {
      const [group] = await db
        .delete(groups)
        .where(eq(groups.id, id))
        .returning();
      return group ?? null;
    },
  };
}

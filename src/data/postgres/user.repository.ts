import { asc, count, eq } from 'drizzle-orm';
import type { AppRole, User } from '../models.ts';
import type { UserRepository } from '../repositories.ts';
import type { PostgresDb } from './db.ts';
import { users } from './schema.ts';

const userColumns = {
  id: users.id,
  name: users.name,
  email: users.email,
  image: users.image,
  role: users.role,
  createdAt: users.createdAt,
};

export function createUserRepository(db: PostgresDb): UserRepository {
  return {
    async list(): Promise<User[]> {
      return db
        .select(userColumns)
        .from(users)
        .orderBy(asc(users.name), asc(users.email));
    },

    async findById(id: string): Promise<User | null> {
      const [user] = await db
        .select(userColumns)
        .from(users)
        .where(eq(users.id, id));
      return user ?? null;
    },

    async countAdmins(): Promise<number> {
      const [row] = await db
        .select({ total: count() })
        .from(users)
        .where(eq(users.role, 'admin'));
      return row?.total ?? 0;
    },

    async setRole(id: string, role: AppRole): Promise<User | null> {
      const [user] = await db
        .update(users)
        .set({ role })
        .where(eq(users.id, id))
        .returning(userColumns);
      return user ?? null;
    },

    async delete(id: string): Promise<User | null> {
      const [user] = await db
        .delete(users)
        .where(eq(users.id, id))
        .returning(userColumns);
      return user ?? null;
    },
  };
}

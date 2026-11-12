import { and, asc, eq, ilike, inArray, or, type SQL } from 'drizzle-orm';
import type { NewPerson, Person, PersonUpdate } from '../models.ts';
import type { PersonRepository } from '../repositories.ts';
import type { PostgresDb } from './db.ts';
import { containsPattern, withTranslatedErrors } from './error-translation.ts';
import { people } from './schema.ts';

export function createPersonRepository(db: PostgresDb): PersonRepository {
  return {
    async list(
      groupId: number,
      options: { q?: string; limit?: number } = {},
    ): Promise<Person[]> {
      const conditions: (SQL | undefined)[] = [eq(people.groupId, groupId)];

      if (options.q) {
        const pattern = containsPattern(options.q);
        conditions.push(
          or(
            ilike(people.firstName, pattern),
            ilike(people.lastName, pattern),
            ilike(people.nickname, pattern),
          ),
        );
      }

      const query = db
        .select()
        .from(people)
        .where(and(...conditions))
        .orderBy(asc(people.firstName), asc(people.lastName), asc(people.id));

      return options.limit ? query.limit(options.limit) : query;
    },

    async findById(groupId: number, id: number): Promise<Person | null> {
      const [person] = await db
        .select()
        .from(people)
        .where(and(eq(people.groupId, groupId), eq(people.id, id)));
      return person ?? null;
    },

    async findManyByIds(groupId: number, ids: number[]): Promise<Person[]> {
      if (ids.length === 0) return [];

      return db
        .select()
        .from(people)
        .where(and(eq(people.groupId, groupId), inArray(people.id, ids)));
    },

    async create(input: NewPerson): Promise<Person> {
      return withTranslatedErrors(async () => {
        const [person] = await db.insert(people).values(input).returning();
        if (!person) throw new Error('Insert into people returned no row.');
        return person;
      });
    },

    async update(
      groupId: number,
      id: number,
      input: PersonUpdate,
    ): Promise<Person | null> {
      return withTranslatedErrors(async () => {
        const [person] = await db
          .update(people)
          .set(input)
          .where(and(eq(people.groupId, groupId), eq(people.id, id)))
          .returning();
        return person ?? null;
      });
    },

    async delete(groupId: number, id: number): Promise<Person | null> {
      const [person] = await db
        .delete(people)
        .where(and(eq(people.groupId, groupId), eq(people.id, id)))
        .returning();
      return person ?? null;
    },
  };
}

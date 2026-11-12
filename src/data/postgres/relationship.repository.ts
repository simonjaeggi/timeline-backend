import { and, asc, eq, or } from 'drizzle-orm';
import type {
  NewRelationship,
  Relationship,
  RelationshipType,
} from '../models.ts';
import type { RelationshipRepository } from '../repositories.ts';
import type { PostgresDb } from './db.ts';
import { withTranslatedErrors } from './error-translation.ts';
import { relationships } from './schema.ts';

export function createRelationshipRepository(
  db: PostgresDb,
): RelationshipRepository {
  return {
    async listForPerson(
      groupId: number,
      personId: number,
    ): Promise<Relationship[]> {
      return db
        .select()
        .from(relationships)
        .where(
          and(
            eq(relationships.groupId, groupId),
            or(
              eq(relationships.personId, personId),
              eq(relationships.relatedPersonId, personId),
            ),
          ),
        )
        .orderBy(asc(relationships.type), asc(relationships.id));
    },

    async find(
      groupId: number,
      personId: number,
      relatedPersonId: number,
      type: RelationshipType,
    ): Promise<Relationship | null> {
      const [relationship] = await db
        .select()
        .from(relationships)
        .where(
          and(
            eq(relationships.groupId, groupId),
            eq(relationships.personId, personId),
            eq(relationships.relatedPersonId, relatedPersonId),
            eq(relationships.type, type),
          ),
        );
      return relationship ?? null;
    },

    async create(input: NewRelationship): Promise<Relationship> {
      return withTranslatedErrors(async () => {
        const [relationship] = await db
          .insert(relationships)
          .values(input)
          .returning();
        if (!relationship) {
          throw new Error('Insert into relationships returned no row.');
        }
        return relationship;
      });
    },

    async delete(groupId: number, id: number): Promise<Relationship | null> {
      const [relationship] = await db
        .delete(relationships)
        .where(
          and(eq(relationships.groupId, groupId), eq(relationships.id, id)),
        )
        .returning();
      return relationship ?? null;
    },
  };
}

import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { sql } from 'drizzle-orm';
import type { DataLayer } from '../index.ts';
import type { PostgresDb } from './db.ts';
import { createAccessCodeRepository } from './access-code.repository.ts';
import { createEntryRepository } from './entry.repository.ts';
import { createGroupRepository } from './group.repository.ts';
import { createMembershipRepository } from './membership.repository.ts';
import { createPersonRepository } from './person.repository.ts';
import { createRelationshipRepository } from './relationship.repository.ts';
import { createUserRepository } from './user.repository.ts';
import { accounts, sessions, users, verifications } from './schema.ts';

/**
 * Builds the Postgres implementation of the data layer: our repositories plus
 * the database adapter Better Auth uses for its own tables.
 * @param db Drizzle Postgres database (node-postgres or PGlite)
 * @param close closes the underlying connection
 */
export function createPostgresDataLayer(
  db: PostgresDb,
  close: () => Promise<void> = async () => {},
): DataLayer {
  return {
    repositories: {
      users: createUserRepository(db),
      memberships: createMembershipRepository(db),
      accessCodes: createAccessCodeRepository(db),
      groups: createGroupRepository(db),
      people: createPersonRepository(db),
      relationships: createRelationshipRepository(db),
      entries: createEntryRepository(db),
      async ping() {
        await db.execute(sql`SELECT 1`);
      },
      close,
    },
    authDatabase: drizzleAdapter(db, {
      provider: 'pg',
      usePlural: true,
      schema: { users, sessions, accounts, verifications },
    }),
  };
}

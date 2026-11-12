import type { BetterAuthOptions } from 'better-auth';
import { env } from '../env-validation.ts';
import { createPostgresConnection } from './postgres/db.ts';
import { createPostgresDataLayer } from './postgres/index.ts';
import type { Repositories } from './repositories.ts';

/**
 * Everything a database driver provides: our repositories and the adapter
 * Better Auth uses for its own tables (users, sessions, accounts, ...).
 */
export type DataLayer = {
  repositories: Repositories;
  authDatabase: NonNullable<BetterAuthOptions['database']>;
};

let dataLayer: DataLayer | null = null;

/**
 * Creates the data layer for the configured DB_DRIVER.
 * To support another database, add a driver folder next to `postgres/`
 * that returns a `DataLayer`, and a case here. Better Auth ships adapters
 * for Drizzle (pg, mysql, sqlite), Kysely, Prisma and MongoDB.
 */
function createDataLayerFromEnv(): DataLayer {
  switch (env.DB_DRIVER) {
    case 'postgres': {
      const connection = createPostgresConnection(env.DATABASE_URL);
      return createPostgresDataLayer(connection.db, connection.close);
    }
  }
}

function getDataLayer(): DataLayer {
  dataLayer ??= createDataLayerFromEnv();
  return dataLayer;
}

/** Returns the shared repositories, created lazily on first use. */
export function getRepositories(): Repositories {
  return getDataLayer().repositories;
}

/** Returns the database adapter for Better Auth. */
export function getAuthDatabase(): DataLayer['authDatabase'] {
  return getDataLayer().authDatabase;
}

/**
 * Replaces the data layer, for tests or a custom bootstrap.
 * @param next data layer to use from now on
 */
export function setDataLayer(next: DataLayer): void {
  dataLayer = next;
}

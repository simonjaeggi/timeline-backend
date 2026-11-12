import { attachDatabasePool } from '@vercel/functions';
import { drizzle } from 'drizzle-orm/node-postgres';
import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core';
import { Pool } from 'pg';
import * as schema from './schema.ts';

/**
 * Any Drizzle Postgres database (node-postgres in production, PGlite in tests).
 */
export type PostgresDb = PgDatabase<PgQueryResultHKT, typeof schema>;

/** A database handle or an open transaction. */
export type PostgresExecutor =
  PostgresDb | Parameters<Parameters<PostgresDb['transaction']>[0]>[0];

/**
 * Opens a node-postgres connection pool.
 * @param connectionString Postgres connection URL
 * @returns Drizzle database and a function closing the pool.
 */
export function createPostgresConnection(connectionString: string): {
  db: PostgresDb;
  close: () => Promise<void>;
} {
  const pool = new Pool({
    connectionString,
    // Serverless (Vercel + Neon): close idle connections quickly so suspended
    // instances do not hold them; Neon's pooler absorbs reconnects cheaply.
    idleTimeoutMillis: 5_000,
    connectionTimeoutMillis: 10_000,
  });
  // On Vercel, keeps the instance alive until idle connections are released.
  // Does nothing elsewhere.
  attachDatabasePool(pool);
  const db = drizzle(pool, { schema });

  return { db, close: () => pool.end() };
}

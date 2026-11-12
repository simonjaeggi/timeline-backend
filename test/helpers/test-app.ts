import { PGlite } from '@electric-sql/pglite';
import type { BetterAuthOptions } from 'better-auth';
import { drizzle } from 'drizzle-orm/pglite';
import { migrate } from 'drizzle-orm/pglite/migrator';
import { createApp } from '../../src/create-app.ts';
import { resetAuth } from '../../src/auth/better-auth.ts';
import { setDataLayer } from '../../src/data/index.ts';
import { createPostgresDataLayer } from '../../src/data/postgres/index.ts';
import * as schema from '../../src/data/postgres/schema.ts';

export const TEST_ORIGIN = 'http://localhost:5173';

/** Minimal cookie jar: remembers cookies from responses, sends them back. */
export class CookieJar {
  private readonly cookies = new Map<string, string>();

  store(response: Response): void {
    for (const header of response.headers.getSetCookie()) {
      const [pair = ''] = header.split(';');
      const index = pair.indexOf('=');
      const name = pair.slice(0, index).trim();
      const value = pair.slice(index + 1).trim();
      if (value === '' || /max-age=0/i.test(header)) this.cookies.delete(name);
      else this.cookies.set(name, value);
    }
  }

  header(): string {
    return [...this.cookies]
      .map(([name, value]) => `${name}=${value}`)
      .join('; ');
  }
}

/**
 * Boots the app against an in-memory Postgres (PGlite) with all migrations applied.
 * Each test file gets its own database.
 * @param authOverrides Better Auth options for tests (only used with AUTH_MODE=better-auth)
 */
export async function createTestApp(
  authOverrides?: Partial<BetterAuthOptions>,
) {
  const client = new PGlite();
  const db = drizzle(client, { schema });
  await migrate(db, { migrationsFolder: 'drizzle' });

  setDataLayer(createPostgresDataLayer(db, () => client.close()));
  if (authOverrides) resetAuth(authOverrides);

  const app = createApp();

  async function request(
    method: string,
    path: string,
    body?: unknown,
    jar?: CookieJar,
  ) {
    const headers: Record<string, string> = { Origin: TEST_ORIGIN };
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    const cookie = jar?.header();
    if (cookie) headers.Cookie = cookie;

    const response = await app.request(`/api${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    jar?.store(response);

    const text = await response.text();
    let json: any = null;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      json = text;
    }
    return { status: response.status, body: json, headers: response.headers };
  }

  /** Creates a fresh group so tests do not share data. */
  async function createGroup(name = 'Test family', jar?: CookieJar) {
    const { body } = await request('POST', '/groups', { name }, jar);
    return body.group.id as number;
  }

  return {
    app,
    db,
    request,
    createGroup,
    close: () => client.close(),
  };
}

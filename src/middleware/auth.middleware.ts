import type { Context, MiddlewareHandler } from 'hono';
import { APP_ROLES, type AppRole } from '../data/models.ts';
import { getAuth } from '../auth/better-auth.ts';
import { env } from '../env-validation.ts';
import { ForbiddenError, UnauthorizedError } from '../shared/errors.ts';

/**
 * The authenticated caller, independent of how they authenticated.
 * `id` is the user id (or the dev user id in AUTH_MODE=dev).
 */
export type AuthUser = {
  id: string;
  name: string;
  email: string | null;
  role: AppRole;
};

/** Resolves the caller from a request; null when not authenticated. */
export type AuthProvider = (c: Context) => Promise<AuthUser | null>;

declare module 'hono' {
  interface ContextVariableMap {
    authUser: AuthUser;
  }
}

/** Development provider: every request is the configured dev user, an admin. */
export const devAuthProvider: AuthProvider = async () => ({
  id: env.DEV_USER_ID,
  name: env.DEV_USER_NAME,
  email: null,
  role: 'admin',
});

function toAppRole(value: unknown): AppRole {
  return APP_ROLES.includes(value as AppRole) ? (value as AppRole) : 'user';
}

/** Better Auth provider: reads the session cookie and loads the user. */
export const betterAuthProvider: AuthProvider = async (c) => {
  const session = await getAuth().api.getSession({
    headers: c.req.raw.headers,
  });
  if (!session) return null;

  return {
    id: session.user.id,
    name: session.user.name,
    email: session.user.email,
    // Additional field configured in better-auth.ts.
    role: toAppRole((session.user as { role?: unknown }).role),
  };
};

/** Picks the provider for the configured AUTH_MODE. */
export function resolveAuthProvider(): AuthProvider {
  return env.AUTH_MODE === 'better-auth' ? betterAuthProvider : devAuthProvider;
}

/**
 * Requires an authenticated caller and stores it in the context.
 * @param provider auth provider, defaults to the configured one
 * @throws {UnauthorizedError} 401 not authenticated
 */
export function requireAuth(
  provider: AuthProvider = resolveAuthProvider(),
): MiddlewareHandler {
  return async (c, next) => {
    const user = await provider(c);
    if (!user) throw new UnauthorizedError();

    c.set('authUser', user);
    await next();
  };
}

/**
 * Requires the app admin role. Must run after requireAuth.
 * @throws {ForbiddenError} 403 not an admin
 */
export function requireAdmin(): MiddlewareHandler {
  return async (c, next) => {
    if (getAuthUser(c).role !== 'admin') {
      throw new ForbiddenError('Admin role required.');
    }
    await next();
  };
}

/**
 * Returns the authenticated caller.
 * @throws {UnauthorizedError} 401 requireAuth did not run
 */
export function getAuthUser(c: Context): AuthUser {
  const user = c.get('authUser') as AuthUser | undefined;
  if (!user) throw new UnauthorizedError();
  return user;
}

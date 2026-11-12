import type { MiddlewareHandler } from 'hono';
import { env } from '../env-validation.ts';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * Only the configured frontend may change data.
 *
 * CORS alone only hides responses from other sites; it does not stop a
 * cross-site form or fetch from being sent with the user's cookies. This
 * rejects state-changing requests whose Origin is not an allowed frontend
 * (CORS_ORIGINS plus the backend's own public URL).
 *
 * Browsers always send Origin on POST/PATCH/DELETE. In production a missing
 * Origin is rejected too, so the API only accepts writes from a browser on the
 * frontend. Outside production it is allowed, so curl and scripts keep working.
 *
 * This is not a substitute for authentication: non-browser clients can send
 * any Origin header. Every data endpoint still requires a session.
 *
 * @param allowedOrigins origins allowed to send state-changing requests
 */
export function requireAllowedOrigin(
  allowedOrigins: readonly string[],
): MiddlewareHandler {
  const allowed = new Set(allowedOrigins);
  const requireOriginHeader = env.NODE_ENV === 'production';

  return async (c, next) => {
    if (SAFE_METHODS.has(c.req.method)) return next();

    const origin = c.req.header('origin');
    const accepted = origin ? allowed.has(origin) : !requireOriginHeader;

    if (!accepted) {
      return c.json(
        { message: 'Requests from this origin are not allowed.', status: 403 },
        403,
      );
    }

    await next();
  };
}

/** Origins allowed by default: CORS_ORIGINS and the public backend URL. */
export function defaultAllowedOrigins(): string[] {
  const origins = [...env.CORS_ORIGINS];
  if (env.BETTER_AUTH_URL) origins.push(new URL(env.BETTER_AUTH_URL).origin);
  return origins;
}

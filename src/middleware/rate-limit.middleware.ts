import type { Context, MiddlewareHandler } from 'hono';
import { getConnInfo } from '@hono/node-server/conninfo';
import { env } from '../env-validation.ts';

type Bucket = { count: number; resetAt: number };

/**
 * Returns the client IP. Uses X-Forwarded-For only behind a proxy that sets
 * it (TRUST_PROXY, or on Vercel, whose edge overwrites the header), otherwise
 * anyone could fake their IP with that header.
 */
export function getClientIp(c: Context): string {
  if (env.TRUST_PROXY || env.VERCEL) {
    const forwarded = c.req.header('x-forwarded-for')?.split(',')[0]?.trim();
    if (forwarded) return forwarded;
  }

  try {
    return getConnInfo(c).remote.address ?? 'unknown';
  } catch {
    // Not running on the Node server (e.g. app.request in tests).
    return 'unknown';
  }
}

/**
 * Fixed-window, in-memory rate limiter. Good enough for a single server
 * instance; use a shared store (Redis, database) when running several.
 * @param options.max requests allowed per window
 * @param options.windowMs window length in milliseconds
 * @param options.key bucket key, defaults to the client IP
 */
export function rateLimit(options: {
  max: number;
  windowMs: number;
  key?: (c: Context) => string;
}): MiddlewareHandler & { reset: () => void } {
  const buckets = new Map<string, Bucket>();
  const keyOf = options.key ?? getClientIp;

  const middleware: MiddlewareHandler = async (c, next) => {
    const now = Date.now();

    if (buckets.size > 10_000) {
      for (const [key, bucket] of buckets) {
        if (bucket.resetAt <= now) buckets.delete(key);
      }
    }

    const key = keyOf(c);
    let bucket = buckets.get(key);
    if (!bucket || bucket.resetAt <= now) {
      bucket = { count: 0, resetAt: now + options.windowMs };
      buckets.set(key, bucket);
    }

    bucket.count += 1;

    if (bucket.count > options.max) {
      const retryAfter = Math.ceil((bucket.resetAt - now) / 1000);
      c.header('Retry-After', String(retryAfter));
      return c.json(
        { message: 'Too many attempts. Try again later.', status: 429 },
        429,
      );
    }

    await next();
  };

  return Object.assign(middleware, { reset: () => buckets.clear() });
}

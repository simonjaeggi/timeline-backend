import { z } from '@hono/zod-openapi';

const EnvSchema = z
  .object({
    NODE_ENV: z
      .enum(['development', 'test', 'production'])
      .default('development'),
    HOST: z.string().trim().min(1).default('localhost'),
    PORT: z.coerce.number().int().positive().default(3000),
    /** Frontend origins allowed to call the API from a browser. */
    CORS_ORIGINS: z
      .string()
      .default('http://localhost:5173')
      .transform((value, ctx) =>
        value
          .split(',')
          .map((origin) => origin.trim())
          .filter(Boolean)
          .map((origin) => {
            // Browsers send a bare origin ("https://app.example.com"), so a
            // trailing slash or path would never match. Normalise or reject.
            try {
              return new URL(origin).origin;
            } catch {
              ctx.addIssue({
                code: 'custom',
                message: `CORS_ORIGINS contains an invalid URL: ${origin}`,
              });
              return z.NEVER;
            }
          }),
      ),
    DB_DRIVER: z.enum(['postgres']).default('postgres'),
    DATABASE_URL: z.url('DATABASE_URL must be a valid URL.'),
    AUTH_MODE: z.enum(['dev', 'better-auth']).default('dev'),
    DEV_USER_ID: z.string().trim().min(1).default('dev-user'),
    DEV_USER_NAME: z.string().trim().min(1).default('Dev User'),
    BETTER_AUTH_SECRET: z
      .string()
      .min(32, 'BETTER_AUTH_SECRET must be at least 32 characters.')
      .optional(),
    BETTER_AUTH_URL: z.url('BETTER_AUTH_URL must be a valid URL.').optional(),
    GOOGLE_CLIENT_ID: z.string().trim().min(1).optional(),
    GOOGLE_CLIENT_SECRET: z.string().trim().min(1).optional(),
    INITIAL_ACCESS_CODE: z
      .string()
      .trim()
      .regex(
        /^[A-Za-z0-9]{4}-?[A-Za-z0-9]{4}-?[A-Za-z0-9]{4}$/,
        'INITIAL_ACCESS_CODE must look like ABCD-EFGH-JKLM.',
      )
      .optional(),
    /** Read the client IP from X-Forwarded-For (only behind a trusted proxy like Caddy). */
    TRUST_PROXY: z.stringbool().default(false),
    /** Set to 1 by Vercel on every deployment. */
    VERCEL: z.stringbool().default(false),
    BODY_LIMIT_BYTES: z.coerce.number().int().positive().default(1_048_576),
  })
  .superRefine((env, ctx) => {
    if (env.AUTH_MODE === 'better-auth') {
      for (const key of [
        'BETTER_AUTH_SECRET',
        'BETTER_AUTH_URL',
        'GOOGLE_CLIENT_ID',
        'GOOGLE_CLIENT_SECRET',
      ] as const) {
        if (!env[key]) {
          ctx.addIssue({
            code: 'custom',
            path: [key],
            message: `${key} is required when AUTH_MODE=better-auth.`,
          });
        }
      }
    }

    if (env.NODE_ENV === 'production') {
      const insecure = env.CORS_ORIGINS.filter(
        (origin) => !origin.startsWith('https://'),
      );
      if (insecure.length > 0) {
        ctx.addIssue({
          code: 'custom',
          path: ['CORS_ORIGINS'],
          message: `CORS_ORIGINS must only contain https origins in production (got ${insecure.join(', ')}).`,
        });
      }
    }

    if (env.NODE_ENV === 'production' && env.AUTH_MODE === 'dev') {
      ctx.addIssue({
        code: 'custom',
        path: ['AUTH_MODE'],
        message:
          'AUTH_MODE=dev authenticates everyone and must not be used in production.',
      });
    }
  });

export type Env = z.infer<typeof EnvSchema>;

/**
 * Validates the process environment once at startup.
 * @returns Parsed and typed environment.
 * @throws {Error} when a variable is missing or invalid
 */
function validateEnv(): Env {
  // `KEY=` in a .env file arrives as an empty string; treat it as unset so
  // defaults and optional fields work with the blanks in .env.example.
  const definedEnv = Object.fromEntries(
    Object.entries(process.env).filter(([, value]) => value !== ''),
  );
  const result = EnvSchema.safeParse(definedEnv);

  if (!result.success) {
    throw new Error(
      `Invalid environment configuration:\n${z.prettifyError(result.error)}`,
    );
  }

  return result.data;
}

export const env = validateEnv();

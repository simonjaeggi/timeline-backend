import { betterAuth, type BetterAuthOptions } from 'better-auth';
import { APIError } from 'better-auth/api';
import {
  ACCESS_CODE_COOKIE,
  completeSignUp,
  reserveAccessCodeForSignUp,
} from '../api/access-codes/access-code.service.ts';
import { getAuthDatabase } from '../data/index.ts';
import { env } from '../env-validation.ts';

/** Codes the frontend receives as `?error=` after a rejected Google sign-up. */
export const SIGN_UP_ERROR_CODES = {
  ACCESS_CODE_REQUIRED: 'ACCESS_CODE_REQUIRED',
  INVALID_ACCESS_CODE: 'INVALID_ACCESS_CODE',
} as const;

/**
 * Builds the Better Auth configuration.
 *
 * Sign-up gate: an account can only be created if the request carries the
 * access code cookie (set by POST /api/access-codes/check) and the code can be
 * redeemed for the account's email. The check runs in the "before user create"
 * hook, so it applies to every sign-up path, not only the frontend form.
 *
 * @param overrides extra options, used by tests (e.g. email/password sign-up)
 */
export function createAuthOptions(overrides: Partial<BetterAuthOptions> = {}) {
  return {
    appName: 'Timeline',
    baseURL: env.BETTER_AUTH_URL,
    secret: env.BETTER_AUTH_SECRET,
    basePath: '/api/auth',
    database: getAuthDatabase(),
    trustedOrigins: env.CORS_ORIGINS,
    socialProviders:
      env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET
        ? {
            google: {
              clientId: env.GOOGLE_CLIENT_ID,
              clientSecret: env.GOOGLE_CLIENT_SECRET,
              prompt: 'select_account' as const,
            },
          }
        : {},
    user: {
      additionalFields: {
        role: {
          type: 'string',
          required: false,
          defaultValue: 'user',
          // Clients can never set their own role.
          input: false,
        },
      },
    },
    session: {
      // Long sessions so family members rarely have to sign in again.
      expiresIn: 60 * 60 * 24 * 30,
      updateAge: 60 * 60 * 24,
    },
    databaseHooks: {
      user: {
        create: {
          before: async (user, ctx) => {
            const code = ctx?.getCookie(ACCESS_CODE_COOKIE);

            if (!code) {
              throw APIError.from('FORBIDDEN', {
                code: SIGN_UP_ERROR_CODES.ACCESS_CODE_REQUIRED,
                message: 'An access code is required to create an account.',
              });
            }

            const reserved = await reserveAccessCodeForSignUp(code, user.email);
            if (!reserved) {
              throw APIError.from('FORBIDDEN', {
                code: SIGN_UP_ERROR_CODES.INVALID_ACCESS_CODE,
                message: 'The access code is invalid, expired or already used.',
              });
            }

            return { data: { ...user, role: reserved.grantsAppRole } };
          },
          after: async (user, ctx) => {
            await completeSignUp(ctx?.getCookie(ACCESS_CODE_COOKIE), user);
          },
        },
      },
    },
    ...overrides,
  } satisfies BetterAuthOptions;
}

function createAuth(overrides: Partial<BetterAuthOptions> = {}) {
  return betterAuth(createAuthOptions(overrides));
}

export type Auth = ReturnType<typeof createAuth>;

let auth: Auth | null = null;

/** Returns the shared Better Auth instance, created on first use. */
export function getAuth(): Auth {
  auth ??= createAuth();
  return auth;
}

/**
 * Replaces the Better Auth instance (tests).
 * @param overrides extra options
 */
export function resetAuth(overrides: Partial<BetterAuthOptions> = {}): Auth {
  auth = createAuth(overrides);
  return auth;
}

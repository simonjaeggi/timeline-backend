import { createRoute, z } from '@hono/zod-openapi';
import { getAuthUser, requireAdmin } from '../../middleware/auth.middleware.ts';
import { rateLimit } from '../../middleware/rate-limit.middleware.ts';
import { errorResponses, json, jsonBody } from '../../shared/openapi.ts';
import { UserGroupSchema } from '../users/zod/user.schema.ts';
import {
  AccessCodeBodySchema,
  AccessCodeCheckSchema,
  AccessCodeParamsSchema,
  AccessCodeSchema,
  CreateAccessCodeSchema,
  CreatedAccessCodeSchema,
} from './zod/access-code.schema.ts';

/** 10 attempts per IP per 15 minutes on the public check. */
export const checkRateLimit = rateLimit({ max: 10, windowMs: 15 * 60 * 1000 });

/** 10 attempts per user per 15 minutes when redeeming as a signed-in user. */
export const redeemRateLimit = rateLimit({
  max: 10,
  windowMs: 15 * 60 * 1000,
  key: (c) => `user:${getAuthUser(c).id}`,
});

const tags = ['Access codes'];

export const checkAccessCodeRoute = createRoute({
  method: 'post',
  path: '/access-codes/check',
  tags,
  summary: 'Check a code before signing up (public)',
  description:
    'Step 1 of sign-up. Validates the code without using it and sets a 15 minute httpOnly cookie. Step 2: sign in with Google via Better Auth; the account is only created if the cookie holds a usable code. Rate limited per IP.',
  security: [],
  middleware: [checkRateLimit] as const,
  request: { body: jsonBody(AccessCodeBodySchema) },
  responses: {
    200: json(AccessCodeCheckSchema, 'Code is valid; cookie set'),
    ...errorResponses(400, 429),
  },
});

export const redeemAccessCodeRoute = createRoute({
  method: 'post',
  path: '/access-codes/redeem',
  tags,
  summary: 'Redeem a code with an existing account',
  description:
    'For signed-in users joining another group. Rate limited per user.',
  middleware: [redeemRateLimit] as const,
  request: { body: jsonBody(AccessCodeBodySchema) },
  responses: {
    200: json(
      z.object({ groups: z.array(UserGroupSchema) }),
      'The caller’s groups after redeeming',
    ),
    ...errorResponses(400, 401, 429),
  },
});

const adminTags = ['Admin'];

export const listAccessCodesRoute = createRoute({
  method: 'get',
  path: '/admin/access-codes',
  tags: adminTags,
  summary: 'List access codes (admin)',
  middleware: [requireAdmin()] as const,
  responses: {
    200: json(z.object({ accessCodes: z.array(AccessCodeSchema) }), 'Codes'),
    ...errorResponses(401, 403),
  },
});

export const createAccessCodeRoute = createRoute({
  method: 'post',
  path: '/admin/access-codes',
  tags: adminTags,
  summary: 'Create an access code (admin)',
  description: 'The plain code is in the response only once.',
  middleware: [requireAdmin()] as const,
  request: { body: jsonBody(CreateAccessCodeSchema) },
  responses: {
    201: json(CreatedAccessCodeSchema, 'Created code'),
    ...errorResponses(400, 401, 403),
  },
});

export const revokeAccessCodeRoute = createRoute({
  method: 'post',
  path: '/admin/access-codes/{accessCodeId}/revoke',
  tags: adminTags,
  summary: 'Revoke an unused access code (admin)',
  middleware: [requireAdmin()] as const,
  request: { params: AccessCodeParamsSchema },
  responses: {
    200: json(z.object({ accessCode: AccessCodeSchema }), 'Revoked code'),
    ...errorResponses(400, 401, 403, 404, 409),
  },
});

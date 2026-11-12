import type { RouteHandler } from '@hono/zod-openapi';
import { deleteCookie, setCookie } from 'hono/cookie';
import { env } from '../../env-validation.ts';
import { getAuthUser } from '../../middleware/auth.middleware.ts';
import { NotFoundError, ValidationError } from '../../shared/errors.ts';
import type {
  checkAccessCodeRoute,
  createAccessCodeRoute,
  listAccessCodesRoute,
  redeemAccessCodeRoute,
  revokeAccessCodeRoute,
} from './access-code.openapi.ts';
import * as accessCodeService from './access-code.service.ts';
import { formatAccessCode } from './access-code.util.ts';

const cookieOptions = {
  // Only sent to the auth routes, where the sign-up hook reads it.
  path: '/api/auth',
  httpOnly: true,
  sameSite: 'Lax',
  secure: env.BETTER_AUTH_URL?.startsWith('https://') ?? false,
} as const;

export const checkAccessCode: RouteHandler<
  typeof checkAccessCodeRoute
> = async (c) => {
  const { code } = c.req.valid('json');
  const result = await accessCodeService.checkAccessCode(code);

  if (!result) {
    deleteCookie(c, accessCodeService.ACCESS_CODE_COOKIE, cookieOptions);
    throw new ValidationError('Invalid, expired or already used access code.');
  }

  setCookie(c, accessCodeService.ACCESS_CODE_COOKIE, formatAccessCode(code), {
    ...cookieOptions,
    maxAge: accessCodeService.ACCESS_CODE_COOKIE_MAX_AGE_SECONDS,
  });

  const { accessCode, group } = result;
  return c.json(
    {
      valid: true as const,
      group,
      groupRole: accessCode.groupRole,
      grantsAdmin: accessCode.grantsAppRole === 'admin',
      expiresAt: accessCode.expiresAt,
    },
    200,
  );
};

export const redeemAccessCode: RouteHandler<
  typeof redeemAccessCodeRoute
> = async (c) => {
  const { code } = c.req.valid('json');
  const groups = await accessCodeService.redeemAccessCodeForUser(
    getAuthUser(c),
    code,
  );
  return c.json({ groups }, 200);
};

export const listAccessCodes: RouteHandler<
  typeof listAccessCodesRoute
> = async (c) => {
  return c.json(
    { accessCodes: await accessCodeService.listAccessCodes() },
    200,
  );
};

export const createAccessCode: RouteHandler<
  typeof createAccessCodeRoute
> = async (c) => {
  const result = await accessCodeService.createAccessCode(
    getAuthUser(c),
    c.req.valid('json'),
  );
  return c.json(result, 201);
};

export const revokeAccessCode: RouteHandler<
  typeof revokeAccessCodeRoute
> = async (c) => {
  const { accessCodeId } = c.req.valid('param');
  const accessCode = await accessCodeService.revokeAccessCode(accessCodeId);
  if (!accessCode) throw new NotFoundError('Access code');
  return c.json({ accessCode }, 200);
};

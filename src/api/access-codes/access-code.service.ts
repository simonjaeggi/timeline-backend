import { getRepositories } from '../../data/index.ts';
import {
  GROUP_ROLES,
  type AccessCode,
  type GroupRole,
  type UserGroup,
} from '../../data/models.ts';
import { env } from '../../env-validation.ts';
import type { AuthUser } from '../../middleware/auth.middleware.ts';
import { ConflictError, ValidationError } from '../../shared/errors.ts';
import {
  accessCodeHint,
  generateAccessCode,
  hashAccessCode,
  normalizeAccessCode,
} from './access-code.util.ts';
import type { CreateAccessCodeDto } from './zod/access-code.schema.ts';

/** Holds a checked code between the code form and the Google sign-up. */
export const ACCESS_CODE_COOKIE = 'timeline_access_code';
export const ACCESS_CODE_COOKIE_MAX_AGE_SECONDS = 15 * 60;

const INVALID_CODE_MESSAGE = 'Invalid, expired or already used access code.';

export type AccessCodeStatus = 'active' | 'redeemed' | 'revoked' | 'expired';

export type AccessCodeView = AccessCode & { status: AccessCodeStatus };

export function accessCodeStatus(
  code: AccessCode,
  now = new Date(),
): AccessCodeStatus {
  if (code.revokedAt) return 'revoked';
  if (code.redeemedAt) return 'redeemed';
  if (code.expiresAt && code.expiresAt <= now) return 'expired';
  return 'active';
}

function toView(code: AccessCode): AccessCodeView {
  return { ...code, status: accessCodeStatus(code) };
}

/** Lower index = more privileged. */
function strongerRole(a: GroupRole, b: GroupRole): GroupRole {
  return GROUP_ROLES.indexOf(a) <= GROUP_ROLES.indexOf(b) ? a : b;
}

/**
 * Applies what a redeemed code grants: app admin role and/or group membership.
 * Never downgrades an existing membership.
 */
async function applyGrants(code: AccessCode, userId: string): Promise<void> {
  const repositories = getRepositories();

  if (code.grantsAppRole === 'admin') {
    await repositories.users.setRole(userId, 'admin');
  }

  if (code.groupId !== null && code.groupRole !== null) {
    const existing = await repositories.memberships.find(code.groupId, userId);
    const role = existing
      ? strongerRole(existing.role, code.groupRole)
      : code.groupRole;
    await repositories.memberships.upsert(code.groupId, userId, role);
  }
}

/**
 * Checks a code without using it up (step 1 of sign-up).
 * @returns The code and its group, or null if it cannot be used.
 */
export async function checkAccessCode(code: string): Promise<{
  accessCode: AccessCode;
  group: { id: number; name: string } | null;
} | null> {
  const repositories = getRepositories();
  const accessCode = await repositories.accessCodes.findByHash(
    hashAccessCode(code),
  );

  if (!accessCode || accessCodeStatus(accessCode) !== 'active') return null;

  const group =
    accessCode.groupId === null
      ? null
      : await repositories.groups.findById(accessCode.groupId);

  return {
    accessCode,
    group: group ? { id: group.id, name: group.name } : null,
  };
}

/**
 * Atomically redeems the code for an account that is about to be created.
 * Called by the Better Auth "before user create" hook.
 * @param code code from the cookie set by the check endpoint
 * @param email email of the account being created
 * @returns Redeemed code, or null if the account must not be created.
 */
export async function reserveAccessCodeForSignUp(
  code: string | null | undefined,
  email: string,
): Promise<AccessCode | null> {
  if (!code || !/^[A-Z0-9]{12}$/.test(normalizeAccessCode(code))) return null;

  return getRepositories().accessCodes.redeem({
    codeHash: hashAccessCode(code),
    email: email.toLowerCase(),
    userId: null,
    now: new Date(),
  });
}

/**
 * Links the reserved code to the created user and applies its grants.
 * Called by the Better Auth "after user create" hook.
 */
export async function completeSignUp(
  code: string | null | undefined,
  user: { id: string; email: string },
): Promise<void> {
  if (!code) return;

  const repositories = getRepositories();
  const accessCode = await repositories.accessCodes.findPendingSignUp(
    hashAccessCode(code),
    user.email.toLowerCase(),
  );
  if (!accessCode) return;

  await repositories.accessCodes.attachUser(accessCode.id, user.id);
  await applyGrants(accessCode, user.id);
}

/**
 * Redeems a code for a user who already has an account, e.g. to join a
 * second group.
 * @returns The user's groups afterwards.
 * @throws {ValidationError} code invalid, used, expired or bound to another email
 */
export async function redeemAccessCodeForUser(
  user: AuthUser,
  code: string,
): Promise<UserGroup[]> {
  if (!user.email) {
    throw new ValidationError(INVALID_CODE_MESSAGE);
  }

  const repositories = getRepositories();
  const accessCode = await repositories.accessCodes.redeem({
    codeHash: hashAccessCode(code),
    email: user.email.toLowerCase(),
    userId: user.id,
    now: new Date(),
  });

  if (!accessCode) {
    throw new ValidationError(INVALID_CODE_MESSAGE);
  }

  await applyGrants(accessCode, user.id);
  return repositories.memberships.listGroupsForUser(user.id);
}

/**
 * Creates a code. The plain code is returned only here and never stored.
 * @throws {ValidationError} group does not exist
 */
export async function createAccessCode(
  admin: AuthUser,
  input: CreateAccessCodeDto,
): Promise<{ code: string; accessCode: AccessCodeView }> {
  const repositories = getRepositories();

  if (input.groupId !== undefined) {
    const group = await repositories.groups.findById(input.groupId);
    if (!group) {
      throw new ValidationError('Group not found.', [
        { path: 'groupId', message: 'Group not found.' },
      ]);
    }
  }

  // Dev users have no account row, so they cannot be referenced.
  const creator = await repositories.users.findById(admin.id);
  const code = generateAccessCode();

  const accessCode = await repositories.accessCodes.create({
    codeHash: hashAccessCode(code),
    codeHint: accessCodeHint(code),
    groupId: input.groupId ?? null,
    groupRole:
      input.groupId !== undefined ? (input.groupRole ?? 'viewer') : null,
    grantsAppRole: input.grantsAdmin ? 'admin' : 'user',
    email: input.email ?? null,
    isInitial: false,
    createdBy: creator?.id ?? null,
    expiresAt: new Date(Date.now() + input.daysValid * 24 * 60 * 60 * 1000),
  });

  return { code, accessCode: toView(accessCode) };
}

export async function listAccessCodes(): Promise<AccessCodeView[]> {
  return (await getRepositories().accessCodes.list()).map(toView);
}

/**
 * Revokes an unused code.
 * @throws {ConflictError} code already used or revoked
 * @returns Revoked code, null if it does not exist.
 */
export async function revokeAccessCode(
  id: number,
): Promise<AccessCodeView | null> {
  const repositories = getRepositories();
  const revoked = await repositories.accessCodes.revoke(id, new Date());
  if (revoked) return toView(revoked);

  const all = await repositories.accessCodes.list();
  if (all.some((code) => code.id === id)) {
    throw new ConflictError('Only unused codes can be revoked.');
  }
  return null;
}

/**
 * Creates the initial admin code from INITIAL_ACCESS_CODE once, so the first
 * admin can sign up. Does nothing if it was created before.
 * @returns True if the code was created now.
 */
export async function ensureInitialAccessCode(): Promise<boolean> {
  if (!env.INITIAL_ACCESS_CODE) return false;

  const repositories = getRepositories();
  if (await repositories.accessCodes.hasInitialCode()) return false;

  await repositories.accessCodes.create({
    codeHash: hashAccessCode(env.INITIAL_ACCESS_CODE),
    codeHint: accessCodeHint(env.INITIAL_ACCESS_CODE),
    groupId: null,
    groupRole: null,
    grantsAppRole: 'admin',
    email: null,
    isInitial: true,
    createdBy: null,
    expiresAt: null,
  });

  return true;
}

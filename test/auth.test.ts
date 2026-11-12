import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

// Must be set before any app module is imported (they read env on load).
process.env.AUTH_MODE = 'better-auth';
process.env.BETTER_AUTH_SECRET = 'test-secret-test-secret-test-secret-123';
process.env.BETTER_AUTH_URL = 'http://localhost:3000';
process.env.GOOGLE_CLIENT_ID = 'test-client-id';
process.env.GOOGLE_CLIENT_SECRET = 'test-client-secret';
process.env.INITIAL_ACCESS_CODE = 'ADMN-2345-6789';

const { createTestApp, CookieJar } = await import('./helpers/test-app.ts');
const { ensureInitialAccessCode } =
  await import('../src/api/access-codes/access-code.service.ts');
const { checkRateLimit, redeemRateLimit } =
  await import('../src/api/access-codes/access-code.openapi.ts');

type Jar = InstanceType<typeof CookieJar>;
let t: Awaited<ReturnType<typeof createTestApp>>;

/**
 * Signs up through Better Auth. Email/password sign-up is enabled only in
 * these tests (production uses Google), but it runs the same user-create
 * hooks, so the access code gate is exercised for real.
 */
async function signUp(jar: Jar, email: string, name = email.split('@')[0]) {
  return t.request(
    'POST',
    '/auth/sign-up/email',
    { email, password: 'correct-horse-battery', name },
    jar,
  );
}

async function joinWithCode(code: string, email: string) {
  const jar = new CookieJar();
  const check = await t.request('POST', '/access-codes/check', { code }, jar);
  expect(check.status).toBe(200);
  const signUpResponse = await signUp(jar, email);
  return { jar, check, signUp: signUpResponse };
}

beforeAll(async () => {
  t = await createTestApp({ emailAndPassword: { enabled: true } });
  await ensureInitialAccessCode();
});

beforeEach(() => {
  checkRateLimit.reset();
  redeemRateLimit.reset();
});

afterAll(async () => {
  await t.close();
});

describe('access code gate', () => {
  const admin = new CookieJar();

  it('keeps everything except health and docs private', async () => {
    expect((await t.request('GET', '/health')).status).toBe(200);
    expect((await t.request('GET', '/openapi.json')).status).toBe(200);
    expect((await t.request('GET', '/me')).status).toBe(401);
    expect((await t.request('GET', '/groups')).status).toBe(401);
  });

  it('refuses sign-up without a code', async () => {
    const res = await signUp(new CookieJar(), 'stranger@example.com');
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('ACCESS_CODE_REQUIRED');
  });

  it('refuses sign-up with a made-up code cookie', async () => {
    const jar = new CookieJar();
    // Bypass the check endpoint and forge the cookie.
    const res = await t.app.request('/api/auth/sign-up/email', {
      method: 'POST',
      headers: {
        Origin: 'http://localhost:5173',
        'Content-Type': 'application/json',
        Cookie: 'timeline_access_code=AAAA-BBBB-CCCC',
      },
      body: JSON.stringify({
        email: 'forger@example.com',
        password: 'correct-horse-battery',
        name: 'Forger',
      }),
    });
    expect(res.status).toBe(403);
    expect(jar.header()).toBe('');
  });

  it('rejects invalid codes at the check step', async () => {
    const res = await t.request('POST', '/access-codes/check', {
      code: 'ZZZZ-ZZZZ-ZZZZ',
    });
    expect(res.status).toBe(400);
    const malformed = await t.request('POST', '/access-codes/check', {
      code: 'nope',
    });
    expect(malformed.status).toBe(400);
  });

  it('lets the first admin sign up with the initial code, once', async () => {
    const check = await t.request(
      'POST',
      '/access-codes/check',
      { code: 'admn-2345-6789' },
      admin,
    );
    expect(check.status).toBe(200);
    expect(check.body.grantsAdmin).toBe(true);

    const res = await signUp(admin, 'simon@example.com', 'Simon');
    expect(res.status).toBe(200);

    const me = await t.request('GET', '/me', undefined, admin);
    expect(me.body.user).toMatchObject({
      email: 'simon@example.com',
      role: 'admin',
    });

    const reuse = await t.request('POST', '/access-codes/check', {
      code: 'ADMN-2345-6789',
    });
    expect(reuse.status).toBe(400);
  });

  it('enforces email binding, roles and group isolation', async () => {
    const familyId = await t.createGroup('Jäggi family', admin);
    const otherId = await t.createGroup('Other family', admin);

    const editorCode = await t.request(
      'POST',
      '/admin/access-codes',
      { groupId: familyId, groupRole: 'editor', email: 'Lea@Example.com' },
      admin,
    );
    expect(editorCode.status).toBe(201);
    expect(editorCode.body.code).toMatch(
      /^[A-Z2-9]{4}-[A-Z2-9]{4}-[A-Z2-9]{4}$/,
    );
    expect(editorCode.body.accessCode).not.toHaveProperty('codeHash');

    // Bound to Lea: someone else holding the code cannot use it.
    const mallory = await joinWithCode(
      editorCode.body.code,
      'mallory@example.com',
    );
    expect(mallory.signUp.status).toBe(403);
    expect(mallory.signUp.body.code).toBe('INVALID_ACCESS_CODE');

    const lea = await joinWithCode(editorCode.body.code, 'lea@example.com');
    expect(lea.signUp.status).toBe(200);

    const leaMe = await t.request('GET', '/me', undefined, lea.jar);
    expect(leaMe.body.groups).toEqual([
      { id: familyId, name: 'Jäggi family', role: 'editor' },
    ]);

    const leaGroups = await t.request('GET', '/groups', undefined, lea.jar);
    expect(leaGroups.body.groups.map((g: { id: number }) => g.id)).toEqual([
      familyId,
    ]);

    // Editors write content, but only owners manage the group.
    const person = await t.request(
      'POST',
      `/groups/${familyId}/people`,
      { firstName: 'Anna' },
      lea.jar,
    );
    expect(person.status).toBe(201);
    expect(person.body.person.createdBy).toBe(leaMe.body.user.id);
    expect(
      (
        await t.request(
          'PATCH',
          `/groups/${familyId}`,
          { name: 'Renamed' },
          lea.jar,
        )
      ).status,
    ).toBe(403);

    // Other groups are invisible, not just forbidden.
    expect(
      (await t.request('GET', `/groups/${otherId}/people`, undefined, lea.jar))
        .status,
    ).toBe(404);

    // Viewers can read but not write.
    const viewerCode = await t.request(
      'POST',
      '/admin/access-codes',
      { groupId: familyId },
      admin,
    );
    expect(viewerCode.body.accessCode.groupRole).toBe('viewer');
    const ben = await joinWithCode(viewerCode.body.code, 'ben@example.com');
    expect(ben.signUp.status).toBe(200);
    expect(
      (await t.request('GET', `/groups/${familyId}/people`, undefined, ben.jar))
        .body.people,
    ).toHaveLength(1);
    expect(
      (
        await t.request(
          'POST',
          `/groups/${familyId}/entries`,
          { title: 'Nope', start: '2024' },
          ben.jar,
        )
      ).status,
    ).toBe(403);

    // Non-admins cannot manage codes.
    expect(
      (
        await t.request(
          'POST',
          '/admin/access-codes',
          { groupId: familyId },
          lea.jar,
        )
      ).status,
    ).toBe(403);

    // Existing users can redeem a code to join another group.
    const joinOther = await t.request(
      'POST',
      '/admin/access-codes',
      { groupId: otherId, groupRole: 'viewer' },
      admin,
    );
    const redeemed = await t.request(
      'POST',
      '/access-codes/redeem',
      { code: joinOther.body.code },
      lea.jar,
    );
    expect(redeemed.status).toBe(200);
    expect(redeemed.body.groups).toHaveLength(2);
    expect(
      (
        await t.request(
          'POST',
          '/access-codes/redeem',
          { code: joinOther.body.code },
          lea.jar,
        )
      ).status,
    ).toBe(400);

    // Owners (here: the admin) manage members.
    const members = await t.request(
      'GET',
      `/groups/${familyId}/members`,
      undefined,
      admin,
    );
    expect(
      members.body.members.map(
        (m: { user: { email: string }; role: string }) =>
          `${m.user.email}:${m.role}`,
      ),
    ).toEqual(['ben@example.com:viewer', 'lea@example.com:editor']);

    const benId = (await t.request('GET', '/me', undefined, ben.jar)).body.user
      .id;
    expect(
      (
        await t.request(
          'PATCH',
          `/groups/${familyId}/members/${benId}`,
          { role: 'editor' },
          admin,
        )
      ).status,
    ).toBe(204);
    expect(
      (
        await t.request(
          'DELETE',
          `/groups/${familyId}/members/${benId}`,
          undefined,
          admin,
        )
      ).status,
    ).toBe(204);
    expect(
      (await t.request('GET', `/groups/${familyId}/people`, undefined, ben.jar))
        .status,
    ).toBe(404);
  });

  it('revokes codes and protects the last admin', async () => {
    const groupId = await t.createGroup('Revoke test', admin);
    const created = await t.request(
      'POST',
      '/admin/access-codes',
      { groupId, daysValid: 1 },
      admin,
    );
    const id = created.body.accessCode.id;

    const revoked = await t.request(
      'POST',
      `/admin/access-codes/${id}/revoke`,
      undefined,
      admin,
    );
    expect(revoked.body.accessCode.status).toBe('revoked');
    expect(
      (
        await t.request('POST', '/access-codes/check', {
          code: created.body.code,
        })
      ).status,
    ).toBe(400);
    expect(
      (
        await t.request(
          'POST',
          `/admin/access-codes/${id}/revoke`,
          undefined,
          admin,
        )
      ).status,
    ).toBe(409);

    const tooLong = await t.request(
      'POST',
      '/admin/access-codes',
      { groupId, daysValid: 30 },
      admin,
    );
    expect(tooLong.status).toBe(400);

    const list = await t.request(
      'GET',
      '/admin/access-codes',
      undefined,
      admin,
    );
    expect(list.body.accessCodes.length).toBeGreaterThan(3);

    const adminId = (await t.request('GET', '/me', undefined, admin)).body.user
      .id;
    const demote = await t.request(
      'PATCH',
      `/admin/users/${adminId}`,
      { role: 'user' },
      admin,
    );
    expect(demote.status).toBe(409);
  });

  it('rate limits the public check endpoint', async () => {
    const statuses: number[] = [];
    for (let i = 0; i < 11; i += 1) {
      statuses.push(
        (
          await t.request('POST', '/access-codes/check', {
            code: 'ZZZZ-ZZZZ-ZZZZ',
          })
        ).status,
      );
    }
    expect(statuses.slice(0, 10).every((status) => status === 400)).toBe(true);
    expect(statuses[10]).toBe(429);
  });
});

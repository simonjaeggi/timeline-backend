import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestApp, TEST_ORIGIN } from './helpers/test-app.ts';

let t: Awaited<ReturnType<typeof createTestApp>>;

beforeAll(async () => {
  t = await createTestApp();
});

afterAll(async () => {
  await t.close();
});

describe('basics', () => {
  it('reports health without auth', async () => {
    const res = await t.request('GET', '/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true, db: 'up' });
    expect((await t.request('GET', '/openapi.json')).status).toBe(200);
  });

  it('returns JSON 404s for unknown routes and groups', async () => {
    expect((await t.request('GET', '/nope')).status).toBe(404);
    const res = await t.request('GET', '/groups/9999/people');
    expect(res.status).toBe(404);
    expect(res.body.message).toBe('Group not found.');
  });

  it('returns validation issues', async () => {
    const res = await t.request('POST', '/groups', { name: '', extra: 1 });
    expect(res.status).toBe(400);
    expect(res.body.issues.length).toBeGreaterThan(0);

    const invalidJson = await t.app.request('/api/groups', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{nope',
    });
    expect(invalidJson.status).toBe(400);

    expect((await t.request('GET', '/groups/abc')).status).toBe(400);
  });

  it('only lets the configured frontend origin change data', async () => {
    const post = (headers: Record<string, string>) =>
      t.app.request('/api/groups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...headers },
        body: JSON.stringify({ name: 'Origin check' }),
      });

    const foreign = await post({ Origin: 'https://evil.example' });
    expect(foreign.status).toBe(403);
    expect(foreign.headers.get('access-control-allow-origin')).toBeNull();

    // Reads are not blocked by the origin check (CORS hides them from other sites).
    const read = await t.app.request('/api/groups', {
      headers: { Origin: 'https://evil.example' },
    });
    expect(read.status).toBe(200);
    expect(read.headers.get('access-control-allow-origin')).toBeNull();

    const allowed = await post({ Origin: TEST_ORIGIN });
    expect(allowed.status).toBe(201);
    expect(allowed.headers.get('access-control-allow-origin')).toBe(
      TEST_ORIGIN,
    );

    // Outside production, requests without Origin (curl, scripts) still work.
    expect((await post({})).status).toBe(201);

    const preflight = await t.app.request('/api/groups', {
      method: 'OPTIONS',
      headers: {
        Origin: 'https://evil.example',
        'Access-Control-Request-Method': 'POST',
      },
    });
    expect(preflight.headers.get('access-control-allow-origin')).toBeNull();
  });

  it('records the dev user as creator', async () => {
    const res = await t.request('POST', '/groups', { name: 'Jäggi' });
    expect(res.status).toBe(201);
    expect(res.body.group.createdBy).toBe('dev-user');
  });
});

describe('people and relationships', () => {
  it('handles CRUD and relationships from both sides', async () => {
    const groupId = await t.createGroup();
    const base = `/groups/${groupId}/people`;

    const anna = (
      await t.request('POST', base, {
        firstName: 'Anna',
        lastName: 'Muster',
        birthDate: '1960-04-02',
        color: '#AA3355',
      })
    ).body.person;
    const ben = (await t.request('POST', base, { firstName: 'Ben' })).body
      .person;
    const cleo = (await t.request('POST', base, { firstName: 'Cleo' })).body
      .person;

    expect(anna.color).toBe('#aa3355');

    const parent = await t.request('POST', `${base}/${anna.id}/relationships`, {
      relatedPersonId: ben.id,
      type: 'parent',
    });
    expect(parent.status).toBe(201);
    expect(parent.body.relationship.relation).toBe('child');

    // Reverse parent link is rejected.
    const reverse = await t.request('POST', `${base}/${ben.id}/relationships`, {
      relatedPersonId: anna.id,
      type: 'parent',
    });
    expect(reverse.status).toBe(409);

    // Symmetric link stored once, so the mirrored request conflicts.
    await t.request('POST', `${base}/${cleo.id}/relationships`, {
      relatedPersonId: ben.id,
      type: 'sibling',
    });
    const mirrored = await t.request(
      'POST',
      `${base}/${ben.id}/relationships`,
      { relatedPersonId: cleo.id, type: 'sibling' },
    );
    expect(mirrored.status).toBe(409);

    const benDetail = await t.request('GET', `${base}/${ben.id}`);
    const relations = benDetail.body.relationships
      .map(
        (r: { relation: string; person: { firstName: string } }) =>
          `${r.relation}:${r.person.firstName}`,
      )
      .sort();
    expect(relations).toEqual(['parent:Anna', 'sibling:Cleo']);

    const self = await t.request('POST', `${base}/${ben.id}/relationships`, {
      relatedPersonId: ben.id,
      type: 'other',
    });
    expect(self.status).toBe(400);

    const search = await t.request('GET', `${base}?q=mus`);
    expect(search.body.people.map((p: { id: number }) => p.id)).toEqual([
      anna.id,
    ]);

    const invalidDeath = await t.request('PATCH', `${base}/${anna.id}`, {
      deathDate: '1950-01-01',
    });
    expect(invalidDeath.status).toBe(400);

    const relId = parent.body.relationship.id;
    expect(
      (await t.request('DELETE', `${base}/${anna.id}/relationships/${relId}`))
        .status,
    ).toBe(200);

    expect((await t.request('DELETE', `${base}/${cleo.id}`)).status).toBe(200);
    expect((await t.request('GET', `${base}/${cleo.id}`)).status).toBe(404);
  });

  it('keeps groups isolated', async () => {
    const groupA = await t.createGroup('A');
    const groupB = await t.createGroup('B');
    const person = (
      await t.request('POST', `/groups/${groupA}/people`, { firstName: 'Ida' })
    ).body.person;

    expect(
      (await t.request('GET', `/groups/${groupB}/people/${person.id}`)).status,
    ).toBe(404);

    const entry = await t.request('POST', `/groups/${groupB}/entries`, {
      title: 'Not allowed',
      start: '2024',
      participants: [person.id],
    });
    expect(entry.status).toBe(400);
  });
});

describe('entries', () => {
  it('stores partial dates and participants', async () => {
    const groupId = await t.createGroup();
    const person = (
      await t.request('POST', `/groups/${groupId}/people`, { firstName: 'Max' })
    ).body.person;

    const created = await t.request('POST', `/groups/${groupId}/entries`, {
      kind: 'milestone',
      category: 'education',
      title: 'Master at UZH',
      start: '2024-09',
      end: '2026',
      participants: [{ personId: person.id, role: 'student' }],
    });

    expect(created.status).toBe(201);
    const entry = created.body.entry;
    expect(entry.start).toEqual({
      value: '2024-09',
      date: '2024-09-01',
      precision: 'month',
    });
    expect(entry.end).toEqual({
      value: '2026',
      date: '2026-12-31',
      precision: 'year',
    });
    expect(entry.participants).toEqual([
      { personId: person.id, role: 'student' },
    ]);
    expect(entry).not.toHaveProperty('spanEnd');

    const badRange = await t.request('POST', `/groups/${groupId}/entries`, {
      title: 'Backwards',
      start: '2024-05',
      end: '2024-04',
    });
    expect(badRange.status).toBe(400);

    // PATCH validates against stored dates.
    const badPatch = await t.request(
      'PATCH',
      `/groups/${groupId}/entries/${entry.id}`,
      { start: '2030' },
    );
    expect(badPatch.status).toBe(400);

    const patched = await t.request(
      'PATCH',
      `/groups/${groupId}/entries/${entry.id}`,
      { title: 'MSc Business Informatics', participants: [] },
    );
    expect(patched.body.entry.title).toBe('MSc Business Informatics');
    expect(patched.body.entry.participants).toEqual([]);
    expect(patched.body.entry.start.value).toBe('2024-09');

    const list = await t.request(
      'GET',
      `/groups/${groupId}/entries?kinds=milestone&q=business`,
    );
    expect(list.body.total).toBe(1);

    const filteredOut = await t.request(
      'GET',
      `/groups/${groupId}/entries?kinds=activity`,
    );
    expect(filteredOut.body.total).toBe(0);

    expect(
      (await t.request('DELETE', `/groups/${groupId}/entries/${entry.id}`))
        .status,
    ).toBe(204);
  });
});

describe('timeline', () => {
  it('merges overlapping entries and generated birthdays', async () => {
    const groupId = await t.createGroup();
    const people = `/groups/${groupId}/people`;
    const entries = `/groups/${groupId}/entries`;

    const lea = (
      await t.request('POST', people, {
        firstName: 'Lea',
        birthDate: '1995-03-20',
      })
    ).body.person;
    const tom = (
      await t.request('POST', people, {
        firstName: 'Tom',
        birthDate: '1990-11-01',
      })
    ).body.person;

    // Month precision point entry: covers all of June 2024.
    await t.request('POST', entries, {
      title: 'Holiday',
      start: '2024-06',
      participants: [lea.id],
    });
    // Long range starting before the window.
    await t.request('POST', entries, {
      title: 'Apprenticeship',
      start: '2016-08',
      end: '2020-07',
      participants: [tom.id],
    });
    await t.request('POST', entries, {
      title: 'Wedding',
      kind: 'milestone',
      start: '2024-08-17',
      participants: [lea.id, tom.id],
    });

    const window = await t.request(
      'GET',
      `/groups/${groupId}/timeline?from=2024-06-15&to=2024-12-31`,
    );
    expect(window.status).toBe(200);
    expect(window.body.items.map((item: { key: string }) => item.key)).toEqual([
      expect.stringMatching(/^entry:/),
      expect.stringMatching(/^entry:/),
      `birthday:${tom.id}:2024`,
    ]);
    expect(window.body.items[0].entry.title).toBe('Holiday');
    expect(window.body.items[2].age).toBe(34);

    const tomOnly = await t.request(
      'GET',
      `/groups/${groupId}/timeline?from=2019-01-01&to=2024-12-31&personIds=${tom.id}&includeBirthdays=false`,
    );
    expect(
      tomOnly.body.items.map(
        (item: { entry: { title: string } }) => item.entry.title,
      ),
    ).toEqual(['Apprenticeship', 'Wedding']);

    const milestones = await t.request(
      'GET',
      `/groups/${groupId}/timeline?from=2024-01-01&to=2024-12-31&kinds=milestone&includeBirthdays=false`,
    );
    expect(milestones.body.items).toHaveLength(1);

    const tooLong = await t.request(
      'GET',
      `/groups/${groupId}/timeline?from=1800-01-01&to=2024-01-01`,
    );
    expect(tooLong.status).toBe(400);

    const defaults = await t.request('GET', `/groups/${groupId}/timeline`);
    expect(defaults.status).toBe(200);
    expect(defaults.body.from < defaults.body.to).toBe(true);
  });
});

describe('search and import', () => {
  it('previews, imports idempotently and searches', async () => {
    const groupId = await t.createGroup();
    const person = (
      await t.request('POST', `/groups/${groupId}/people`, {
        firstName: 'Simon',
      })
    ).body.person;

    const content = [
      '2016-08..2020-07 | Apprenticeship at the canton | | milestone, education',
      '2025-07-14 | Climbing in Ticino | Great weather | hobby',
    ].join('\n');

    const preview = await t.request(
      'POST',
      `/groups/${groupId}/import/preview`,
      { source: 'text', content },
    );
    expect(preview.status).toBe(200);
    expect(preview.body.entries).toHaveLength(2);

    const first = await t.request('POST', `/groups/${groupId}/import`, {
      source: 'text',
      content,
      personIds: [person.id],
    });
    expect(first.status).toBe(201);
    expect(first.body.created).toBe(2);
    expect(first.body.entries[0].source).toBe('text');
    expect(first.body.entries[0].participants).toEqual([
      { personId: person.id, role: null },
    ]);

    const second = await t.request('POST', `/groups/${groupId}/import`, {
      source: 'text',
      content,
    });
    expect(second.body).toMatchObject({ created: 0, skippedDuplicates: 2 });

    const withIssues = await t.request('POST', `/groups/${groupId}/import`, {
      source: 'text',
      content: '2024-99 | Broken\n2024 | Fine',
    });
    expect(withIssues.status).toBe(400);
    expect(withIssues.body.issues[0].path).toBe('content.line.1');

    const skipped = await t.request('POST', `/groups/${groupId}/import`, {
      source: 'text',
      content: '2024-99 | Broken\n2024 | Fine',
      skipInvalid: true,
    });
    expect(skipped.body.created).toBe(1);
    expect(skipped.body.issues).toHaveLength(1);

    const linkedIn = await t.request('POST', `/groups/${groupId}/import`, {
      source: 'linkedin',
      content: 'csv',
    });
    expect(linkedIn.status).toBe(501);

    const search = await t.request('GET', `/groups/${groupId}/search?q=climb`);
    expect(search.body.entries).toHaveLength(1);
    expect(search.body.people).toHaveLength(0);

    const wildcard = await t.request('GET', `/groups/${groupId}/search?q=%25`);
    expect(wildcard.body.entries).toHaveLength(0);
  });
});

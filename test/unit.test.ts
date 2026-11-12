import { describe, expect, it } from 'vitest';
import { birthdayOccurrences } from '../src/api/timeline/timeline.service.ts';
import { describeRelationship } from '../src/api/people/person.service.ts';
import { textParser } from '../src/api/import/parsers/text.parser.ts';
import {
  addYears,
  endOfPeriod,
  parsePartialDate,
  toPartialDateView,
} from '../src/shared/partial-date.ts';

describe('partial dates', () => {
  it('normalises start and end edges by precision', () => {
    expect(parsePartialDate('2024', 'start')).toEqual({
      date: '2024-01-01',
      precision: 'year',
    });
    expect(parsePartialDate('2024', 'end')).toEqual({
      date: '2024-12-31',
      precision: 'year',
    });
    expect(parsePartialDate('2024-02', 'end')).toEqual({
      date: '2024-02-29',
      precision: 'month',
    });
    expect(parsePartialDate('2023-02', 'end')?.date).toBe('2023-02-28');
    expect(parsePartialDate('2024-03-15', 'start')).toEqual({
      date: '2024-03-15',
      precision: 'day',
    });
  });

  it('rejects impossible dates', () => {
    expect(parsePartialDate('2023-02-29', 'start')).toBeNull();
    expect(parsePartialDate('2024-13', 'start')).toBeNull();
    expect(parsePartialDate('24-01-01', 'start')).toBeNull();
    expect(parsePartialDate('2024-1-1', 'start')).toBeNull();
  });

  it('computes period ends and views', () => {
    expect(endOfPeriod('2024-02-01', 'month')).toBe('2024-02-29');
    expect(endOfPeriod('2024-01-01', 'year')).toBe('2024-12-31');
    expect(toPartialDateView('2024-06-30', 'month').value).toBe('2024-06');
    expect(addYears('2024-02-29', 1)).toBe('2025-02-28');
  });
});

describe('birthdayOccurrences', () => {
  it('generates birthdays with ages inside the window', () => {
    const result = birthdayOccurrences(
      { id: 1, birthDate: '1990-05-10', deathDate: null },
      '2024-01-01',
      '2025-12-31',
    );
    expect(result).toEqual([
      { personId: 1, date: '2024-05-10', age: 34 },
      { personId: 1, date: '2025-05-10', age: 35 },
    ]);
  });

  it('handles leap day birthdays, birth year and death', () => {
    const leap = birthdayOccurrences(
      { id: 2, birthDate: '2000-02-29', deathDate: null },
      '2000-01-01',
      '2001-12-31',
    );
    expect(leap).toEqual([
      { personId: 2, date: '2000-02-29', age: 0 },
      { personId: 2, date: '2001-02-28', age: 1 },
    ]);

    const deceased = birthdayOccurrences(
      { id: 3, birthDate: '1930-07-01', deathDate: '2020-03-01' },
      '2019-01-01',
      '2022-12-31',
    );
    expect(deceased.map((b) => b.date)).toEqual(['2019-07-01']);
  });
});

describe('describeRelationship', () => {
  const base = { id: 1, groupId: 1, label: null, createdAt: new Date() };

  it('flips parent links depending on the viewer', () => {
    const relationship = {
      ...base,
      personId: 10,
      relatedPersonId: 20,
      type: 'parent' as const,
    };
    expect(describeRelationship(relationship, 10)).toEqual({
      otherPersonId: 20,
      relation: 'child',
    });
    expect(describeRelationship(relationship, 20)).toEqual({
      otherPersonId: 10,
      relation: 'parent',
    });
  });
});

describe('textParser', () => {
  const options = {
    defaultKind: 'activity' as const,
    defaultCategory: 'other' as const,
  };

  it('parses dates, ranges, descriptions and tags', () => {
    const result = textParser.parse(
      [
        '# comment',
        '',
        '2020-09..2024-06 | BSc IIM | HSLU Rotkreuz | milestone, education',
        '2025-07-14 | Climbing trip | | hobby',
      ].join('\n'),
      options,
    );

    expect(result.issues).toEqual([]);
    expect(result.entries).toHaveLength(2);
    expect(result.entries[0]).toMatchObject({
      kind: 'milestone',
      category: 'education',
      title: 'BSc IIM',
      description: 'HSLU Rotkreuz',
      start: { date: '2020-09-01', precision: 'month' },
      end: { date: '2024-06-30', precision: 'month' },
    });
    expect(result.entries[1]).toMatchObject({
      kind: 'activity',
      category: 'hobby',
      description: null,
      end: null,
    });
  });

  it('reports issues with line numbers', () => {
    const result = textParser.parse(
      ['2024-02-30 | Bad date', 'no title', '2024 | Ok | | weird-tag'].join(
        '\n',
      ),
      options,
    );

    expect(result.entries).toHaveLength(0);
    expect(result.issues.map((issue) => issue.line)).toEqual([1, 2, 3]);
  });

  it('produces stable source refs', () => {
    const a = textParser.parse('2024 | Same', options).entries[0];
    const b = textParser.parse('2024 | same', options).entries[0];
    expect(a?.sourceRef).toBe(b?.sourceRef);
  });
});

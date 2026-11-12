import { getRepositories } from '../../data/index.ts';
import type { Person } from '../../data/models.ts';
import { ValidationError } from '../../shared/errors.ts';
import {
  addYears,
  isLeapYear,
  todayIsoDate,
} from '../../shared/partial-date.ts';
import { toEntryView, type EntryView } from '../entries/entry.view.ts';
import type { TimelineQueryDto } from './zod/timeline.schema.ts';

export const MAX_TIMELINE_ENTRIES = 5000;
export const MAX_TIMELINE_RANGE_YEARS = 150;

export type BirthdayOccurrence = {
  personId: number;
  date: string;
  /** 0 is the day of birth. */
  age: number;
};

/**
 * Items on the timeline. `key` is unique and stable, usable as a React key.
 * Birthdays are generated from people's birth dates and are not stored.
 */
export type TimelineItem =
  | { type: 'entry'; key: string; date: string; entry: EntryView }
  | ({ type: 'birthday'; key: string } & BirthdayOccurrence);

export type Timeline = {
  from: string;
  to: string;
  /** True if more than MAX_TIMELINE_ENTRIES entries matched; narrow the range. */
  truncated: boolean;
  items: TimelineItem[];
};

/**
 * Generates the birthdays of a person inside [from, to].
 * Feb 29 birthdays fall on Feb 28 in non-leap years.
 * No birthdays are generated after the death date.
 * @param person person with birth and death date
 * @param from inclusive start `YYYY-MM-DD`
 * @param to inclusive end `YYYY-MM-DD`
 */
export function birthdayOccurrences(
  person: Pick<Person, 'id' | 'birthDate' | 'deathDate'>,
  from: string,
  to: string,
): BirthdayOccurrence[] {
  if (!person.birthDate) return [];

  const [birthYear, month, day] = person.birthDate.split('-').map(Number) as [
    number,
    number,
    number,
  ];
  const monthDay = `${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

  const occurrences: BirthdayOccurrence[] = [];
  const firstYear = Math.max(Number(from.slice(0, 4)), birthYear);
  const lastYear = Number(to.slice(0, 4));

  for (let year = firstYear; year <= lastYear; year += 1) {
    const date =
      monthDay === '02-29' && !isLeapYear(year)
        ? `${year}-02-28`
        : `${year}-${monthDay}`;

    if (person.deathDate && date > person.deathDate) break;
    if (date < from || date > to) continue;

    occurrences.push({ personId: person.id, date, age: year - birthYear });
  }

  return occurrences;
}

const TYPE_ORDER: Record<TimelineItem['type'], number> = {
  birthday: 0,
  entry: 1,
};

function compareItems(a: TimelineItem, b: TimelineItem): number {
  if (a.date !== b.date) return a.date < b.date ? -1 : 1;
  if (a.type !== b.type) return TYPE_ORDER[a.type] - TYPE_ORDER[b.type];
  return a.key.localeCompare(b.key);
}

/**
 * Builds the timeline for a date window: stored entries overlapping the window
 * plus generated birthdays, sorted chronologically.
 * @throws {ValidationError} window invalid or too large
 */
export async function getTimeline(
  groupId: number,
  query: TimelineQueryDto,
): Promise<Timeline> {
  const today = todayIsoDate();
  const from = query.from ?? addYears(query.to ?? today, -1);
  const to = query.to ?? addYears(query.from ?? today, 1);

  if (from > to) {
    throw new ValidationError('"from" must not be after "to".');
  }

  if (addYears(from, MAX_TIMELINE_RANGE_YEARS) < to) {
    throw new ValidationError(
      `The timeline window cannot be longer than ${MAX_TIMELINE_RANGE_YEARS} years.`,
    );
  }

  const repositories = getRepositories();
  const entries = await repositories.entries.findAll(
    groupId,
    {
      from,
      to,
      personIds: query.personIds,
      kinds: query.kinds,
      categories: query.categories,
    },
    MAX_TIMELINE_ENTRIES + 1,
  );

  const truncated = entries.length > MAX_TIMELINE_ENTRIES;

  const items: TimelineItem[] = entries
    .slice(0, MAX_TIMELINE_ENTRIES)
    .map((entry) => ({
      type: 'entry',
      key: `entry:${entry.id}`,
      date: entry.startDate,
      entry: toEntryView(entry),
    }));

  if (query.includeBirthdays) {
    const personFilter = query.personIds ? new Set(query.personIds) : null;
    const people = await repositories.people.list(groupId);

    for (const person of people) {
      if (personFilter && !personFilter.has(person.id)) continue;

      for (const birthday of birthdayOccurrences(person, from, to)) {
        items.push({
          type: 'birthday',
          key: `birthday:${birthday.personId}:${birthday.date.slice(0, 4)}`,
          ...birthday,
        });
      }
    }
  }

  items.sort(compareItems);

  return { from, to, truncated, items };
}

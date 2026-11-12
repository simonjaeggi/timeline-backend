import { getRepositories } from '../../data/index.ts';
import type {
  EntryWithParticipants,
  NewEntry,
  NewParticipant,
  Page,
} from '../../data/models.ts';
import type { AuthUser } from '../../middleware/auth.middleware.ts';
import { ValidationError } from '../../shared/errors.ts';
import { endOfPeriod, type PartialDate } from '../../shared/partial-date.ts';
import { toEntryView, type EntryView } from './entry.view.ts';
import type {
  CreateEntryDto,
  ListEntriesQueryDto,
  UpdateEntryDto,
} from './zod/entry.schema.ts';

type EntryDates = Pick<
  NewEntry,
  'startDate' | 'startPrecision' | 'endDate' | 'endPrecision' | 'spanEnd'
>;

/**
 * Converts start and end into stored date columns, including the derived span end.
 * @param start normalised start
 * @param end normalised end, or null for a point in time
 * @throws {ValidationError} end before start
 */
export function toEntryDates(
  start: PartialDate,
  end: PartialDate | null,
): EntryDates {
  if (end && end.date < start.date) {
    throw new ValidationError('End cannot be before start.', [
      { path: 'end', message: 'End cannot be before start.' },
    ]);
  }

  return {
    startDate: start.date,
    startPrecision: start.precision,
    endDate: end?.date ?? null,
    endPrecision: end?.precision ?? null,
    spanEnd: end?.date ?? endOfPeriod(start.date, start.precision),
  };
}

/**
 * Ensures every person id belongs to the group.
 * @throws {ValidationError} unknown person ids
 */
export async function assertPeopleInGroup(
  groupId: number,
  personIds: number[],
  path = 'participants',
): Promise<void> {
  const uniqueIds = [...new Set(personIds)];
  if (uniqueIds.length === 0) return;

  const found = await getRepositories().people.findManyByIds(
    groupId,
    uniqueIds,
  );
  const foundIds = new Set(found.map((person) => person.id));
  const missing = uniqueIds.filter((id) => !foundIds.has(id));

  if (missing.length > 0) {
    const message = `Unknown person id(s) in this group: ${missing.join(', ')}.`;
    throw new ValidationError(message, [{ path, message }]);
  }
}

export async function listEntries(
  groupId: number,
  query: ListEntriesQueryDto,
): Promise<Page<EntryView>> {
  const { pageNumber, pageSize, ...filter } = query;
  const page = await getRepositories().entries.findPage(groupId, filter, {
    pageNumber,
    pageSize,
  });

  return { ...page, items: page.items.map(toEntryView) };
}

export async function getEntry(
  groupId: number,
  entryId: number,
): Promise<EntryView | null> {
  const entry = await getRepositories().entries.findById(groupId, entryId);
  return entry ? toEntryView(entry) : null;
}

/**
 * Creates a manual entry.
 * @throws {ValidationError} invalid dates or unknown participants
 */
export async function createEntry(
  groupId: number,
  user: AuthUser,
  input: CreateEntryDto,
): Promise<EntryView> {
  const participants: NewParticipant[] = input.participants ?? [];
  await assertPeopleInGroup(
    groupId,
    participants.map((participant) => participant.personId),
  );

  const entry = await getRepositories().entries.create({
    entry: {
      groupId,
      kind: input.kind ?? 'activity',
      category: input.category ?? 'other',
      title: input.title,
      description: input.description ?? null,
      ...toEntryDates(input.start, input.end ?? null),
      location: input.location ?? null,
      source: 'manual',
      sourceRef: null,
      createdBy: user.id,
    },
    participants,
  });

  return toEntryView(entry);
}

function storedEnd(entry: EntryWithParticipants): PartialDate | null {
  return entry.endDate && entry.endPrecision
    ? { date: entry.endDate, precision: entry.endPrecision }
    : null;
}

/**
 * Partially updates an entry. Dates are re-validated against stored values.
 * @returns Updated entry, null if not found.
 */
export async function updateEntry(
  groupId: number,
  entryId: number,
  input: UpdateEntryDto,
): Promise<EntryView | null> {
  const repositories = getRepositories();
  const existing = await repositories.entries.findById(groupId, entryId);
  if (!existing) return null;

  if (input.participants) {
    await assertPeopleInGroup(
      groupId,
      input.participants.map((participant) => participant.personId),
    );
  }

  const start = input.start ?? {
    date: existing.startDate,
    precision: existing.startPrecision,
  };
  const end = input.end === undefined ? storedEnd(existing) : input.end;

  const updated = await repositories.entries.update(
    groupId,
    entryId,
    {
      ...(input.kind !== undefined && { kind: input.kind }),
      ...(input.category !== undefined && { category: input.category }),
      ...(input.title !== undefined && { title: input.title }),
      ...(input.description !== undefined && {
        description: input.description,
      }),
      ...(input.location !== undefined && { location: input.location }),
      ...toEntryDates(start, end),
    },
    input.participants,
  );

  return updated ? toEntryView(updated) : null;
}

export async function deleteEntry(
  groupId: number,
  entryId: number,
): Promise<boolean> {
  return (await getRepositories().entries.delete(groupId, entryId)) !== null;
}

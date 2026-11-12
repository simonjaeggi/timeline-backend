import {
  and,
  asc,
  count,
  desc,
  eq,
  exists,
  gte,
  ilike,
  inArray,
  lte,
  or,
  sql,
  type SQL,
} from 'drizzle-orm';
import type {
  Entry,
  EntryFilter,
  EntryParticipant,
  EntryUpdate,
  EntryWithParticipants,
  NewParticipant,
  Page,
  PageRequest,
} from '../models.ts';
import type {
  EntryRepository,
  NewEntryWithParticipants,
} from '../repositories.ts';
import type { PostgresDb, PostgresExecutor } from './db.ts';
import { containsPattern, withTranslatedErrors } from './error-translation.ts';
import { entries, entryParticipants } from './schema.ts';

function buildWhere(
  db: PostgresExecutor,
  groupId: number,
  filter: EntryFilter,
): SQL | undefined {
  const conditions: (SQL | undefined)[] = [eq(entries.groupId, groupId)];

  // Overlap: the entry starts before the window ends and ends after it starts.
  if (filter.from) conditions.push(gte(entries.spanEnd, filter.from));
  if (filter.to) conditions.push(lte(entries.startDate, filter.to));

  if (filter.kinds?.length)
    conditions.push(inArray(entries.kind, filter.kinds));

  if (filter.categories?.length) {
    conditions.push(inArray(entries.category, filter.categories));
  }

  if (filter.personIds?.length) {
    conditions.push(
      exists(
        db
          .select({ one: sql`1` })
          .from(entryParticipants)
          .where(
            and(
              eq(entryParticipants.entryId, entries.id),
              inArray(entryParticipants.personId, filter.personIds),
            ),
          ),
      ),
    );
  }

  if (filter.q) {
    const pattern = containsPattern(filter.q);
    conditions.push(
      or(ilike(entries.title, pattern), ilike(entries.description, pattern)),
    );
  }

  return and(...conditions);
}

async function attachParticipants(
  db: PostgresExecutor,
  rows: Entry[],
): Promise<EntryWithParticipants[]> {
  if (rows.length === 0) return [];

  const participantRows = await db
    .select()
    .from(entryParticipants)
    .where(
      inArray(
        entryParticipants.entryId,
        rows.map((row) => row.id),
      ),
    )
    .orderBy(asc(entryParticipants.personId));

  const byEntry = new Map<number, EntryParticipant[]>();
  for (const participant of participantRows) {
    const list = byEntry.get(participant.entryId) ?? [];
    list.push(participant);
    byEntry.set(participant.entryId, list);
  }

  return rows.map((row) => ({
    ...row,
    participants: byEntry.get(row.id) ?? [],
  }));
}

async function insertParticipants(
  db: PostgresExecutor,
  entryId: number,
  participants: NewParticipant[],
): Promise<void> {
  if (participants.length === 0) return;

  await db
    .insert(entryParticipants)
    .values(participants.map((participant) => ({ ...participant, entryId })));
}

async function findWithParticipants(
  db: PostgresExecutor,
  groupId: number,
  id: number,
): Promise<EntryWithParticipants | null> {
  const [row] = await db
    .select()
    .from(entries)
    .where(and(eq(entries.groupId, groupId), eq(entries.id, id)));

  if (!row) return null;

  const [withParticipants] = await attachParticipants(db, [row]);
  return withParticipants ?? null;
}

export function createEntryRepository(db: PostgresDb): EntryRepository {
  return {
    async findPage(
      groupId: number,
      filter: EntryFilter,
      page: PageRequest,
    ): Promise<Page<EntryWithParticipants>> {
      const where = buildWhere(db, groupId, filter);

      const [rows, totals] = await Promise.all([
        db
          .select()
          .from(entries)
          .where(where)
          .orderBy(desc(entries.startDate), desc(entries.id))
          .limit(page.pageSize)
          .offset((page.pageNumber - 1) * page.pageSize),
        db.select({ total: count() }).from(entries).where(where),
      ]);

      return {
        items: await attachParticipants(db, rows),
        total: totals[0]?.total ?? 0,
        pageNumber: page.pageNumber,
        pageSize: page.pageSize,
      };
    },

    async findAll(
      groupId: number,
      filter: EntryFilter,
      limit: number,
    ): Promise<EntryWithParticipants[]> {
      const rows = await db
        .select()
        .from(entries)
        .where(buildWhere(db, groupId, filter))
        .orderBy(asc(entries.startDate), asc(entries.id))
        .limit(limit);

      return attachParticipants(db, rows);
    },

    async findById(
      groupId: number,
      id: number,
    ): Promise<EntryWithParticipants | null> {
      return findWithParticipants(db, groupId, id);
    },

    async create(
      input: NewEntryWithParticipants,
    ): Promise<EntryWithParticipants> {
      return withTranslatedErrors(() =>
        db.transaction(async (tx) => {
          const [row] = await tx
            .insert(entries)
            .values(input.entry)
            .returning();
          if (!row) throw new Error('Insert into entries returned no row.');

          await insertParticipants(tx, row.id, input.participants);

          const created = await findWithParticipants(tx, row.groupId, row.id);
          if (!created) throw new Error('Created entry could not be read.');
          return created;
        }),
      );
    },

    async createMany(
      inputs: NewEntryWithParticipants[],
    ): Promise<{ created: EntryWithParticipants[]; skipped: number }> {
      return withTranslatedErrors(() =>
        db.transaction(async (tx) => {
          const createdRows: Entry[] = [];
          let skipped = 0;

          for (const input of inputs) {
            const [row] = await tx
              .insert(entries)
              .values(input.entry)
              .onConflictDoNothing({
                target: [entries.groupId, entries.source, entries.sourceRef],
              })
              .returning();

            if (!row) {
              skipped += 1;
              continue;
            }

            await insertParticipants(tx, row.id, input.participants);
            createdRows.push(row);
          }

          return {
            created: await attachParticipants(tx, createdRows),
            skipped,
          };
        }),
      );
    },

    async update(
      groupId: number,
      id: number,
      input: EntryUpdate,
      participants?: NewParticipant[],
    ): Promise<EntryWithParticipants | null> {
      return withTranslatedErrors(() =>
        db.transaction(async (tx) => {
          const [row] = await tx
            .update(entries)
            .set({ ...input, updatedAt: new Date() })
            .where(and(eq(entries.groupId, groupId), eq(entries.id, id)))
            .returning({ id: entries.id });

          if (!row) return null;

          if (participants) {
            await tx
              .delete(entryParticipants)
              .where(eq(entryParticipants.entryId, id));
            await insertParticipants(tx, id, participants);
          }

          return findWithParticipants(tx, groupId, id);
        }),
      );
    },

    async delete(groupId: number, id: number): Promise<Entry | null> {
      const [row] = await db
        .delete(entries)
        .where(and(eq(entries.groupId, groupId), eq(entries.id, id)))
        .returning();
      return row ?? null;
    },
  };
}

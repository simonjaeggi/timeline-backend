import { sql } from 'drizzle-orm';
import {
  boolean,
  check,
  date,
  index,
  integer,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from 'drizzle-orm/pg-core';
import {
  DATE_PRECISIONS,
  ENTRY_CATEGORIES,
  ENTRY_KINDS,
  ENTRY_SOURCES,
  GROUP_ROLES,
  RELATIONSHIP_TYPES,
} from '../models.ts';
import { appRoleEnum, users } from './auth-schema.ts';

export * from './auth-schema.ts';

export const groupRoleEnum = pgEnum('group_role', GROUP_ROLES);
export const entryKindEnum = pgEnum('entry_kind', ENTRY_KINDS);
export const entryCategoryEnum = pgEnum('entry_category', ENTRY_CATEGORIES);
export const datePrecisionEnum = pgEnum('date_precision', DATE_PRECISIONS);
export const entrySourceEnum = pgEnum('entry_source', ENTRY_SOURCES);
export const relationshipTypeEnum = pgEnum(
  'relationship_type',
  RELATIONSHIP_TYPES,
);

const createdAt = () =>
  timestamp('created_at', { withTimezone: true }).notNull().defaultNow();

const updatedAt = () =>
  timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date());

/** Auth subject of the creator (for example the OAuth `sub`). No FK until users exist. */
const createdBy = () => varchar('created_by', { length: 255 });

export const groups = pgTable('groups', {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  createdBy: createdBy(),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const people = pgTable(
  'people',
  {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    groupId: integer('group_id')
      .notNull()
      .references(() => groups.id, { onDelete: 'cascade' }),
    firstName: varchar('first_name', { length: 255 }).notNull(),
    lastName: varchar('last_name', { length: 255 }),
    nickname: varchar('nickname', { length: 255 }),
    birthDate: date('birth_date', { mode: 'string' }),
    deathDate: date('death_date', { mode: 'string' }),
    color: varchar('color', { length: 7 }),
    notes: text('notes'),
    createdBy: createdBy(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    index('people_group_id_idx').on(table.groupId),
    check(
      'people_death_after_birth',
      sql`${table.deathDate} IS NULL OR ${table.birthDate} IS NULL OR ${table.deathDate} >= ${table.birthDate}`,
    ),
  ],
);

export const relationships = pgTable(
  'relationships',
  {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    groupId: integer('group_id')
      .notNull()
      .references(() => groups.id, { onDelete: 'cascade' }),
    personId: integer('person_id')
      .notNull()
      .references(() => people.id, { onDelete: 'cascade' }),
    relatedPersonId: integer('related_person_id')
      .notNull()
      .references(() => people.id, { onDelete: 'cascade' }),
    type: relationshipTypeEnum('type').notNull(),
    label: varchar('label', { length: 100 }),
    createdAt: createdAt(),
  },
  (table) => [
    uniqueIndex('relationships_unique').on(
      table.personId,
      table.relatedPersonId,
      table.type,
    ),
    index('relationships_related_person_id_idx').on(table.relatedPersonId),
    check(
      'relationships_not_self',
      sql`${table.personId} <> ${table.relatedPersonId}`,
    ),
  ],
);

export const entries = pgTable(
  'entries',
  {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    groupId: integer('group_id')
      .notNull()
      .references(() => groups.id, { onDelete: 'cascade' }),
    kind: entryKindEnum('kind').notNull(),
    category: entryCategoryEnum('category').notNull(),
    title: varchar('title', { length: 255 }).notNull(),
    description: text('description'),
    startDate: date('start_date', { mode: 'string' }).notNull(),
    startPrecision: datePrecisionEnum('start_precision').notNull(),
    endDate: date('end_date', { mode: 'string' }),
    endPrecision: datePrecisionEnum('end_precision'),
    spanEnd: date('span_end', { mode: 'string' }).notNull(),
    location: varchar('location', { length: 255 }),
    source: entrySourceEnum('source').notNull().default('manual'),
    sourceRef: varchar('source_ref', { length: 255 }),
    createdBy: createdBy(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    index('entries_group_start_idx').on(table.groupId, table.startDate),
    index('entries_group_span_end_idx').on(table.groupId, table.spanEnd),
    uniqueIndex('entries_group_source_ref_unique').on(
      table.groupId,
      table.source,
      table.sourceRef,
    ),
    check(
      'entries_end_after_start',
      sql`${table.endDate} IS NULL OR ${table.endDate} >= ${table.startDate}`,
    ),
    check(
      'entries_end_precision_with_end',
      sql`(${table.endDate} IS NULL) = (${table.endPrecision} IS NULL)`,
    ),
    check(
      'entries_span_end_after_start',
      sql`${table.spanEnd} >= ${table.startDate}`,
    ),
  ],
);

export const entryParticipants = pgTable(
  'entry_participants',
  {
    entryId: integer('entry_id')
      .notNull()
      .references(() => entries.id, { onDelete: 'cascade' }),
    personId: integer('person_id')
      .notNull()
      .references(() => people.id, { onDelete: 'cascade' }),
    role: varchar('role', { length: 100 }),
  },
  (table) => [
    primaryKey({ columns: [table.entryId, table.personId] }),
    index('entry_participants_person_id_idx').on(table.personId),
  ],
);

export const groupMembers = pgTable(
  'group_members',
  {
    groupId: integer('group_id')
      .notNull()
      .references(() => groups.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    role: groupRoleEnum('role').notNull(),
    createdAt: createdAt(),
  },
  (table) => [
    primaryKey({ columns: [table.groupId, table.userId] }),
    index('group_members_user_id_idx').on(table.userId),
  ],
);

export const accessCodes = pgTable(
  'access_codes',
  {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    /** SHA-256 of the normalised code. The code itself is never stored. */
    codeHash: varchar('code_hash', { length: 64 }).notNull(),
    codeHint: varchar('code_hint', { length: 4 }).notNull(),
    groupId: integer('group_id').references(() => groups.id, {
      onDelete: 'cascade',
    }),
    groupRole: groupRoleEnum('group_role'),
    grantsAppRole: appRoleEnum('grants_app_role').notNull().default('user'),
    email: varchar('email', { length: 255 }),
    isInitial: boolean('is_initial').notNull().default(false),
    createdBy: text('created_by').references(() => users.id, {
      onDelete: 'set null',
    }),
    createdAt: createdAt(),
    expiresAt: timestamp('expires_at', { withTimezone: true }),
    redeemedAt: timestamp('redeemed_at', { withTimezone: true }),
    redeemedByUserId: text('redeemed_by_user_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    redeemedByEmail: varchar('redeemed_by_email', { length: 255 }),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
  },
  (table) => [
    uniqueIndex('access_codes_code_hash_unique').on(table.codeHash),
    uniqueIndex('access_codes_single_initial_unique')
      .on(table.isInitial)
      .where(sql`${table.isInitial} = true`),
    check(
      'access_codes_group_role_with_group',
      sql`(${table.groupId} IS NULL) = (${table.groupRole} IS NULL)`,
    ),
    check(
      'access_codes_grants_something',
      sql`${table.groupId} IS NOT NULL OR ${table.grantsAppRole} = 'admin'`,
    ),
  ],
);

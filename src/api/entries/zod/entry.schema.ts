import { z } from '@hono/zod-openapi';
import {
  ENTRY_CATEGORIES,
  ENTRY_KINDS,
  ENTRY_SOURCES,
} from '../../../data/models.ts';
import {
  partialDateSchema,
  PartialDateViewSchema,
} from '../../../shared/partial-date.ts';
import {
  DateTimeSchema,
  GroupParamsSchema,
  IdParamSchema,
} from '../../../shared/openapi.ts';
import {
  BodyIdSchema,
  csvList,
  IdSchema,
  IsoDateSchema,
  nullableText,
  PaginationSchema,
  SearchTermSchema,
} from '../../../shared/zod/common.schema.ts';

export const EntryKindSchema = z.enum(ENTRY_KINDS).openapi('EntryKind');
export const EntryCategorySchema = z
  .enum(ENTRY_CATEGORIES)
  .openapi('EntryCategory');
export const EntrySourceSchema = z.enum(ENTRY_SOURCES).openapi('EntrySource');

/** Accepts `5` or `{ "personId": 5, "role": "host" }`. */
const ParticipantSchema = z.union([
  z
    .number()
    .int()
    .positive()
    .transform((personId) => ({ personId, role: null })),
  z
    .strictObject({
      personId: BodyIdSchema,
      role: nullableText(100, 'Role'),
    })
    .transform((participant) => ({
      personId: participant.personId,
      role: participant.role ?? null,
    })),
]);

const EntryFields = z.strictObject({
  kind: EntryKindSchema.optional(),
  category: EntryCategorySchema.optional(),
  title: z
    .string()
    .trim()
    .min(1, 'Title is required.')
    .max(255, 'Title cannot be longer than 255 characters.'),
  description: nullableText(10_000, 'Description'),
  /** `YYYY`, `YYYY-MM` or `YYYY-MM-DD`. */
  start: partialDateSchema('start'),
  /** Optional end of a period, same formats as `start`. */
  end: partialDateSchema('end').nullable().optional(),
  location: nullableText(255, 'Location'),
  participants: z
    .array(ParticipantSchema)
    .max(100, 'An entry can have at most 100 participants.')
    .refine(
      (participants) =>
        new Set(participants.map((participant) => participant.personId))
          .size === participants.length,
      'Each person can only participate once.',
    )
    .optional(),
});

type DateFields = {
  start?: { date: string };
  end?: { date: string } | null;
};

const endNotBeforeStart = {
  check: (value: DateFields) =>
    !value.start || !value.end || value.end.date >= value.start.date,
  params: { message: 'End cannot be before start.', path: ['end'] },
};

export const CreateEntrySchema = EntryFields.refine(
  endNotBeforeStart.check,
  endNotBeforeStart.params,
).openapi('CreateEntry', {
  description:
    'kind defaults to activity, category to other. participants accepts person ids or { personId, role }.',
});

export type CreateEntryDto = z.infer<typeof CreateEntrySchema>;

export const UpdateEntrySchema = EntryFields.partial()
  .refine(
    (value) => Object.keys(value).length > 0,
    'At least one field must be provided.',
  )
  .refine(endNotBeforeStart.check, endNotBeforeStart.params)
  .openapi('UpdateEntry', {
    description: 'Partial update. participants, when sent, replaces the list.',
  });

export type UpdateEntryDto = z.infer<typeof UpdateEntrySchema>;

export const EntryFilterQuerySchema = z.object({
  from: IsoDateSchema.optional(),
  to: IsoDateSchema.optional(),
  personIds: csvList(IdSchema).optional(),
  kinds: csvList(EntryKindSchema, 'milestone').optional(),
  categories: csvList(EntryCategorySchema, 'education,work').optional(),
});

export const ListEntriesQuerySchema = PaginationSchema.extend({
  ...EntryFilterQuerySchema.shape,
  q: SearchTermSchema.optional(),
}).refine((value) => !value.from || !value.to || value.from <= value.to, {
  message: '"from" must not be after "to".',
  path: ['from'],
});

export type ListEntriesQueryDto = z.infer<typeof ListEntriesQuerySchema>;

export const EntryParamsSchema = GroupParamsSchema.extend({
  entryId: IdParamSchema,
});

/* Responses */

export const EntryParticipantSchema = z
  .object({ personId: z.number().int(), role: z.string().nullable() })
  .openapi('EntryParticipant');

export const EntrySchema = z
  .object({
    id: z.number().int(),
    groupId: z.number().int(),
    kind: EntryKindSchema,
    category: EntryCategorySchema,
    title: z.string(),
    description: z.string().nullable(),
    start: PartialDateViewSchema,
    end: PartialDateViewSchema.nullable(),
    location: z.string().nullable(),
    source: EntrySourceSchema,
    sourceRef: z.string().nullable(),
    participants: z.array(EntryParticipantSchema),
    createdBy: z.string().nullable(),
    createdAt: DateTimeSchema,
    updatedAt: DateTimeSchema,
  })
  .openapi('Entry');

export const EntryPageSchema = z
  .object({
    items: z.array(EntrySchema),
    total: z.number().int(),
    pageNumber: z.number().int(),
    pageSize: z.number().int(),
  })
  .openapi('EntryPage');

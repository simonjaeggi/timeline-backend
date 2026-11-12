import { z } from '@hono/zod-openapi';
import { RELATIONSHIP_TYPES } from '../../../data/models.ts';
import {
  DateStringSchema,
  DateTimeSchema,
  GroupParamsSchema,
  IdParamSchema,
} from '../../../shared/openapi.ts';
import {
  BodyIdSchema,
  IsoDateSchema,
  nullableText,
  SearchTermSchema,
} from '../../../shared/zod/common.schema.ts';

const PersonFields = z.strictObject({
  firstName: z
    .string()
    .trim()
    .min(1, 'First name is required.')
    .max(255, 'First name cannot be longer than 255 characters.')
    .openapi({ example: 'Anna' }),
  lastName: nullableText(255, 'Last name'),
  nickname: nullableText(255, 'Nickname'),
  birthDate: IsoDateSchema.nullable().optional(),
  deathDate: IsoDateSchema.nullable().optional(),
  color: z
    .string()
    .trim()
    .regex(/^#[0-9a-fA-F]{6}$/, 'Color must be a hex value like #3a7bd5.')
    .transform((value) => value.toLowerCase())
    .nullable()
    .optional()
    .openapi({ type: 'string', example: '#3a7bd5' }),
  notes: nullableText(5000, 'Notes'),
});

const deathNotBeforeBirth = {
  check: (value: { birthDate?: string | null; deathDate?: string | null }) =>
    !value.birthDate || !value.deathDate || value.deathDate >= value.birthDate,
  params: {
    message: 'Death date cannot be before the birth date.',
    path: ['deathDate'],
  },
};

export const CreatePersonSchema = PersonFields.refine(
  deathNotBeforeBirth.check,
  deathNotBeforeBirth.params,
).openapi('CreatePerson');

export type CreatePersonDto = z.infer<typeof CreatePersonSchema>;

export const UpdatePersonSchema = PersonFields.partial()
  .refine(
    (value) => Object.keys(value).length > 0,
    'At least one field must be provided.',
  )
  .refine(deathNotBeforeBirth.check, deathNotBeforeBirth.params)
  .openapi('UpdatePerson');

export type UpdatePersonDto = z.infer<typeof UpdatePersonSchema>;

export const ListPeopleQuerySchema = z.object({
  q: SearchTermSchema.optional().openapi({
    description: 'Matches first name, last name or nickname.',
  }),
});

export const PersonParamsSchema = GroupParamsSchema.extend({
  personId: IdParamSchema,
});

export const RelationshipParamsSchema = PersonParamsSchema.extend({
  relationshipId: IdParamSchema,
});

export const RelationshipTypeSchema = z
  .enum(RELATIONSHIP_TYPES)
  .openapi('RelationshipType');

/**
 * `type` describes what the person in the URL is to `relatedPersonId`:
 * POST /people/1/relationships { relatedPersonId: 2, type: "parent" }
 * means person 1 is a parent of person 2.
 */
export const CreateRelationshipSchema = z
  .strictObject({
    relatedPersonId: BodyIdSchema,
    type: RelationshipTypeSchema,
    label: nullableText(100, 'Label'),
  })
  .openapi('CreateRelationship', {
    description:
      'The person in the URL is <type> of relatedPersonId. "parent" is directional, "partner" and "sibling" are symmetric.',
  });

export type CreateRelationshipDto = z.infer<typeof CreateRelationshipSchema>;

/* Responses */

export const PersonSchema = z
  .object({
    id: z.number().int(),
    groupId: z.number().int(),
    firstName: z.string(),
    lastName: z.string().nullable(),
    nickname: z.string().nullable(),
    birthDate: DateStringSchema.nullable(),
    deathDate: DateStringSchema.nullable(),
    color: z.string().nullable(),
    notes: z.string().nullable(),
    createdBy: z.string().nullable(),
    createdAt: DateTimeSchema,
    updatedAt: DateTimeSchema,
  })
  .openapi('Person');

export const PersonSummarySchema = PersonSchema.pick({
  id: true,
  firstName: true,
  lastName: true,
  nickname: true,
}).openapi('PersonSummary');

export const RelationshipViewSchema = z
  .object({
    id: z.number().int(),
    relation: z
      .enum(['parent', 'child', 'partner', 'sibling', 'other'])
      .openapi({ description: 'What `person` is to the person being viewed.' }),
    label: z.string().nullable(),
    person: PersonSummarySchema,
  })
  .openapi('RelationshipView');

export const RelationshipSchema = z
  .object({
    id: z.number().int(),
    groupId: z.number().int(),
    personId: z.number().int(),
    relatedPersonId: z.number().int(),
    type: RelationshipTypeSchema,
    label: z.string().nullable(),
    createdAt: DateTimeSchema,
  })
  .openapi('Relationship');

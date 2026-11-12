import { z } from '@hono/zod-openapi';
import { BodyIdSchema } from '../../../shared/zod/common.schema.ts';
import {
  EntryCategorySchema,
  EntryKindSchema,
} from '../../entries/zod/entry.schema.ts';
import { IMPORT_SOURCES } from '../parsers/parser.types.ts';

export const MAX_IMPORT_CONTENT_LENGTH = 200_000;

export const ImportSourceSchema = z
  .enum(IMPORT_SOURCES)
  .openapi('ImportSource');

export const ImportRequestSchema = z
  .strictObject({
    source: ImportSourceSchema,
    content: z
      .string()
      .min(1, 'Content must not be empty.')
      .max(
        MAX_IMPORT_CONTENT_LENGTH,
        `Content cannot be longer than ${MAX_IMPORT_CONTENT_LENGTH} characters.`,
      ),
    /** People attached as participants to every imported entry. */
    personIds: z.array(BodyIdSchema).max(50).default([]),
    defaults: z
      .strictObject({
        kind: EntryKindSchema.default('activity'),
        category: EntryCategorySchema.default('other'),
      })
      .default({ kind: 'activity', category: 'other' }),
    /** Import the valid entries even if some lines have issues. */
    skipInvalid: z.boolean().default(false),
  })
  .openapi('ImportRequest', {
    description:
      'text format, one entry per line: `<date or start..end> | <title> | <description> | <tags>`',
  });

export type ImportRequestDto = z.infer<typeof ImportRequestSchema>;

export const ImportIssueSchema = z
  .object({ line: z.number().int().nullable(), message: z.string() })
  .openapi('ImportIssue');

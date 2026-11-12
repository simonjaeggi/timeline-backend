import { z } from '@hono/zod-openapi';
import { PartialDateObjectSchema } from '../../../shared/partial-date.ts';
import {
  EntryCategorySchema,
  EntryKindSchema,
} from '../../entries/zod/entry.schema.ts';

/**
 * The one normalised format every parser must produce, whatever the source
 * (plain text, LinkedIn export, Xing, ...). The import service validates each
 * parser result against this schema before anything is stored, so a buggy
 * parser cannot write malformed data.
 */
export const ParsedEntrySchema = z
  .strictObject({
    kind: EntryKindSchema,
    category: EntryCategorySchema,
    title: z.string().trim().min(1).max(255),
    description: z.string().trim().max(10_000).nullable(),
    start: PartialDateObjectSchema,
    end: PartialDateObjectSchema.nullable(),
    location: z.string().trim().max(255).nullable(),
    /** Stable id of the item in its source, used to skip duplicates on re-import. */
    sourceRef: z.string().trim().min(1).max(255),
  })
  .refine((entry) => !entry.end || entry.end.date >= entry.start.date, {
    message: 'End cannot be before start.',
    path: ['end'],
  })
  .openapi('ParsedEntry');

export type ParsedEntry = z.infer<typeof ParsedEntrySchema>;

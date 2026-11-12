import { createRoute, z } from '@hono/zod-openapi';
import {
  errorResponses,
  GROUP_ERRORS,
  GroupParamsSchema,
  json,
  jsonBody,
} from '../../shared/openapi.ts';
import { EntrySchema } from '../entries/zod/entry.schema.ts';
import { ImportIssueSchema, ImportRequestSchema } from './zod/import.schema.ts';
import { ParsedEntrySchema } from './zod/parsed-entry.schema.ts';

const tags = ['Import'];

export const previewImportRoute = createRoute({
  method: 'post',
  path: '/groups/{groupId}/import/preview',
  tags,
  summary: 'Parse content without storing it (editor)',
  request: { params: GroupParamsSchema, body: jsonBody(ImportRequestSchema) },
  responses: {
    200: json(
      z
        .object({
          entries: z.array(ParsedEntrySchema),
          issues: z.array(ImportIssueSchema),
        })
        .openapi('ImportPreview'),
      'What would be imported',
    ),
    ...errorResponses(...GROUP_ERRORS, 501),
  },
});

export const importEntriesRoute = createRoute({
  method: 'post',
  path: '/groups/{groupId}/import',
  tags,
  summary: 'Parse and store entries (editor)',
  description:
    'All or nothing unless skipInvalid is set. Entries imported before are skipped.',
  request: { params: GroupParamsSchema, body: jsonBody(ImportRequestSchema) },
  responses: {
    201: json(
      z
        .object({
          created: z.number().int(),
          skippedDuplicates: z.number().int(),
          issues: z.array(ImportIssueSchema),
          entries: z.array(EntrySchema),
        })
        .openapi('ImportResult'),
      'Import result',
    ),
    ...errorResponses(...GROUP_ERRORS, 501),
  },
});

import { createRoute, z } from '@hono/zod-openapi';
import {
  errorResponses,
  GROUP_ERRORS,
  GroupParamsSchema,
  json,
  jsonBody,
} from '../../shared/openapi.ts';
import {
  CreateEntrySchema,
  EntryPageSchema,
  EntryParamsSchema,
  EntrySchema,
  ListEntriesQuerySchema,
  UpdateEntrySchema,
} from './zod/entry.schema.ts';

const tags = ['Entries'];

export const listEntriesRoute = createRoute({
  method: 'get',
  path: '/groups/{groupId}/entries',
  tags,
  summary: 'List entries, newest first',
  description: '`from` and `to` select entries overlapping that window.',
  request: { params: GroupParamsSchema, query: ListEntriesQuerySchema },
  responses: {
    200: json(EntryPageSchema, 'Page of entries'),
    ...errorResponses(...GROUP_ERRORS),
  },
});

export const createEntryRoute = createRoute({
  method: 'post',
  path: '/groups/{groupId}/entries',
  tags,
  summary: 'Create an entry (editor)',
  request: { params: GroupParamsSchema, body: jsonBody(CreateEntrySchema) },
  responses: {
    201: json(z.object({ entry: EntrySchema }), 'Created entry'),
    ...errorResponses(...GROUP_ERRORS),
  },
});

export const getEntryRoute = createRoute({
  method: 'get',
  path: '/groups/{groupId}/entries/{entryId}',
  tags,
  summary: 'Get an entry',
  request: { params: EntryParamsSchema },
  responses: {
    200: json(z.object({ entry: EntrySchema }), 'Entry'),
    ...errorResponses(...GROUP_ERRORS),
  },
});

export const updateEntryRoute = createRoute({
  method: 'patch',
  path: '/groups/{groupId}/entries/{entryId}',
  tags,
  summary: 'Update an entry (editor)',
  request: { params: EntryParamsSchema, body: jsonBody(UpdateEntrySchema) },
  responses: {
    200: json(z.object({ entry: EntrySchema }), 'Updated entry'),
    ...errorResponses(...GROUP_ERRORS),
  },
});

export const deleteEntryRoute = createRoute({
  method: 'delete',
  path: '/groups/{groupId}/entries/{entryId}',
  tags,
  summary: 'Delete an entry (editor)',
  request: { params: EntryParamsSchema },
  responses: {
    204: { description: 'Deleted' },
    ...errorResponses(...GROUP_ERRORS),
  },
});

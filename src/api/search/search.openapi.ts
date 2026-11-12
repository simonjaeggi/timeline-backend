import { createRoute, z } from '@hono/zod-openapi';
import {
  errorResponses,
  GROUP_ERRORS,
  GroupParamsSchema,
  json,
} from '../../shared/openapi.ts';
import { EntrySchema } from '../entries/zod/entry.schema.ts';
import { PersonSchema } from '../people/zod/person.schema.ts';
import { SearchQuerySchema } from './zod/search.schema.ts';

export const searchRoute = createRoute({
  method: 'get',
  path: '/groups/{groupId}/search',
  tags: ['Search'],
  summary: 'Search people and entries',
  description: 'Backs the search bar. Matches names, titles and descriptions.',
  request: { params: GroupParamsSchema, query: SearchQuerySchema },
  responses: {
    200: json(
      z
        .object({
          people: z.array(PersonSchema),
          entries: z.array(EntrySchema),
        })
        .openapi('SearchResult'),
      'Matches',
    ),
    ...errorResponses(...GROUP_ERRORS),
  },
});

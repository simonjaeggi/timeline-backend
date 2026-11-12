import { createRoute } from '@hono/zod-openapi';
import {
  errorResponses,
  GROUP_ERRORS,
  GroupParamsSchema,
  json,
} from '../../shared/openapi.ts';
import { TimelineQuerySchema, TimelineSchema } from './zod/timeline.schema.ts';

export const timelineRoute = createRoute({
  method: 'get',
  path: '/groups/{groupId}/timeline',
  tags: ['Timeline'],
  summary: 'Chronological timeline for a date window',
  description:
    'Entries overlapping [from, to] plus generated birthdays, sorted by date. Defaults to one year around today, at most 150 years.',
  request: { params: GroupParamsSchema, query: TimelineQuerySchema },
  responses: {
    200: json(TimelineSchema, 'Timeline'),
    ...errorResponses(...GROUP_ERRORS),
  },
});

import type { RouteHandler } from '@hono/zod-openapi';
import { getGroupId } from '../../middleware/group-access.middleware.ts';
import type { searchRoute } from './search.openapi.ts';
import * as searchService from './search.service.ts';

export const search: RouteHandler<typeof searchRoute> = async (c) => {
  return c.json(
    await searchService.search(getGroupId(c), c.req.valid('query')),
    200,
  );
};

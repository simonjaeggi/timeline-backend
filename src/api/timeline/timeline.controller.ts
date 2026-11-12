import type { RouteHandler } from '@hono/zod-openapi';
import { getGroupId } from '../../middleware/group-access.middleware.ts';
import type { timelineRoute } from './timeline.openapi.ts';
import { getTimeline } from './timeline.service.ts';

export const timeline: RouteHandler<typeof timelineRoute> = async (c) => {
  return c.json(await getTimeline(getGroupId(c), c.req.valid('query')), 200);
};

import type { Router } from '../../shared/openapi.ts';
import { timeline } from './timeline.controller.ts';
import { timelineRoute } from './timeline.openapi.ts';

export function registerTimelineRoutes(router: Router): void {
  router.openapi(timelineRoute, timeline);
}

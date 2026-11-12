import type { Router } from '../../shared/openapi.ts';
import * as controller from './entry.controller.ts';
import * as routes from './entry.openapi.ts';

export function registerEntryRoutes(router: Router): void {
  router.openapi(routes.listEntriesRoute, controller.listEntries);
  router.openapi(routes.createEntryRoute, controller.createEntry);
  router.openapi(routes.getEntryRoute, controller.getEntry);
  router.openapi(routes.updateEntryRoute, controller.updateEntry);
  router.openapi(routes.deleteEntryRoute, controller.deleteEntry);
}

import type { Router } from '../../shared/openapi.ts';
import * as controller from './import.controller.ts';
import * as routes from './import.openapi.ts';

export function registerImportRoutes(router: Router): void {
  router.openapi(routes.previewImportRoute, controller.previewImport);
  router.openapi(routes.importEntriesRoute, controller.importEntries);
}

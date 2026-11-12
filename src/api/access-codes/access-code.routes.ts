import type { Router } from '../../shared/openapi.ts';
import * as controller from './access-code.controller.ts';
import * as routes from './access-code.openapi.ts';

/** Public: registered before requireAuth. */
export function registerPublicAccessCodeRoutes(router: Router): void {
  router.openapi(routes.checkAccessCodeRoute, controller.checkAccessCode);
}

export function registerAccessCodeRoutes(router: Router): void {
  router.openapi(routes.redeemAccessCodeRoute, controller.redeemAccessCode);
  router.openapi(routes.listAccessCodesRoute, controller.listAccessCodes);
  router.openapi(routes.createAccessCodeRoute, controller.createAccessCode);
  router.openapi(routes.revokeAccessCodeRoute, controller.revokeAccessCode);
}

import type { Router } from '../../shared/openapi.ts';
import * as controller from './user.controller.ts';
import * as routes from './user.openapi.ts';

export function registerUserRoutes(router: Router): void {
  router.openapi(routes.meRoute, controller.me);
  router.openapi(routes.listUsersRoute, controller.listUsers);
  router.openapi(routes.updateUserRoute, controller.updateUser);
  router.openapi(routes.deleteUserRoute, controller.deleteUser);
}

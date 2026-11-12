import type { Router } from '../../shared/openapi.ts';
import * as controller from './person.controller.ts';
import * as routes from './person.openapi.ts';

export function registerPersonRoutes(router: Router): void {
  router.openapi(routes.listPeopleRoute, controller.listPeople);
  router.openapi(routes.createPersonRoute, controller.createPerson);
  router.openapi(routes.getPersonRoute, controller.getPerson);
  router.openapi(routes.updatePersonRoute, controller.updatePerson);
  router.openapi(routes.deletePersonRoute, controller.deletePerson);
  router.openapi(routes.addRelationshipRoute, controller.addRelationship);
  router.openapi(routes.removeRelationshipRoute, controller.removeRelationship);
}

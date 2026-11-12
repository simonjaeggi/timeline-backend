import type { Router } from '../../shared/openapi.ts';
import * as controller from './group.controller.ts';
import * as routes from './group.openapi.ts';

export function registerGroupRoutes(router: Router): void {
  router.openapi(routes.listGroupsRoute, controller.listGroups);
  router.openapi(routes.createGroupRoute, controller.createGroup);
  router.openapi(routes.getGroupRoute, controller.getGroup);
  router.openapi(routes.updateGroupRoute, controller.updateGroup);
  router.openapi(routes.deleteGroupRoute, controller.deleteGroup);
  router.openapi(routes.listMembersRoute, controller.listMembers);
  router.openapi(routes.updateMemberRoute, controller.updateMember);
  router.openapi(routes.removeMemberRoute, controller.removeMember);
}

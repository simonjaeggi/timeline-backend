import type { Router } from '../../shared/openapi.ts';
import { search } from './search.controller.ts';
import { searchRoute } from './search.openapi.ts';

export function registerSearchRoutes(router: Router): void {
  router.openapi(searchRoute, search);
}

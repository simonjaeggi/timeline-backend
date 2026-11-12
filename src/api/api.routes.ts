import { createRoute, z } from '@hono/zod-openapi';
import { getRepositories } from '../data/index.ts';
import { requireAuth } from '../middleware/auth.middleware.ts';
import {
  requireGroupAccess,
  requireWriteAccessForMutations,
} from '../middleware/group-access.middleware.ts';
import { createRouter, json } from '../shared/openapi.ts';
import {
  registerAccessCodeRoutes,
  registerPublicAccessCodeRoutes,
} from './access-codes/access-code.routes.ts';
import { registerEntryRoutes } from './entries/entry.routes.ts';
import { registerGroupRoutes } from './groups/group.routes.ts';
import { registerImportRoutes } from './import/import.routes.ts';
import { registerPersonRoutes } from './people/person.routes.ts';
import { registerSearchRoutes } from './search/search.routes.ts';
import { registerTimelineRoutes } from './timeline/timeline.routes.ts';
import { registerUserRoutes } from './users/user.routes.ts';

const HealthSchema = z
  .object({ ok: z.boolean(), db: z.enum(['up', 'down']) })
  .openapi('Health');

const healthRoute = createRoute({
  method: 'get',
  path: '/health',
  tags: ['System'],
  summary: 'Health check (public)',
  security: [],
  responses: {
    200: json(HealthSchema, 'API and database are up'),
    503: json(HealthSchema, 'Database is down'),
  },
});

/**
 * Builds the /api router. Order matters: routes registered before
 * `requireAuth` are public, everything after needs a session.
 */
export function createApiRouter() {
  const api = createRouter();

  api.openAPIRegistry.registerComponent('securitySchemes', 'session', {
    type: 'apiKey',
    in: 'cookie',
    name: 'better-auth.session_token',
    description:
      'Session cookie set by Better Auth after Google sign-in (/api/auth). Send requests with credentials included.',
  });

  // Public
  api.openapi(healthRoute, async (c) => {
    try {
      await getRepositories().ping();
      return c.json({ ok: true, db: 'up' as const }, 200);
    } catch (error) {
      console.error('DB healthcheck failed:', error);
      return c.json({ ok: false, db: 'down' as const }, 503);
    }
  });
  registerPublicAccessCodeRoutes(api);

  // Everything below requires a session.
  api.use('*', requireAuth());

  // Group scoped: membership check, viewers read-only.
  for (const path of ['/groups/:groupId', '/groups/:groupId/*']) {
    api.use(path, requireGroupAccess(), requireWriteAccessForMutations());
  }

  registerUserRoutes(api);
  registerAccessCodeRoutes(api);
  registerGroupRoutes(api);
  registerPersonRoutes(api);
  registerEntryRoutes(api);
  registerTimelineRoutes(api);
  registerSearchRoutes(api);
  registerImportRoutes(api);

  return api;
}

import type { RouteHandler } from '@hono/zod-openapi';
import { getAuthUser } from '../../middleware/auth.middleware.ts';
import { getGroupId } from '../../middleware/group-access.middleware.ts';
import type {
  importEntriesRoute,
  previewImportRoute,
} from './import.openapi.ts';
import * as importService from './import.service.ts';

export const previewImport: RouteHandler<typeof previewImportRoute> = async (
  c,
) => {
  return c.json(importService.parseImport(c.req.valid('json')), 200);
};

export const importEntries: RouteHandler<typeof importEntriesRoute> = async (
  c,
) => {
  const result = await importService.importEntries(
    getGroupId(c),
    getAuthUser(c),
    c.req.valid('json'),
  );
  return c.json(result, 201);
};

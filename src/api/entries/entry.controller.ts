import type { RouteHandler } from '@hono/zod-openapi';
import { getAuthUser } from '../../middleware/auth.middleware.ts';
import { getGroupId } from '../../middleware/group-access.middleware.ts';
import { NotFoundError } from '../../shared/errors.ts';
import type {
  createEntryRoute,
  deleteEntryRoute,
  getEntryRoute,
  listEntriesRoute,
  updateEntryRoute,
} from './entry.openapi.ts';
import * as entryService from './entry.service.ts';

export const listEntries: RouteHandler<typeof listEntriesRoute> = async (c) => {
  const page = await entryService.listEntries(
    getGroupId(c),
    c.req.valid('query'),
  );
  return c.json(page, 200);
};

export const getEntry: RouteHandler<typeof getEntryRoute> = async (c) => {
  const { entryId } = c.req.valid('param');
  const entry = await entryService.getEntry(getGroupId(c), entryId);
  if (!entry) throw new NotFoundError('Entry');
  return c.json({ entry }, 200);
};

export const createEntry: RouteHandler<typeof createEntryRoute> = async (c) => {
  const entry = await entryService.createEntry(
    getGroupId(c),
    getAuthUser(c),
    c.req.valid('json'),
  );
  return c.json({ entry }, 201);
};

export const updateEntry: RouteHandler<typeof updateEntryRoute> = async (c) => {
  const { entryId } = c.req.valid('param');
  const entry = await entryService.updateEntry(
    getGroupId(c),
    entryId,
    c.req.valid('json'),
  );
  if (!entry) throw new NotFoundError('Entry');
  return c.json({ entry }, 200);
};

export const deleteEntry: RouteHandler<typeof deleteEntryRoute> = async (c) => {
  const { entryId } = c.req.valid('param');
  const deleted = await entryService.deleteEntry(getGroupId(c), entryId);
  if (!deleted) throw new NotFoundError('Entry');
  return c.body(null, 204);
};

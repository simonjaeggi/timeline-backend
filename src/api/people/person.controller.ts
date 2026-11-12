import type { RouteHandler } from '@hono/zod-openapi';
import { getAuthUser } from '../../middleware/auth.middleware.ts';
import { getGroupId } from '../../middleware/group-access.middleware.ts';
import { NotFoundError } from '../../shared/errors.ts';
import type {
  addRelationshipRoute,
  createPersonRoute,
  deletePersonRoute,
  getPersonRoute,
  listPeopleRoute,
  removeRelationshipRoute,
  updatePersonRoute,
} from './person.openapi.ts';
import * as personService from './person.service.ts';

export const listPeople: RouteHandler<typeof listPeopleRoute> = async (c) => {
  const people = await personService.listPeople(
    getGroupId(c),
    c.req.valid('query'),
  );
  return c.json({ people }, 200);
};

export const getPerson: RouteHandler<typeof getPersonRoute> = async (c) => {
  const { personId } = c.req.valid('param');
  const result = await personService.getPerson(getGroupId(c), personId);
  if (!result) throw new NotFoundError('Person');
  return c.json(result, 200);
};

export const createPerson: RouteHandler<typeof createPersonRoute> = async (
  c,
) => {
  const person = await personService.createPerson(
    getGroupId(c),
    getAuthUser(c),
    c.req.valid('json'),
  );
  return c.json({ person }, 201);
};

export const updatePerson: RouteHandler<typeof updatePersonRoute> = async (
  c,
) => {
  const { personId } = c.req.valid('param');
  const person = await personService.updatePerson(
    getGroupId(c),
    personId,
    c.req.valid('json'),
  );
  if (!person) throw new NotFoundError('Person');
  return c.json({ person }, 200);
};

export const deletePerson: RouteHandler<typeof deletePersonRoute> = async (
  c,
) => {
  const { personId } = c.req.valid('param');
  const person = await personService.deletePerson(getGroupId(c), personId);
  if (!person) throw new NotFoundError('Person');
  return c.json({ person }, 200);
};

export const addRelationship: RouteHandler<
  typeof addRelationshipRoute
> = async (c) => {
  const { personId } = c.req.valid('param');
  const relationship = await personService.addRelationship(
    getGroupId(c),
    personId,
    c.req.valid('json'),
  );
  return c.json({ relationship }, 201);
};

export const removeRelationship: RouteHandler<
  typeof removeRelationshipRoute
> = async (c) => {
  const { personId, relationshipId } = c.req.valid('param');
  const relationship = await personService.removeRelationship(
    getGroupId(c),
    personId,
    relationshipId,
  );
  if (!relationship) throw new NotFoundError('Relationship');
  return c.json({ relationship }, 200);
};

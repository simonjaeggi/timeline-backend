import { createRoute, z } from '@hono/zod-openapi';
import {
  errorResponses,
  GROUP_ERRORS,
  GroupParamsSchema,
  json,
  jsonBody,
} from '../../shared/openapi.ts';
import {
  CreatePersonSchema,
  CreateRelationshipSchema,
  ListPeopleQuerySchema,
  PersonParamsSchema,
  PersonSchema,
  RelationshipParamsSchema,
  RelationshipSchema,
  RelationshipViewSchema,
  UpdatePersonSchema,
} from './zod/person.schema.ts';

const tags = ['People'];

export const listPeopleRoute = createRoute({
  method: 'get',
  path: '/groups/{groupId}/people',
  tags,
  summary: 'List the people of a group',
  request: { params: GroupParamsSchema, query: ListPeopleQuerySchema },
  responses: {
    200: json(z.object({ people: z.array(PersonSchema) }), 'People'),
    ...errorResponses(...GROUP_ERRORS),
  },
});

export const createPersonRoute = createRoute({
  method: 'post',
  path: '/groups/{groupId}/people',
  tags,
  summary: 'Add a person (editor)',
  request: { params: GroupParamsSchema, body: jsonBody(CreatePersonSchema) },
  responses: {
    201: json(z.object({ person: PersonSchema }), 'Created person'),
    ...errorResponses(...GROUP_ERRORS),
  },
});

export const getPersonRoute = createRoute({
  method: 'get',
  path: '/groups/{groupId}/people/{personId}',
  tags,
  summary: 'Get a person with their relationships',
  request: { params: PersonParamsSchema },
  responses: {
    200: json(
      z.object({
        person: PersonSchema,
        relationships: z.array(RelationshipViewSchema),
      }),
      'Person',
    ),
    ...errorResponses(...GROUP_ERRORS),
  },
});

export const updatePersonRoute = createRoute({
  method: 'patch',
  path: '/groups/{groupId}/people/{personId}',
  tags,
  summary: 'Update a person (editor)',
  request: { params: PersonParamsSchema, body: jsonBody(UpdatePersonSchema) },
  responses: {
    200: json(z.object({ person: PersonSchema }), 'Updated person'),
    ...errorResponses(...GROUP_ERRORS),
  },
});

export const deletePersonRoute = createRoute({
  method: 'delete',
  path: '/groups/{groupId}/people/{personId}',
  tags,
  summary: 'Delete a person (editor)',
  description: 'Removes their relationships and participations. Entries stay.',
  request: { params: PersonParamsSchema },
  responses: {
    200: json(z.object({ person: PersonSchema }), 'Deleted person'),
    ...errorResponses(...GROUP_ERRORS),
  },
});

export const addRelationshipRoute = createRoute({
  method: 'post',
  path: '/groups/{groupId}/people/{personId}/relationships',
  tags,
  summary: 'Add a relationship (editor)',
  request: {
    params: PersonParamsSchema,
    body: jsonBody(CreateRelationshipSchema),
  },
  responses: {
    201: json(
      z.object({ relationship: RelationshipViewSchema }),
      'Relationship as seen from the person in the URL',
    ),
    ...errorResponses(...GROUP_ERRORS, 409),
  },
});

export const removeRelationshipRoute = createRoute({
  method: 'delete',
  path: '/groups/{groupId}/people/{personId}/relationships/{relationshipId}',
  tags,
  summary: 'Remove a relationship (editor)',
  request: { params: RelationshipParamsSchema },
  responses: {
    200: json(z.object({ relationship: RelationshipSchema }), 'Removed'),
    ...errorResponses(...GROUP_ERRORS),
  },
});

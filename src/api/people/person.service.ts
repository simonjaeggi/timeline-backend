import { DuplicateRecordError } from '../../data/errors.ts';
import { getRepositories } from '../../data/index.ts';
import type { Person, Relationship } from '../../data/models.ts';
import type { AuthUser } from '../../middleware/auth.middleware.ts';
import {
  ConflictError,
  NotFoundError,
  ValidationError,
} from '../../shared/errors.ts';
import type {
  CreatePersonDto,
  CreateRelationshipDto,
  UpdatePersonDto,
} from './zod/person.schema.ts';

/** What the other person is, seen from the person being viewed. */
export type Relation = 'parent' | 'child' | 'partner' | 'sibling' | 'other';

export type PersonSummary = Pick<
  Person,
  'id' | 'firstName' | 'lastName' | 'nickname'
>;

export type RelationshipView = {
  id: number;
  relation: Relation;
  label: string | null;
  person: PersonSummary;
};

const SYMMETRIC_TYPES = new Set<Relationship['type']>(['partner', 'sibling']);

function toSummary(person: Person): PersonSummary {
  return {
    id: person.id,
    firstName: person.firstName,
    lastName: person.lastName,
    nickname: person.nickname,
  };
}

/**
 * Turns a stored relationship into the view of one of its two people.
 * Stored: `personId` is <type> of `relatedPersonId`.
 * @param relationship stored relationship
 * @param viewerId person whose point of view is used
 * @returns The other person's id and what they are to the viewer.
 */
export function describeRelationship(
  relationship: Relationship,
  viewerId: number,
): { otherPersonId: number; relation: Relation } {
  const outgoing = relationship.personId === viewerId;
  const otherPersonId = outgoing
    ? relationship.relatedPersonId
    : relationship.personId;

  if (relationship.type === 'parent') {
    return { otherPersonId, relation: outgoing ? 'child' : 'parent' };
  }

  return { otherPersonId, relation: relationship.type };
}

async function toRelationshipViews(
  groupId: number,
  viewerId: number,
  relationships: Relationship[],
): Promise<RelationshipView[]> {
  const described = relationships.map((relationship) => ({
    relationship,
    ...describeRelationship(relationship, viewerId),
  }));

  const others = await getRepositories().people.findManyByIds(
    groupId,
    described.map((item) => item.otherPersonId),
  );
  const othersById = new Map(others.map((person) => [person.id, person]));

  return described.flatMap(({ relationship, otherPersonId, relation }) => {
    const other = othersById.get(otherPersonId);
    if (!other) return [];

    return [
      {
        id: relationship.id,
        relation,
        label: relationship.label,
        person: toSummary(other),
      },
    ];
  });
}

/**
 * Lists the people of a group, optionally filtered by name.
 */
export async function listPeople(
  groupId: number,
  options: { q?: string } = {},
): Promise<Person[]> {
  return getRepositories().people.list(groupId, options);
}

/**
 * Returns a person with their relationships.
 * @returns Person and relationships, null if the person does not exist.
 */
export async function getPerson(
  groupId: number,
  personId: number,
): Promise<{ person: Person; relationships: RelationshipView[] } | null> {
  const repositories = getRepositories();
  const person = await repositories.people.findById(groupId, personId);
  if (!person) return null;

  const relationships = await repositories.relationships.listForPerson(
    groupId,
    personId,
  );

  return {
    person,
    relationships: await toRelationshipViews(groupId, personId, relationships),
  };
}

export async function createPerson(
  groupId: number,
  user: AuthUser,
  input: CreatePersonDto,
): Promise<Person> {
  return getRepositories().people.create({
    ...input,
    groupId,
    createdBy: user.id,
  });
}

/**
 * Updates a person. Validates birth and death date against stored values.
 * @returns Updated person, null if not found.
 * @throws {ValidationError} death date before birth date
 */
export async function updatePerson(
  groupId: number,
  personId: number,
  input: UpdatePersonDto,
): Promise<Person | null> {
  const repositories = getRepositories();
  const existing = await repositories.people.findById(groupId, personId);
  if (!existing) return null;

  const birthDate =
    input.birthDate === undefined ? existing.birthDate : input.birthDate;
  const deathDate =
    input.deathDate === undefined ? existing.deathDate : input.deathDate;

  if (birthDate && deathDate && deathDate < birthDate) {
    throw new ValidationError('Death date cannot be before the birth date.', [
      {
        path: 'deathDate',
        message: 'Death date cannot be before the birth date.',
      },
    ]);
  }

  return repositories.people.update(groupId, personId, input);
}

/**
 * Deletes a person. Their relationships and entry participations go with them,
 * the entries themselves stay.
 */
export async function deletePerson(
  groupId: number,
  personId: number,
): Promise<Person | null> {
  return getRepositories().people.delete(groupId, personId);
}

/**
 * Adds a relationship from the person to another person of the group.
 * @returns Relationship as seen from `personId`.
 * @throws {ValidationError} relationship to self
 * @throws {NotFoundError} one of the people does not exist in the group
 * @throws {ConflictError} relationship (or its reverse parent link) exists
 */
export async function addRelationship(
  groupId: number,
  personId: number,
  input: CreateRelationshipDto,
): Promise<RelationshipView> {
  if (input.relatedPersonId === personId) {
    throw new ValidationError('A person cannot be related to themselves.');
  }

  const repositories = getRepositories();
  const people = await repositories.people.findManyByIds(groupId, [
    personId,
    input.relatedPersonId,
  ]);
  if (people.length !== 2) {
    throw new NotFoundError('Person');
  }

  let from = personId;
  let to = input.relatedPersonId;

  // Symmetric relationships are stored once, lower id first.
  if (SYMMETRIC_TYPES.has(input.type) && from > to) {
    [from, to] = [to, from];
  }

  if (input.type === 'parent') {
    const reverse = await repositories.relationships.find(
      groupId,
      to,
      from,
      'parent',
    );
    if (reverse) {
      throw new ConflictError(
        'The related person is already a parent of this person.',
      );
    }
  }

  try {
    const relationship = await repositories.relationships.create({
      groupId,
      personId: from,
      relatedPersonId: to,
      type: input.type,
      label: input.label ?? null,
    });

    const [view] = await toRelationshipViews(groupId, personId, [relationship]);
    if (!view) throw new Error('Created relationship could not be read.');
    return view;
  } catch (error) {
    if (error instanceof DuplicateRecordError) {
      throw new ConflictError('Relationship already exists.');
    }
    throw error;
  }
}

/**
 * Removes a relationship involving the person.
 * @returns Removed relationship, null if not found for this person.
 */
export async function removeRelationship(
  groupId: number,
  personId: number,
  relationshipId: number,
): Promise<Relationship | null> {
  const repositories = getRepositories();
  const relationships = await repositories.relationships.listForPerson(
    groupId,
    personId,
  );

  if (
    !relationships.some((relationship) => relationship.id === relationshipId)
  ) {
    return null;
  }

  return repositories.relationships.delete(groupId, relationshipId);
}

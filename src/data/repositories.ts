import type {
  AccessCode,
  AppRole,
  GroupMember,
  GroupMembership,
  GroupRole,
  NewAccessCode,
  User,
  UserGroup,
  Entry,
  EntryFilter,
  EntryUpdate,
  EntryWithParticipants,
  Group,
  GroupUpdate,
  NewEntry,
  NewGroup,
  NewParticipant,
  NewPerson,
  NewRelationship,
  Page,
  PageRequest,
  Person,
  PersonUpdate,
  Relationship,
} from './models.ts';

/**
 * Data access contracts. A database driver (see `postgres/`) implements these.
 * Rules of thumb for implementations:
 * - "not found" is returned as null, never thrown
 * - constraint violations are translated into the errors in `data/errors.ts`
 * - every group-scoped method filters by groupId, so a leaked id from another
 *   group never resolves
 */

export interface UserRepository {
  list(): Promise<User[]>;
  findById(id: string): Promise<User | null>;
  countAdmins(): Promise<number>;
  setRole(id: string, role: AppRole): Promise<User | null>;
  /** Deletes the account, its sessions, logins and memberships. */
  delete(id: string): Promise<User | null>;
}

export interface MembershipRepository {
  listGroupsForUser(userId: string): Promise<UserGroup[]>;
  listForGroup(groupId: number): Promise<GroupMember[]>;
  find(groupId: number, userId: string): Promise<GroupMembership | null>;
  /** Creates the membership or replaces the role of an existing one. */
  upsert(
    groupId: number,
    userId: string,
    role: GroupRole,
  ): Promise<GroupMembership>;
  delete(groupId: number, userId: string): Promise<GroupMembership | null>;
}

export type RedeemAccessCode = {
  codeHash: string;
  email: string;
  /** Null while the account is still being created. */
  userId: string | null;
  now: Date;
};

export interface AccessCodeRepository {
  /** Newest first. */
  list(): Promise<AccessCode[]>;
  create(input: NewAccessCode): Promise<AccessCode>;
  findByHash(codeHash: string): Promise<AccessCode | null>;
  /**
   * Atomically marks the code as redeemed if it is unused, not revoked, not
   * expired and (if bound) matches the email. Returns null otherwise, which
   * makes double use impossible even with concurrent requests.
   */
  redeem(input: RedeemAccessCode): Promise<AccessCode | null>;
  /** Finds a code redeemed during sign-up that has no user attached yet. */
  findPendingSignUp(
    codeHash: string,
    email: string,
  ): Promise<AccessCode | null>;
  attachUser(id: number, userId: string): Promise<void>;
  revoke(id: number, now: Date): Promise<AccessCode | null>;
  hasInitialCode(): Promise<boolean>;
}

export interface GroupRepository {
  list(): Promise<Group[]>;
  findById(id: number): Promise<Group | null>;
  create(input: NewGroup): Promise<Group>;
  update(id: number, input: GroupUpdate): Promise<Group | null>;
  /** Deletes the group and everything in it. */
  delete(id: number): Promise<Group | null>;
}

export interface PersonRepository {
  list(
    groupId: number,
    options?: { q?: string; limit?: number },
  ): Promise<Person[]>;
  findById(groupId: number, id: number): Promise<Person | null>;
  findManyByIds(groupId: number, ids: number[]): Promise<Person[]>;
  create(input: NewPerson): Promise<Person>;
  update(
    groupId: number,
    id: number,
    input: PersonUpdate,
  ): Promise<Person | null>;
  delete(groupId: number, id: number): Promise<Person | null>;
}

export interface RelationshipRepository {
  /** Relationships where the person is on either side. */
  listForPerson(groupId: number, personId: number): Promise<Relationship[]>;
  find(
    groupId: number,
    personId: number,
    relatedPersonId: number,
    type: Relationship['type'],
  ): Promise<Relationship | null>;
  /** @throws {DuplicateRecordError} same relationship exists already */
  create(input: NewRelationship): Promise<Relationship>;
  delete(groupId: number, id: number): Promise<Relationship | null>;
}

export type NewEntryWithParticipants = {
  entry: NewEntry;
  participants: NewParticipant[];
};

export interface EntryRepository {
  /** Ordered by start date, newest first. */
  findPage(
    groupId: number,
    filter: EntryFilter,
    page: PageRequest,
  ): Promise<Page<EntryWithParticipants>>;
  /** Ordered by start date, oldest first. Returns at most `limit` entries. */
  findAll(
    groupId: number,
    filter: EntryFilter,
    limit: number,
  ): Promise<EntryWithParticipants[]>;
  findById(groupId: number, id: number): Promise<EntryWithParticipants | null>;
  create(input: NewEntryWithParticipants): Promise<EntryWithParticipants>;
  /**
   * Creates entries atomically. Entries whose (source, sourceRef) already exists
   * in the group are skipped instead of failing the batch.
   */
  createMany(
    inputs: NewEntryWithParticipants[],
  ): Promise<{ created: EntryWithParticipants[]; skipped: number }>;
  /** When `participants` is given it replaces the current participants. */
  update(
    groupId: number,
    id: number,
    input: EntryUpdate,
    participants?: NewParticipant[],
  ): Promise<EntryWithParticipants | null>;
  delete(groupId: number, id: number): Promise<Entry | null>;
}

export interface Repositories {
  users: UserRepository;
  memberships: MembershipRepository;
  accessCodes: AccessCodeRepository;
  groups: GroupRepository;
  people: PersonRepository;
  relationships: RelationshipRepository;
  entries: EntryRepository;
  /** Throws if the database is unreachable. */
  ping(): Promise<void>;
  close(): Promise<void>;
}

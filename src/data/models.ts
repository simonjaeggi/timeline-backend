/**
 * Database-agnostic domain models.
 * Services and controllers only depend on these types and on the repository
 * interfaces in `repositories.ts`, never on a specific database driver.
 */

export const ENTRY_KINDS = ['activity', 'milestone'] as const;
export type EntryKind = (typeof ENTRY_KINDS)[number];

export const ENTRY_CATEGORIES = [
  'family',
  'education',
  'work',
  'travel',
  'health',
  'hobby',
  'celebration',
  'other',
] as const;
export type EntryCategory = (typeof ENTRY_CATEGORIES)[number];

export const DATE_PRECISIONS = ['day', 'month', 'year'] as const;
export type DatePrecision = (typeof DATE_PRECISIONS)[number];

/** Where an entry came from. Imported entries carry a `sourceRef` for de-duplication. */
export const ENTRY_SOURCES = ['manual', 'text', 'linkedin', 'xing'] as const;
export type EntrySource = (typeof ENTRY_SOURCES)[number];

/**
 * Stored direction: `personId` is <type> of `relatedPersonId`.
 * `partner` and `sibling` are symmetric and stored with the lower id first.
 */
export const RELATIONSHIP_TYPES = [
  'parent',
  'partner',
  'sibling',
  'other',
] as const;
export type RelationshipType = (typeof RELATIONSHIP_TYPES)[number];

/** App-wide role. Admins manage access codes and users and see every group. */
export const APP_ROLES = ['admin', 'user'] as const;
export type AppRole = (typeof APP_ROLES)[number];

/** Role inside one group, ordered from most to least privileged. */
export const GROUP_ROLES = ['owner', 'editor', 'viewer'] as const;
export type GroupRole = (typeof GROUP_ROLES)[number];

/**
 * A login account. Created by the auth library on first sign-in, but only
 * with a valid access code. Not the same as a Person on the timeline.
 */
export type User = {
  id: string;
  name: string;
  email: string;
  image: string | null;
  role: AppRole;
  createdAt: Date;
};

export type GroupMembership = {
  groupId: number;
  userId: string;
  role: GroupRole;
  createdAt: Date;
};

export type GroupMember = GroupMembership & {
  user: Pick<User, 'id' | 'name' | 'email' | 'image'>;
};

export type UserGroup = {
  id: number;
  name: string;
  role: GroupRole;
};

/**
 * One-time code that allows creating an account (or joining a group).
 * Only a hash of the code is stored; `codeHint` keeps the last characters
 * so admins can tell codes apart.
 */
export type AccessCode = {
  id: number;
  codeHint: string;
  groupId: number | null;
  groupRole: GroupRole | null;
  grantsAppRole: AppRole;
  /** If set, only a user with this email can redeem the code. */
  email: string | null;
  isInitial: boolean;
  createdBy: string | null;
  createdAt: Date;
  expiresAt: Date | null;
  redeemedAt: Date | null;
  redeemedByUserId: string | null;
  redeemedByEmail: string | null;
  revokedAt: Date | null;
};

export type NewAccessCode = {
  codeHash: string;
  codeHint: string;
  groupId: number | null;
  groupRole: GroupRole | null;
  grantsAppRole: AppRole;
  email: string | null;
  isInitial: boolean;
  createdBy: string | null;
  expiresAt: Date | null;
};

/** A family or circle of people sharing one timeline. */
export type Group = {
  id: number;
  name: string;
  description: string | null;
  createdBy: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type NewGroup = {
  name: string;
  description?: string | null;
  createdBy?: string | null;
};

export type GroupUpdate = Partial<Pick<NewGroup, 'name' | 'description'>>;

/** A person shown on the timeline. Not a login account. */
export type Person = {
  id: number;
  groupId: number;
  firstName: string;
  lastName: string | null;
  nickname: string | null;
  birthDate: string | null;
  deathDate: string | null;
  color: string | null;
  notes: string | null;
  createdBy: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type NewPerson = {
  groupId: number;
  firstName: string;
  lastName?: string | null;
  nickname?: string | null;
  birthDate?: string | null;
  deathDate?: string | null;
  color?: string | null;
  notes?: string | null;
  createdBy?: string | null;
};

export type PersonUpdate = Partial<Omit<NewPerson, 'groupId' | 'createdBy'>>;

export type Relationship = {
  id: number;
  groupId: number;
  personId: number;
  relatedPersonId: number;
  type: RelationshipType;
  label: string | null;
  createdAt: Date;
};

export type NewRelationship = {
  groupId: number;
  personId: number;
  relatedPersonId: number;
  type: RelationshipType;
  label?: string | null;
};

/** Something that happened, or happens, on the timeline. */
export type Entry = {
  id: number;
  groupId: number;
  kind: EntryKind;
  category: EntryCategory;
  title: string;
  description: string | null;
  startDate: string;
  startPrecision: DatePrecision;
  endDate: string | null;
  endPrecision: DatePrecision | null;
  /** Derived, inclusive last day the entry covers. Used for range queries only. */
  spanEnd: string;
  location: string | null;
  source: EntrySource;
  sourceRef: string | null;
  createdBy: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type EntryParticipant = {
  entryId: number;
  personId: number;
  role: string | null;
};

export type EntryWithParticipants = Entry & {
  participants: EntryParticipant[];
};

export type NewEntry = {
  groupId: number;
  kind: EntryKind;
  category: EntryCategory;
  title: string;
  description: string | null;
  startDate: string;
  startPrecision: DatePrecision;
  endDate: string | null;
  endPrecision: DatePrecision | null;
  spanEnd: string;
  location: string | null;
  source: EntrySource;
  sourceRef: string | null;
  createdBy: string | null;
};

export type EntryUpdate = Partial<
  Omit<NewEntry, 'groupId' | 'source' | 'sourceRef' | 'createdBy'>
>;

export type NewParticipant = {
  personId: number;
  role: string | null;
};

export type EntryFilter = {
  /** Only entries overlapping [from, to]. */
  from?: string;
  to?: string;
  /** Only entries involving at least one of these people. */
  personIds?: number[];
  kinds?: EntryKind[];
  categories?: EntryCategory[];
  /** Case-insensitive match on title and description. */
  q?: string;
};

export type PageRequest = {
  pageNumber: number;
  pageSize: number;
};

export type Page<T> = PageRequest & {
  items: T[];
  total: number;
};

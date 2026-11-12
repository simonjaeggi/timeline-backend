/**
 * Driver-independent data errors. Repository implementations translate their
 * native errors (for example Postgres SQLSTATE codes) into these.
 */
export class DataError extends Error {
  readonly constraint: string | undefined;

  constructor(message: string, constraint?: string) {
    super(message);
    this.name = new.target.name;
    this.constraint = constraint;
  }
}

/** A unique constraint was violated. */
export class DuplicateRecordError extends DataError {
  constructor(constraint?: string) {
    super('Record already exists.', constraint);
  }
}

/** A referenced record (foreign key) does not exist. */
export class MissingReferenceError extends DataError {
  constructor(constraint?: string) {
    super('Referenced record does not exist.', constraint);
  }
}

/** A check constraint was violated. */
export class IntegrityError extends DataError {
  constructor(constraint?: string) {
    super('Data integrity rule violated.', constraint);
  }
}

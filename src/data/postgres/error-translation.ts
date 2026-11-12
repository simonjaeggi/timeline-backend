import {
  DuplicateRecordError,
  IntegrityError,
  MissingReferenceError,
} from '../errors.ts';

type PgErrorFields = { code: string; constraint?: string };

function isPgErrorFields(value: unknown): value is PgErrorFields {
  return (
    typeof value === 'object' &&
    value !== null &&
    'code' in value &&
    typeof (value as { code: unknown }).code === 'string'
  );
}

/**
 * Finds the Postgres error fields. Drizzle wraps driver errors in `cause`,
 * and both node-postgres and PGlite expose `code` and `constraint`.
 */
function findPgError(error: unknown): PgErrorFields | null {
  let current: unknown = error;

  for (let depth = 0; depth < 3 && current; depth += 1) {
    if (isPgErrorFields(current) && /^[0-9A-Z]{5}$/.test(current.code)) {
      return current;
    }
    current = (current as { cause?: unknown }).cause;
  }

  return null;
}

/**
 * Translates Postgres constraint violations into driver-independent data errors.
 * @param error error thrown by the driver
 * @returns The translated error, or the original error if it is not a known violation.
 */
export function translatePostgresError(error: unknown): unknown {
  const pgError = findPgError(error);
  if (!pgError) return error;

  switch (pgError.code) {
    case '23505':
      return new DuplicateRecordError(pgError.constraint);
    case '23503':
      return new MissingReferenceError(pgError.constraint);
    case '23514':
      return new IntegrityError(pgError.constraint);
    default:
      return error;
  }
}

/**
 * Runs a database operation and translates its errors.
 * @param operation database operation
 */
export async function withTranslatedErrors<T>(
  operation: () => Promise<T>,
): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    throw translatePostgresError(error);
  }
}

/**
 * Builds an ILIKE pattern for a substring search, escaping wildcards.
 * @param term user supplied search term
 */
export function containsPattern(term: string): string {
  return `%${term.replace(/[\\%_]/g, (char) => `\\${char}`)}%`;
}

import { z } from '@hono/zod-openapi';

/** Positive integer id, coerced so it works for path and query params. */
export const IdSchema = z.coerce
  .number({ error: 'Id must be a number.' })
  .int('Id must be an integer.')
  .positive('Id must be positive.');

export type Id = z.infer<typeof IdSchema>;

/** Id inside a JSON body (no coercion, documents as integer). */
export const BodyIdSchema = z
  .number({ error: 'Id must be a number.' })
  .int('Id must be an integer.')
  .positive('Id must be positive.');

/** Calendar date without time, `YYYY-MM-DD`. */
export const IsoDateSchema = z.iso
  .date('Date must be in YYYY-MM-DD format.')
  .openapi({ example: '1990-05-12' });

export const PaginationSchema = z.object({
  pageNumber: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(25),
});

export type PaginationDto = z.infer<typeof PaginationSchema>;

/** Free text search term. */
export const SearchTermSchema = z
  .string()
  .trim()
  .min(1, 'Search term must not be empty.')
  .max(200, 'Search term cannot be longer than 200 characters.');

/**
 * Accepts a comma separated query value (`?ids=1,2,3`) and validates each item.
 * @param item schema for a single item
 * @returns Schema producing an array of parsed items.
 */
export function csvList<T extends z.ZodType>(item: T, example = '1,2') {
  return z
    .preprocess(
      (value) =>
        typeof value === 'string'
          ? value
              .split(',')
              .map((part) => part.trim())
              .filter(Boolean)
          : value,
      z.array(item).max(100, 'Too many values in list.'),
    )
    .openapi({ type: 'string', description: 'Comma separated list.', example });
}

/** Optional text field that turns empty strings into null. */
export function nullableText(max: number, label: string) {
  return z
    .string()
    .trim()
    .max(max, `${label} cannot be longer than ${max} characters.`)
    .transform((value) => (value === '' ? null : value))
    .nullable()
    .optional();
}

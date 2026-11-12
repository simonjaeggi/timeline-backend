import { OpenAPIHono, z, type Hook } from '@hono/zod-openapi';
import { ValidationError } from './errors.ts';
import { toErrorIssues } from './validation.ts';
import { IdSchema } from './zod/common.schema.ts';

export const ErrorIssueSchema = z
  .object({ path: z.string(), message: z.string() })
  .openapi('ErrorIssue');

export const ErrorSchema = z
  .object({
    message: z.string(),
    status: z.number().int(),
    issues: z.array(ErrorIssueSchema).optional(),
  })
  .openapi('Error');

/** Date objects in handlers, ISO 8601 strings on the wire. */
export const DateTimeSchema = z
  .date()
  .openapi({ type: 'string', format: 'date-time' });

/** Calendar date on the wire (`YYYY-MM-DD`). */
export const DateStringSchema = z
  .string()
  .openapi({ type: 'string', format: 'date', example: '2024-06-15' });

/** Positive integer path parameter. */
export const IdParamSchema = IdSchema.openapi({
  type: 'integer',
  minimum: 1,
  param: { required: true },
});

export const GroupParamsSchema = z.object({ groupId: IdParamSchema });

/** JSON response or request body helper for route definitions. */
export function json<T extends z.ZodType>(schema: T, description: string) {
  return {
    content: { 'application/json': { schema } },
    description,
  } as const;
}

export function jsonBody<T extends z.ZodType>(schema: T) {
  return {
    content: { 'application/json': { schema } },
    required: true,
  } as const;
}

const ERROR_DESCRIPTIONS = {
  400: 'Invalid input. `issues` lists the failing fields.',
  401: 'Not signed in.',
  403: 'Signed in, but not allowed.',
  404: 'Not found, or not visible to the caller.',
  409: 'Conflicts with the current state.',
  429: 'Too many attempts.',
  501: 'Not implemented yet.',
} as const;

type ErrorStatus = keyof typeof ERROR_DESCRIPTIONS;

/**
 * Error responses for a route definition. Errors are thrown by services and
 * middleware and rendered by the global error handler, always as `Error`.
 */
export function errorResponses<S extends ErrorStatus>(...statuses: S[]) {
  return Object.fromEntries(
    statuses.map((status) => [
      status,
      json(ErrorSchema, ERROR_DESCRIPTIONS[status]),
    ]),
  ) as { [K in S]: ReturnType<typeof json<typeof ErrorSchema>> };
}

/** Routes that need a session and a group membership. */
export const GROUP_ERRORS = [400, 401, 403, 404] as const;

/**
 * Turns request validation failures into our 400 error format.
 */
export const validationHook: Hook<unknown, any, any, any> = (result) => {
  if (!result.success) {
    const issues = toErrorIssues(result.error);
    throw new ValidationError(issues[0]?.message ?? 'Invalid request.', issues);
  }
};

/** Router whose routes appear in the OpenAPI document. */
export function createRouter() {
  return new OpenAPIHono({ defaultHook: validationHook });
}

export type Router = ReturnType<typeof createRouter>;

/** Security requirement for routes that need a session cookie. */
export const SESSION_SECURITY = [{ session: [] }];

import type { Context } from 'hono';
import { z } from '@hono/zod-openapi';
import { ValidationError, type ErrorIssue } from './errors.ts';

/**
 * Converts zod issues into the API error issue format.
 * @param error zod error
 * @returns List of issues with dotted paths.
 */
export function toErrorIssues(error: z.ZodError): ErrorIssue[] {
  return error.issues.map((issue) => ({
    path: issue.path.map(String).join('.'),
    message: issue.message,
  }));
}

/**
 * Parses input with a zod schema.
 * @param schema zod schema
 * @param input untrusted input
 * @param fallbackMessage message used when zod gives none
 * @returns Parsed data.
 * @throws {ValidationError} 400 input invalid
 */
export function parseWith<T extends z.ZodType>(
  schema: T,
  input: unknown,
  fallbackMessage = 'Invalid input.',
): z.output<T> {
  const result = schema.safeParse(input);

  if (!result.success) {
    const issues = toErrorIssues(result.error);
    throw new ValidationError(issues[0]?.message ?? fallbackMessage, issues);
  }

  return result.data;
}

/**
 * Validates the path parameters (including parameters of parent routes).
 * @param c HTTP context
 * @param schema zod schema for the path parameters
 * @returns Parsed parameters.
 * @throws {ValidationError} 400 parameters invalid
 */
export function parseParams<T extends z.ZodType>(
  c: Context,
  schema: T,
): z.output<T> {
  return parseWith(schema, c.req.param(), 'Invalid path parameters.');
}
